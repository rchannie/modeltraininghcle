// chart_manager.js — render semua chart lewat Plotly.
// Warna tidak ditulis langsung di sini: diambil dari CSS custom property supaya
// light/dark dan palet cukup diubah di satu tempat (app.css).

const ChartManager = (() => {

  // Nama provinsi di CSV (HURUF BESAR) -> nama di GeoJSON 38 provinsi.
  const PROVINCE_MAP = {
    'ACEH': 'Aceh',
    'BALI': 'Bali',
    'BANTEN': 'Banten',
    'BENGKULU': 'Bengkulu',
    'DI YOGYAKARTA': 'Daerah Istimewa Yogyakarta',
    'DKI JAKARTA': 'DKI Jakarta',
    'GORONTALO': 'Gorontalo',
    'JAMBI': 'Jambi',
    'JAWA BARAT': 'Jawa Barat',
    'JAWA TENGAH': 'Jawa Tengah',
    'JAWA TIMUR': 'Jawa Timur',
    'KALIMANTAN BARAT': 'Kalimantan Barat',
    'KALIMANTAN SELATAN': 'Kalimantan Selatan',
    'KALIMANTAN TENGAH': 'Kalimantan Tengah',
    'KALIMANTAN TIMUR': 'Kalimantan Timur',
    'KALIMANTAN UTARA': 'Kalimantan Utara',
    'KEP. BANGKA BELITUNG': 'Kepulauan Bangka Belitung',
    'KEP. RIAU': 'Kepulauan Riau',
    'LAMPUNG': 'Lampung',
    'MALUKU': 'Maluku',
    'MALUKU UTARA': 'Maluku Utara',
    'NUSA TENGGARA BARAT': 'Nusa Tenggara Barat',
    'NUSA TENGGARA TIMUR': 'Nusa Tenggara Timur',
    'PAPUA': 'Papua',
    'PAPUA BARAT': 'Papua Barat',
    'RIAU': 'Riau',
    'SULAWESI BARAT': 'Sulawesi Barat',
    'SULAWESI SELATAN': 'Sulawesi Selatan',
    'SULAWESI TENGAH': 'Sulawesi Tengah',
    'SULAWESI TENGGARA': 'Sulawesi Tenggara',
    'SULAWESI UTARA': 'Sulawesi Utara',
    'SUMATERA BARAT': 'Sumatera Barat',
    'SUMATERA SELATAN': 'Sumatera Selatan',
    'SUMATERA UTARA': 'Sumatera Utara'
    // 4 DOB Papua ada di GeoJSON tapi belum ada datanya di CSV -> tetap kosong.
  };

  const LABEL = {
    NEET: 'NEET', P1: 'Kedalaman kemiskinan (P1)', P2: 'Keparahan kemiskinan (P2)',
    Internet: 'Akses internet', RLS: 'Rata-rata lama sekolah', HLS: 'Harapan lama sekolah'
  };

  const css = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const tokens = () => ({
    surface: css('--surface-1'),
    text1: css('--text-1'),
    text2: css('--text-2'),
    muted: css('--muted'),
    grid: css('--grid'),
    axis: css('--axis'),
    k1: css('--k1'), k2: css('--k2'), k3: css('--k3'),
    s1: css('--series-1'), s2: css('--series-2'),
    pos: css('--pos'), neg: css('--neg')
  });

  const BASE_LAYOUT = (t) => ({
    font: { family: 'system-ui, -apple-system, "Segoe UI", sans-serif', size: 12, color: t.text2 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    hoverlabel: {
      bgcolor: t.surface,
      bordercolor: t.axis,
      font: { color: t.text1, size: 12.5,
              family: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
      align: 'left'
    },
    showlegend: false
  });

  const CONFIG = { responsive: true, displayModeBar: false };

  const AXIS = (t) => ({
    gridcolor: t.grid, zerolinecolor: t.axis, linecolor: t.axis,
    tickfont: { color: t.muted, size: 11.5 },
    automargin: true
  });

  const clusterColor = (n, t) => [t.k1, t.k2, t.k3][n - 1] || t.k2;
  const clusterNum = (s) => parseInt(String(s).replace(/\D/g, ''), 10) || 1;
  const fmt = (v, d = 4) => Number(v).toFixed(d);

  return {
    mapProvinceNameToGeoJSON(name) {
      return PROVINCE_MAP[name] || name;
    },
    clusterColor(n) { return clusterColor(n, tokens()); },
    varLabel(v) { return LABEL[v] || v; },

    /* Teks di ATAS bidang berwarna: dipilih menurut luminansi bidangnya, bukan
       ditebak per nomor kluster — step yang sama bisa terang di satu mode dan
       gelap di mode lain. */
    inkOn(hex) {
      const m = /^#?([\da-f]{6})$/i.exec(String(hex).trim());
      if (!m) return '#0b0b0b';
      const n = parseInt(m[1], 16);
      const lin = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const L = 0.2126 * lin((n >> 16) & 255)
              + 0.7152 * lin((n >> 8) & 255)
              + 0.0722 * lin(n & 255);
      // Bandingkan rasio kontras terhadap putih dan terhadap tinta gelap.
      const cW = 1.05 / (L + 0.05);
      const cK = (L + 0.05) / 0.05;
      return cW >= cK ? '#ffffff' : '#0b0b0b';
    },

    /* --- PERINGKAT PENGUNGKIT ---------------------------------------------
       Bar horizontal diverging: arah = tanda efek pada HCLI.
       Panjang bar = koefisien terbaku (satu SD), supaya antarvariabel setara. */
    betaRanking(beta, elId = 'betaChart') {
      const t = tokens();
      const rows = [...beta].sort(
        (a, b) => Math.abs(a['Beta terbaku']) - Math.abs(b['Beta terbaku'])
      );

      const vals = rows.map(r => r['Beta terbaku']);
      const names = rows.map(r => r.Variabel);

      const data = [{
        type: 'bar', orientation: 'h',
        x: vals, y: names,
        width: 0.55,                       // marks tipis, sisakan udara
        marker: { color: vals.map(v => (v < 0 ? t.pos : t.neg)) },
        // Label diletakkan di luar ujung bar; Plotly membalik sisinya sesuai tanda.
        text: vals.map(v => (v > 0 ? '+' : '−') + Math.abs(v).toFixed(2)),
        textposition: 'outside',
        outsidetextfont: { color: t.text2, size: 11.5 },
        constraintext: 'none',
        cliponaxis: false,
        customdata: rows.map(r => [
          LABEL[r.Variabel] || r.Variabel,
          r['Koefisien (Beta)'].toFixed(5),
          r['P-Value (clustered)'] < 0.001 ? '<0,001'
            : r['P-Value (clustered)'].toFixed(4),
          r.Signifikan ? 'signifikan' : 'tidak signifikan'
        ]),
        hovertemplate:
          '<b>%{customdata[0]}</b><br>' +
          'Efek per 1 SD: %{x:.4f}<br>' +
          'Koefisien mentah: %{customdata[1]}<br>' +
          'p (klaster): %{customdata[2]} — %{customdata[3]}' +
          '<extra></extra>'
      }];

      const pad = Math.max(...vals.map(Math.abs)) * 1.35;

      Plotly.react(elId, data, {
        ...BASE_LAYOUT(t),
        height: 260,
        margin: { l: 8, r: 8, t: 6, b: 28 },
        bargap: 0.45,
        xaxis: {
          ...AXIS(t), range: [-pad, pad], zeroline: true, zerolinewidth: 1,
          tickfont: { color: t.muted, size: 11 }
        },
        yaxis: {
          ...AXIS(t), gridcolor: 'rgba(0,0,0,0)',
          tickfont: { color: t.text1, size: 12.5 }
        }
      }, CONFIG);
    },

    /* --- TREN: dua chart terpisah, satu sumbu masing-masing -----------------
       Dual-axis (dua skala y pada satu plot) menyiratkan korelasi yang tidak
       ada di data, jadi HCLI dan NEET dipisah. */
    trendHCLI(trend, elId = 'trendHcli') {
      const t = tokens();
      const x = trend.map(d => d.Tahun);
      const y = trend.map(d => d.HCLI);

      const data = [{
        type: 'scatter', mode: 'lines+markers',
        x, y,
        line: { color: t.s1, width: 2, shape: 'linear' },
        marker: {
          color: t.s1, size: 8,
          line: { color: t.surface, width: 2 }   // surface ring
        },
        hovertemplate: '<b>%{x}</b><br>HCLI %{y:.4f}<extra></extra>'
      }, {
        // label langsung hanya pada titik akhir — bukan pada tiap titik
        type: 'scatter', mode: 'text',
        x: [x[x.length - 1]], y: [y[y.length - 1]],
        text: [fmt(y[y.length - 1])],
        textposition: 'top center',
        textfont: { color: t.text1, size: 12 },
        hoverinfo: 'skip'
      }];

      Plotly.react(elId, data, {
        ...BASE_LAYOUT(t),
        height: 190,
        margin: { l: 44, r: 20, t: 16, b: 30 },
        hovermode: 'x unified',
        xaxis: { ...AXIS(t), tickvals: x, gridcolor: 'rgba(0,0,0,0)' },
        yaxis: { ...AXIS(t), tickformat: '.2f', rangemode: 'tozero' }
      }, CONFIG);
    },

    trendNEET(trend, elId = 'trendNeet') {
      const t = tokens();
      const x = trend.map(d => d.Tahun);
      const y = trend.map(d => d.NEET);

      const data = [{
        type: 'scatter', mode: 'lines+markers',
        x, y,
        line: { color: t.s2, width: 2 },
        marker: { color: t.s2, size: 8, line: { color: t.surface, width: 2 } },
        hovertemplate: '<b>%{x}</b><br>NEET %{y:.2f}%<extra></extra>'
      }, {
        type: 'scatter', mode: 'text',
        x: [x[x.length - 1]], y: [y[y.length - 1]],
        text: [y[y.length - 1].toFixed(2) + '%'],
        textposition: 'top center',
        textfont: { color: t.text1, size: 12 },
        hoverinfo: 'skip'
      }];

      Plotly.react(elId, data, {
        ...BASE_LAYOUT(t),
        height: 190,
        margin: { l: 44, r: 20, t: 16, b: 30 },
        hovermode: 'x unified',
        xaxis: { ...AXIS(t), tickvals: x, gridcolor: 'rgba(0,0,0,0)' },
        yaxis: { ...AXIS(t), ticksuffix: '%' }
      }, CONFIG);
    },

    /* --- PETA KLUSTER ------------------------------------------------------
       Kluster sudah dinomori ulang menurut HCLI (K1 terbaik -> K3 terburuk),
       jadi warnanya ramp ordinal satu hue, bukan hue kategorikal acak. */
    klusterMap(mapData, elId = 'klusterMap') {
      const t = tokens();
      const self = this;

      return fetch('/api/geojson')
        .then(r => r.json())
        .then(geojson => {
          const nums = mapData.map(d => clusterNum(d.Kluster));

          // Skala diskret: tiap kluster satu step, tanpa gradasi antara.
          const steps = [t.k1, t.k2, t.k3];
          const scale = [];
          steps.forEach((c, i) => {
            scale.push([i / steps.length, c]);
            scale.push([(i + 1) / steps.length, c]);
          });

          const data = [{
            type: 'choropleth',
            geojson,
            locations: mapData.map(d => self.mapProvinceNameToGeoJSON(d.Provinsi)),
            z: nums,
            zmin: 1, zmax: 3,
            colorscale: scale,
            autocolorscale: false,
            showscale: false,               // legenda HTML dipakai sebagai gantinya
            marker: { line: { color: t.surface, width: 0.6 } },  // surface gap
            customdata: mapData.map(d => [d.Provinsi, d.Kluster, fmt(d.HCLI)]),
            hovertemplate:
              '<b>%{customdata[0]}</b><br>' +
              '%{customdata[1]}<br>HCLI %{customdata[2]}<extra></extra>'
          }];

          Plotly.react(elId, data, {
            ...BASE_LAYOUT(t),
            height: 320,
            margin: { l: 0, r: 0, t: 0, b: 0 },
            geo: {
              scope: 'asia', showframe: false, showcoastlines: false,
              showland: true, landcolor: t.grid,
              lonaxis: { range: [94, 142] },
              lataxis: { range: [-11, 7] },
              projection: { type: 'mercator' },
              bgcolor: 'rgba(0,0,0,0)'
            }
          }, CONFIG);
        })
        .catch(err => {
          console.error('Gagal memuat peta:', err);
          const el = document.getElementById(elId);
          if (el) {
            el.innerHTML =
              '<p class="empty">Peta tidak dapat dimuat. Tabel di bawah memuat data yang sama.</p>';
          }
        });
    },

    /* --- SIMULASI: sebelum -> sesudah (dumbbell, satu hue dua shade) ------- */
    simulationChart(awal, baru, elId = 'simulationChart') {
      const t = tokens();
      const membaik = baru <= awal;
      // Saat belum ada skenario kedua titik berimpit; labelnya digabung supaya
      // teksnya tidak saling menimpa.
      const identik = Math.abs(baru - awal) < 1e-9;

      const data = [{
        type: 'scatter', mode: 'lines',
        x: [awal, baru], y: ['HCLI', 'HCLI'],
        line: { color: t.axis, width: 2 },
        hoverinfo: 'skip'
      }, {
        type: 'scatter', mode: 'markers+text',
        x: [awal], y: ['HCLI'],
        marker: { color: t.muted, size: 14, line: { color: t.surface, width: 2 } },
        text: [identik ? 'Belum ada perubahan · ' + fmt(awal) : 'Awal ' + fmt(awal)],
        textposition: 'top center',
        textfont: { color: t.text2, size: 12 },
        hovertemplate: 'HCLI awal %{x:.4f}<extra></extra>'
      }, {
        type: 'scatter', mode: identik ? 'markers' : 'markers+text',
        x: [baru], y: ['HCLI'],
        marker: {
          color: membaik ? t.pos : t.neg, size: 14,
          line: { color: t.surface, width: 2 }
        },
        text: ['Simulasi ' + fmt(baru)],
        textposition: 'bottom center',
        textfont: { color: t.text1, size: 12.5 },
        hovertemplate: 'HCLI simulasi %{x:.4f}<extra></extra>'
      }];

      const lo = Math.min(awal, baru), hi = Math.max(awal, baru);
      const pad = Math.max((hi - lo) * 0.9, 0.02);

      Plotly.react(elId, data, {
        ...BASE_LAYOUT(t),
        height: 150,
        margin: { l: 46, r: 24, t: 30, b: 34 },
        xaxis: { ...AXIS(t), range: [lo - pad, hi + pad], tickformat: '.3f' },
        yaxis: { ...AXIS(t), gridcolor: 'rgba(0,0,0,0)',
                 tickfont: { color: t.text2, size: 12 } }
      }, CONFIG);
    },

    /* --- Re-render semua chart saat tema berubah --------------------------- */
    onThemeChange(fn) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', fn);
      new MutationObserver(fn).observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-theme']
      });
    }
  };
})();
