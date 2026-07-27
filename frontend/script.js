// script.js — halaman diagnostik.
// Tidak ada data contoh: kalau API mati, halaman menyatakan datanya tidak tersedia
// alih-alih menampilkan angka yang berbeda dari hasil model.

document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();
  UI.initTableToggles();
  UI.initModal('btnInfo', 'infoModal', 'btnCloseInfo');

  let latest = null;

  fetch('/api/dashboard_data')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      latest = data;
      setStatus(true, data);
      render(data);
      ChartManager.onThemeChange(() => {
        if (!latest) return;
        drawCharts(latest);
        drawSparks(latest.trend_data);
      });
    })
    .catch(err => {
      console.warn('API tidak tersedia:', err);
      setStatus(false);
      showUnavailable();
    });
});

function setStatus(online, d) {
  const el = document.getElementById('status');
  if (!el) return;
  el.hidden = false;
  el.className = 'status ' + (online ? 'status-on' : 'status-off');
  document.getElementById('statusText').textContent = online
    ? 'Model aktif · ' + d.audit.n_baris + ' observasi'
    : 'Server tidak terhubung';
}

/* ---------- RENDER ---------- */

function render(d) {
  const tahun = d.tahun_uji;
  const trend = d.trend_data;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const first = trend[0];

  // --- KPI ---
  setText('kpiYear', tahun);
  setText('kpiTestYear', tahun);
  setText('kpiHcli', UI.fmt(d.mean_hcli_2024, 4));

  const hcliChange = (last.HCLI - first.HCLI) / first.HCLI * 100;
  const hcliDelta = document.getElementById('kpiHcliDelta');
  hcliDelta.textContent = (hcliChange < 0 ? '↓ ' : '↑ ') +
    Math.abs(hcliChange).toFixed(1).replace('.', ',') + '%';
  hcliDelta.className = 'delta ' + (hcliChange < 0 ? 'delta-good' : 'delta-bad');

  document.getElementById('kpiNeet').innerHTML =
    UI.fmt(last.NEET, 2) + '<span class="stat-unit">%</span>';

  const neetChange = last.NEET - prev.NEET;
  const neetDelta = document.getElementById('kpiNeetDelta');
  neetDelta.textContent = (neetChange < 0 ? '↓ ' : '↑ ') +
    Math.abs(neetChange).toFixed(2).replace('.', ',') + ' poin';
  neetDelta.className = 'delta ' + (neetChange < 0 ? 'delta-good' : 'delta-bad');

  // Kluster terburuk = nomor tertinggi (penomoran sudah urut menurut HCLI)
  const profile = [...d.cluster_profile].sort((a, b) => a.HCLI - b.HCLI);
  const worst = profile[profile.length - 1];
  const best = profile[0];
  setText('kpiWorstN', worst.n);
  setText('kpiWorstNote',
    'HCLI ' + UI.fmt(worst.HCLI, 4) + ' — ' +
    (worst.HCLI / best.HCLI).toFixed(1).replace('.', ',') + '× kluster terbaik');

  const rmsePct = d.metrics.RMSE_pct_rentang * 100;
  document.getElementById('kpiRmse').innerHTML =
    rmsePct.toFixed(2).replace('.', ',') + '<span class="stat-unit">%</span>';
  document.getElementById('kpiRmseMeter').style.width =
    Math.min(rmsePct * 8, 100) + '%';

  // --- Meta ---
  const nProv = d.cluster_map_data.length;
  setText('metaObs', d.audit.n_baris + ' observasi · ' + nProv + ' provinsi');
  setText('metaTahun', 'Data panel ' + first.Tahun + '–' + last.Tahun);

  // --- Catatan audit: jelaskan sifat angka R² sebelum orang salah baca ---
  if (d.audit.is_rekonstruksi) {
    const el = document.getElementById('auditNote');
    el.textContent = '';
    const b = document.createElement('strong');
    b.textContent = 'Cara membaca angka di halaman ini. ';
    el.appendChild(b);
    el.appendChild(document.createTextNode(
      'HCLI disusun dari keenam variabel yang sama, jadi model di sini membongkar ' +
      'bobot indeks, bukan meramal. ' + d.audit.baris_persis + ' dari ' +
      d.audit.n_baris + ' baris bisa dihitung ulang persis. Karena itu R² yang ' +
      'tinggi bukan prestasi model, melainkan hitungan yang memang sudah pasti.'
    ));
  }

  // --- Tren: narasi singkat di bawah tiap chart ---
  setText('trendHcliNote',
    'Turun dari ' + UI.fmt(first.HCLI, 4) + ' (' + first.Tahun + ') ke ' +
    UI.fmt(last.HCLI, 4) + ' (' + last.Tahun + '), membaik ' +
    Math.abs(hcliChange).toFixed(1).replace('.', ',') + '%.');

  const neetPeak = trend.reduce((a, b) => (b.NEET > a.NEET ? b : a));
  setText('trendNeetNote',
    'Naik lebih dulu ke ' + UI.fmt(neetPeak.NEET, 2) + '% pada ' + neetPeak.Tahun +
    ', lalu turun ke ' + UI.fmt(last.NEET, 2) + '% pada ' + last.Tahun + '.');

  setText('kpiRmseNote', 'rentang ' + UI.fmt(d.metrics.RMSE, 4));

  drawSparks(trend);
  renderShareStrip(profile);
  renderFinding(d, profile);
  renderRankList(d.beta_ranking);
  renderClusters(profile, d.cluster_map_data);
  renderMapLegend(profile);
  fillTables(d, profile);
  drawCharts(d);
}

