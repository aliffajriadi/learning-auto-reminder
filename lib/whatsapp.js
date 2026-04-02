import axios from "axios";

/**
 * Mengirim reminder deadline ke WhatsApp Group
 * @param {string} grup - Nomor grup WhatsApp (atau nomor pribadi)
 * @param {Array} events - Array event dari Moodle
 * @param {string} apikey - API Key WhatsApp kamu
 * @param {string} url - URL endpoint WhatsApp API
 */
const sendWhatsapp = async (grup, events, apikey, url) => {
    if (!grup || !events || events.length === 0) return;

    try {
        let pesan = `🔔 *REMINDER DEADLINE MOODLE*\n\n`;
        pesan += `Halo! Berikut adalah tugas yang mendekati deadline:\n\n`;
        pesan += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        events.forEach((event, index) => {
            const remainingHours = Math.ceil(((event.timesort * 1000) - Date.now()) / 3600000);

            const status = remainingHours <= 10 
                ? "🚨 *KRITIS - Segera dikerjakan!*"
                : "⏳ *Perlu diperhatikan*";

            pesan += `*${index + 1}. ${event.name}*\n`;
            pesan += `${status}\n`;
            pesan += `⏰ *Sisa Waktu:* ${remainingHours} jam lagi\n`;
            pesan += `📚 *Mata Kuliah:* ${event.course || '-'}\n`;
            pesan += `📅 *Deadline:* ${new Date(event.timesort * 1000).toLocaleString('id-ID')}\n`;
            
            if (event.url) {
                pesan += `🔗 *Link:* ${event.url}\n`;
            }
            
            pesan += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        });

        pesan += `⚠️ *Mohon segera dikerjakan agar tidak terlambat.*\n`;
        pesan += `_Auto Reminder • Learning IF C_`;

        const payload = {
            nomor: grup,
            pesan: pesan
        };

        await axios.post(url, payload, {
            headers: { 
                'x-api-key': apikey,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ WhatsApp reminder berhasil dikirim (${events.length} tugas)`);

    } catch (err) {
        console.error(`❌ Gagal mengirim WhatsApp reminder:`, err.message);
        if (err.response) {
            console.error(`   Status: ${err.response.status} - ${err.response.data}`);
        }
    }
};

export { sendWhatsapp };