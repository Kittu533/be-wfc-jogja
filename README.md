# BE WFC Jogja

Express API untuk frontend `fe-wfc-jogja`. Backend memakai TypeScript, Supabase Postgres untuk data tempat, dan Supabase Storage untuk upload gambar.

## Struktur

- `src/server.ts`: bootstrap server dan storage.
- `src/app.ts`: wiring Express middleware, static uploads, route, dan error handler.
- `src/routes`: mapping URL ke controller.
- `src/controllers`: HTTP layer, hanya baca request dan kirim response.
- `src/services`: business logic tempat, kurasi, auth, upload.
- `src/repositories`: akses data Supabase.
- `src/mappers`: transform dataset mentah ke model admin/public.
- `src/middleware`: auth, CORS, upload, 404/error handler.
- `src/types`: kontrak domain yang dipakai antar-layer.

## Scripts

```bash
npm run dev
npm run check
npm run build
npm run start
```

API default berjalan di `http://localhost:4000`. Token admin default untuk local dev adalah `dev-admin-token`, bisa diganti lewat env `ADMIN_TOKEN`.

## Google Maps Scraper Eksperimen

Scraper kecil tersedia di `scripts/google_maps_scraper.py`. Script ini membuka Google Maps dengan Selenium, mengambil HTML yang sudah dirender, lalu mengekstrak kandidat tempat, link Maps, rating yang terbaca, dan URL image dengan BeautifulSoup.

Install dependency Python:

```bash
python3 -m pip install -r requirements-scraper.txt
```

Jalankan dengan limit aman default 5 tempat:

```bash
python3 scripts/google_maps_scraper.py --query "cafe wfc jogja"
```

Output default tersimpan ke `data/google-maps-scrape.json`. Limit di-hard-cap maksimal 50 dan delay antar aksi minimal 2 detik supaya tidak agresif. Gunakan output ini sebagai kandidat verifikasi manual, bukan data final otomatis.

Untuk hasil filter frontend yang lebih akurat, scrape beberapa intent sekaligus agar backend bisa menandai data dari query asal:

```bash
python3 scripts/google_maps_scraper.py \
  --queries "cafe wifi kencang jogja,cafe murah jogja,cafe colokan jogja,cafe 24 jam jogja,coworking space jogja" \
  --limit 10 \
  --max-scrolls 10
```

Script akan merge tempat duplikat berdasarkan Google Maps place id/link, menyimpan `source_queries`, dan backend memakai sinyal itu untuk filter seperti `Wifi kencang`, `Budget murah`, `Banyak colokan`, dan `Buka 24 jam`.

Secara default output baru akan digabung ke `data/google-maps-scrape.json` lama dan didedupe berdasarkan Google Maps place id/link. Jadi scrape query berbeda akan menambah tempat unik, bukan menduplikasi tempat lama. Kalau ingin menimpa output lama sepenuhnya, pakai `--replace-output`.

Setelah scrape selesai, sinkronkan hasilnya ke Supabase:

```bash
npm run sync:google-maps
```

Backend admin sudah bisa membaca hasil scrape tersebut:

```bash
GET /admin/places/import/google-maps/candidates
POST /admin/places/import/google-maps
```

Body import:

```json
{
  "mapsUrl": "https://www.google.com/maps/place/..."
}
```

Import akan membuat tempat baru sebagai `draft`, mengisi nama, link Maps, rating, koordinat bila terbaca dari URL, image URL, dan catatan admin. Jika kandidat sudah pernah diimport berdasarkan `mapsUrl` atau `slug`, backend mengembalikan item lama agar tidak duplikat.

## Setup Supabase

1. Buat project Supabase.
2. Buka Supabase SQL Editor, jalankan isi `supabase/schema.sql`.
3. Copy `.env.example` ke `.env`.
4. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.
5. Jalankan `npm run dev`.

Backend akan seed data awal dari `data/google-maps-scrape.json` saat tabel `admin_places` masih kosong. Hasil seed dibuat sebagai `draft` agar admin tetap bisa memverifikasi fasilitas WFC sebelum publish.

Catatan keamanan: `SUPABASE_SERVICE_ROLE_KEY` hanya boleh ada di backend. Jangan expose key ini ke frontend.
