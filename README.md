# BIM CREATIVE HUB — AI Social Media & Creative Management Platform

Aplikasi web enterprise terpadu untuk pengelolaan **Digital Marketing, Social Media Management, Content Calendar, Social Media Analytics, Live Schedule, Procurement Pengadaan Barang, Ads Manager, AI Creative Studio (RAG Knowledge Base, Chat Assistant, Trend Research, Script & Storyboard, Image Studio, Prompt Builder, Brand Guard), Design Order Management (ID Card & Banner Cetak), Task & Approval Management, Notification Center, dan Media Library**.

## 1. Struktur Proyek & Paket Deliverable
1. **Single-File Interactive Web Application (`bim_creative_hub.html`)**:
   - Berjalan langsung secara mandiri di Canvas maupun browser modern tanpa membutuhkan instalasi dependensi tambahan.
   - Mendukung penyimpanan persisten otomatis (`localStorage`), pemisahan **Data Demo (`[DATA DEMO]`)** vs **Data Produksi Aktual**, 3 pilihan tema (**Light**, **Dark**, **System**), dan **Automated Test Suite** bawaan.
2. **Full-Stack Production Architecture (`bim_creative_hub_fullstack.zip`)**:
   - `prisma/schema.prisma`: Skema database relasional PostgreSQL lengkap (30 tabel inti dengan indeks, foreign keys, dan dukungan soft-delete `deletedAt`).
   - `src/lib/rbac.ts`: Middleware otorisasi RBAC 3-tier (`MASTER`, `USER`, `GUEST`) dan isolasi query database untuk Tamu Cabang.
   - `src/lib/ai-provider.ts`: Abstraction layer untuk integrasi multi-provider AI (Google Gemini, OpenAI, Anthropic, Stability AI) dan sanitasi Prompt Injection pada dokumen RAG.
   - `app/bim_creative_hub.html`: Salinan lengkap aplikasi frontend interaktif.

## 2. Akun Pengujian Bawaan (RBAC)
Anda dapat beralih antar-role secara instan melalui dropdown **Pilih Sesi Pengguna** di bagian atas layar atau melalui layar Login:
- **MASTER / SUPER ADMIN**: `master@bimcreative.id` / `BimMaster#2026` (Kendali penuh + Master Settings).
- **USER — Social Media Specialist**: `rina.marketing@bimcreative.id` / `BimUser#2026`.
- **USER — Senior Graphic Designer**: `budi.desainer@bimcreative.id` / `BimUser#2026`.
- **USER — Ads & Procurement Officer**: `andi.ops@bimcreative.id` / `BimUser#2026`.
- **TAMU / GUEST — Cabang Surabaya**: `tamu.surabaya@bimcreative.id` / `BimGuest#2026` (Terisolasi hanya pada Order ID Card, Order Banner, Status/Revisi milik Cabang Surabaya, dan Profil).
- **TAMU / GUEST — Cabang Tuban**: `tamu.tuban@bimcreative.id` / `BimGuest#2026` (Terisolasi hanya pada Order milik Cabang Tuban).

## 3. Panduan Deployment Produksi (Next.js + PostgreSQL + S3)
1. Siapkan database PostgreSQL dan variabel lingkungan pada `.env`:
   - `DATABASE_URL="postgresql://user:pass@localhost:5432/bim_creative_hub"`
   - `NEXTAUTH_SECRET="<secret-acak-minimal-32-karakter>"`
   - `AI_PROVIDER_API_KEY="<kunci-api-gemini-atau-openai>"`
   - `S3_BUCKET_URL` & kredensial Object Storage untuk penyimpanan file produksi.
2. Jalankan migrasi Prisma: `npx prisma migrate deploy && npx prisma generate`.
3. Konfigurasikan nama aplikasi, warna brand, batas revisi desain, dan status koneksi provider AI melalui menu **Master Settings**.
