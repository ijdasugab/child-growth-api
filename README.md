# Child Growth API

[![CI](https://github.com/ijdasugab/child-growth-api/actions/workflows/ci.yml/badge.svg)](https://github.com/ijdasugab/child-growth-api/actions/workflows/ci.yml)

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Swagger](https://img.shields.io/badge/API%20Docs-Swagger-85EA2D?logo=swagger&logoColor=black)](http://localhost:3000/docs)

Backend API sederhana untuk MVP aplikasi pertumbuhan anak.

## Overview

Child Growth API adalah backend MVP untuk pencatatan profil anak, pengukuran pertumbuhan, imunisasi, milestone, reminder, relasi orang tua-anak, serta administrasi user berbasis role.

Project ini dibuat dengan pendekatan sederhana dan bertahap agar mudah dikembangkan menjadi aplikasi mobile/web penuh.

## Stack

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL

## Fitur Utama

- Authentication dengan JWT access token dan refresh token yang dirotasi setiap
  dipakai.
- Role user: `SUPER_ADMIN`, `ADMIN`, dan `PARENT`. Tidak ada lagi peran `GUEST`
  otomatis: semua endpoint data anak wajib token.
- Setiap endpoint tulis diperiksa identitas, dan data anak diperiksa lewat
  relasi `user_children`.
- Status gizi dihitung server dari tabel acuan, bukan diterima dari klien.
  Nilai z ikut disimpan di empat kolom.
- Batas 10 percobaan login per 15 menit per akun.
- Relasi user ke children melalui `user_children`.
- Audit trail untuk aktivitas create, update, delete, login, dan logout.
- Measurement history untuk melihat perkembangan anak.
- Master data growth standards, growth status rules, imunisasi, dan milestone.
- Dokumentasi API dengan Swagger UI.

## Perintah

```bash
npm run dev            # server development dengan watch
npm run build          # kompilasi ke dist
npm start              # jalankan hasil build
npm test               # uji perhitungan z-score
npm run typecheck      # periksa tipe src, tests, scripts, prisma
npm run db:seed        # isi data acuan
npm run admin:create   # buat akun admin pertama
npm run prisma:studio  # GUI database
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Salin konfigurasi environment:

   ```bash
   cp .env.example .env
   ```

3. Isi `DATABASE_URL` di `.env` sesuai database PostgreSQL lokal.

4. Buat role dan database PostgreSQL jika belum ada:

   ```bash
   createuser child_growth_user
   createdb child_growth_app -O child_growth_user
   ```

   Jika role perlu password, masuk ke PostgreSQL lalu jalankan:

   ```bash
   psql postgres
   ```

   ```sql
   ALTER USER child_growth_user WITH PASSWORD 'password';
   ```

5. Isi juga `JWT_SECRET`. Server menolak start kalau kosong, masih nilai contoh,
   atau kurang dari 32 karakter:

   ```bash
   openssl rand -hex 32
   ```

   Variabel opsional: `CORS_ORIGINS`, berisi daftar origin yang dipisah koma.
   Kosong berarti tidak ada header CORS, dan itu yang benar untuk produksi
   karena web disajikan dari origin yang sama.

6. Generate Prisma Client dan terapkan migrasi:

   ```bash
   npm run prisma:generate
   npx prisma migrate deploy
   ```

7. Isi data acuan: peran, tipe standar, aturan status, standar pertumbuhan,
   imunisasi, dan milestone. Idempoten, aman dijalankan berulang:

   ```bash
   npm run db:seed
   ```

8. Buat akun admin pertama. Registrasi publik hanya menghasilkan peran `PARENT`,
   jadi akun pengelola dibuat lewat skrip ini:

   ```bash
   npm run admin:create -- --email "emailmu@contoh.com" --password "passwordku" --name "Nama"
   ```

9. Jalankan server development:

   ```bash
   npm run dev
   ```

API berjalan di `http://localhost:3000`.

Dokumentasi API:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`

## Endpoint MVP

- `GET /health`
- `GET /docs`
- `GET /openapi.json`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/admin/roles`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `GET /api/admin/audit-logs`
- `GET /api/children`
- `POST /api/children`
- `GET /api/children/:id`
- `PUT /api/children/:id`
- `DELETE /api/children/:id`
- `POST /api/children/:id/users`
- `GET /api/children/:childId/measurements`
- `POST /api/children/:childId/measurements`
- `GET /api/children/:childId/measurements/history`
- `PUT /api/children/:childId/measurements/:id`
- `DELETE /api/children/:childId/measurements/:id`
- `GET /api/children/:childId/immunizations`
- `POST /api/children/:childId/immunizations`
- `PUT /api/children/:childId/immunizations/:id`
- `GET /api/children/:childId/immunizations/schedule`
- `GET /api/children/:childId/milestones`
- `POST /api/children/:childId/milestones`
- `PUT /api/children/:childId/milestones/:id`
- `GET /api/children/:childId/reminders`
- `POST /api/children/:childId/reminders`
- `PATCH /api/children/:childId/reminders/:id/done`
- `GET /api/master-data/growth-standard-types`
- `GET /api/master-data/growth-standards`
- `GET /api/master-data/immunizations`
- `GET /api/master-data/milestones`
- `GET /api/master-data/growth-status-rules`

## Contoh Request

Register/login dulu untuk mendapatkan bearer token:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Parent User",
    "email": "parent@example.com",
    "password": "password123"
  }'
```

Gunakan `accessToken` dari response:

```bash
curl -X POST http://localhost:3000/api/children \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Alya",
    "gender": "FEMALE",
    "birthDate": "2024-01-15",
    "birthWeightKg": 3.2,
    "birthLengthCm": 49
  }'
```

```bash
curl -X POST http://localhost:3000/api/children/1/measurements \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "measuredAt": "2024-03-15",
    "weightKg": 5.1,
    "heightCm": 57.5,
    "headCircumferenceCm": 39
  }'
```

## Pengujian

20 test, dijalankan dengan `npm test`. Yang diuji: rumus LMS untuk L bukan nol
dan L mendekati nol, interpolasi antar titik SD, ekstrapolasi di luar rentang
beserta batasnya, dan penolakan data acuan yang urutannya rusak.

## CI dan deploy

`.github/workflows/ci.yml` menjalankan `npm ci`, `prisma generate`, `typecheck`,
`test`, dan `build` pada setiap push ke `main` dan setiap pull request.

Deploy dijalankan terpisah, dari sisi server. Skrip di server memeriksa commit
terakhir `main` yang sudah hijau di CI, lalu pull, build, dan restart service.
Commit yang CI-nya belum hijau tidak pernah terpasang. Migrasi Prisma tidak
dijalankan otomatis, supaya migrasi yang salah tidak menimpa data produksi tanpa
cadangan.

## Catatan

Status gizi dihitung server dari tabel acuan, bukan diterima dari klien. Nilai z
disimpan di empat kolom. Peran `GUEST` sudah dihapus: semua endpoint data anak
wajib token, dan endpoint tulis diperiksa identitasnya.
