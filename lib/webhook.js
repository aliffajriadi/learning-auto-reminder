import axios from 'axios';

// ====================== WEBHOOK REMINDER (VERSI CANTIK + RAPI) ======================

const EMOJI_ARROW = "<a:12562351879610695981:1461627126070378497>";
const EMOJI_TIME = "<a:time:1438376849150447627>";
const EMOJI_SIGNAL = "<a:online:1270230386064101376>";
const EMOJI_LONCENG = "<a:NA_Updates:879246105471230023>";
const EMOJI_KRITIS = "<a:Warn:1462413813310554187>";
const EMOJI_BOOK = "<a:page:1467044874338439228>";
const EMOJI_LINK = "<a:12562351879610695981:1461627126070378497>";
const SEPARATOR = "────────────────────";

/**
 * Format sisa waktu
 * @param {number} remainingHours
 * @returns {string}
 */
function formatRemainingTime(remainingHours) {
    if (remainingHours <= 1) return "Kurang dari 1 jam";
    if (remainingHours < 24) return `${remainingHours} jam lagi`;

    const days = Math.floor(remainingHours / 24);
    const hours = remainingHours % 24;

    if (hours === 0) return `${days} hari lagi`;
    return `${days} hari ${hours} jam lagi`;
}

/**
 * Mengirim reminder ke Discord Webhook dalam 1 pesan (batch)
 * @param {string} webhookUrl - URL Discord Webhook
 * @param {Array} events - Array event yang perlu diingatkan
 */
async function sendWebhookReminder(webhookUrl, events) {
    if (!webhookUrl || !events || events.length === 0) return;

    try {
        const now = Date.now();
        let criticalCount = 0;
        let warningCount = 0;

        const fields = events.map((event, index) => {
            const remainingHours = Math.max(
                0,
                Math.ceil(((event.timesort * 1000) - now) / 3600000)
            );

            const isCritical = remainingHours <= 10;

            if (isCritical) criticalCount++;
            else warningCount++;

            const courseName =
                event.course
                "Mata kuliah tidak diketahui";

            const deadlineText = formatRemainingTime(remainingHours);
            const statusText = isCritical
                ? `${EMOJI_KRITIS} **Status:** Kritis`
                : `${EMOJI_LONCENG} **Status:** Perlu diperhatikan`;

            return {
                name: `${isCritical ? "🚨" : "⏳"} ${index + 1}. ${event.name}`,
                value:
                    `${SEPARATOR}\n` +
                    `${EMOJI_TIME} **Deadline:** ${deadlineText}\n` +
                    `${statusText}\n` +
                    `${EMOJI_BOOK} **Mata Kuliah:** ${courseName}\n` +
                    `${EMOJI_LINK} **Tautan:** [Buka Tugas](${event.url || "#"})\n` +
                    `${SEPARATOR}`,
                inline: false
            };
        });

        const title =
            criticalCount > 0
                ? `🚨 ${criticalCount} Deadline Kritis Terdeteksi`
                : `⏳ ${events.length} Deadline Sedang Mendekat`;

        const description =
            criticalCount > 0
                ? [
                      `**Perhatian! Ada tugas yang hampir habis waktunya.**`,
                      ``,
                      `> ${EMOJI_KRITIS} Deadline kritis: **${criticalCount}**`,
                      `> ${EMOJI_LONCENG} Deadline lainnya: **${warningCount}**`,
                      ``,
                      `Mohon segera dicek dan dikerjakan ya.`
                  ].join("\n")
                : [
                      `**Reminder tugas aktif**`,
                      ``,
                      `> ${EMOJI_LONCENG} Total deadline: **${events.length}**`,
                      `> Silakan cek detail tugas di bawah ini.`
                  ].join("\n");

        const payload = {
            username: "IF C Learning Helper",
            content:
                criticalCount > 0
                    ? "@everyone **Ada deadline yang butuh perhatian segera!**"
                    : null,
            embeds: [
                {
                    title,
                    description,
                    color: criticalCount > 0 ? 0xff3b30 : 0xffb020,
                    fields,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: "IF C IoT Class • Auto reminder setiap 30 menit"
                    }
                }
            ]
        };

        await axios.post(webhookUrl, payload, {
            headers: { "Content-Type": "application/json" }
        });

        console.log(`✅ Webhook berhasil dikirim (${events.length} tugas)`);
    } catch (err) {
        console.error(`❌ Gagal mengirim webhook: ${err.message}`);
    }
}

export { sendWebhookReminder };