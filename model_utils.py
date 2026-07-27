# model_utils.py
# Pipeline HCLE Navigator - mengikuti Training_Model_HCLI.ipynb

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, r2_score, mean_squared_error
import statsmodels.formula.api as smf

FILE = 'data/DATA_PANEL_HCLE_PROVINSI_2021-2024.csv'
CORE = ['NEET', 'P1', 'P2', 'Internet', 'RLS', 'HLS']
TARGET = 'HCLI'
K = 3
SEED = 42
N_INIT = 25


def to_num(s):
    """Konversi kolom teks ke numerik. Menangani desimal koma dan titik ribuan.

    Export Google Sheets memakai koma sebagai pemisah desimal. Kalau langsung
    dilempar ke pd.to_numeric(errors='coerce'), semua nilai jadi NaN lalu
    dropna() mengosongkan dataframe tanpa memunculkan pesan galat.
    """
    return pd.to_numeric(
        s.astype(str)
         .str.strip()
         .str.replace('.', '', regex=False)
         .str.replace(',', '.', regex=False),
        errors='coerce'
    )


# --- 1. LOAD DATA DAN PREPROCESSING ---
def load_and_preprocess_data(file_name=FILE):
    try:
        df = pd.read_csv(file_name)
    except FileNotFoundError:
        raise FileNotFoundError(
            f"File data tidak ditemukan di: {file_name}. "
            "Pastikan file ada di folder 'data/'."
        )

    df.columns = ['Provinsi', 'Tahun', 'NEET', 'P1', 'P2',
                  'Internet', 'RLS', 'HLS', TARGET]

    for c in CORE + [TARGET]:
        if not pd.api.types.is_numeric_dtype(df[c]):
            df[c] = to_num(df[c])

    return df.dropna(subset=CORE + [TARGET]).reset_index(drop=True)


# --- 2. FUNGSI UTAMA: MENGHITUNG SEMUA HASIL ---
def run_all_analysis(df):
    tahun_uji = df['Tahun'].max()

    # A. AUDIT KONSTRUKSI INDEKS
    # HCLI adalah indeks komposit dari enam indikator. Kalau ia kombinasi linear
    # dari keenamnya, regresi di bawah adalah REKONSTRUKSI bobot indeks, bukan
    # prediksi. R2 mendekati 1 jadi konsekuensi aritmetika, bukan capaian model.
    pooled = smf.ols(f'{TARGET} ~ ' + ' + '.join(CORE), data=df).fit()
    resid_sd = float((df[TARGET] - pooled.predict(df)).std())
    noise_teoretis = 0.01 / np.sqrt(12)   # HCLI dilaporkan 2 desimal
    audit = {
        'pooled_r2': float(pooled.rsquared),
        'resid_sd': resid_sd,
        'noise_teoretis': float(noise_teoretis),
        'rasio': resid_sd / noise_teoretis,
        'baris_persis': int((pooled.predict(df).round(2) == df[TARGET]).sum()),
        'n_baris': int(len(df)),
        'is_rekonstruksi': bool(resid_sd / noise_teoretis < 1.5),
    }

    # B. K-MEANS CLUSTERING (potongan lintang tahun terakhir)
    df24 = df[df['Tahun'] == tahun_uji].copy()
    Xs = StandardScaler().fit_transform(df24[CORE].values)

    validasi_k = [
        {
            'k': k,
            'Inertia': float(km.inertia_),
            'Silhouette': float(silhouette_score(Xs, km.labels_)),
        }
        for k in range(2, 9)
        for km in [KMeans(n_clusters=k, init='k-means++',
                          random_state=SEED, n_init=N_INIT).fit(Xs)]
    ]

    kmeans = KMeans(n_clusters=K, init='k-means++',
                    random_state=SEED, n_init=N_INIT)
    labels = kmeans.fit_predict(Xs)

    # Nomori ulang kluster menurut HCLI rata-rata: Kluster 1 = kondisi terbaik.
    # Tanpa ini penomoran mengikuti urutan sentroid yang arbitrer, sehingga
    # legenda peta tidak punya arti ordinal.
    urutan = (df24.assign(_lab=labels)
                  .groupby('_lab')[TARGET].mean()
                  .sort_values().index)
    peta_label = {lab: i + 1 for i, lab in enumerate(urutan)}
    df24['Kluster'] = ['Kluster ' + str(peta_label[l]) for l in labels]

    cluster_profile = df24.groupby('Kluster')[CORE + [TARGET]].mean()
    cluster_profile.insert(0, 'n', df24.groupby('Kluster').size())

    # C. REGRESI PANEL EFEK TETAP (split temporal, bukan acak)
    train = df[df['Tahun'] < tahun_uji].copy()
    test = df[df['Tahun'] == tahun_uji].copy()

    formula = f'{TARGET} ~ ' + ' + '.join(CORE) + ' + C(Provinsi)'
    fe = smf.ols(formula, data=train).fit()
    # Galat baku terkoreksi klaster provinsi: observasi dari provinsi yang sama
    # tidak saling bebas antartahun.
    fe_cl = smf.ols(formula, data=train).fit(
        cov_type='cluster', cov_kwds={'groups': train['Provinsi']}
    )

    # D. KOEFISIEN TERBAKU
    # Rentang keenam variabel berbeda jauh, jadi koefisien mentah tidak setara.
    # Karena modelnya efek tetap, pembakuan memakai simpangan baku
    # within-province - variasi itulah yang sesungguhnya dipakai model.
    dm = df.copy()
    for c in CORE + [TARGET]:
        dm[c + '_w'] = dm.groupby('Provinsi')[c].transform(lambda s: s - s.mean())
    sd_w = {c: dm[c + '_w'].std(ddof=1) for c in CORE}
    sd_target_w = dm[TARGET + '_w'].std(ddof=1)

    beta = pd.DataFrame({
        'Variabel': CORE,
        'Koefisien (Beta)': [fe.params[c] for c in CORE],
        'P-Value': [fe.pvalues[c] for c in CORE],
        'P-Value (clustered)': [fe_cl.pvalues[c] for c in CORE],
        'SD within': [sd_w[c] for c in CORE],
    })
    beta['Beta terbaku'] = beta['Koefisien (Beta)'] * beta['SD within'] / sd_target_w
    beta['Magnitudo Dampak'] = beta['Beta terbaku'].abs()
    beta['Signifikan'] = beta['P-Value (clustered)'] < 0.05
    beta = (beta.reindex(beta['Magnitudo Dampak'].sort_values(ascending=False).index)
                .reset_index(drop=True))

    # E. EVALUASI
    test = test.copy()
    test[TARGET + '_Prediksi'] = fe.predict(test)
    r2 = r2_score(test[TARGET], test[TARGET + '_Prediksi'])
    mse = mean_squared_error(test[TARGET], test[TARGET + '_Prediksi'])
    rentang = float(df[TARGET].max() - df[TARGET].min())

    # F. TREN NASIONAL
    trend_data = df.groupby('Tahun')[[TARGET, 'NEET']].mean().reset_index()

    return {
        'df_2024_kluster': df24,
        'tahun_uji': int(tahun_uji),
        'cluster_profile': cluster_profile,
        'validasi_k': validasi_k,
        'beta_ranking': beta,
        'trend_data': trend_data,
        'model_fe': fe,
        'audit': audit,
        'metrics': {
            'R2': float(r2),
            'MSE': float(mse),
            'RMSE': float(np.sqrt(mse)),
            'RMSE_pct_rentang': float(np.sqrt(mse) / rentang),
            'R2_train': float(fe.rsquared),
            'R2_pooled': float(pooled.rsquared),
        },
    }


