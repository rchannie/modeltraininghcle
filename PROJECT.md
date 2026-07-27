# HCLE Navigator — Dokumentasi Proyek

**Dashboard Strategis Ketimpangan Modal Manusia Indonesia berbasis Data Mining**

Aplikasi analitik yang mengolah data panel 34 provinsi Indonesia (2021–2024) untuk
memetakan, menjelaskan, dan mensimulasikan **HCLI** (Human Capital Loss Index).
Terdiri dari pipeline data mining (Python) + dashboard interaktif (web).

> Pipeline mengikuti `Training_Model_HCLI.ipynb`. Notebook itu adalah sumber
> kebenaran metodologi; `model_utils.py` adalah porting-nya untuk dipakai server.

---

## 1. Tujuan Proyek

| Pertanyaan kebijakan | Teknik | Output |
|---|---|---|
| **Di mana** masalahnya? Provinsi mana yang berkarakteristik serupa? | K-Means Clustering | Peta 3 kluster + profil rata-rata |
| **Apa** yang paling berpengaruh? | Regresi panel efek tetap + galat baku terkoreksi klaster | Peringkat koefisien terbaku |
| **Bagaimana jika** kebijakan X dijalankan? | Prediksi kontrafaktual | Simulasi Δ HCLI interaktif |

---

## 2. Dataset

**File:** `data/DATA_PANEL_HCLE_PROVINSI_2021-2024.csv`

- Panel seimbang: 34 provinsi × 4 tahun = **136 observasi**, tidak ada baris terbuang.
- Satu baris = satu provinsi pada satu tahun.

### Variabel

| Kolom | Peran | Deskripsi |
|---|---|---|
| `Provinsi` | Entitas panel | 34 provinsi |
| `Tahun` | Dimensi waktu | 2021–2024 |
| `HCLI` | **Target (Y)** | Human Capital Loss Index, skala 0–1. Makin **kecil makin baik** |
| `NEET` | Prediktor | % pemuda 15–24 tahun di luar sekolah, kerja, dan pelatihan (SDG 8.6.1) |
| `P1` | Prediktor | Indeks Kedalaman Kemiskinan |
| `P2` | Prediktor | Indeks Keparahan Kemiskinan |
| `Internet` | Prediktor | Indikator akses internet rumah tangga |
| `RLS` | Prediktor | Rata-rata Lama Sekolah (tahun) |
| `HLS` | Prediktor | Harapan Lama Sekolah (tahun) |

### Preprocessing (`model_utils.py`)

Konversi numerik memakai `to_num()`, bukan `pd.to_numeric(errors='coerce')` langsung.
Alasannya penting: berkas hasil ekspor Google Sheets memakai **koma sebagai pemisah
desimal**. Kalau langsung di-*coerce*, seluruh kolom jadi `NaN`, lalu `dropna()`
mengosongkan dataframe **tanpa memunculkan pesan galat** — kesalahan yang sulit
terdeteksi. `to_num()` mengganti pemisah desimal lebih dulu, sehingga aman untuk
kedua format.

---

## 3. Metodologi

### 3.0 Audit konstruksi indeks — dijalankan lebih dahulu

Langkah ini menentukan cara membaca seluruh hasil regresi. Pooled OLS tanpa efek
tetap dijalankan, lalu simpangan baku residualnya dibandingkan dengan noise
pembulatan teoretis (`0.01/√12 = 0,00289`, karena HCLI dilaporkan dua desimal).

| Besaran | Nilai |
|---|---|
| Pooled OLS R² (tanpa efek tetap) | 0,9994 |
| SD residual | 0,00291 |
| SD noise pembulatan | 0,00289 |
| Rekonstruksi persis setelah dibulatkan | 131 / 136 baris |

**Kesimpulannya: HCLI adalah kombinasi linear dari keenam prediktornya sendiri.**
Karena itu regresi pada lapis kedua bukan prediksi maupun inferensi kausal,
melainkan **dekomposisi bobot indeks**. R² 0,9912 adalah konsekuensi aritmetika,
bukan capaian model. Yang tetap bermakna adalah presisi rekonstruksinya (RMSE
1,43% dari rentang HCLI). Sisi baiknya, justru karena deterministik, simulasi pada
lapis ketiga bersifat eksak sebagai kalkulator kebijakan.