/* --- Sparkline: konteks arah di dalam kartu KPI, bukan chart penuh --- */
function drawSparks(trend) {
  spark('sparkHcli', trend.map(t => t.HCLI), 'var(--series-1)');
  spark('sparkNeet', trend.map(t => t.NEET), 'var(--series-2)');

  setText('sparkHcliA', trend[0].Tahun);
  setText('sparkHcliB', trend[trend.length - 1].Tahun);
  setText('sparkNeetA', trend[0].Tahun);
  setText('sparkNeetB', trend[trend.length - 1].Tahun);
}

function spark(id, values, color) {
  const svg = document.getElementById(id);
  if (!svg) return;
  svg.textContent = '';

  const NS = 'http://www.w3.org/2000/svg';
  const min = Math.min(...values), max = Math.max(...values);
  const span = (max - min) || 1;
  const pad = 4;

  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * 100,
    pad + (1 - (v - min) / span) * (30 - pad * 2)
  ]);

  const line = pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');

  const area = document.createElementNS(NS, 'polygon');
  area.setAttribute('points', '0,30 ' + line + ' 100,30');
  area.setAttribute('fill', color);
  area.setAttribute('class', 'spark-area');
  svg.appendChild(area);

  const path = document.createElementNS(NS, 'polyline');
  path.setAttribute('points', line);
  path.setAttribute('stroke', color);
  path.setAttribute('class', 'spark-line');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(path);

  // hanya titik akhir yang ditandai — bukan tiap titik
  const last = pts[pts.length - 1];
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('cx', last[0]);
  dot.setAttribute('cy', last[1]);
  dot.setAttribute('r', '2.6');
  dot.setAttribute('fill', color);
  dot.setAttribute('class', 'spark-dot');
  dot.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(dot);
}

/* --- Strip proporsi provinsi per kluster --- */
function renderShareStrip(profile) {
  const el = document.getElementById('shareStrip');
  if (!el) return;
  el.textContent = '';

  const total = profile.reduce((s, c) => s + c.n, 0);

  profile.forEach(c => {
    const num = parseInt(String(c.Kluster).replace(/\D/g, ''), 10);
    const bg = ChartManager.clusterColor(num);
    const seg = document.createElement('div');
    seg.className = 'share-seg';
    seg.style.flex = String(c.n);
    seg.style.background = bg;
    seg.style.color = ChartManager.inkOn(bg);
    seg.textContent = c.n;
    seg.title = c.Kluster + ': ' + c.n + ' dari ' + total + ' provinsi · HCLI ' +
                UI.fmt(c.HCLI, 4);
    el.appendChild(seg);
  });
}

