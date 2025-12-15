# app.py - DIPERBAIKI

from flask import Flask, jsonify, request
from flask_cors import CORS
from model_utils import load_and_preprocess_data, run_all_analysis
import pandas as pd

app = Flask(__name__)
CORS(app)

# --- LOAD DAN HITUNG MODEL SEKALI SAJA SAAT SERVER DIMULAI ---
print("Memuat data dan model...")
try:
    df = load_and_preprocess_data()
    analysis_results = run_all_analysis(df)
    print("Data dan model berhasil dimuat!")
except Exception as e:
    print(f"Error memuat data: {e}")
    df = None
    analysis_results = None

# Ekstrak hasil yang sering dipakai
if df is not None:
    df_2024 = analysis_results['df_2024_kluster']
    model_fe = analysis_results['model_fe']
    global_mean_hcle = df_2024['HCLE'].mean()
else:
    df_2024 = None
    model_fe = None
    global_mean_hcle = 0.3492

# --- ENDPOINT 1: DATA DASHBOARD STATIS (Page 1) ---
@app.route('/api/dashboard_data', methods=['GET'])
def get_dashboard_data():
    if df is None:
        return jsonify({'error': 'Data belum dimuat'}), 500
    
    # Mengubah DataFrame ke format JSON yang mudah dibaca oleh JavaScript
    data = {
        'cluster_map_data': df_2024[['Provinsi', 'Kluster', 'HCLE']].to_dict(orient='records'),
        'cluster_profile': analysis_results['cluster_profile'].reset_index().to_dict(orient='records'),
        'beta_ranking': analysis_results['beta_ranking'].to_dict(orient='records'),
        'trend_data': analysis_results['trend_data'].to_dict(orient='records'),
        'mean_hcle_2024': global_mean_hcle,
        'metrics': analysis_results['metrics']
    }
    return jsonify(data)

# --- ENDPOINT 2: SIMULASI DINAMIS (Page 2) ---
@app.route('/api/run_simulation', methods=['POST'])
def run_simulation():
    if df is None or model_fe is None:
        return jsonify({'error': 'Model belum dimuat'}), 500
    
    try:
        # Asumsi data JSON yang diterima
        input_data = request.json
        
        # 1. Tentukan target provinsi/kluster
        target_region = input_data.get('target_region', 'Nasional')
        
        # Gunakan df_2024 untuk simulasi (data terbaru)
        df_scenario = df_2024.copy()
        
        if target_region != 'Nasional':
            df_scenario = df_scenario[df_scenario['Kluster'] == target_region]
        
        # 2. Modifikasi variabel sesuai input perubahan
        changes = input_data.get('changes', {})
        original_values = df_scenario.copy()
        
        for var, change in changes.items():
            if var in df_scenario.columns:
                # change adalah persentase dalam desimal (misal -0.05 untuk -5%)
                df_scenario[var] = df_scenario[var] * (1 + change)
        
        # 3. Prediksi HCLE baru
        df_scenario['HCLE_Prediksi_Baru'] = model_fe.predict(df_scenario)
        
        # 4. Hitung statistik
        new_hcle_mean = df_scenario['HCLE_Prediksi_Baru'].mean()
        original_hcle_mean = original_values['HCLE'].mean()
        
        # 5. Hitung kontribusi per variabel (sederhana)
        contributions = {}
        for var, change in changes.items():
            if var in ['NEET', 'Internet', 'RLS']:  # Variabel utama
                # Estimasi dampak berdasarkan koefisien regresi
                if var in model_fe.params:
                    coef = model_fe.params[var]
                    avg_value = original_values[var].mean()
                    contributions[var] = {
                        'impact': coef * avg_value * change,
                        'coef': coef,
                        'change': change
                    }
        
        return jsonify({
            'success': True,
            'new_hcle_prediction': float(new_hcle_mean),
            'delta_hcle': float(original_hcle_mean - new_hcle_mean),
            'original_hcle_mean': float(original_hcle_mean),
            'contributions': contributions
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

# --- ENDPOINT 3: Health Check ---
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'model_loaded': df is not None,
        'hcle_mean_2024': float(global_mean_hcle) if df is not None else 0.3492
    })

# --- Jalankan Server ---
if __name__ == '__main__':
    print("Server HCLE Navigator berjalan di http://127.0.0.1:5000")
    print("Endpoint tersedia:")
    print("  - GET  /api/dashboard_data")
    print("  - POST /api/run_simulation")
    print("  - GET  /api/health")
    app.run(debug=True, host='127.0.0.1', port=5000)