Dashboard menyampaikan hal ini secara terbuka di kartu "Cara membaca angka di
halaman ini", supaya R² tinggi tidak disalahbaca sebagai kemampuan prediktif.

### 3.1 K-Means Clustering — Segmentasi Wilayah

```
Data      : potongan lintang 2024 (34 provinsi)
Fitur     : NEET, P1, P2, Internet, RLS, HLS  (6 prediktor; HCLI TIDAK dipakai)
Scaling   : StandardScaler (z-score)
Algoritma : KMeans(n_clusters=3, init='k-means++', random_state=42, n_init=25)
```

**HCLI sengaja dikeluarkan** dari fitur clustering supaya bisa berfungsi sebagai
*validasi eksternal*: kalau kluster yang murni dibentuk dari kondisi sosial-ekonomi
ternyata punya tingkat HCLI yang berbeda tajam, segmentasi itu menangkap struktur
nyata, bukan pembagian yang dipaksakan.

**Validasi jumlah kluster.** k tidak ditetapkan di awal, melainkan diuji pada rentang
2–8 lewat metode elbow (inertia) dan skor silhouette. Silhouette memuncak pada k = 3
(0,3389 vs 0,2906 pada k = 2 dan 0,2477 pada k = 4). Kestabilan keanggotaan diuji
dengan 30 benih acak berbeda: Adjusted Rand Index rata-rata **dan** minimum = 1,000,
artinya keanggotaan identik pada seluruh pengulangan.

**Penomoran ulang.** Label K-Means sendiri arbitrer (mengikuti urutan sentroid).
`model_utils.py` menomori ulang kluster menurut HCLI rata-rata, sehingga
**Kluster 1 = kondisi terbaik** dan nomor yang lebih besar = lebih tertinggal.
Tanpa ini, legenda peta tidak punya arti ordinal.

**Profil kluster (rata-rata, data 2024):**

| Kluster | n | NEET | P1 | P2 | Internet | RLS | HLS | **HCLI** |
|---|---|---|---|---|---|---|---|---|
| Kluster 1 | 10 | 16,70 | 0,96 | 0,22 | 3,12 | 10,14 | 13,83 | **0,1820** |
| Kluster 2 | 20 | 21,29 | 1,49 | 0,36 | 2,81 | 9,00 | 13,11 | 0,3250 |
| Kluster 3 | 4 | 28,19 | 3,48 | 1,06 | 2,76 | 10,24 | 13,84 | **0,4525** |

Gradien HCLI bergerak monoton meski indeks itu tidak ikut membentuk kluster —
segmentasinya tervalidasi secara eksternal.

**Temuan yang berlawanan dengan dugaan umum:** Kluster 3 (Aceh, Maluku, Papua,
Papua Barat) justru punya **RLS tertinggi** (10,24 tahun), sementara P1 dan P2-nya
berlipat ganda di atas kelompok lain. Wilayah paling tertinggal bukan wilayah yang
kekurangan sekolah, melainkan wilayah yang penduduknya terlalu miskin untuk
memanfaatkan sekolah yang sudah ada. Sebaliknya Kluster 2 — kelompok terbesar —
justru punya RLS terendah (9,00 tahun) dengan kemiskinan tergolong sedang.

### 3.2 Regresi Panel Efek Tetap

```
Formula : HCLI ~ NEET + P1 + P2 + Internet + RLS + HLS + C(Provinsi)
Estimasi: OLS via statsmodels, DAN varian cov_type='cluster' per Provinsi
Train   : Tahun < 2024  → 102 observasi
Test    : Tahun == 2024 → 34 observasi
Parameter: 40 (6 prediktor + intercept + 33 dummy provinsi)
```

`C(Provinsi)` memberi tiap provinsi intercept sendiri, sehingga karakteristik yang
tidak berubah antarwaktu (geografi, struktur ekonomi, kualitas kelembagaan) terserap
ke dummy. Koefisien dibaca sebagai efek **within-province**.

