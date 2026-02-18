# Runa PRO – Bulk HTML Generator (Client-side)

Versi PRO dari tools generator placeholder berbasis browser (tanpa backend).
Fokus: produksi massal HTML + ZIP, dengan fitur tambahan untuk workflow konten skala besar.

## Fitur Utama
- Multi-template (upload beberapa template, rotasi per artikel / random)
- Import CSV (judul, link, gambar, artikel, folder opsional)
- Related/internal linking generator (auto bikin daftar tautan terkait)
- Output folder (silo) berdasarkan kolom `folder` atau path link
- Report output: `report.json` + `manifest.csv` di dalam ZIP
- Preview file pertama + validasi placeholder + strict integrity check opsional

## Placeholder default
- `*JUDUL*`
- `*LINK*`
- `*GAMBAR*`
- `*ARTIKEL*`
- (opsional) `*RELATED*`  → akan diisi daftar internal links (jika diaktifkan)

Disarankan gunakan placeholder unik seperti `{{JUDUL}}` agar aman.

## CSV format (header wajib)
Kolom minimal:
- title
- link
- image
- article

Opsional:
- folder  (contoh: fase-stabil)
- slug    (override nama file)
- tags    (bebas)

## Cara pakai singkat
1) Upload template (1 atau banyak)
2) Paste data / import CSV
3) Atur advanced options (related links, folder output, strict check)
4) Generate ZIP
