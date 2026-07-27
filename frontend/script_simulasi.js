// script_simulasi.js — halaman simulasi kebijakan.
// Semua perhitungan dilakukan server. Kalau server mati, halaman menyatakannya
// alih-alih menghitung estimasi kasar yang berbeda dari model.

const VARS = [
  {
    key: 'NEET', name: 'NEET',
    desc: 'Pemuda 15–24 tahun yang tidak sekolah dan tidak bekerja. Makin turun makin baik.',
    unit: '%'
  },
  {
    key: 'Internet', name: 'Akses internet',
    desc: 'Akses internet rumah tangga. Pengungkit paling kuat.',
    unit: ''
  },
  {
    key: 'RLS', name: 'Rata-rata lama sekolah',
    desc: 'Lama sekolah penduduk 25 tahun ke atas.',
    unit: 'tahun'
  },
  {
    key: 'P2', name: 'Keparahan kemiskinan (P2)',
    desc: 'Seberapa berat kondisi penduduk termiskin. Makin turun makin baik.',
    unit: ''
  }
];

const PRESETS = {
  internet: { Internet: 10 },
  neet:     { NEET: -20 },
  rls:      { RLS: 10 },
  paket:    { Internet: 10, NEET: -10, P2: -10 }
};

const state = {
  changes: { NEET: 0, Internet: 0, RLS: 0, P2: 0 },
  profile: [],
  baseline: null,
  last: null,
  online: false
};

document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();
  UI.initTableToggles();
  UI.initModal('btnInfo', 'infoModal', 'btnCloseInfo');

  buildSliders();

  document.getElementById('btnRun').addEventListener('click', runSimulation);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('target-region').addEventListener('change', onRegionChange);

  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  ChartManager.onThemeChange(() => {
    if (state.last) {
      ChartManager.simulationChart(state.last.original_hcli_mean,
                                   state.last.new_hcli_prediction);
    } else if (state.baseline != null) {
      ChartManager.simulationChart(state.baseline, state.baseline);
    }
  });

  loadRegions();
});

/* ---------- SLIDER ---------- */

function buildSliders() {
  const host = document.getElementById('sliders');
  host.textContent = '';

  VARS.forEach(v => {
    const row = document.createElement('div');
    row.className = 'slider-row';

    const head = document.createElement('div');
    head.className = 'slider-head';

    const name = document.createElement('label');
    name.className = 'slider-name';
    name.setAttribute('for', 'sl-' + v.key);
    name.textContent = v.name;

    const val = document.createElement('output');
    val.className = 'slider-val';
    val.id = 'val-' + v.key;
    val.setAttribute('for', 'sl-' + v.key);
    val.textContent = '0%';

    head.append(name, val);

    const desc = document.createElement('p');
    desc.className = 'slider-desc';
    desc.textContent = v.desc;

    const input = document.createElement('input');
    input.type = 'range';
    input.id = 'sl-' + v.key;
    input.min = '-30';
    input.max = '30';
    input.step = '1';
    input.value = '0';
    input.setAttribute('aria-describedby', 'val-' + v.key);
    input.addEventListener('input', () => setChange(v.key, Number(input.value)));

    const scale = document.createElement('div');
    scale.className = 'slider-scale';
    ['−30%', '0', '+30%'].forEach(s => {
      const span = document.createElement('span');
      span.textContent = s;
      scale.appendChild(span);
    });

    row.append(head, desc, input, scale);
    host.appendChild(row);
  });
}

function setChange(key, pct) {
  state.changes[key] = pct;

  const out = document.getElementById('val-' + key);
  // Minus tipografis (U+2212), bukan hyphen — sejajar dengan lebar tanda plus.
  out.textContent = pct > 0 ? '+' + pct + '%'
                  : pct < 0 ? '−' + Math.abs(pct) + '%'
                  : '0%';

  const slider = document.getElementById('sl-' + key);
  if (Number(slider.value) !== pct) slider.value = String(pct);
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;

  VARS.forEach(v => setChange(v.key, preset[v.key] || 0));
  runSimulation();
}

function resetAll() {
  VARS.forEach(v => setChange(v.key, 0));

  document.getElementById('resDelta').textContent = '—';
  document.getElementById('resDeltaNote').textContent = 'Belum dijalankan';
  document.getElementById('resDelta').style.color = '';

  if (state.baseline != null) {
    document.getElementById('resBaru').textContent = UI.fmt(state.baseline, 4);
    ChartManager.simulationChart(state.baseline, state.baseline);
  }

  state.last = null;
  clearContrib();
  clearClusterCompare();
}