**Galat baku terkoreksi klaster** dipakai karena observasi dari provinsi yang sama
tidak saling bebas antartahun. Pengabaian hal ini melebih-lebihkan keyakinan
statistik — terbukti pada HLS, yang signifikan pada uji naif (p = 0,032) tetapi
kehilangan signifikansinya setelah dikoreksi (p = 0,094).

**Split train/test bersifat temporal**, bukan acak: model dilatih 2021–2023 lalu
diuji pada 2024. Yang diuji adalah kemampuan memproyeksikan tahun berikutnya.

**Koefisien terbaku.** Rentang keenam variabel berbeda jauh (NEET puluhan, P2 di
bawah 1,5), jadi koefisien mentah tidak setara antarvariabel. Karena modelnya efek
tetap, pembakuan memakai **simpangan baku within-province** — variasi itulah yang
sesungguhnya dipakai model.

| Peringkat | Variabel | Koefisien β | **Terbaku** | p (klaster) | Signifikan |
|---|---|---|---|---|---|
| 1 | **Internet** | −0,15803 | **−0,6437** | < 0,001 | Ya |
| 2 | **NEET** | +0,00560 | +0,2111 | < 0,001 | Ya |
| 3 | **RLS** | −0,03353 | −0,2055 | 0,0012 | Ya |
| 4 | **P2** | +0,08245 | +0,1696 | < 0,001 | Ya |
| 5 | **P1** | +0,03318 | +0,1670 | 0,0002 | Ya |
| 6 | HLS | −0,02100 | −0,0955 | 0,0944 | **Tidak** |

**Pembakuan mengubah peringkat secara berarti.** Berdasar koefisien mentah, P2 ada
di posisi kedua dan NEET di posisi terakhir. Setelah dibakukan, NEET naik ke posisi
kedua dan P2 turun ke keempat — karena NEET bergerak pada rentang puluhan sementara
P2 di bawah 2,5, sehingga koefisien mentah NEET tampak kecil padahal variasi
tahunannya besar.

Dua kesimpulan bertahan setelah pembakuan:
1. **Akses internet tetap pengungkit terkuat** (−0,6437), sekitar **tiga kali lipat**
   pengungkit berikutnya. Infrastruktur digital layak diperlakukan sebagai jalur
   intervensi utama, bukan pelengkap program pendidikan.
2. **Dugaan bahwa kemiskinan ekstrem jauh lebih menentukan daripada kemiskinan luas
   tidak bertahan.** Setelah dibakukan, P2 (0,1696) dan P1 (0,1670) praktis setara.

**Multikolinearitas P1–P2.** Korelasi keduanya 0,985 dengan VIF di atas 50. Uji
ketahanan: mengeluarkan P1 membuat koefisien P2 melonjak dari 0,0824 ke 0,1449 —
keduanya saling menggantikan, sehingga penafsirannya sebaiknya digabung sebagai
satu dimensi kemiskinan.

### 3.3 Evaluasi

| Metrik | Nilai |
|---|---|
| R² uji (2024) | 0,9912 |
| MSE uji | 0,0000866 |
| RMSE uji | 0,00931 (**1,43%** dari rentang HCLI 0,11–0,76) |
| R² latih | 0,9995 |
| R² pooled (pembanding, tanpa efek tetap) | 0,9994 |

Perhatikan baris terakhir: model **tanpa** efek tetap sekalipun sudah mencapai
0,9994. Itu penegasan bahwa R² tinggi di sini bukan capaian model — lihat 3.0.

### 3.4 Simulasi Kontrafaktual

1. Ambil data tahun terakhir sebagai garis dasar (opsional difilter ke satu kluster).
2. Terapkan perubahan persentase: `X_baru = X_lama × (1 + Δ)`.
3. Prediksi ulang dengan model efek tetap.
4. Δ HCLI = rata-rata prediksi skenario − rata-rata prediksi garis dasar.
5. Dekomposisi kontribusi: `impact ≈ β_var × rata-rata(X_var) × Δ`.

**Hasil skenario nasional:**