/* --- Temuan kunci: satu kalimat yang paling menentukan --- */
function renderFinding(d, profile) {
  const top = d.beta_ranking[0];
  const second = d.beta_ranking[1];
  const kali = Math.abs(top['Beta terbaku'] / second['Beta terbaku']);

  document.getElementById('findingKey').textContent = UI.fmt(top['Beta terbaku'], 2);

  const body = document.getElementById('findingBody');
  body.textContent = '';
  const b = document.createElement('strong');
  b.textContent = ChartManager.varLabel(top.Variabel) + ' paling besar pengaruhnya.';
  body.appendChild(b);
  // Jangan di-lowercase: sebagian label berupa akronim (NEET, P1, P2, RLS, HLS).
  body.appendChild(document.createTextNode(
    ' Sekitar ' + kali.toFixed(1).replace('.', ',') + '× lipat ' +
    ChartManager.varLabel(second.Variabel) + ' di urutan kedua. Meski begitu, ' +
    'kelompok paling tertinggal justru paling sedikit terbantu.'
  ));

  document.getElementById('finding').hidden = false;
}

/* --- Daftar peringkat pengungkit di bawah chart --- */
function renderRankList(beta) {
  const el = document.getElementById('rankList');
  if (!el) return;
  el.textContent = '';

  beta.forEach((b, i) => {
    const v = b['Beta terbaku'];

    const row = document.createElement('div');
    row.className = 'rank-row';

    const num = document.createElement('span');
    num.className = 'rank-num';
    num.textContent = i + 1;

    const name = document.createElement('span');
    name.className = 'rank-name';
    const dot = document.createElement('span');
    dot.className = 'rank-dot';
    dot.style.background = v < 0 ? 'var(--pos)' : 'var(--neg)';
    const txt = document.createElement('span');
    txt.className = 'rank-text';
    txt.textContent = ChartManager.varLabel(b.Variabel);
    name.append(dot, txt);

    const val = document.createElement('span');
    val.className = 'rank-val';
    if (!b.Signifikan) {
      const tag = document.createElement('span');
      tag.className = 'tag-ns';
      tag.textContent = 'tidak signifikan';
      val.appendChild(tag);
    }
    const nv = document.createElement('span');
    nv.textContent = (v > 0 ? '+' : '−') + UI.fmt(Math.abs(v), 2);
    val.appendChild(nv);

    row.append(num, name, val);
    el.appendChild(row);
  });
}

function renderClusters(profile, mapData) {
  const list = document.getElementById('clusterList');
  list.textContent = '';

  // Karakterisasi dibaca dari angkanya sendiri, bukan label yang ditulis tangan.
  const rlsAll = profile.map(p => p.RLS);
  const minRls = Math.min(...rlsAll);

  profile.forEach((c, i) => {
    const num = parseInt(String(c.Kluster).replace(/\D/g, ''), 10);
    const provs = mapData
      .filter(m => m.Kluster === c.Kluster)
      .sort((a, b) => a.HCLI - b.HCLI)
      .map(m => UI.titleCase(m.Provinsi));

    let diagnosa;
    if (i === profile.length - 1) {
      diagnosa = 'Masalahnya kemiskinan, bukan sekolah. P1 ' + UI.fmt(c.P1, 2) +
        ' dan P2 ' + UI.fmt(c.P2, 2) + ' berlipat di atas kluster lain, padahal ' +
        'lama sekolahnya ' + UI.fmt(c.RLS, 2) + ' tahun, tertinggi dari semua kluster.';
    } else if (c.RLS === minRls) {
      diagnosa = 'Kemiskinannya sedang, tapi lama sekolahnya paling rendah: ' +
        UI.fmt(c.RLS, 2) + ' tahun. Perlu penguatan pendidikan dasar dan menengah.';
    } else {
      diagnosa = 'Paling baik dari semua kluster. NEET ' + UI.fmt(c.NEET, 2) +
        '%, akses internet ' + UI.fmt(c.Internet, 2) + ', keduanya terbaik.';
    }

    const item = document.createElement('div');
    item.className = 'cluster-item';

    const rule = document.createElement('div');
    rule.className = 'cluster-rule';
    rule.style.background = ChartManager.clusterColor(num);

    const body = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'cluster-name';
    name.textContent = c.Kluster + ' · ' + c.n + ' provinsi';
    const meta = document.createElement('div');
    meta.className = 'cluster-meta';
    meta.textContent = diagnosa;
    const pr = document.createElement('div');
    pr.className = 'cluster-provs';
    pr.textContent = provs.join(', ');
    body.append(name, meta, pr);

    const val = document.createElement('div');
    val.className = 'cluster-val';
    val.textContent = UI.fmt(c.HCLI, 4);
    const vlab = document.createElement('div');
    vlab.className = 'cluster-val-label';
    vlab.textContent = 'HCLI';
    val.appendChild(vlab);

    item.append(rule, body, val);
    list.appendChild(item);
  });
}

