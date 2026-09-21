# 🚀 Deploy GudangPro ke Production — Supabase + Vercel

Panduan lengkap untuk men-deploy sistem manajemen stok gudang menggunakan:
- **Supabase** (database PostgreSQL gratis)
- **Vercel** (hosting Next.js)
- **GitHub** (source code)

**Estimasi waktu: 15-25 menit**

---

## 📋 Prasyarat

1. Akun GitHub → https://github.com
2. Akun Supabase → https://supabase.com (gratis)
3. Akun Vercel → https://vercel.com (gratis)

---

## ✅ Langkah 1: Buat Database Supabase (±3 menit)

1. Buka **https://supabase.com** → Sign Up (bisa pakai GitHub)
2. Klik **New Project**
3. Isi:
   - **Organization**: (buat baru / pilih yang ada)
   - **Project name**: `gudangpro`
   - **Database Password**: buat password kuat (simpan!) — contoh: `GudangPro2026!`
   - **Region**: `Southeast Asia (Singapore)`
4. Klik **Create new project** → tunggu provisioning (±1-2 menit)
5. Setelah selesai, buka **Project Settings → Database**
6. Cari bagian **Connection string** → pilih tab **URI**
7. Salin **Session pooler** atau **Direct connection**:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   atau
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
   ```

> 💡 **Rekomendasi**: gunakan **Session pooler** (port 5432) untuk Vercel serverless.
> Ganti `[PASSWORD]` dengan password database yang Anda buat tadi.
> ⚠️ Jangan gunakan password dengan karakter khusus yang bisa merusak URL (misal `@`, `#`, `:`); jika terpaksa, URL-encode dengan `%40` untuk `@`, dll.

---

## ✅ Langkah 2: Push Source Code ke GitHub (±3 menit)

```bash
cd folder-project-gudangpro

git init
git add .
git commit -m "GudangPro: sistem manajemen stok gudang"
git branch -M main

git remote add origin https://github.com/USERNAME/gudangpro.git
git push -u origin main
```

> Buat repo kosong dulu di github.com → New Repository → nama `gudangpro` → Copy URL di atas.

---

## ✅ Langkah 3: Deploy ke Vercel (±5 menit)

1. Buka **https://vercel.com** → Sign Up dengan GitHub
2. Klik **Add New... → Project**
3. Pilih repo **gudangpro**
4. Framework terdeteksi otomatis: **Next.js** → klik **Deploy**
5. Akan muncul dialog setup → scroll ke **Environment Variables**:

   | Key | Value (contoh) |
   |-----|----------------|
   | `DATABASE_URL` | `postgresql://postgres.xxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
   | `JWT_SECRET` | generate dengan: `openssl rand -base64 32` |

6. Klik **Deploy**
7. Tunggu build selesai (±1-2 menit) → URL: **`https://gudangpro.vercel.app`** 🎉

---

## ✅ Langkah 4: Buat Tabel Database (±2 menit)

### Cara A — Via Vercel Terminal (recommended):

1. Di Vercel project → tab **Settings → Environment Variables** → pastikan `DATABASE_URL` & `JWT_SECRET` ada
2. Buka lokal di komputer Anda:
   ```bash
   npx vercel link
   npx vercel env pull .env.production
   npm install
   npx drizzle-kit push
   ```

### Cara B — Via Supabase SQL Editor (tanpa terminal):

1. Buka Supabase dashboard → Project → **SQL Editor**
2. Klik **New query**
3. Paste SQL di bawah → klik **Run**

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'pic',
  email VARCHAR(150),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Umum',
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  brand VARCHAR(100),
  model VARCHAR(150),
  min_stock INTEGER NOT NULL DEFAULT 10,
  new_stock INTEGER NOT NULL DEFAULT 0,
  return_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type VARCHAR(10) NOT NULL,
  source VARCHAR(10) NOT NULL DEFAULT 'new',
  quantity INTEGER NOT NULL,
  ticket_no VARCHAR(50),
  store_name VARCHAR(150),
  serial_number VARCHAR(150),
  barcode VARCHAR(150),
  asset_status VARCHAR(50),
  item_type VARCHAR(100),
  resi TEXT,
  drive_link TEXT,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(150),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  description TEXT,
  metadata TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS stock_movements_user_idx ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS stock_movements_sn_idx ON stock_movements(serial_number);
CREATE INDEX IF NOT EXISTS stock_movements_barcode_idx ON stock_movements(barcode);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at);
```

---

## ✅ Langkah 5: Registrasi Akun Admin (±1 menit)

1. Buka **https://gudangpro.vercel.app**
2. Klik **"Daftar"** (karena aplikasi bisa dibuka tanpa login, cari tombol "Masuk / Daftar" di sidebar)
3. Isi nama, username, password → **Daftar**
4. User pertama otomatis jadi **Admin** 🎉
5. User berikutnya yang daftar otomatis jadi **PIC**

---

## 📚 Update Aplikasi Setelah Ini

Setiap ada perubahan kode:
```bash
git add .
git commit -m "update fitur"
git push
```
→ Vercel auto-deploy otomatis (production)

---

## 🔧 Troubleshooting Supabase

### Error: "relation users does not exist"
- Tabel belum dibuat → jalankan SQL di Langkah 4B

### Error: "Password authentication failed for user postgres"
- Password di `DATABASE_URL` salah → cek ulang di Supabase (Password Settings / reset password)

### Error: "timeout exceeded when trying to connect"
- Pastikan pakai **Session pooler** (port 5432), bukan Transaction pooler (6543) untuk node-postgres
- Cek kalau project sudah aktif (bukan paused di free tier setelah 7 hari inactive)

### Error: "self signed certificate" / SSL
- Kode sudah otomatis menangani: `ssl: { rejectUnauthorized: false }` aktif jika URL mengandung `supabase.co`
- Pastikan tidak menambah `sslmode=disable` di URL

### Aplikasi blank di Vercel
- Cek Vercel → **Deployments** → log error
- Pastikan `DATABASE_URL` & `JWT_SECRET` ter-set sebelum build

### Free tier Supabase pause
- Free tier database **pause setelah 7 hari tidak aktif**
- Buka dashboard Supabase → "Restore" untuk mengaktifkan lagi (dalam 1 klik)
- Opsional: set webhook/uptime monitor untuk mencegah pause

---

## 📖 Info Tambahan

- **URL permanen**: `https://gudangpro.vercel.app` (tidak pernah kadaluarsa)
- **Custom domain**: bisa tambahkan domain sendiri di Vercel → Settings → Domains
- **Backup data**: Supabase → Database → Backups (untuk paid plan) atau `pg_dump` manual
- **Aplikasi dibuka tanpa login** juga bisa (mode pengunjung), tapi aksi tulis butuh login