| Skenario | HCLI baru | Perubahan |
|---|---|---|
| Internet +10% | 0,2505 | −15,5% |
| RLS +10% | 0,2645 | −10,7% |
| NEET −20% | 0,2730 | −7,8% |
| P2 −20% | 0,2897 | −2,2% |
| Paket gabungan | 0,2356 | −20,5% |

**Efektivitas berbeda antarkluster.** Skenario Internet +10% memperbaiki HCLI
Kluster 1 sebesar 27,1%, tetapi hanya 9,8% pada Kluster 3. Wilayah paling tertinggal
justru paling tidak responsif terhadap intervensi digital — konsisten dengan
diagnosis di 3.1: hambatan utamanya kemiskinan ekstrem, sehingga perluasan jaringan
tanpa perbaikan daya beli tidak banyak berubah. Kebijakan digital tunggal berskala
nasional tidak akan bekerja merata.

**Keterbatasan simulasi:**
- **Ceteris paribus** — variabel lain dianggap tetap, padahal kemiskinan dan
  pendidikan saling berkorelasi.
- Belum memvalidasi apakah suatu skenario menghasilkan nilai yang mustahil secara
  empiris (mis. RLS di luar rentang historis).
- Dekomposisi kontribusi adalah **aproksimasi linier**, sehingga jumlahnya tidak
  selalu sama persis dengan Δ HCLI yang diprediksi model. Dashboard menampilkan
  kedua angka berdampingan agar selisihnya terlihat, bukan disembunyikan.

---

## 4. Dashboard

Dua halaman dengan fungsi yang tegas berbeda: halaman 1 untuk **memahami keadaan**,
halaman 2 untuk **menguji keputusan**.

### Prinsip desain

Dashboard ini ditulis dengan CSS sendiri (`app.css`), tanpa framework CSS dari CDN.
Keputusan visualnya mengikuti aturan berikut:

- **Token warna, bukan hex tersebar.** Semua warna berasal dari custom property di
  `app.css`. `chart_manager.js` membacanya lewat `getComputedStyle`, sehingga chart
  dan UI selalu sewarna dan tema gelap cukup diatur di satu tempat.
- **Palet tervalidasi.** Ramp kluster diuji sebagai ramp *ordinal* (satu hue,
  lightness monoton, jarak antar-step memadai, ujung terang tetap terpisah dari
  latar) untuk mode terang dan gelap secara terpisah. Step gelap pada mode gelap
  dinaikkan agar K3 tetap terbaca (2,63:1, bukan 2,15:1).
- **Kluster diwarnai ordinal, bukan kategorikal.** Karena kluster sudah dinomori
  menurut HCLI, urutannya bermakna — jadi satu hue terang→gelap, bukan hue acak
  yang menyiratkan kategori setara.
- **Tidak ada chart dua sumbu-y.** HCLI dan NEET dipisah menjadi dua chart. Menumpuk
  dua skala berbeda pada satu plot menyiratkan korelasi yang tidak ada di data.
- **Tiap chart punya padanan tabel** (tombol "Tampilkan tabel"), sehingga tidak ada
  nilai yang hanya dapat dibaca lewat warna atau hover.
- **Label secukupnya.** Hanya titik akhir dan nilai ekstrem yang diberi label
  langsung; sisanya lewat sumbu dan tooltip.
- **Tema gelap dipilih, bukan dibalik otomatis.** Ikut preferensi OS, dan tombol
  tema menimpanya (tersimpan di `localStorage`).
- **Teks di atas bidang berwarna dipilih dari luminansi bidangnya**
  (`ChartManager.inkOn()`), bukan ditebak per nomor kluster — step yang sama bisa
  terang di satu mode dan gelap di mode lain.
- **Aksen dipakai sekali.** Garis aksen di tepi kartu hanya pada KPI utama, dan
  hanya ada satu hero number per halaman.

### Halaman 1 — Diagnostik (`frontend/index.html`)

Alur bacanya: **ukuran masalah → variabel yang layak digarap → wilayah yang
menggarapnya → arah perubahan.**

Keempat tahap itu diberi penanda bernomor (`.section-label`) supaya urutannya
terbaca, bukan sekadar tumpukan kartu.

