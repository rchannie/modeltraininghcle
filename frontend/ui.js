// ui.js — perkakas UI yang dipakai kedua halaman.

const UI = {
  /* --- Tema: OS sebagai default, pilihan pengguna menang dan tersimpan --- */
  initTheme(btnId = 'btnTheme') {
    const saved = localStorage.getItem('hcle-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const current = document.documentElement.getAttribute('data-theme')
        || (prefersDark ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('hcle-theme', next);
    });
  },

  /* --- Toggle tabel: tiap chart punya padanan tabel --- */
  initTableToggles() {
    document.querySelectorAll('.table-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.table);
        if (!target) return;
        const show = target.hasAttribute('hidden');
        target.toggleAttribute('hidden', !show);
        btn.setAttribute('aria-expanded', String(show));
        btn.textContent = show
          ? btn.textContent.replace('Tampilkan', 'Sembunyikan')
          : btn.textContent.replace('Sembunyikan', 'Tampilkan');
      });
    });
  },

  initModal(openId, dialogId, closeId) {
    const dlg = document.getElementById(dialogId);
    const open = document.getElementById(openId);
    const close = document.getElementById(closeId);
    if (!dlg || !open) return;

    open.addEventListener('click', () => dlg.showModal());
    if (close) close.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => {
      // klik di luar panel menutup dialog
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right
                  && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close();
    });
  },

  /* --- Toast. Pesan disisipkan lewat textContent (data tak tepercaya). --- */
  toast(title, body, kind = 'warn', ms = 9000) {
    const stack = document.getElementById('toasts');
    if (!stack) return;

    const el = document.createElement('div');
    el.className = 'toast toast-' + kind;

    const wrap = document.createElement('div');
    const h = document.createElement('div');
    h.className = 'toast-title';
    h.textContent = title;
    wrap.appendChild(h);

    if (body) {
      const p = document.createElement('div');
      p.className = 'toast-body';
      p.textContent = body;
      wrap.appendChild(p);
    }

    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Tutup notifikasi');
    btn.style.cssText = 'width:22px;height:22px;border:0;flex:none;margin-left:auto';
    btn.textContent = '✕';
    btn.addEventListener('click', () => el.remove());

    el.append(wrap, btn);
    stack.appendChild(el);

    if (ms) setTimeout(() => el.remove(), ms);
    return el;
  },

  /* --- Isi tabel dari array. Sel ditulis via textContent. --- */
  fillTable(tbodyId, rows) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.textContent = '';

    rows.forEach(cells => {
      const tr = document.createElement('tr');
      cells.forEach((c, i) => {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.setAttribute('scope', 'row');
        cell.textContent = c;
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    });
  },

  fmt(v, d = 4) {
    return Number(v).toLocaleString('id-ID', {
      minimumFractionDigits: d, maximumFractionDigits: d
    });
  },

  pct(v, d = 1) {
    const s = Number(v).toLocaleString('id-ID', {
      minimumFractionDigits: d, maximumFractionDigits: d
    });
    return (v > 0 ? '+' : '') + s + '%';
  },

  titleCase(s) {
    return String(s).toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase())
      .replace(/\bDi\b/, 'DI').replace(/\bDki\b/, 'DKI').replace(/\bKep\./, 'Kep.');
  }
};