function setStatus(online, d) {
  const el = document.getElementById('status');
  if (!el) return;
  el.hidden = false;
  el.className = 'status ' + (online ? 'status-on' : 'status-off');
  document.getElementById('statusText').textContent = online
    ? 'Model aktif · ' + d.cluster_map_data.length + ' provinsi'
    : 'Server tidak terhubung';
}

/* ---------- DATA AWAL ---------- */

function loadRegions() {
  fetch('/api/dashboard_data')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(d => {
      state.online = true;
      setStatus(true, d);
      state.profile = [...d.cluster_profile].sort((a, b) => a.HCLI - b.HCLI);

      const select = document.getElementById('target-region');
      state.profile.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.Kluster;
        opt.textContent = c.Kluster + ' — ' + c.n + ' provinsi · HCLI ' + UI.fmt(c.HCLI, 4);
        select.appendChild(opt);
      });

      state.baseline = d.mean_hcli_2024;
      document.getElementById('resAwal').textContent = UI.fmt(state.baseline, 4);
      document.getElementById('resBaru').textContent = UI.fmt(state.baseline, 4);
      document.getElementById('resScope').textContent =
        'Nasional · ' + d.cluster_map_data.length + ' provinsi';
      document.getElementById('resBaruNote').textContent = 'Belum ada perubahan';

      ChartManager.simulationChart(state.baseline, state.baseline);
      onRegionChange();
    })
    .catch(err => {
      console.warn('API tidak tersedia:', err);
      setStatus(false);
      document.getElementById('btnRun').disabled = true;
      document.getElementById('simulationChart').innerHTML =
        '<p class="empty">Data tidak tersedia.</p>';
      UI.toast(
        'Server tidak terhubung',
        'Jalankan "python app.py" lalu muat ulang halaman. Simulasi dimatikan supaya '
        + 'tidak memunculkan angka di luar hasil model.',
        'warn', 0
      );
    });
}

function onRegionChange() {
  const region = document.getElementById('target-region').value;
  const hint = document.getElementById('regionHint');

  if (region === 'Nasional') {
    hint.textContent = 'Pilih satu kluster kalau kebijakannya khusus wilayah tertentu.';
    return;
  }

  const c = state.profile.find(p => p.Kluster === region);
  if (c) {
    hint.textContent = c.n + ' provinsi · HCLI rata-rata ' + UI.fmt(c.HCLI, 4) +
      ' · NEET ' + UI.fmt(c.NEET, 2) + '% · akses internet ' + UI.fmt(c.Internet, 2);
  }
}

/* ---------- SIMULASI ---------- */

function runSimulation() {
  if (!state.online) return;

  const region = document.getElementById('target-region').value;

  const payload = {};
  Object.entries(state.changes).forEach(([k, v]) => {
    if (v !== 0) payload[k] = v / 100;
  });

  if (Object.keys(payload).length === 0) {
    UI.toast('Belum ada yang diubah',
      'Geser salah satu slider dulu, atau pakai skenario siap pakai di bawahnya.',
      'warn', 6000);
    return;
  }

  const btn = document.getElementById('btnRun');
  btn.disabled = true;
  btn.textContent = 'Menghitung…';
  // Tahan render sebelumnya dengan opasitas turun — tanpa skeleton, tanpa lompatan layout
  document.getElementById('simulationChart').classList.add('is-loading');

  fetch('/api/run_simulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_region: region, changes: payload })
  })
    .then(r => r.json())
    .then(res => {
      if (!res.success) throw new Error(res.error || 'Simulasi gagal');
      state.last = res;
      renderResult(res);
      runClusterCompare(payload, region);
    })
    .catch(err => {
      console.error(err);
      UI.toast('Simulasi gagal', String(err.message || err), 'bad', 8000);
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = 'Jalankan simulasi';
      document.getElementById('simulationChart').classList.remove('is-loading');
    });
}