| Komponen | Fungsi |
|---|---|
| 4 KPI | HCLI nasional (hero), NEET, jumlah provinsi paling tertinggal, presisi rekonstruksi |
| Sparkline di kartu KPI | Arah 4 tahun tanpa memakai chart penuh; hanya titik akhir yang ditandai |
| Strip proporsi | Sebaran provinsi antarkluster dalam satu baris, terang→gelap |
| Temuan kunci | Satu kalimat paling menentukan, dihitung dari `beta_ranking` (rasio pengungkit teratas terhadap berikutnya) |
| Pengungkit kebijakan | Bar diverging koefisien **terbaku** — arah bar = tanda efek |
| Daftar peringkat | Menerjemahkan bar jadi urutan aksi; menandai variabel yang tidak signifikan |
| Peta kluster | Choropleth, ramp ordinal 3 step, legenda HTML + tabel |
| Profil kluster | Kartu per kluster; diagnosisnya dihitung dari angka, bukan teks tetap |
| Tren HCLI & NEET | Dua chart terpisah, masing-masing satu sumbu |
| Catatan tafsir | Menjelaskan audit 3.0 agar R² tidak disalahbaca |
| Glosarium | Definisi istilah untuk pengguna non-teknis |

### Halaman 2 — Simulasi (`frontend/simulasi.html`)

| Komponen | Fungsi |
|---|---|
| Pemilih wilayah | Nasional atau satu kluster; hint-nya menampilkan profil kluster terpilih |
| 4 slider (−30%…+30%) | NEET, Internet, RLS, P2 — empat jalur intervensi berbeda |
| 4 skenario siap pakai | Internet +10%, NEET −20%, RLS +10%, paket gabungan |
| 3 kartu hasil | HCLI awal → perubahan → HCLI simulasi |
| Chart pergeseran | Dumbbell sebelum→sesudah |
| **Perbandingan antarkluster** | Skenario yang sama dijalankan pada tiap kluster, berbagi satu skala — menampilkan temuan 3.4 secara langsung, bukan lewat teks |
| Kontribusi per variabel | Bar; jadi diverging hanya kalau kontribusinya memang berlawanan arah |

**Kalau server mati, kedua halaman menyatakan datanya tidak tersedia** dan
menonaktifkan simulasi. Versi sebelumnya menampilkan data contoh yang berbeda dari
hasil model — menyesatkan kalau pengguna tidak melihat banner peringatan.

---

## 5. Arsitektur

```
   CSV panel  ──────▶  model_utils.py
   136 baris           • load_and_preprocess_data()  (to_num: desimal koma)
                       • run_all_analysis()
                       │   ├─ audit konstruksi indeks (pooled OLS)
                       │   ├─ validasi k (elbow + silhouette, k=2..8)
                       │   ├─ KMeans (k=3, dinomori ulang menurut HCLI)
                       │   ├─ OLS efek tetap + varian clustered SE
                       │   ├─ koefisien terbaku (SD within-province)
                       │   └─ evaluasi R²/MSE/RMSE
                       • simulasi()
                              │ dihitung SEKALI saat startup
                              ▼
                       app.py — Flask (port 5000)
                              │ JSON
                              ▼
                       frontend/
                         app.css            → design system (token, komponen)
                         chart_manager.js   → semua chart Plotly
                         ui.js              → tema, toast, tabel, format
                         index.html + script.js
                         simulasi.html + script_simulasi.js
```

### Endpoint API

| Method | Endpoint | Response |
|---|---|---|
| GET | `/api/dashboard_data` | `cluster_map_data`, `cluster_profile`, `beta_ranking`, `trend_data`, `validasi_k`, `audit`, `mean_hcli_2024`, `tahun_uji`, `metrics` |
| POST | `/api/run_simulation` | `original_hcli_mean`, `new_hcli_prediction`, `delta_hcli`, `delta_persen`, `contributions`, `wilayah`, `n_provinsi` |
| GET | `/api/geojson` | GeoJSON 38 provinsi (dilayani lokal) |
| GET | `/api/health` | `status`, `model_loaded`, `hcli_mean_2024` |

---

