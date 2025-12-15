# model_utils.py

import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import statsmodels.formula.api as smf
from sklearn.metrics import r2_score, mean_squared_error

# --- 1. LOAD DATA DAN PREPROCESSING ---
def load_and_preprocess_data():
    file_name = 'data/DATA_PANEL_HCLE_PROVINSI_2021-2024.csv'
    # Pastikan jalur file benar
    try:
        df = pd.read_csv(file_name)
    except FileNotFoundError:
        raise FileNotFoundError(f"File data tidak ditemukan di: {file_name}. Pastikan file ada di folder 'data/'.")
        
    df.columns = ['Provinsi', 'Tahun', 'NEET', 'P1', 'P2', 'Internet', 'RLS', 'HLS', 'HCLE']
    clustering_vars = ['NEET', 'P1', 'P2', 'Internet', 'RLS', 'HLS', 'HCLE']
    for col in clustering_vars:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.dropna(subset=clustering_vars, inplace=True)
    return df

# --- 2. FUNGSI UNTUK MENGHITUNG SEMUA HASIL ---
def run_all_analysis(df):
    # A. K-MEANS CLUSTERING
    df_2024 = df[df['Tahun'] == 2024].copy()
    clustering_vars_preds = ['NEET', 'P1', 'P2', 'Internet', 'RLS', 'HLS']
    X_cluster = df_2024[clustering_vars_preds]
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_cluster)
    kmeans = KMeans(n_clusters=4, init='k-means++', random_state=42, n_init='auto')
    clusters = kmeans.fit_predict(X_scaled)
    df_2024['Kluster'] = 'Kluster ' + (clusters + 1).astype(str)
    
    cluster_profile = df_2024.groupby('Kluster')[clustering_vars_preds + ['HCLE']].mean()
    
    # B. FIXED EFFECT REGRESSION
    df_train = df[df['Tahun'] < 2024].copy()
    df_test = df[df['Tahun'] == 2024].copy()
    formula = 'HCLE ~ NEET + P1 + P2 + Internet + RLS + HLS + C(Provinsi)'
    model_fe = smf.ols(formula=formula, data=df_train).fit()
    
    # C. EKSTRAKSI BETA
    core_vars = ['NEET', 'P1', 'P2', 'Internet', 'RLS', 'HLS']
    beta_summary = pd.DataFrame({
        'Koefisien (Beta)': model_fe.params.filter(items=core_vars),
        'P-Value': model_fe.pvalues.filter(items=core_vars)
    })
    beta_summary['Magnitudo Dampak'] = beta_summary['Koefisien (Beta)'].abs()
    beta_summary_sorted = beta_summary.sort_values(by='Magnitudo Dampak', ascending=False).reset_index().rename(columns={'index': 'Variabel'})
    
    # D. DATA TREN
    trend_data = df.groupby('Tahun')[['HCLE', 'NEET']].mean().reset_index()

    # E. EVALUASI
    df_test['HCLE_Prediksi'] = model_fe.predict(df_test)
    r2 = r2_score(df_test['HCLE'], df_test['HCLE_Prediksi'])
    mse = mean_squared_error(df_test['HCLE'], df_test['HCLE_Prediksi'])
    
    return {
        'df_2024_kluster': df_2024,
        'cluster_profile': cluster_profile,
        'beta_ranking': beta_summary_sorted,
        'trend_data': trend_data,
        'model_fe': model_fe,
        'metrics': {'R2': r2, 'MSE': mse}
    }

# --- BAGIAN BARU: FUNGSI UTAMA UNTUK UJI TERMINAL ---
if __name__ == "__main__":
    print("--- MEMUAT DAN MENGANALISIS DATA HCLE ---")
    try:
        df = load_and_preprocess_data()
        results = run_all_analysis(df)
        
        print("\n--- 1. PROFIL RATA-RATA KLUSTER (Diagnosis) ---")
        print(results['cluster_profile'].to_markdown(floatfmt=".4f"))

        print("\n--- 2. RANKING PRIORITAS AKSI (Variabel Pengungkit) ---")
        print(results['beta_ranking'].to_markdown(floatfmt=".4f"))

        print("\n--- 3. DATA TREN NASIONAL ---")
        print(results['trend_data'].to_markdown(index=False, floatfmt=".4f"))

        print("\n--- 4. EVALUASI MODEL (Data Uji 2024) ---")
        print(f"R-squared Test Score: {results['metrics']['R2']:.4f}")
        print(f"Mean Squared Error (MSE): {results['metrics']['MSE']:.6f}")

    except FileNotFoundError as e:
        print(f"\n[ERROR FATAL]: {e}")
        print("Pastikan file 'DATA_PANEL_HCLE_PROVINSI_2021-2024.csv' berada di dalam folder 'data/'.")