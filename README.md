# 📚 Moodle Deadline Reminder Bot

> Bot otomatis untuk memantau deadline tugas dari Moodle dan mengirimkan pengingat ke **Discord** dan **WhatsApp**.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green?logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-ISC-blue)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com)

---

## ✨ Fitur

- 🔐 **Auto Login** — Login otomatis ke Moodle dengan session management & cookie handling
- 📅 **Fetch Deadline** — Mengambil event/tugas dari Moodle Calendar API
- 🔔 **Auto Reminder** — Cek deadline setiap **30 menit** secara otomatis
- ⚠️ **Smart Alert** — Notifikasi tiap event punya 2 level:
  - `48 jam` sebelum deadline → ⏳ Perlu diperhatikan
  - `10 jam` sebelum deadline → 🚨 KRITIS
- 📢 **Discord Webhook** — Kirim notifikasi rich embed ke channel Discord
- 💬 **WhatsApp Group** — Kirim notifikasi teks ke grup WhatsApp via API
- 🎛️ **Filter Mata Kuliah** — Hanya pantau mata kuliah yang relevan
- 🔁 **Auto Re-login** — Jika sesi expired, bot login ulang otomatis
- 🌐 **REST API** — Endpoint untuk query deadline secara manual

---

## 🚀 Cara Penggunaan

### 1. Clone & Install

```bash
git clone https://github.com/aliffajriadi/learning-auto-reminder.git
cd learning-auto-reminder
npm install
```

### 2. Konfigurasi

Salin file contoh config dan sesuaikan isinya:

```bash
cp "config copy.json" config.json
```

Edit `config.json` sesuai kebutuhan (lihat bagian [Konfigurasi](#️-konfigurasi) di bawah).

### 3. Jalankan

```bash
npm start
```

Bot akan langsung berjalan dan otomatis mengecek deadline setiap 30 menit.

---

## ⚙️ Konfigurasi

Buat file `config.json` di root project dengan struktur berikut:

```json
{
  "port": 3874,
  "baseUrl": "https://learning-if.polibatam.ac.id",
  "user": {
    "username": "nim.anda",
    "password": "password_learning"
  },
  "discord": {
    "enabled": true,
    "webhookUrl": "https://discord.com/api/webhooks/ID/TOKEN"
  },
  "whatsapp": {
    "enabled": true,
    "groupId": "ID_GRUP_WHATSAPP",
    "apiUrl": "http://localhost:3000/api/grub",
    "apiKey": "api_key_kamu"
  }
}
```

| Field | Keterangan |
|---|---|
| `port` | Port server Express (default: `3874`) |
| `baseUrl` | URL Moodle kampus kamu |
| `user.username` | Username/NIM Moodle |
| `user.password` | Password Moodle |
| `discord.enabled` | Aktifkan notifikasi Discord (`true`/`false`) |
| `discord.webhookUrl` | URL webhook Discord channel |
| `whatsapp.enabled` | Aktifkan notifikasi WhatsApp (`true`/`false`) |
| `whatsapp.groupId` | ID grup WhatsApp tujuan |
| `whatsapp.apiUrl` | Endpoint API WhatsApp Gateway kamu |
| `whatsapp.apiKey` | API Key untuk autentikasi WhatsApp Gateway |

> **⚠️ Penting:** Jangan commit `config.json` ke repository! File ini sudah ada di `.gitignore`.

---

## 🎛️ Filter Mata Kuliah

Secara default, hanya mata kuliah tertentu yang dipantau. Edit konstanta berikut di `index.js` untuk menyesuaikan:

```js
// Kode mata kuliah yang INGIN dipantau
const ALLOWED_COURSES = [
    "IF419",
    "IF420",
    // tambahkan kode lainnya...
];

// Alias tampilan yang lebih rapi
const MATA_KULIAH_FILTER = {
    "IF419": "Proyek Perangkat Lunak Industri",
    // tambahkan alias lainnya...
};
```

> Kosongkan array `ALLOWED_COURSES` (`[]`) untuk memantau **semua** mata kuliah.

---

## 🌐 API Endpoints

Server berjalan di `http://localhost:3874` (default).

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/upcoming?days=7` | Daftar deadline dalam N hari ke depan |
| `GET` | `/all` | Semua event (30 hari lalu hingga 120 hari ke depan) |
| `GET` | `/health` | Status server |

**Contoh response `/upcoming`:**

```json
{
  "success": true,
  "days_requested": 7,
  "total_upcoming": 3,
  "current_time": "03/04/2026, 09.00.00",
  "upcoming": [
    {
      "id": 12345,
      "name": "Tugas 1 UML Diagram",
      "course": "Proyek Perangkat Lunak Industri",
      "due_date": "04/04/2026, 23.59.00",
      "remaining_days": 2,
      "is_overdue": false,
      "url": "https://moodle.kampus.ac.id/mod/assign/..."
    }
  ]
}
```

---

## 📁 Struktur Proyek

```
moodle-deadline-reminder/
├── index.js              # Entry point — server & scheduler utama
├── lib/
│   ├── webhook.js        # Modul pengiriman ke Discord Webhook
│   └── whatsapp.js       # Modul pengiriman ke WhatsApp Group
├── config.json           # Konfigurasi (jangan di-commit!)
├── config copy.json      # Template konfigurasi
├── previous_events.json  # State tracker event yang sudah diingatkan
├── package.json
└── .gitignore
```

---

## 📦 Dependencies

| Package | Versi | Fungsi |
|---|---|---|
| `axios` | ^1.14.0 | HTTP client untuk request ke Moodle & webhook |
| `axios-cookiejar-support` | ^6.0.5 | Cookie session support untuk axios |
| `tough-cookie` | ^6.0.1 | Cookie jar untuk manajemen sesi login |
| `cheerio` | ^1.2.0 | HTML parser untuk scraping logintoken |
| `node-cron` | ^4.2.1 | Penjadwal otomatis (cek setiap 30 menit) |
| `express` | — | REST API server |

---

## 🔌 WhatsApp Gateway

Bot ini menggunakan WhatsApp API gateway pihak ketiga (self-hosted). Pastikan API Gateway kamu sudah berjalan dan mendukung endpoint berikut:

```
POST /api/grub
Headers: x-api-key: <apiKey>
Body: { "nomor": "<groupId>", "pesan": "<text>" }
```

Rekomendasi: [Baileys](https://github.com/WhiskeySockets/Baileys) atau [WA-Multi-Device](https://github.com/dimaskiddo/go-whatsapp-multidevice-rest).

---

## 🛠️ Development

```bash
# Jalankan langsung
node index.js

# Atau dengan npm
npm start
```

Log akan tampil di terminal, termasuk status login, cek deadline, dan pengiriman notifikasi.

---

## 🤝 Kontribusi

Pull request sangat diterima! Untuk perubahan besar, silakan buka issue terlebih dahulu untuk mendiskusikan apa yang ingin kamu ubah.

1. Fork repository ini
2. Buat branch fitur (`git checkout -b feature/fitur-keren`)
3. Commit perubahan (`git commit -m 'feat: tambah fitur keren'`)
4. Push ke branch (`git push origin feature/fitur-keren`)
5. Buka Pull Request

---

## 📄 Lisensi

Didistribusikan di bawah lisensi **ISC**. Lihat file `LICENSE` untuk informasi lebih lanjut.

---

<p align="center">Made for Polibatam Student</p>