## 6. Struktur File

```
modeltraininghcle/
├── Training_Model_HCLI.ipynb   # sumber kebenaran metodologi
├── app.py                      # Flask API + server frontend
├── model_utils.py              # pipeline (dapat dijalankan standalone)
├── requirements.txt
├── data/
│   └── DATA_PANEL_HCLE_PROVINSI_2021-2024.csv
└── frontend/
    ├── app.css                 # design system
    ├── chart_manager.js        # chart Plotly
    ├── ui.js                   # tema, toast, tabel, format
    ├── index.html / script.js
    ├── simulasi.html / script_simulasi.js
    ├── favicon.svg
    └── data/indonesia-38-provinces.geojson
```

---

## 7. Cara Menjalankan

```bash
pip install -r requirements.txt
python app.py
# buka http://127.0.0.1:5000
```

Untuk melihat hasil analisis di terminal tanpa server:

```bash
python model_utils.py
```

> Jalankan dari direktori root proyek — path CSV bersifat relatif (`data/...`).

---

## 8. Batasan yang Diketahui

**Data**
- 34 provinsi di CSV, sedangkan GeoJSON berisi 38. Empat DOB Papua tampil kosong
  di peta karena datanya belum tersedia untuk periode kajian.
- 136 observasi untuk 40 parameter tergolong padat; rasio obs/param ≈ 2,55,
  sehingga hasil sensitif terhadap perubahan data.

**Metodologi**
- Seluruh temuan **asosiatif**, bukan kausal.
- HCLI tersusun dari prediktornya sendiri — yang terukur adalah bobot dimensi di
  dalam indeks, bukan mekanisme sebab akibat. Validasi eksternal terhadap variabel
  di luar penyusun indeks (mis. PDRB per kapita, angka putus sekolah aktual) belum
  dilakukan dan menjadi agenda pengembangan utama.
- Multikolinearitas P1–P2 membuat kontribusi keduanya tidak dapat dipisahkan.
- Clustering hanya memakai potongan lintang tahun terakhir, sehingga perpindahan
  provinsi antarkluster dari tahun ke tahun tidak terbaca.
- Model adalah OLS dengan dummy, bukan estimator panel khusus (`PanelOLS`), dan
  belum ada uji Hausman untuk membenarkan efek tetap di atas efek acak.
- Analisis berhenti di level provinsi; ketimpangan antarkabupaten tidak terbaca.

**Aplikasi**
- Mengubah CSV butuh restart server (model dihitung sekali saat startup).
- Simulasi belum memvalidasi apakah skenario menghasilkan nilai yang mustahil.

---

## 9. Ringkasan Temuan Utama

1. **HCLI adalah kombinasi linear dari prediktornya** — regresi di sini adalah
   dekomposisi bobot indeks, bukan prediksi. Ini menentukan cara membaca semua
   angka lain, termasuk R² 0,9912.
2. **Akses internet adalah pengungkit terkuat** (terbaku −0,6437), sekitar tiga kali
   lipat pengungkit berikutnya.
3. **Pembakuan mengubah peringkat.** NEET naik dari terakhir ke posisi kedua; P1 dan
   P2 ternyata praktis setara, sehingga dugaan "kemiskinan ekstrem jauh lebih
   menentukan" tidak bertahan.
4. **Ketimpangan terkonsentrasi.** Kluster 3 hanya 4 provinsi dengan HCLI 0,4525
   versus 0,1820 di Kluster 1 — rasio 2,5×.
5. **Wilayah paling tertinggal bukan kekurangan sekolah, melainkan terlalu miskin.**
   RLS Kluster 3 justru tertinggi (10,24 tahun) sementara P1/P2-nya berlipat ganda.
6. **Intervensi digital tidak bekerja merata.** Internet +10% memperbaiki Kluster 1
   sebesar 27,1% tetapi Kluster 3 hanya 9,8% — perlu didahului atau disertai
   perlindungan sosial di wilayah termiskin.
7. **Kondisi nasional membaik konsisten:** HCLI turun dari 0,4029 (2021) ke 0,2979
   (2024), sekitar 26,1% dalam empat tahun.
