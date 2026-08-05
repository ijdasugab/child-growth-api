# Child Growth API

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
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

- Authentication dengan JWT access token dan refresh token.
- Role user: `SUPER_ADMIN`, `ADMIN`, dan `PARENT`.
- Relasi user ke children melalui `user_children`.
- Audit trail untuk aktivitas create, update, delete, login, dan logout.
- Measurement history untuk melihat perkembangan anak.
- Master data growth standards, growth status rules, imunisasi, dan milestone.
- Dokumentasi API dengan Swagger UI.

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

5. Muat isi `.env` ke terminal aktif:

   ```bash
   set -a
   source .env
   set +a
   ```

6. Restore schema dan master data ke database PostgreSQL:

   ```bash
   psql "$DATABASE_URL" < "/Users/bagusamudra/Development/Child App/schema.sql"
   psql "$DATABASE_URL" < "/Users/bagusamudra/Development/Child App/master_data.sql"
   ```

7. Generate Prisma Client:

   ```bash
   npm run prisma:generate
   ```

8. Jalankan server development:

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

## Catatan YAGNI

Untuk MVP ini auth sudah memakai JWT sederhana dan refresh token DB. Belum ditambahkan Docker, test suite, atau kalkulasi z-score otomatis. Status pertumbuhan bisa disimpan di measurement dan aturan status tersedia lewat endpoint master data.
