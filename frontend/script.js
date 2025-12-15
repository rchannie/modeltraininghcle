// script.js - DIPERBAIKI

document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah chart_manager.js sudah dimuat
    if (typeof ChartManager === 'undefined') {
        console.error('ChartManager tidak ditemukan. Pastikan chart_manager.js dimuat.');
        showFallbackData();
        return;
    }
    
    // API URL - Pastikan server Flask berjalan
    const API_URL = 'http://127.0.0.1:5000/api/dashboard_data';
    
    console.log('Memulai HCLE Navigator...');
    
    // Coba ambil data dari API
    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - Server mungkin belum berjalan`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Data berhasil diambil dari API:', data);
            
            // Update metrik utama
            const hcleValue = data.mean_hcle_2024 || 0.3492;
            document.getElementById('hcle-nasional-value').textContent = hcleValue.toFixed(4);
            
            // Update NEET dan RLS dari trend data
            if (data.trend_data && Array.isArray(data.trend_data) && data.trend_data.length > 0) {
                const latestTrend = data.trend_data[data.trend_data.length - 1];
                const prevTrend = data.trend_data.length > 1 ? data.trend_data[data.trend_data.length - 2] : null;
                
                // Update NEET
                if (latestTrend.NEET) {
                    document.getElementById('neet-value').textContent = `${latestTrend.NEET.toFixed(1)}%`;
                    if (prevTrend && prevTrend.NEET) {
                        const neetChange = latestTrend.NEET - prevTrend.NEET;
                        document.getElementById('neet-change').textContent = `${neetChange >= 0 ? '+' : ''}${neetChange.toFixed(1)}%`;
                    }
                }
                
                // Update RLS dari cluster profile jika tersedia
                if (data.cluster_profile && Array.isArray(data.cluster_profile)) {
                    const nasionalRls = data.cluster_profile.reduce((sum, c) => sum + (c.RLS || 0), 0) / data.cluster_profile.length;
                    document.getElementById('rls-value').textContent = `${nasionalRls.toFixed(1)} tahun`;
                }
            }
            
            // Visualisasi data
            if (data.beta_ranking && Array.isArray(data.beta_ranking)) {
                ChartManager.visualizeBetaRanking(data.beta_ranking);
            }
            
            if (data.trend_data && Array.isArray(data.trend_data)) {
                ChartManager.visualizeTrendChart(data.trend_data);
            }
            
            if (data.cluster_map_data && Array.isArray(data.cluster_map_data)) {
                ChartManager.visualizeKlusterMap(data.cluster_map_data);
            }
            
            // Update akurasi prediksi jika ada
            if (data.metrics && data.metrics.R2) {
                const r2Value = data.metrics.R2;
                const r2Percentage = (r2Value * 100).toFixed(2);
                document.getElementById('accuracy-value').textContent = `${r2Percentage}%`;
                document.getElementById('accuracy-decimal').textContent = r2Value.toFixed(4);
                document.getElementById('accuracy-bar').style.width = `${Math.min(r2Value * 100, 100)}%`;
            }
            
        })
        .catch(error => {
            console.warn('Gagal mengambil data dari API, menggunakan data fallback:', error);
            showFallbackData();
            showApiWarning();
        });
});

// Data fallback jika API tidak tersedia
function showFallbackData() {
    console.log('Menggunakan data fallback...');
    
    // Update HCLE nasional
    document.getElementById('hcle-nasional-value').textContent = '0.3492';
    
    // Data beta ranking contoh
    const fallbackBeta = [
        { Variabel: 'NEET', 'Koefisien (Beta)': -0.0082, 'Magnitudo Dampak': 0.0082 },
        { Variabel: 'RLS', 'Koefisien (Beta)': -0.0055, 'Magnitudo Dampak': 0.0055 },
        { Variabel: 'Internet', 'Koefisien (Beta)': -0.0031, 'Magnitudo Dampak': 0.0031 },
        { Variabel: 'HLS', 'Koefisien (Beta)': 0.0028, 'Magnitudo Dampak': 0.0028 },
        { Variabel: 'P1', 'Koefisien (Beta)': 0.0015, 'Magnitudo Dampak': 0.0015 },
        { Variabel: 'P2', 'Koefisien (Beta)': 0.0009, 'Magnitudo Dampak': 0.0009 }
    ];
    
    // Data tren contoh
    const fallbackTrend = [
        { Tahun: 2021, HCLE: 0.3650, NEET: 21.5 },
        { Tahun: 2022, HCLE: 0.3580, NEET: 21.8 },
        { Tahun: 2023, HCLE: 0.3520, NEET: 22.1 },
        { Tahun: 2024, HCLE: 0.3492, NEET: 22.4 }
    ];
    
    // Data kluster contoh
    const fallbackCluster = [
        { Provinsi: 'DKI Jakarta', Kluster: 'Kluster 4', HCLE: 0.2850 },
        { Provinsi: 'Jawa Barat', Kluster: 'Kluster 3', HCLE: 0.3320 },
        { Provinsi: 'Jawa Timur', Kluster: 'Kluster 3', HCLE: 0.3350 },
        { Provinsi: 'Papua', Kluster: 'Kluster 1', HCLE: 0.4150 },
        { Provinsi: 'NTT', Kluster: 'Kluster 1', HCLE: 0.4080 }
    ];
    
    // Gunakan ChartManager jika tersedia
    if (typeof ChartManager !== 'undefined') {
        ChartManager.visualizeBetaRanking(fallbackBeta);
        ChartManager.visualizeTrendChart(fallbackTrend);
        ChartManager.visualizeKlusterMap(fallbackCluster);
    } else {
        // Fallback sederhana jika ChartManager tidak ada
        document.getElementById('betaChart').innerHTML = '<p class="text-gray-500 text-center p-8">Data tidak tersedia. Jalankan server Python.</p>';
        document.getElementById('trendChart').innerHTML = '<p class="text-gray-500 text-center p-8">Data tidak tersedia. Jalankan server Python.</p>';
        document.getElementById('klusterMap').innerHTML = '<p class="text-gray-500 text-center p-8">Data tidak tersedia. Jalankan server Python.</p>';
    }
}

function showApiWarning() {
    const warning = document.createElement('div');
    warning.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 rounded-lg shadow-lg z-50 max-w-md';
    warning.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-triangle mr-3 text-yellow-500"></i>
            <div>
                <p class="font-medium">Server Python Tidak Terhubung</p>
                <p class="text-sm">Jalankan <code>python app.py</code> di terminal untuk data real-time.</p>
                <p class="text-xs mt-1">Menggunakan data contoh untuk demonstrasi.</p>
            </div>
            <button class="ml-4 text-yellow-600 hover:text-yellow-800" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    document.body.appendChild(warning);
    
    setTimeout(() => {
        if (warning.parentElement) {
            warning.remove();
        }
    }, 10000);
}