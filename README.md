# Quiz Merdeka — Frontend

Ringkasan singkat
-----------------
Aplikasi frontend untuk "Quiz Merdeka" (Next.js App Router + Tailwind). Frontend ini berkomunikasi dengan backend FastAPI yang berjalan di port 8001 untuk mengambil hasil kuis, mengirim email via Mailry, dan fitur AI.

Struktur penting
----------------
- `app/` — halaman Next.js (termasuk `result.tsx` yang menampilkan hasil kuis).
- `components/` — komponen UI (mis. `TeamModal.tsx`).

Prasyarat
---------
- Node.js (disarankan v18+ atau sesuai `package.json`).
- npm / pnpm / yarn.
- Python 3.11+ (untuk menjalankan backend FastAPI).
- MongoDB yang dapat diakses (atau gunakan URI dev Anda).

Environment (contoh)
--------------------
Beberapa env harus diatur untuk backend. Letakkan di file `backend/.env`:

- `MONGODB_URI` — koneksi MongoDB.
- `API_KEY` — kunci internal untuk proteksi endpoint (opsional tapi direkomendasikan).
- `MAILRY_API_KEY` — API key Mailry (server-side only).
- `MAILRY_API_URL` — URL endpoint Mailry (contoh: `https://api.mailry.co/ext/inbox/send`).
- `MAILRY_EMAIL_ID` — uuid emailId dari Mailry (pengirim/inbox id).
- `FRONTEND_BASE` — base URL frontend (contoh `http://localhost:3000`) — dipakai untuk membangun link hasil di email.
- `OPENAI_API_KEY` / `UNLI_API_KEY` / `LUNOS_API_KEY` — jika backend memakai AI provider.

Menjalankan proyek (development)
-------------------------------
1. Jalankan backend (dari folder `backend`):

```powershell
# buat virtualenv (opsional)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn[standard] pymongo python-dotenv requests
# lalu jalankan
python -m uvicorn main:app --reload --port 8001
```

2. Jalankan frontend (dari folder `frontend`):

```powershell
cd frontend
npm install
npm run dev
```

Buka http://localhost:3000 di browser. Backend default ada di http://localhost:8001.

Build & production
-------------------
- Frontend build:

```powershell
cd frontend
npm run build
npm run start
```

- Backend production: jalankan `uvicorn` tanpa `--reload` dan pertimbangkan menjalankan di process manager (systemd, PM2, atau container).

Mailry (testing)
-----------------
Backend menyertakan endpoint diagnostik untuk menguji payload Mailry (jika hadir):

```
GET /admin/mailry/test?to=you@example.com&emailId=DEBUG_PAYLOAD
```

Endpoint ini akan mengirim payload uji ke `MAILRY_API_URL` dan mengembalikan cuplikan respons provider serta payload yang dikirim (berguna untuk debugging).

Catatan keamanan
---------------
- Simpan semua API key di server/backend; jangan masukkan kunci sensitif ke frontend.
- Pastikan `MAILRY_API_KEY` hanya tersedia di `backend/.env`.

Troubleshooting singkat
----------------------
- Jika halaman `/result` error parsing: pastikan file `frontend/src/app/result.tsx` tidak memiliki tag JSX yang tidak tertutup.
- Jika email gagal (Mailry mengembalikan 500), gunakan endpoint diagnostik untuk melihat payload yang dikirim dan hubungi tim Mailry bila perlu.

Butuh bantuan lebih lanjut?
-------------------------
Kalau mau, saya bisa:
- Tambah contoh `backend/.env.example`.
- Tambah script `requirements.txt` untuk pip.
- Jalankan build dan cek error parsing (JSX) untuk Anda.

Tentang Tim GakTau.Dev
----------------------
Tim GakTau.Dev membangun dan merawat proyek "Quiz Kemerdekaan" — sebuah aplikasi kuis interaktif berbasis AI untuk membantu pelajar dan penggemar sejarah Indonesia memahami peristiwa kemerdekaan dengan cara yang menyenangkan.

Teknologi & Integrasi
- Next.js (App Router)
- React
- Tailwind CSS
- FastAPI (backend)
- MongoDB (penyimpanan hasil & leaderboard)
- unli.dev / lunos.tech (penyedia AI, fallback)
- Mailry (pengiriman email hasil & sertifikat)

Anggota
- Azis Maulana Suhada — Fullstack Developer (GitHub: RAYDENFLY)
- Fahat Fajar Andhika — Support Designer
- Bagus Setiawan — Tester / QC

---
Ringkas: jalankan backend di port 8001 lalu frontend di port 3000. Pastikan env Mailry diisi di `backend/.env` sebelum menguji fitur kirim email.
