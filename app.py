# app.py - HCLE Navigator API

import os

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from model_utils import load_and_preprocess_data, run_all_analysis, simulasi

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

# --- MODEL DIHITUNG SEKALI SAAT STARTUP ---
# Konsekuensinya: mengubah CSV butuh restart server.
print("Memuat data dan model...")
try:
    df = load_and_preprocess_data()
    analysis_results = run_all_analysis(df)
    print("Data dan model berhasil dimuat.")
except Exception as e:
    print(f"Error memuat data: {e}")
    df = None
    analysis_results = None

if analysis_results is not None:
    df_2024 = analysis_results['df_2024_kluster']
    model_fe = analysis_results['model_fe']
    global_mean_hcli = float(df_2024['HCLI'].mean())
else:
    df_2024 = None
    model_fe = None
    global_mean_hcli = None


@app.route('/api/dashboard_data', methods=['GET'])
def get_dashboard_data():
    if analysis_results is None:
        return jsonify({'error': 'Data belum dimuat'}), 500

    profile = analysis_results['cluster_profile'].reset_index()

    return jsonify({
        'cluster_map_data': df_2024[['Provinsi', 'Kluster', 'HCLI']].to_dict(orient='records'),
        'cluster_profile': profile.to_dict(orient='records'),
        'beta_ranking': analysis_results['beta_ranking'].to_dict(orient='records'),
        'trend_data': analysis_results['trend_data'].to_dict(orient='records'),
        'validasi_k': analysis_results['validasi_k'],
        'audit': analysis_results['audit'],
        'mean_hcli_2024': global_mean_hcli,
        'tahun_uji': analysis_results['tahun_uji'],
        'metrics': analysis_results['metrics'],
    })


@app.route('/api/run_simulation', methods=['POST'])
def run_simulation():
    if analysis_results is None:
        return jsonify({'error': 'Model belum dimuat'}), 500

    try:
        payload = request.get_json(silent=True) or {}
        target_region = payload.get('target_region', 'Nasional')
        changes = {k: float(v) for k, v in (payload.get('changes') or {}).items()}

        hasil = simulasi(model_fe, df_2024, changes, kluster=target_region)

        return jsonify({
            'success': True,
            'wilayah': hasil['wilayah'],
            'n_provinsi': hasil['n_provinsi'],
            'original_hcli_mean': hasil['hcli_awal'],
            'new_hcli_prediction': hasil['hcli_baru'],
            'delta_hcli': hasil['delta'],
            'delta_persen': hasil['delta_persen'],
            'contributions': hasil['kontribusi'],
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/geojson', methods=['GET'])
def get_geojson():
    # Dilayani lokal supaya peta tidak bergantung koneksi eksternal.
    return send_from_directory(os.path.join(FRONTEND_DIR, 'data'),
                               'indonesia-38-provinces.geojson',
                               mimetype='application/json')


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok' if analysis_results is not None else 'error',
        'model_loaded': analysis_results is not None,
        'hcli_mean_2024': global_mean_hcli,
    })


# --- FRONTEND (satu origin, tanpa masalah file://) ---
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:filename>')
def serve_frontend_file(filename):
    return send_from_directory(FRONTEND_DIR, filename)


if __name__ == '__main__':
    print("Server HCLE Navigator: http://127.0.0.1:5000")
    app.run(debug=False, host='127.0.0.1', port=5000)