function renderResult(res) {
  const awal = res.original_hcli_mean;
  const baru = res.new_hcli_prediction;
  const delta = res.delta_hcli;              // baru - awal
  const membaik = delta < 0;

  document.getElementById('resAwal').textContent = UI.fmt(awal, 4);
  document.getElementById('resBaru').textContent = UI.fmt(baru, 4);
  document.getElementById('resScope').textContent =
    res.wilayah + ' · ' + res.n_provinsi + ' provinsi';

  const dEl = document.getElementById('resDelta');
  dEl.textContent = (delta > 0 ? '+' : '−') + UI.fmt(Math.abs(delta), 4);
  dEl.style.color = membaik ? 'var(--good-ink)' : 'var(--critical)';

  document.getElementById('resDeltaNote').textContent =
    (membaik ? 'HCLI turun ' : 'HCLI naik ') +
    Math.abs(res.delta_persen * 100).toFixed(1).replace('.', ',') + '%' +
    (membaik ? ' — membaik' : ' — memburuk');

  document.getElementById('resBaruNote').textContent =
    membaik ? 'Lebih baik dari kondisi awal' : 'Lebih buruk dari kondisi awal';

  ChartManager.simulationChart(awal, baru);
  renderContrib(res.contributions, delta);
}

function renderContrib(contrib, totalDelta) {
  const host = document.getElementById('contrib');
  host.textContent = '';

  const entries = Object.entries(contrib || {});
  if (!entries.length) {
    clearContrib();
    return;
  }

  const maxAbs = Math.max(...entries.map(([, c]) => Math.abs(c.impact)), 1e-9);
  const wrap = document.createElement('div');
  wrap.className = 'contrib';

  // Terbesar dampaknya di atas
  entries.sort((a, b) => Math.abs(b[1].impact) - Math.abs(a[1].impact));

  // Track diverging hanya dipakai kalau kontribusinya memang berlawanan arah.
  // Kalau semuanya searah, bar dari tepi kiri memakai lebar penuh dan lebih terbaca.
  const adaDuaArah = entries.some(([, c]) => c.impact < 0)
                  && entries.some(([, c]) => c.impact > 0);

  entries.forEach(([key, c]) => {
    const item = document.createElement('div');
    item.className = 'contrib-item';

    const head = document.createElement('div');
    head.className = 'contrib-head';

    const name = document.createElement('span');
    name.className = 'contrib-name';
    const chg = Math.round(c.change * 100);
    name.textContent = ChartManager.varLabel(key) + ' ' +
      (chg > 0 ? '+' + chg : chg < 0 ? '−' + Math.abs(chg) : '0') + '%';

    const val = document.createElement('span');
    val.className = 'contrib-val';
    val.textContent = (c.impact > 0 ? '+' : '−') + UI.fmt(Math.abs(c.impact), 4);

    head.append(name, val);

    const track = document.createElement('div');
    track.className = 'contrib-track';

    const bar = document.createElement('div');
    bar.className = 'contrib-bar';
    bar.style.background = c.impact < 0 ? 'var(--pos)' : 'var(--neg)';

    if (adaDuaArah) {
      // Kontribusi berlawanan arah: titik nol di tengah, kiri menurunkan HCLI.
      const mid = document.createElement('div');
      mid.className = 'contrib-mid';
      track.appendChild(mid);

      bar.style.width = (Math.abs(c.impact) / maxAbs * 50) + '%';
      bar.style[c.impact < 0 ? 'right' : 'left'] = '50%';
    } else {
      // Semua searah: bar tumbuh dari tepi kiri memakai lebar penuh.
      bar.style.width = (Math.abs(c.impact) / maxAbs * 100) + '%';
      bar.style.left = '0';
    }

    track.appendChild(bar);
    item.append(head, track);
    wrap.appendChild(item);
  });

  host.appendChild(wrap);

  // Legenda hanya memuat arah yang benar-benar muncul di chart.
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.style.marginTop = '12px';
  [
    ['var(--pos)', 'Menurunkan HCLI', entries.some(([, c]) => c.impact < 0)],
    ['var(--neg)', 'Menaikkan HCLI', entries.some(([, c]) => c.impact > 0)]
  ].forEach(([color, label, tampil]) => {
    if (!tampil) return;
    const it = document.createElement('span');
    it.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = color;
    const tx = document.createElement('span');
    tx.textContent = label;
    it.append(sw, tx);
    legend.appendChild(it);
  });
  host.appendChild(legend);

  UI.fillTable('contribTableBody', entries.map(([key, c]) => [
    ChartManager.varLabel(key),
    (c.change > 0 ? '+' : '') + Math.round(c.change * 100) + '%',
    UI.fmt(c.coef, 5),
    UI.fmt(c.impact, 5)
  ]));

  const sum = entries.reduce((s, [, c]) => s + c.impact, 0);
  const signed = (v) => (v < 0 ? '−' : '+') + UI.fmt(Math.abs(v), 4);
  document.getElementById('contribNote').textContent =
    'Total kontribusi ' + signed(sum) + ', perubahan sebenarnya ' +
    signed(totalDelta) + '. Kalau ada selisih, itu wajar: rincian ini dihitung ' +
    'per variabel, sedangkan model menghitung semuanya sekaligus.';
}

