import express from 'express';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';
import cron from 'node-cron';

import { sendWebhookReminder } from './lib/webhook.js';
import { sendWhatsapp } from './lib/whatsapp.js';

const app = express();

// ====================== LOAD CONFIG ======================
let config;
try {
    const configData = fs.readFileSync('config.json', 'utf8');
    config = JSON.parse(configData);
} catch (err) {
    console.error('❌ config.json tidak ditemukan atau rusak');
    process.exit(1);
}

const PORT = config.port || 3874;
const BASE_URL = (config.baseUrl || '').replace(/\/$/, '');
const USERNAME = config.user.username;
const PASSWORD = config.user.password;

const WEBHOOK_URL = config.discord.webhookUrl;
const USING_WEBHOOK = config.discord.enabled;

const WHATSAPP_GRUB = config.whatsapp.groupId;
const WHATSAPP_URL = config.whatsapp.apiUrl;
const WHATSAPP_APIKEY = config.whatsapp.apiKey;
const USING_WHATSAPP = config.whatsapp.enabled;

if (!BASE_URL || !USERNAME || !PASSWORD) {
    console.error('❌ baseUrl, username, atau password belum diisi di config.json');
    process.exit(1);
}

// ====================== FILTER MATA KULIAH ======================
const ALLOWED_COURSES = ["IF419", "IF420", "IF421", "IF423", "IF424", "IF422", "IoT", "PK4IF"];

const MATA_KULIAH_FILTER = {
    "IF419": "Proyek Perangkat Lunak Industri",
    "IF424": "Bahasa Inggris untuk Bisnis",
    "IF421": "Instalasi dan Perawatan Perangkat Lunak",
    "IF423": "K3",
    "IoT": "Internet of Things",
    "PK4IF": "Pendidikan Bahasa Indonesia",
    "IF422": "Pengujian Perangkat Lunak",
};

// ====================== AXIOS + SESSION ======================
let jar = new CookieJar();
let client = createClient();
let isLoggedIn = false;
let lastSesskey = null;
let lastSesskeyTime = 0;

function createClient() {
    return wrapper(
        axios.create({
            jar,
            withCredentials: true,
            timeout: 15000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        })
    );
}

function resetSession() {
    jar = new CookieJar();
    client = createClient();
    isLoggedIn = false;
    lastSesskey = null;
    lastSesskeyTime = 0;
}

function looksLikeLoggedIn(html) {
    if (!html || typeof html !== 'string') return false;
    return (
        html.includes('/login/logout.php') ||
        html.includes('data-userid=') ||
        html.includes('"sesskey":"') ||
        html.includes('id="nav-drawer"') ||
        html.includes('/my/') ||
        html.includes('Dashboard')
    );
}

