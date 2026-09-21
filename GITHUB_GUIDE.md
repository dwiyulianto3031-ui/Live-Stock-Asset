# 📌 Panduan Langkah 2: Push Source Code ke GitHub

Bagian ini menjelaskan **3 cara** mengupload kode proyek GudangPro ke GitHub.
Pilih salah satu yang paling mudah untuk Anda.

---

## 🎯 Sebelum Mulai

Yang Anda butuhkan:
1. **Akun GitHub** → daftar di https://github.com (gratis, pakai email)
2. **Source code proyek** — folder berisi file GudangPro (ada `package.json`, folder `src`, dll)

---

## 🟢 CARA A: Upload via Website GitHub (PALING MUDAH — tanpa install apa-apa)

Cocok untuk: pemula, tidak mau install Git & terminal

### Langkah A1 — Buat Repository Baru
1. Buka https://github.com → Login
2. Klik tombol **+** di pojok kanan atas → pilih **New repository**
3. Isi:
   - **Repository name**: `gudangpro`
   - **Description** (opsional): `Sistem manajemen stok gudang`
   - Pilih **Public** (bisa juga Private, Vercel tetap bisa akses)
   - **JANGAN** centang "Add a README file" (biarkan kosong!)
4. Klik **Create repository**

### Langkah A2 — Upload File
1. Di halaman repo yang baru dibuat, klik link **"uploading an existing file"**
2. Drag & drop **SEMUA file proyek** ke area upload, KECUALI:
   - ❌ folder `node_modules`
   - ❌ folder `.next`
   - ❌ file `.env` (berisi password lokal, jangan diupload!)
   - ✅ file `.env.example` boleh diupload
   - ✅ `vercel.json`, `DEPLOYMENT.md`, `package.json`, folder `src`, dll WAJIB
3. Scroll bawah → di kolom **"Commit changes"** ketik: `GudangPro v1`
4. Klik tombol hijau **Commit changes** / **Commit and push**

> ⚠️ **Catatan penting**: Upload lewat web hanya bisa pakai **drag & drop folder per folder**.
> Karena itu cara B (terminal) biasanya lebih praktis untuk proyek banyak file.

### Langkah A3 — Cek
- Buka repo → pastikan file `package.json` dan folder `src` terlihat
- Selesai! Lanjut ke Langkah 3 (Vercel)

---

## 🔵 CARA B: Git CLI di Terminal (STANDAR — recommended)

Cocok untuk: punya terminal, atau mau cara profesional

### Langkah B1 — Install Git (jika belum)
- **Windows**: download dari https://git-scm.com → install (klik Next terus)
- **Mac**: buka Terminal → ketik `git --version` → jika belum ada, install via Xcode Command Line Tools
- **Linux**: `sudo apt install git`

Cek berhasil:
```bash
git --version
```
Harus muncul: `git version 2.x.x`

### Langkah B2 — Buka Terminal di Folder Proyek
- **Windows**: buka folder proyek → klik kanan → **Git Bash Here**
- **Mac/Linux**: buka Terminal → `cd path/ke/folder/proyek`

### Langkah B3 — Konfigurasi Identitas (sekali saja)
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"
```

### Langkah B4 — Buat Repo di GitHub Dulu
1. Buka https://github.com → **+** → **New repository**
2. Nama: `gudangpro` → **Public** → **Create repository**
3. Setelah dibuat, halaman akan menampilkan URL seperti:
   ```
   https://github.com/USERNAME/gudangpro.git
   ```
   (ganti USERNAME dengan username GitHub Anda)

### Langkah B5 — Inisialisasi & Upload
Jalankan perintah berikut **satu per satu** di terminal (folder proyek):

```bash
# 1. Inisialisasi git
git init

# 2. Tambahkan semua file (kecuali yang ada di .gitignore)
git add .

# 3. Commit
git commit -m "GudangPro v1: sistem manajemen stok gudang"

# 4. Rename branch utama jadi main
git branch -M main

# 5. Hubungkan ke repo GitHub
#    GANTI USERNAME dengan username GitHub Anda!
git remote add origin https://github.com/USERNAME/gudangpro.git

# 6. Upload
git push -u origin main
```

### Langkah B6 — Saat Diminta Login
- Muncul jendela login GitHub → login dengan akun Anda
- **Cara modern (2024+)**: saat push, GitHub meminta **token** bukan password
  1. Buka https://github.com/settings/tokens
  2. Klik **Generate new token** → **Generate new token (classic)**
  3. Centang scope **repo** → Generate → **COPY token** (hanya muncul sekali!)
  4. Saat terminal minta password, tempel token tersebut
- Alternatif: install **GitHub CLI** (`winget install GitHub.cli`) lalu `gh auth login` — lebih mudah

### Langkah B7 — Cek
```bash
# Harus muncul daftar file yang terupload
git status
```
Buka repo di browser → file sudah ada → lanjut Langkah 3

---

## 🟣 CARA C: GitHub Desktop (Aplikasi GUI)

Cocok untuk: tidak suka terminal, masih mau cara git

1. Download & install **GitHub Desktop**: https://desktop.github.com
2. Login dengan akun GitHub
3. **File → Add local repository** → pilih folder proyek
4. Di aplikasi:
   - Kolom **Summary**: `GudangPro v1`
   - Klik **Commit to main**
5. Klik tombol **Publish repository** (kanan atas)
6. Isi nama repo: `gudangpro` → uncheck "Keep this code private" jika mau public → **Publish**
7. Selesai → repo sudah di GitHub

---

## ❓ Pertanyaan Umum

### "Kenapa node_modules tidak diupload?"
`node_modules` berisi ribuan file dependensi (~200MB). Di Vercel, dependensi **diinstall otomatis** dari `package.json`, jadi tidak perlu diupload. File `.gitignore` sudah mengaturnya.

### ".env tidak diupload, apakah aman?"
Aman & benar. File `.env` berisi password database lokal. Untuk Vercel, environment variable diisi **langsung di dashboard Vercel** (Langkah 3). Template `.env.example` sudah disediakan.

### "Error: remote origin already exists"
Repo sudah pernah dihubungkan. Solusi:
```bash
git remote remove origin
git remote add origin https://github.com/USERNAME/gudangpro.git
```

### "Error: failed to push some refs"
Repo GitHub sudah ada isinya (misal README). Solusi:
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### "Error: Authentication failed"
Password yang diminta bukan password akun, tapi **Personal Access Token** (lihat Langkah B6).

### "Sudah pernah push lokal ke repo kosong, tapi file tidak muncul di github.com"
Cek: `git remote -v` harus menampilkan URL repo Anda, lalu `git push -u origin main`.

---

## ✅ Checklist Setelah Langkah 2

- [ ] Repo `gudangpro` ada di github.com
- [ ] Di dalamnya terlihat: `src/`, `package.json`, `vercel.json`
- [ ] Tidak ada `node_modules`, `.next`, `.env`
- [ ] Lanjut ke **Langkah 3: Deploy ke Vercel**