function renderMapLegend(profile) {
  const el = document.getElementById('mapLegend');
  el.textContent = '';

  profile.forEach(c => {
    const num = parseInt(String(c.Kluster).replace(/\D/g, ''), 10);
    const item = document.createElement('span');
    item.className = 'legend-item';

    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = ChartManager.clusterColor(num);

    const txt = document.createElement('span');
    txt.textContent = c.Kluster + ' (' + c.n + ') · HCLI ' + UI.fmt(c.HCLI, 3);

    item.append(sw, txt);
    el.appendChild(item);
  });
}

function fillTables(d, profile) {
  UI.fillTable('betaTableBody', d.beta_ranking.map(b => [
    ChartManager.varLabel(b.Variabel),
    UI.fmt(b['Koefisien (Beta)'], 5),
    UI.fmt(b['Beta terbaku'], 4),
    b['P-Value (clustered)'] < 0.001 ? '<0,001' : UI.fmt(b['P-Value (clustered)'], 4)
  ]));

  UI.fillTable('mapTableBody', [...d.cluster_map_data]
    .sort((a, b) => b.HCLI - a.HCLI)
    .map(m => [UI.titleCase(m.Provinsi), m.Kluster, UI.fmt(m.HCLI, 4)]));

  UI.fillTable('profileTableBody', profile.map(c => [
    c.Kluster, c.n,
    UI.fmt(c.NEET, 2), UI.fmt(c.P1, 2), UI.fmt(c.P2, 2),
    UI.fmt(c.Internet, 2), UI.fmt(c.RLS, 2), UI.fmt(c.HLS, 2),
    UI.fmt(c.HCLI, 4)
  ]));

  UI.fillTable('trendTableBody', d.trend_data.map(t => [
    t.Tahun, UI.fmt(t.HCLI, 4), UI.fmt(t.NEET, 2)
  ]));
}

function drawCharts(d) {
  ChartManager.betaRanking(d.beta_ranking);
  ChartManager.trendHCLI(d.trend_data);
  ChartManager.trendNEET(d.trend_data);
  ChartManager.klusterMap(d.cluster_map_data);
}

/* ---------- KEADAAN TANPA DATA ---------- */

function showUnavailable() {
  ['betaChart', 'klusterMap', 'trendHcli', 'trendNeet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Data tidak tersedia.';
      el.appendChild(p);
    }
  });

  ['kpiHcli', 'kpiNeet', 'kpiWorstN', 'kpiRmse'].forEach(id => setText(id, '—'));
  ['kpiHcliDelta', 'kpiNeetDelta', 'kpiWorstNote'].forEach(id => setText(id, '—'));

  const list = document.getElementById('clusterList');
  if (list) {
    list.textContent = '';
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Data tidak tersedia.';
    list.appendChild(p);
  }

  UI.toast(
    'Server tidak terhubung',
    'Jalankan "python app.py" lalu muat ulang halaman. Angkanya dikosongkan supaya '
    + 'tidak tertukar dengan hasil model yang asli.',
    'warn', 0
  );
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}
