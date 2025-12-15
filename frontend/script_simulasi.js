// script_simulasi.js - DIPERBAIKI

const API_SIMULATION_URL = 'http://127.0.0.1:5000/api/run_simulation';
const API_DASHBOARD_URL = 'http://127.0.0.1:5000/api/dashboard_data';

// Objek untuk menyimpan semua perubahan dari slider
let scenarioChanges = {
    'NEET': 0,
    'Internet': 0,
    'RLS': 0,
    'P2': 0,
};

// Variabel untuk menyimpan data original HCLE dan koefisien dari model
let originalHCLE = 0.3492;
let currentRegion = 'Nasional';
let modelCoefficients = {
    'NEET': 0.0056,
    'Internet': -0.1580,
    'RLS': -0.0335,
    'P1': 0.0332,
    'P2': 0.0824,
    'HLS': -0.0210
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Memulai simulasi HCLE...');
    
    // Cek koneksi server
    checkServerConnection();
    
    // Memuat Kluster untuk Dropdown Target Wilayah
    loadTargetRegions();
    
    // Inisialisasi chart sederhana
    initializeDefaultChart();
});

// --- FUNGSI KONEKSI SERVER ---
async function checkServerConnection() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/health');
        if (response.ok) {
            const data = await response.json();
            console.log('Server terhubung:', data);
            return true;
        }
    } catch (error) {
        console.warn('Server belum berjalan, menggunakan data simulasi:', error);
        showServerWarning();
        return false;
    }
}

function showServerWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'fixed top-20 right-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg shadow-lg z-50';
    warningDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-triangle mr-3"></i>
            <div>
                <p class="font-bold">Server Python Belum Berjalan</p>
                <p class="text-sm">Jalankan <code>python app.py</code> di terminal untuk simulasi real-time.</p>
                <p class="text-sm mt-1">Menggunakan data simulasi...</p>
            </div>
        </div>
    `;
    document.body.appendChild(warningDiv);
    
    setTimeout(() => warningDiv.remove(), 8000);
}

// --- FUNGSI UTILITY ---
function updateSlider(variable, value) {
    // Konversi % ke desimal, e.g., 5% -> 0.05
    const changeValue = parseFloat(value) / 100;
    
    // Update label tampilan
    const label = document.getElementById(`label-${variable}`);
    label.innerText = `${value}%`;
    
    // Update slider value
    const slider = document.querySelector(`.slider-${variable.toLowerCase()}`);
    if (slider) slider.value = value;
    
    // Simpan nilai perubahan (desimal)
    scenarioChanges[variable] = changeValue;
    
    // Update tampilan total perubahan
    updateTotalChange();
    
    // Tampilkan estimasi cepat
    showQuickEstimate();
}

function updateTotalChange() {
    const neetVal = Math.abs(scenarioChanges.NEET * 100);
    const internetVal = Math.abs(scenarioChanges.Internet * 100);
    const rlsVal = Math.abs(scenarioChanges.RLS * 100);
    const p2Val = Math.abs(scenarioChanges.P2 * 100);
    const total = neetVal + internetVal + rlsVal + p2Val;
    
    document.getElementById('total-change').textContent = `${total.toFixed(1)}%`;
    
    // Update status skenario
    if (total === 0) {
        document.getElementById('active-scenario').textContent = 'Belum diatur';
        document.getElementById('active-scenario').className = 'text-sm font-medium text-gray-600 dark:text-gray-400';
    } else if (scenarioChanges.NEET < 0 || scenarioChanges.Internet < 0 || scenarioChanges.RLS < 0) {
        document.getElementById('active-scenario').textContent = 'Skenario Campuran';
        document.getElementById('active-scenario').className = 'text-sm font-medium text-yellow-600 dark:text-yellow-400';
    } else {
        document.getElementById('active-scenario').textContent = 'Skenario Positif';
        document.getElementById('active-scenario').className = 'text-sm font-medium text-green-600 dark:text-green-400';
    }
}

function showQuickEstimate() {
    // Koefisien dari model Fixed Effect Regression (dari API atau default)
    const neetImpact = scenarioChanges.NEET * modelCoefficients.NEET;
    const internetImpact = scenarioChanges.Internet * modelCoefficients.Internet;
    const rlsImpact = scenarioChanges.RLS * modelCoefficients.RLS;
    const p2Impact = scenarioChanges.P2 * modelCoefficients.P2;
    
    const totalImpact = neetImpact + internetImpact + rlsImpact + p2Impact;
    
    document.getElementById('estimated-impact').textContent = totalImpact.toFixed(4);
    
    if (totalImpact < 0) {
        document.getElementById('estimated-impact').className = 'text-sm font-medium text-green-600 dark:text-green-400';
    } else if (totalImpact > 0) {
        document.getElementById('estimated-impact').className = 'text-sm font-medium text-red-600 dark:text-red-400';
    } else {
        document.getElementById('estimated-impact').className = 'text-sm font-medium text-gray-600 dark:text-gray-400';
    }
}

async function loadTargetRegions() {
    try {
        const response = await fetch(API_DASHBOARD_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const select = document.getElementById('target-region');
        
        // Reset options
        select.innerHTML = '<option value="Nasional">Nasional (Rata-Rata)</option>';
        
        // Tambahkan kluster
        if (data.cluster_profile && Array.isArray(data.cluster_profile)) {
            data.cluster_profile.forEach(cluster => {
                const option = document.createElement('option');
                option.value = cluster.Kluster;
                option.textContent = cluster.Kluster;
                select.appendChild(option);
            });
        }
        
        // Update HCLE nasional
        originalHCLE = data.mean_hcle_2024 || 0.3492;
        document.getElementById('original-hcle').textContent = originalHCLE.toFixed(4);
        document.getElementById('new-hcle').textContent = originalHCLE.toFixed(4);
        
        // Perbarui koefisien dari API (beta_ranking)
        if (data.beta_ranking && Array.isArray(data.beta_ranking)) {
            data.beta_ranking.forEach(item => {
                if (item.Variabel && 'Koefisien (Beta)' in item) {
                    modelCoefficients[item.Variabel] = item['Koefisien (Beta)'];
                }
            });
            console.log('Koefisien model berhasil diperbarui dari API:', modelCoefficients);
        }
        
        console.log('Data kluster berhasil dimuat:', data.cluster_profile?.length || 0, 'kluster');
        
    } catch (error) {
        console.warn('Gagal memuat data kluster, menggunakan default:', error);
        // Gunakan data default dan koefisien default
        document.getElementById('original-hcle').textContent = '0.3492';
        document.getElementById('new-hcle').textContent = '0.3492';
    }
}

// --- FUNGSI SIMULASI UTAMA ---
async function runSimulation() {
    const targetRegion = document.getElementById('target-region').value;
    currentRegion = targetRegion;
    
    // Tampilkan loading state
    const runButton = document.querySelector('button[onclick="runEnhancedSimulation()"]');
    if (!runButton) {
        console.error('Run button not found');
        return;
    }
    const originalButtonText = runButton.innerHTML;
    runButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-3"></i> MEMPROSES...';
    runButton.disabled = true;
    
    // Filter hanya perubahan yang non-nol
    const changesPayload = {};
    Object.entries(scenarioChanges).forEach(([key, value]) => {
        if (value !== 0) {
            changesPayload[key] = value;
        }
    });
    
    // Jika tidak ada perubahan, tetap jalankan simulasi untuk demo
    if (Object.keys(changesPayload).length === 0) {
        changesPayload['NEET'] = 0.05; // Default 5% improvement untuk demo
    }
    
    try {
        // Coba hubungi server Python
        const response = await fetch(API_SIMULATION_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                target_region: targetRegion,
                changes: changesPayload
            })
        });
        
        let result;
        
        if (response.ok) {
            result = await response.json();
            console.log('Hasil simulasi dari server:', result);
        } else {
            // Fallback: simulasi client-side jika server error
            console.warn('Server tidak merespons, menggunakan simulasi client-side');
            result = simulateClientSide(targetRegion, changesPayload);
        }
        
        // Update UI dengan hasil
        updateResultsUI(result);
        
    } catch (error) {
        console.error('Error menjalankan simulasi:', error);
        
        // Fallback ke simulasi client-side
        const fallbackResult = simulateClientSide(targetRegion, changesPayload);
        updateResultsUI(fallbackResult);
        
        // Tampilkan pesan error
        showNotification('Menggunakan simulasi lokal karena server tidak tersedia', 'warning');
    } finally {
        // Restore button
        setTimeout(() => {
            runButton.innerHTML = originalButtonText;
            runButton.disabled = false;
        }, 1000);
    }
}

// Simulasi client-side fallback
function simulateClientSide(region, changes) {
    console.log('Menjalankan simulasi client-side untuk region:', region);
    
    // Base HCLE berdasarkan region
    let baseHCLE = originalHCLE;
    if (region.includes('Kluster')) {
        // Adjust berdasarkan kluster (contoh sederhana)
        const clusterNum = parseInt(region.replace('Kluster ', ''));
        baseHCLE = originalHCLE * (0.8 + (clusterNum * 0.1)); // Contoh adjustment
    }
    
    // Hitung dampak berdasarkan koefisien dari model Fixed Effect Regression
    const neetImpact = (changes.NEET || 0) * modelCoefficients.NEET;
    const internetImpact = (changes.Internet || 0) * modelCoefficients.Internet;
    const rlsImpact = (changes.RLS || 0) * modelCoefficients.RLS;
    const p2Impact = (changes.P2 || 0) * modelCoefficients.P2;
    
    const totalImpact = neetImpact + internetImpact + rlsImpact + p2Impact;
    const newHCLE = baseHCLE + totalImpact;
    
    return {
        success: true,
        new_hcle_prediction: Math.max(0, newHCLE), // Pastikan tidak negatif
        delta_hcle: Math.abs(totalImpact),
        original_hcle_mean: baseHCLE,
        contributions: {
            NEET: { impact: neetImpact, change: changes.NEET || 0 },
            Internet: { impact: internetImpact, change: changes.Internet || 0 },
            RLS: { impact: rlsImpact, change: changes.RLS || 0 },
            P2: { impact: p2Impact, change: changes.P2 || 0 }
        }
    };
}

// Update UI dengan hasil simulasi
function updateResultsUI(result) {
    if (!result.success) {
        showNotification('Simulasi gagal: ' + (result.error || 'Unknown error'), 'error');
        return;
    }
    
    const original = result.original_hcle_mean;
    const predicted = result.new_hcle_prediction;
    const delta = result.delta_hcle;
    
    // Update metrics
    document.getElementById('original-hcle').textContent = original.toFixed(4);
    document.getElementById('new-hcle').textContent = predicted.toFixed(4);
    document.getElementById('delta-hcle').textContent = delta.toFixed(4);
    
    // Update delta text dan warna
    const deltaText = document.getElementById('delta-text');
    if (predicted < original) {
        deltaText.textContent = 'Penurunan HCLE (Baik)';
        deltaText.className = 'text-xs text-green-600 dark:text-green-400 mt-2';
        document.getElementById('delta-hcle').className = 'text-4xl font-bold text-green-700 dark:text-green-300 mb-2';
    } else {
        deltaText.textContent = 'Peningkatan HCLE (Perhatian)';
        deltaText.className = 'text-xs text-red-600 dark:text-red-400 mt-2';
        document.getElementById('delta-hcle').className = 'text-4xl font-bold text-red-700 dark:text-red-300 mb-2';
    }
    
    // Update progress bars
    const deltaPercent = Math.abs(delta) / original * 100;
    document.getElementById('delta-bar').style.width = `${Math.min(deltaPercent * 3, 100)}%`;
    document.getElementById('new-bar').style.width = `${(predicted / 0.6 * 100)}%`;
    
    // Update chart
    updateSimulationChart(original, predicted);
    
    // Update impact breakdown
    updateImpactBreakdown(result.contributions, delta);
    
    // Tampilkan notifikasi sukses
    const improvementPercent = ((original - predicted) / original * 100).toFixed(1);
    showNotification(`Simulasi berhasil! Prediksi perubahan: ${improvementPercent}%`, 'success');
}

function updateSimulationChart(original, predicted) {
    const colors = document.documentElement.classList.contains('dark') 
        ? { original: '#6b7280', new: '#60a5fa', target: 'rgba(96, 165, 250, 0.3)' }
        : { original: '#9ca3af', new: '#3b82f6', target: 'rgba(59, 130, 246, 0.3)' };
    
    const data = [{
        x: ['HCLE Awal', 'HCLE Baru', 'Target Nasional'],
        y: [original, predicted, 0.2500],
        type: 'bar',
        marker: { 
            color: [colors.original, colors.new, colors.target],
            line: { width: 1.5 }
        },
        text: [original.toFixed(4), predicted.toFixed(4), '0.2500'],
        textposition: 'auto',
    }];
    
    const layout = {
        title: false,
        yaxis: { 
            range: [0, 0.6], 
            title: 'Nilai HCLE',
            gridcolor: 'rgba(0,0,0,0.1)',
            zerolinecolor: 'rgba(0,0,0,0.1)'
        },
        margin: { t: 30, b: 50, l: 60, r: 30 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };
    
    Plotly.react('simulationChart', data, layout);
}

function updateImpactBreakdown(contributions, totalDelta) {
    if (!contributions || Object.keys(contributions).length === 0) {
        document.getElementById('impactBreakdown').innerHTML = `
            <div class="text-center py-8 text-gray-400 dark:text-gray-500">
                <i class="fas fa-calculator text-3xl mb-3"></i>
                <p>Jalankan simulasi untuk melihat rincian dampak</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="space-y-4">';
    
    for (const [varName, data] of Object.entries(contributions)) {
        const impact = data.impact || 0;
        const changePercent = (data.change || 0) * 100;
        const impactPercent = totalDelta !== 0 ? Math.abs(impact / totalDelta * 100) : 0;
        
        // Tentukan warna berdasarkan variabel
        let colorClass, bgClass, varLabel;
        switch(varName) {
            case 'NEET':
                colorClass = 'danger';
                varLabel = 'Tingkat NEET';
                break;
            case 'Internet':
                colorClass = 'primary';
                varLabel = 'Akses Internet';
                break;
            case 'RLS':
                colorClass = 'success';
                varLabel = 'Rata-rata Lama Sekolah';
                break;
            case 'P2':
                colorClass = 'warning';
                varLabel = 'Kemiskinan Parah (P2)';
                break;
            default:
                colorClass = 'gray';
                varLabel = varName;
        }
        
        html += `
            <div class="bg-${colorClass}-50 dark:bg-${colorClass}-900/20 p-4 rounded-xl">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-medium text-${colorClass}-700 dark:text-${colorClass}-300">${varLabel}</span>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-${colorClass}-600 dark:text-${colorClass}-400">${changePercent.toFixed(1)}%</div>
                        <div class="text-xs text-${colorClass}-500 dark:text-${colorClass}-300">Perubahan Input</div>
                    </div>
                </div>
                <div class="text-sm text-${colorClass}-600 dark:text-${colorClass}-400">
                    Dampak HCLE: ${impact.toFixed(4)} (${impactPercent.toFixed(1)}% dari total)
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    document.getElementById('impactBreakdown').innerHTML = html;
}

function resetSimulation() {
    // Reset semua slider ke 0
    updateSlider('NEET', 0);
    updateSlider('Internet', 0);
    updateSlider('RLS', 0);
    updateSlider('P2', 0);
    
    // Reset UI
    document.getElementById('original-hcle').textContent = originalHCLE.toFixed(4);
    document.getElementById('new-hcle').textContent = originalHCLE.toFixed(4);
    document.getElementById('delta-hcle').textContent = '0.0000';
    document.getElementById('delta-text').textContent = 'Belum ada perubahan';
    document.getElementById('delta-bar').style.width = '0%';
    document.getElementById('new-bar').style.width = '65%';
    document.getElementById('estimated-impact').textContent = '-';
    
    // Reset chart
    updateSimulationChart(originalHCLE, originalHCLE);
    
    // Reset impact breakdown
    document.getElementById('impactBreakdown').innerHTML = `
        <div class="text-center py-8 text-gray-400 dark:text-gray-500">
            <i class="fas fa-calculator text-3xl mb-3"></i>
            <p>Jalankan simulasi untuk melihat rincian dampak</p>
        </div>
    `;
    
    showNotification('Semua pengaturan telah direset', 'info');
}

// Fungsi bantuan
function showNotification(message, type = 'info') {
    const types = {
        success: { icon: 'check-circle', color: 'green', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-500' },
        error: { icon: 'exclamation-circle', color: 'red', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-500' },
        warning: { icon: 'exclamation-triangle', color: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-500' },
        info: { icon: 'info-circle', color: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-500' }
    };
    
    const config = types[type] || types.info;
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${config.bg} border-l-4 ${config.border} text-${config.color}-700 dark:text-${config.color}-300 p-4 rounded-lg shadow-lg z-50 max-w-sm animate-slide-in`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${config.icon} mr-3 text-${config.color}-500"></i>
            <div>
                <p class="font-medium">${message}</p>
            </div>
            <button class="ml-4 text-${config.color}-500 hover:text-${config.color}-700" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove setelah 5 detik
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function initializeDefaultChart() {
    const data = [{
        x: ['HCLE Awal', 'HCLE Baru', 'Target Nasional'],
        y: [originalHCLE, originalHCLE, 0.2500],
        type: 'bar',
        marker: { 
            color: ['#9ca3af', '#3b82f6', 'rgba(59, 130, 246, 0.3)'],
            line: { width: 1.5 }
        },
        text: [originalHCLE.toFixed(4), originalHCLE.toFixed(4), '0.2500'],
        textposition: 'auto',
    }];
    
    const layout = {
        title: false,
        yaxis: { 
            range: [0, 0.6], 
            title: 'Nilai HCLE',
            gridcolor: 'rgba(0,0,0,0.1)',
            zerolinecolor: 'rgba(0,0,0,0.1)'
        },
        margin: { t: 30, b: 50, l: 60, r: 30 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };
    
    Plotly.newPlot('simulationChart', data, layout, { responsive: true, displayModeBar: false });
}