/* --- Skenario yang sama dijalankan pada tiap kluster --- */
function runClusterCompare(payload, aktif) {
  const host = document.getElementById('clusterCompare');
  if (!host || !state.profile.length) return;

  Promise.all(state.profile.map(c =>
    fetch('/api/run_simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_region: c.Kluster, changes: payload })
    })
      .then(r => r.json())
      .then(res => ({ kluster: c.Kluster, n: c.n, res }))
      .catch(() => null)
  ))
    .then(hasil => renderClusterCompare(hasil.filter(Boolean), aktif))
    .catch(err => console.warn('Perbandingan kluster gagal:', err));
}

function renderClusterCompare(hasil, aktif) {
  const host = document.getElementById('clusterCompare');
  host.textContent = '';

  if (!hasil.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Perbandingan tidak tersedia.';
    host.appendChild(p);
    return;
  }

  // Semua bar berbagi satu skala supaya panjangnya bisa dibandingkan langsung.
  const maxAbs = Math.max(...hasil.map(h => Math.abs(h.res.delta_persen)), 1e-9);

  const wrap = document.createElement('div');
  wrap.className = 'cmp';

  hasil.forEach(h => {
    const num = parseInt(String(h.kluster).replace(/\D/g, ''), 10);
    const pct = h.res.delta_persen * 100;
    const membaik = pct < 0;

    const row = document.createElement('div');
    row.className = 'cmp-row' + (h.kluster === aktif ? ' cmp-current' : '');
    if (h.kluster === aktif) row.style.padding = '8px 10px';

    const head = document.createElement('div');
    head.className = 'cmp-head';

    const name = document.createElement('span');
    name.className = 'cmp-name';
    const dot = document.createElement('span');
    dot.className = 'cmp-dot';
    dot.style.background = ChartManager.clusterColor(num);
    const label = document.createElement('span');
    label.textContent = h.kluster;
    const n = document.createElement('span');
    n.className = 'cmp-n';
    n.textContent = h.n + ' provinsi' + (h.kluster === aktif ? ' · sasaran saat ini' : '');
    name.append(dot, label, n);

    const val = document.createElement('span');
    val.className = 'cmp-val' + (membaik ? '' : ' cmp-val-bad');
    val.textContent = (membaik ? '−' : '+') + Math.abs(pct).toFixed(1).replace('.', ',') + '%';

    head.append(name, val);

    const track = document.createElement('div');
    track.className = 'cmp-track';
    const bar = document.createElement('div');
    bar.className = 'cmp-bar';
    bar.style.width = (Math.abs(pct) / (maxAbs * 100) * 100) + '%';
    bar.style.background = membaik ? ChartManager.clusterColor(num) : 'var(--neg)';
    track.appendChild(bar);

    row.append(head, track);
    wrap.appendChild(row);
  });

  host.appendChild(wrap);

  // Narasi otomatis: seberapa timpang dampaknya antar kelompok
  const urut = [...hasil].sort((a, b) => a.res.delta_persen - b.res.delta_persen);
  const kuat = urut[0], lemah = urut[urut.length - 1];
  if (kuat.kluster !== lemah.kluster) {
    const note = document.createElement('p');
    note.className = 'chart-note';
    note.textContent =
      'Skenario yang sama memperbaiki ' + kuat.kluster + ' sebesar ' +
      Math.abs(kuat.res.delta_persen * 100).toFixed(1).replace('.', ',') + '%, tapi ' +
      lemah.kluster + ' cuma ' +
      Math.abs(lemah.res.delta_persen * 100).toFixed(1).replace('.', ',') +
      '%. Satu kebijakan untuk semua wilayah hasilnya tidak merata.';
    host.appendChild(note);
  }
}

function clearClusterCompare() {
  const host = document.getElementById('clusterCompare');
  if (!host) return;
  host.textContent = '';
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = 'Jalankan simulasi untuk membandingkan antarkluster.';
  host.appendChild(p);
}

function clearContrib() {
  const host = document.getElementById('contrib');
  host.textContent = '';
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = 'Jalankan simulasi untuk melihat rinciannya.';
  host.appendChild(p);
  UI.fillTable('contribTableBody', []);
  document.getElementById('contribNote').textContent = '';
}