// ====================== LOGIN ======================
async function login(force = false) {
    if (isLoggedIn && !force) return;

    console.log('🔑 Login ke Moodle...');
    const loginUrl = `${BASE_URL}/login/index.php`;

    const getRes = await client.get(loginUrl);
    const html = getRes.data || '';
    const $ = cheerio.load(html);
    const logintoken = $('input[name="logintoken"]').val();

    if (!logintoken) {
        if (looksLikeLoggedIn(html)) {
            isLoggedIn = true;
            console.log('✅ Session masih aktif');
            return;
        }
        throw new Error('Gagal mendapatkan logintoken');
    }

    const payload = new URLSearchParams({
        username: USERNAME,
        password: PASSWORD,
        logintoken
    });

    const postRes = await client.post(loginUrl, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const postHtml = postRes.data || '';
    const loginFailed = postHtml.includes('loginerrors') || postHtml.includes('invalidlogin');

    if (loginFailed) {
        throw new Error('Login gagal. Periksa username/password');
    }

    isLoggedIn = true;
    console.log('✅ Login berhasil');
}

// ====================== GET SESSKEY ======================
async function getSesskey() {
    await login();

    const now = Date.now();
    if (lastSesskey && (now - lastSesskeyTime < 10 * 60 * 1000)) return lastSesskey;

    const dashboard = await client.get(`${BASE_URL}/my/`);
    const html = dashboard.data || '';
    const $ = cheerio.load(html);

    const sesskey = $('input[name="sesskey"]').val() ||
                    html.match(/"sesskey":"([a-zA-Z0-9]+)"/)?.[1] ||
                    html.match(/sesskey=([a-zA-Z0-9]+)/)?.[1];

    if (!sesskey) throw new Error('Gagal mendapatkan sesskey');

    lastSesskey = sesskey;
    lastSesskeyTime = now;
    return sesskey;
}

// ====================== CALL MOODLE AJAX ======================
async function callCalendarApi({ timesortfrom, timesortto, limitnum = 50, retry = true }) {
    try {
        const sesskey = await getSesskey();

        const url = `${BASE_URL}/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`;

        const payload = [{
            index: 0,
            methodname: 'core_calendar_get_action_events_by_timesort',
            args: {
                aftereventid: 0,
                limitnum,
                timesortfrom,
                timesortto,
                limittononsuspendedevents: true
            }
        }];

        const res = await client.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const item = res.data?.[0];
        if (!item || item.error) throw new Error(item?.exception?.message || 'Moodle error');

        return item.data?.events || [];
    } catch (err) {
        if (retry) {
            console.log('⚠️ Session bermasalah, login ulang...');
            resetSession();
            await login(true);
            return callCalendarApi({ timesortfrom, timesortto, limitnum, retry: false });
        }
        throw err;
    }
}

// ====================== FETCHERS ======================
async function fetchUpcomingEvents() {
    const now = Math.floor(Date.now() / 1000);
    return callCalendarApi({ timesortfrom: now, timesortto: now + (86400 * 120), limitnum: 50 });
}

// ====================== FORMAT EVENT ======================
function formatEvent(e) {
    // Ambil course code
    let courseCode = e.course?.shortname || e.course || '-';

    // Ganti dengan nama alias jika ada di filter
    let courseName = MATA_KULIAH_FILTER[courseCode] || courseCode;

    return {
        id: e.id,
        name: e.name.replace(/ is due$/i, '').trim(),
        course: courseName,                    // ← Nama course sudah diganti
        due_date: new Date(e.timesort * 1000).toLocaleString('id-ID'),
        remaining_days: Math.ceil((e.timesort - Date.now()) / 86400),
        is_overdue: e.timesort < Date.now(),
        url: e.url
    };
}

// ====================== AUTO REMINDER ======================
const remindedEvents = new Set();

async function checkDeadlines() {
    try {
        console.log('\n🔍 [REMINDER] Memeriksa deadline tugas...');
        let events = await fetchUpcomingEvents();

        const eventsToRemind = [];

        for (const e of events) {
            const remainingMs = (e.timesort * 1000) - Date.now();
            if (remainingMs <= 0 || remainingMs > 48 * 60 * 60 * 1000) continue;

            const courseCode = e.course?.shortname || e.course || '';
            if (ALLOWED_COURSES.length > 0 && !ALLOWED_COURSES.includes(courseCode)) continue;

            const remainingHours = Math.ceil(remainingMs / 3600000);
            const is10h = remainingHours <= 10;
            const key = is10h ? `10h_${e.id}` : `48h_${e.id}`;

            if (remindedEvents.has(key)) continue;
            remindedEvents.add(key);

            let cleanName = e.name.replace(/ is due$/i, '').trim();
            let courseName = MATA_KULIAH_FILTER[courseCode] || courseCode;

            eventsToRemind.push({ ...e, name: cleanName, course: courseName });
        }

        if (eventsToRemind.length === 0) {
            console.log('✅ Tidak ada deadline dalam 2 hari untuk mata kuliah yang dipantau.');
            return;
        }

        eventsToRemind.sort((a, b) => a.timesort - b.timesort);

        if (USING_WEBHOOK) await sendWebhookReminder(WEBHOOK_URL, eventsToRemind);
        if (USING_WHATSAPP) await sendWhatsapp(WHATSAPP_GRUB, eventsToRemind, WHATSAPP_APIKEY, WHATSAPP_URL);

    } catch (err) {
        console.error('❌ [REMINDER] Gagal:', err.message);
    }
}

// ====================== ROUTES ======================
app.get('/upcoming', async (req, res) => {
    try {
        const days = parseInt(req.query.days, 10) || 7;
        const now = Math.floor(Date.now() / 1000);

        let events = await fetchUpcomingEvents();

        const upcoming = events
            .filter(e => {
                const remaining = e.timesort - now;
                const courseCode = e.course?.shortname || e.course || '';
                return remaining > 0 && 
                       remaining <= (days * 86400) &&
                       (ALLOWED_COURSES.length === 0 || ALLOWED_COURSES.includes(courseCode));
            })
            .map(e => formatEvent(e));   // Pakai formatEvent yang sudah mengganti nama course

        res.json({
            success: true,
            days_requested: days,
            total_upcoming: upcoming.length,
            current_time: new Date().toLocaleString('id-ID'),
            upcoming: upcoming
        });
    } catch (err) {
        console.error('ERROR /upcoming:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ success: true, status: 'ok', time: new Date().toLocaleString('id-ID') });
});

// ====================== START SERVER ======================
app.listen(PORT, () => {
    console.log(`🚀 Moodle API berjalan di http://localhost:${PORT}`);
    console.log(`→ http://localhost:${PORT}/upcoming?days=7`);
    console.log(`→ http://localhost:${PORT}/health`);

    console.log('\n⏰ Auto reminder diaktifkan');
    cron.schedule('*/30 * * * *', checkDeadlines);
    setTimeout(checkDeadlines, 8000);
});