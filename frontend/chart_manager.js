// chart_manager.js - Chart Visualization Manager

const ChartManager = {
    // Mapping nama provinsi dari data ke GeoJSON
    provinceMapping: {
        'ACEH': 'DI. ACEH',
        'DI YOGYAKARTA': 'DAERAH ISTIMEWA YOGYAKARTA',
        'KEP. BANGKA BELITUNG': 'BANGKA BELITUNG',
        'KEP. RIAU': 'RIAU ISLANDS',
        'NUSA TENGGARA BARAT': 'NUSATENGGARA BARAT',
        'PAPUA': 'IRIAN JAYA TIMUR',
        'PAPUA BARAT': 'IRIAN JAYA BARAT'
    },
    
    mapProvinceNameToGeoJSON: function(provinsiName) {
        return this.provinceMapping[provinsiName] || provinsiName;
    },
    
    // Skema warna untuk Light dan Dark Mode
    colorScheme: {
        light: {
            original: '#9ca3af', new: '#3b82f6', target: 'rgba(59, 130, 246, 0.3)',
            grid: 'rgba(0,0,0,0.1)', text: '#e5e7eb', background: '#ffffff',
            primary: '#2563eb', secondary: '#eab308', success: '#059669', danger: '#dc2626'
        },
        dark: {
            original: '#6b7280', new: '#60a5fa', target: 'rgba(96, 165, 250, 0.3)',
            grid: 'rgba(255,255,255,0.1)', text: '#e5e7eb', background: '#1f2937',
            primary: '#60a5fa', secondary: '#facc15', success: '#10b981', danger: '#ef4444'
        }
    },
    
    // Mendeteksi tema aktif
    getColors: function() {
        const isDark = document.documentElement.classList.contains('dark');
        return isDark ? this.colorScheme.dark : this.colorScheme.light;
    },

    // --- FUNGSI 1: PETA KLUSTER (CHOROPLETH) ---
    visualizeKlusterMap: function(mapData) {
        const GEOJSON_URL = 'https://raw.githubusercontent.com/superpikar/indonesia-geojson/master/indonesia-province-simple.json';
        const colors = this.getColors();
        const self = this;
        
        fetch(GEOJSON_URL)
            .then(response => response.json())
            .then(geojson => {
                
                const locations = mapData.map(d => self.mapProvinceNameToGeoJSON(d.Provinsi));
                const z = mapData.map(d => parseInt(d.Kluster.replace('Kluster ', ''))); 
                const hovertext = mapData.map(d => 
                    `Provinsi: ${d.Provinsi}<br>Kluster: ${d.Kluster}<br>HCLE: ${d.HCLE.toFixed(4)}`
                );
                
                // Skala warna untuk 4 kluster
                const color_scale = [
                    [0.0, '#fca5a5'], [0.25, '#fca5a5'], // Kluster 1 (Merah Muda) - Tantangan Moderat
                    [0.25, '#fde047'], [0.50, '#fde047'], // Kluster 2 (Kuning) - Aman & Unggul
                    [0.50, '#93c5fd'], [0.75, '#93c5fd'], // Kluster 3 (Biru Muda) - Paradoks Pendidikan
                    [0.75, '#1e40af'], [1.0, '#1e40af'] // Kluster 4 (Biru Tua) - Ketimpangan Struktural Parah
                ];

                const data = [{
                    type: 'choropleth',
                    geojson: geojson,
                    locations: locations, 
                    z: z, 
                    text: hovertext,
                    hoverinfo: 'text',
                    featureidkey: 'properties.Propinsi', // KUNCI KRITIS: Harus sama dengan nama di GeoJSON
                    colorscale: color_scale,
                    autocolorscale: false,
                    marker: { line: { color: colors.grid, width: 0.5 } },
                    colorbar: { 
                        title: 'Kluster Ketimpangan',
                        titlefont: { color: colors.text, size: 12 },
                        tickvals: [1, 2, 3, 4], 
                        ticktext: ['K1: Tantangan\nModerat', 'K2: Aman &\nUnggul', 'K3: Paradoks\nPendidikan', 'K4: Ketimpangan\nParah'],
                        tickfont: { color: colors.text, size: 10 },
                        thickness: 20,
                        len: 0.7
                    },
                    zmin: 1, 
                    zmax: 4, 
                }];

                const layout = {
                    title: false,
                    geo: {
                        scope: 'asia',
                        showframe: false,
                        showcoastlines: true,
                        lonaxis: { 'range': [90, 145] },
                        lataxis: { 'range': [-15, 10] },
                        projection: { type: 'mercator' },
                        bgcolor: colors.background 
                    },
                    margin: { l: 0, r: 0, t: 0, b: 0 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                };

                Plotly.newPlot('klusterMap', data, layout, {responsive: true, displayModeBar: false});

            })
            .catch(error => {
                console.error('Error fetching GeoJSON or drawing map:', error);
                document.getElementById('klusterMap').innerHTML = 
                    `<div class="h-full flex items-center justify-center text-red-500">
                        Gagal memuat peta: Pastikan koneksi internet dan API stabil.
                    </div>`;
            });
    },

    // --- FUNGSI 2: BETA RANKING ---
    visualizeBetaRanking: function(betaData) {
        const colors = this.getColors();
        betaData.sort((a, b) => b['Magnitudo Dampak'] - a['Magnitudo Dampak']);

        const labels = betaData.map(item => item.Variabel);
        const values = betaData.map(item => item['Koefisien (Beta)']);

        const data = [{
            x: values,
            y: labels,
            type: 'bar',
            orientation: 'h',
            marker: {
                // Koefisien negatif pada HCLE = Dampak Positif (Penurunan HCLE)
                color: values.map(v => v < 0 ? colors.success : colors.danger) 
            },
            hoverinfo: 'text',
            text: values.map(v => `Dampak: ${v.toFixed(4)}`),
            name: 'Koefisien Beta'
        }];

        const layout = {
            height: 400,
            margin: { l: 80, r: 20, t: 30, b: 50 },
            xaxis: { 
                title: 'Koefisien (Dampak pada HCLE)',
                titlefont: { color: colors.text, size: 12 },
                gridcolor: colors.grid, zerolinecolor: colors.grid, tickfont: { color: colors.text }
            },
            yaxis: { automargin: true, tickfont: { color: colors.text } },
            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
            showlegend: false
        };

        Plotly.newPlot('betaChart', data, layout, {responsive: true, displayModeBar: false});
    },

    // --- FUNGSI 3: TREND CHART ---
    visualizeTrendChart: function(trendData) {
        const colors = this.getColors();
        const tahun = trendData.map(item => item.Tahun);
        
        const traceHCLE = {
            x: tahun, y: trendData.map(item => item.HCLE),
            mode: 'lines+markers', name: 'HCLE (Rata-rata Nasional)',
            line: { color: colors.primary }, marker: { size: 8 }
        };

        const traceNEET = {
            x: tahun, y: trendData.map(item => item.NEET),
            mode: 'lines+markers', name: 'NEET (%)',
            yaxis: 'y2', line: { color: colors.secondary }, marker: { size: 8 }
        };

        const data = [traceHCLE, traceNEET];

        const layout = {
            title: false,
            margin: { t: 30, b: 30, r: 50, l: 50 },
            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
                tickvals: tahun, ticktext: tahun, gridcolor: colors.grid, tickfont: { color: colors.text }
            },
            yaxis: { 
                title: 'HCLE', side: 'left', gridcolor: colors.grid, tickfont: { color: colors.text }, titlefont: { color: colors.text }
            },
            yaxis2: {
                title: 'NEET (%)', overlaying: 'y', side: 'right', gridcolor: colors.grid, tickfont: { color: colors.text }, titlefont: { color: colors.text }
            },
            legend: { x: 0, y: 1.1, orientation: 'h', font: { color: colors.text } }
        };

        Plotly.newPlot('trendChart', data, layout, {responsive: true, displayModeBar: false});
    },

}; // Akhir dari ChartManager

// JAMINAN GLOBAL SCOPE: Membuat fungsi-fungsi ini dapat dipanggil di script.js
const visualizeKlusterMap = ChartManager.visualizeKlusterMap.bind(ChartManager);
const visualizeBetaRanking = ChartManager.visualizeBetaRanking.bind(ChartManager);
const visualizeTrendChart = ChartManager.visualizeTrendChart.bind(ChartManager);