# --- 3. SIMULASI KONTRAFAKTUAL ---
def simulasi(fe, df24, perubahan, kluster=None):
    """Prediksi HCLI kontrafaktual.

    perubahan : dict, misal {'Internet': 0.10, 'NEET': -0.20}
    kluster   : nama kluster sasaran, None = nasional
    """
    base = df24.copy()
    if kluster and kluster != 'Nasional':
        base = base[base['Kluster'] == kluster]
    if base.empty:
        raise ValueError('Wilayah sasaran kosong')

    skenario = base.copy()
    for var, delta in perubahan.items():
        if var in skenario.columns:
            skenario[var] = skenario[var] * (1 + delta)

    hcli_awal = float(fe.predict(base).mean())
    hcli_baru = float(fe.predict(skenario).mean())

    kontribusi = {
        var: {
            'impact': float(fe.params[var] * base[var].mean() * delta),
            'coef': float(fe.params[var]),
            'change': float(delta),
        }
        for var, delta in perubahan.items()
        if var in fe.params
    }

    return {
        'wilayah': kluster or 'Nasional',
        'n_provinsi': int(len(base)),
        'hcli_awal': hcli_awal,
        'hcli_baru': hcli_baru,
        'delta': hcli_baru - hcli_awal,
        'delta_persen': (hcli_baru - hcli_awal) / hcli_awal if hcli_awal else 0.0,
        'kontribusi': kontribusi,
    }


# --- UJI TERMINAL ---
if __name__ == "__main__":
    print("--- MEMUAT DAN MENGANALISIS DATA HCLI ---")
    try:
        df = load_and_preprocess_data()
        r = run_all_analysis(df)

        a = r['audit']
        print("\n--- 0. AUDIT KONSTRUKSI INDEKS ---")
        print(f"Pooled OLS R2         : {a['pooled_r2']:.6f}")
        print(f"SD residual           : {a['resid_sd']:.6f}")
        print(f"Noise pembulatan      : {a['noise_teoretis']:.6f}")
        print(f"Rekonstruksi persis   : {a['baris_persis']}/{a['n_baris']} baris")
        if a['is_rekonstruksi']:
            print("KESIMPULAN: HCLI adalah kombinasi linear dari keenam prediktor.")
            print("Regresi ditafsirkan sebagai DEKOMPOSISI BOBOT INDEKS.")

        print("\n--- 1. PROFIL RATA-RATA KLUSTER ---")
        print(r['cluster_profile'].round(4).to_string())

        print("\n--- 2. PERINGKAT PENGUNGKIT (koefisien terbaku) ---")
        print(r['beta_ranking'].round(5).to_string(index=False))

        print("\n--- 3. TREN NASIONAL ---")
        print(r['trend_data'].round(4).to_string(index=False))

        print("\n--- 4. EVALUASI MODEL ---")
        m = r['metrics']
        print(f"R2 uji {r['tahun_uji']}    : {m['R2']:.4f}")
        print(f"RMSE            : {m['RMSE']:.5f} ({m['RMSE_pct_rentang']:.2%} rentang)")
        print(f"R2 pooled       : {m['R2_pooled']:.4f} (pembanding, lihat audit)")

    except FileNotFoundError as e:
        print(f"\n[ERROR FATAL]: {e}")
