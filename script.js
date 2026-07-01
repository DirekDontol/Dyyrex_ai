/* =====================================================================
   HYBRID NEXUS OS — SCRIPT UTAMA
   Struktur:
     1. Data konfigurasi aplikasi
     2. Boot sequence
     3. Jam & tanggal real-time
     4. Start Menu
     5. Window Manager (buka/tutup/drag/fokus/minimize)
     6. Aplikasi: Notepad, Calculator, File Explorer, Settings, About
     7. Persistensi pengaturan (wallpaper, tema, aksen)
     8. Inisialisasi
   ===================================================================== */

/* --------------------------------------------------------------- */
/* 1. DATA KONFIGURASI APLIKASI                                      */
/* --------------------------------------------------------------- */
// Setiap aplikasi punya id, nama, ikon, ukuran default, dan template konten.
const APPS = {
  notepad:    { title: 'Notepad',       icon: '📝',  w: 380, h: 420 },
  calculator: { title: 'Calculator',    icon: '🧮',  w: 300, h: 460 },
  explorer:   { title: 'File Explorer', icon: '🗂️', w: 520, h: 400 },
  settings:   { title: 'Settings',      icon: '⚙️',  w: 380, h: 480 },
  about:      { title: 'About Hybrid Nexus', icon: '◈', w: 360, h: 400 },
};

// State global: window mana yang sedang terbuka & z-index tertinggi
const state = {
  openWindows: {},   // { appId: windowElement }
  zTop: 20,
  windowOffset: 0,   // untuk efek "cascade" saat membuka window baru
};

/* --------------------------------------------------------------- */
/* 2. BOOT SEQUENCE                                                   */
/* --------------------------------------------------------------- */
function runBootSequence() {
  const statuses = [
    'Menginisialisasi kernel…',
    'Memuat modul antarmuka…',
    'Menyiapkan ruang kerja…',
    'Hybrid Nexus siap.'
  ];
  const el = document.getElementById('bootStatus');
  let i = 0;
  const interval = setInterval(() => {
    i++;
    if (i < statuses.length) {
      el.textContent = statuses[i];
    } else {
      clearInterval(interval);
    }
  }, 550);

  // Hapus boot screen dari DOM setelah animasinya selesai (lihat CSS: 2.4s + 0.6s)
  setTimeout(() => {
    const boot = document.getElementById('boot-screen');
    if (boot) boot.remove();
  }, 3100);
}

/* --------------------------------------------------------------- */
/* 3. JAM & TANGGAL REAL-TIME                                        */
/* --------------------------------------------------------------- */
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

  document.getElementById('clockTime').textContent = time;
  document.getElementById('clockDate').textContent = date;

  const mini = document.getElementById('startClockMini');
  if (mini) mini.textContent = `${date} · ${time}`;
}

/* --------------------------------------------------------------- */
/* 4. START MENU                                                     */
/* --------------------------------------------------------------- */
function buildStartMenu() {
  const container = document.getElementById('startApps');
  container.innerHTML = '';

  Object.entries(APPS).forEach(([id, app]) => {
    const btn = document.createElement('button');
    btn.className = 'start-app-item';
    btn.dataset.app = id;
    btn.innerHTML = `<span class="icon-glyph">${app.icon}</span><span>${app.title}</span>`;
    btn.addEventListener('click', () => {
      openWindow(id);
      closeStartMenu();
    });
    container.appendChild(btn);
  });
}

function openStartMenu() {
  document.getElementById('startMenu').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('startBtn').classList.add('active');
  setTimeout(() => document.getElementById('startSearch').focus(), 150);
}
function closeStartMenu() {
  document.getElementById('startMenu').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('startBtn').classList.remove('active');
  document.getElementById('startSearch').value = '';
  filterStartApps('');
}
function toggleStartMenu() {
  document.getElementById('startMenu').classList.contains('open') ? closeStartMenu() : openStartMenu();
}
function filterStartApps(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll('.start-app-item').forEach(item => {
    const name = item.textContent.toLowerCase();
    item.style.display = name.includes(q) ? 'flex' : 'none';
  });
}

/* --------------------------------------------------------------- */
/* 5. WINDOW MANAGER                                                  */
/* --------------------------------------------------------------- */
function openWindow(appId) {
  // Jika window sudah terbuka, cukup fokuskan (dan batalkan minimize jika perlu)
  if (state.openWindows[appId]) {
    restoreWindow(appId);
    focusWindow(appId);
    return;
  }

  const app = APPS[appId];
  const win = document.createElement('div');
  win.className = 'window';
  win.dataset.app = appId;

  // Posisi cascade agar window baru tidak menumpuk persis di tempat yang sama
  const isMobile = window.innerWidth <= 720;
  const offset = (state.windowOffset % 6) * 26;
  state.windowOffset++;

  if (!isMobile) {
    win.style.width = app.w + 'px';
    win.style.height = app.h + 'px';
    win.style.left = (60 + offset) + 'px';
    win.style.top = (50 + offset) + 'px';
  }

  win.innerHTML = `
    <div class="window-titlebar">
      <span class="window-icon">${app.icon}</span>
      <span class="window-title">${app.title}</span>
      <div class="window-controls">
        <button class="win-btn win-min" title="Minimize">–</button>
        <button class="win-btn win-close" title="Tutup">✕</button>
      </div>
    </div>
    <div class="window-body"></div>
    <div class="window-resizer"></div>
  `;

  document.getElementById('windowLayer').appendChild(win);
  state.openWindows[appId] = win;

  // Salin konten dari <template> ke dalam body window
  const body = win.querySelector('.window-body');
  const tpl = document.getElementById(`tpl-${appId}`);
  if (tpl) body.appendChild(tpl.content.cloneNode(true));

  // Jalankan inisialisasi khusus aplikasi (lihat bagian 6)
  if (typeof APP_INIT[appId] === 'function') APP_INIT[appId](win);

  // Event: fokus saat window diklik di mana pun
  win.addEventListener('mousedown', () => focusWindow(appId));
  win.addEventListener('touchstart', () => focusWindow(appId), { passive: true });

  // Event: tombol tutup & minimize
  win.querySelector('.win-close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(appId); });
  win.querySelector('.win-min').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(appId); });

  // Aktifkan drag & resize (hanya berarti di desktop, di-skip otomatis saat fullscreen mobile)
  makeDraggable(win, win.querySelector('.window-titlebar'));
  makeResizable(win, win.querySelector('.window-resizer'));

  focusWindow(appId);
  addTaskbarEntry(appId);
}

function closeWindow(appId) {
  const win = state.openWindows[appId];
  if (!win) return;
  win.classList.add('closing');
  win.addEventListener('animationend', () => {
    win.remove();
    delete state.openWindows[appId];
    removeTaskbarEntry(appId);
  }, { once: true });
}

function minimizeWindow(appId) {
  const win = state.openWindows[appId];
  if (!win) return;
  win.style.display = 'none';
  const taskBtn = document.querySelector(`.taskbar-app-btn[data-app="${appId}"]`);
  if (taskBtn) taskBtn.classList.add('minimized');
}

function restoreWindow(appId) {
  const win = state.openWindows[appId];
  if (!win) return;
  win.style.display = 'flex';
  const taskBtn = document.querySelector(`.taskbar-app-btn[data-app="${appId}"]`);
  if (taskBtn) taskBtn.classList.remove('minimized');
}

function focusWindow(appId) {
  const win = state.openWindows[appId];
  if (!win) return;
  document.querySelectorAll('.window').forEach(w => w.classList.remove('focused'));
  win.classList.add('focused');
  state.zTop += 1;
  win.style.zIndex = state.zTop;

  document.querySelectorAll('.taskbar-app-btn').forEach(b => b.classList.remove('running'));
  const taskBtn = document.querySelector(`.taskbar-app-btn[data-app="${appId}"]`);
  if (taskBtn) taskBtn.classList.add('running');
}

/* ---- Drag window lewat titlebar ---- */
function makeDraggable(win, handle) {
  let startX, startY, startLeft, startTop, dragging = false;

  function onDown(clientX, clientY) {
    // Di mode mobile fullscreen, drag dinonaktifkan
    if (window.innerWidth <= 720) return;
    dragging = true;
    const rect = win.getBoundingClientRect();
    startX = clientX; startY = clientY;
    startLeft = rect.left; startTop = rect.top;
    win.classList.add('dragging');
  }
  function onMove(clientX, clientY) {
    if (!dragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    let newLeft = startLeft + dx;
    let newTop = Math.max(0, startTop + dy); // jangan sampai naik di atas layar
    win.style.left = newLeft + 'px';
    win.style.top = newTop + 'px';
  }
  function onUp() {
    dragging = false;
    win.classList.remove('dragging');
  }

  handle.addEventListener('mousedown', (e) => { onDown(e.clientX, e.clientY); e.preventDefault(); });
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);

  handle.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; onDown(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const t = e.touches[0]; onMove(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchend', onUp);
}

/* ---- Resize window dari pojok kanan-bawah ---- */
function makeResizable(win, handle) {
  let startX, startY, startW, startH, resizing = false;

  handle.addEventListener('mousedown', (e) => {
    if (window.innerWidth <= 720) return;
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    const rect = win.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startW = rect.width; startH = rect.height;
  });
  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const newW = Math.max(280, startW + (e.clientX - startX));
    const newH = Math.max(200, startH + (e.clientY - startY));
    win.style.width = newW + 'px';
    win.style.height = newH + 'px';
  });
  window.addEventListener('mouseup', () => { resizing = false; });
}

/* ---- Entri aplikasi yang berjalan di taskbar ---- */
function addTaskbarEntry(appId) {
  const app = APPS[appId];
  const bar = document.getElementById('taskbarApps');
  const btn = document.createElement('button');
  btn.className = 'taskbar-app-btn running';
  btn.dataset.app = appId;
  btn.textContent = app.icon;
  btn.title = app.title;
  btn.addEventListener('click', () => {
    const win = state.openWindows[appId];
    if (win.style.display === 'none') {
      restoreWindow(appId);
      focusWindow(appId);
    } else if (win.classList.contains('focused')) {
      minimizeWindow(appId);
    } else {
      focusWindow(appId);
    }
  });
  bar.appendChild(btn);
}
function removeTaskbarEntry(appId) {
  const btn = document.querySelector(`.taskbar-app-btn[data-app="${appId}"]`);
  if (btn) btn.remove();
}

/* --------------------------------------------------------------- */
/* 6. INISIALISASI TIAP APLIKASI                                      */
/* --------------------------------------------------------------- */
const APP_INIT = {};

/* ---- Notepad: simpan otomatis ke localStorage ---- */
APP_INIT.notepad = function (win) {
  const area = win.querySelector('#notepadArea');
  const status = win.querySelector('#notepadSaved');
  const STORAGE_KEY = 'nexus-notepad-content';

  area.value = localStorage.getItem(STORAGE_KEY) || '';

  let saveTimeout;
  area.addEventListener('input', () => {
    status.textContent = 'Mengetik…';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, area.value);
      status.textContent = 'Tersimpan';
    }, 400);
  });
};

/* ---- Calculator ---- */
APP_INIT.calculator = function (win) {
  const exprEl = win.querySelector('#calcExpression');
  const resultEl = win.querySelector('#calcResult');
  let current = '0';
  let previous = null;
  let operator = null;
  let justEvaluated = false;

  function render() {
    resultEl.textContent = current;
    exprEl.textContent = previous !== null ? `${previous} ${opSymbol(operator)}` : '\u00A0';
  }
  function opSymbol(op) {
    return { '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || '';
  }
  function inputDigit(d) {
    if (justEvaluated) { current = '0'; justEvaluated = false; }
    if (current === '0' && d !== '.') current = d;
    else if (d === '.' && current.includes('.')) return;
    else current += d;
  }
  function applyOperator(op) {
    if (operator && previous !== null && !justEvaluated) {
      evaluate();
    }
    previous = current;
    operator = op;
    current = '0';
    justEvaluated = false;
  }
  function evaluate() {
    if (operator === null || previous === null) return;
    const a = parseFloat(previous);
    const b = parseFloat(current);
    let r;
    switch (operator) {
      case '+': r = a + b; break;
      case '-': r = a - b; break;
      case '*': r = a * b; break;
      case '/': r = b === 0 ? NaN : a / b; break;
    }
    current = String(Number.isFinite(r) ? parseFloat(r.toFixed(10)) : 'Error');
    previous = null;
    operator = null;
    justEvaluated = true;
  }

  win.querySelectorAll('.calc-key').forEach(key => {
    key.addEventListener('click', () => {
      const k = key.dataset.key;
      if (/^[0-9.]$/.test(k)) inputDigit(k);
      else if (['+', '-', '*', '/'].includes(k)) applyOperator(k);
      else if (k === '=') evaluate();
      else if (k === 'clear') { current = '0'; previous = null; operator = null; justEvaluated = false; }
      else if (k === 'sign') current = String(parseFloat(current) * -1);
      else if (k === 'percent') current = String(parseFloat(current) / 100);
      render();
    });
  });
  render();
};

/* ---- File Explorer: struktur folder & file simulasi ---- */
const FS_DATA = {
  Documents: [
    { name: 'Proposal Bot.txt', glyph: '📄' },
    { name: 'Catatan Rilis.md', glyph: '📄' },
  ],
  Pictures: [
    { name: 'wallpaper-01.png', glyph: '🖼️' },
    { name: 'screenshot.png', glyph: '🖼️' },
  ],
  Music: [
    { name: 'lo-fi-session.mp3', glyph: '🎵' },
  ],
  System: [
    { name: 'kernel.sys', glyph: '⚙️' },
    { name: 'config.json', glyph: '⚙️' },
  ],
};

APP_INIT.explorer = function (win) {
  const tree = win.querySelector('#explorerTree');
  const view = win.querySelector('#explorerView');

  const folders = Object.keys(FS_DATA);
  tree.innerHTML = folders.map((f, i) =>
    `<button class="explorer-folder${i === 0 ? ' active' : ''}" data-folder="${f}">📁 ${f}</button>`
  ).join('');

  function renderFolder(name) {
    const files = FS_DATA[name] || [];
    view.innerHTML = `
      <div class="explorer-path">Nexus / ${name}</div>
      <div class="explorer-grid">
        ${files.map(f => `
          <div class="explorer-file" title="${f.name}">
            <span class="file-glyph">${f.glyph}</span>
            <span class="file-name">${f.name}</span>
          </div>`).join('') || '<div class="explorer-empty">Folder kosong</div>'}
      </div>
    `;
  }

  tree.querySelectorAll('.explorer-folder').forEach(btn => {
    btn.addEventListener('click', () => {
      tree.querySelectorAll('.explorer-folder').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFolder(btn.dataset.folder);
    });
  });

  renderFolder(folders[0]);
};

/* ---- Settings: wallpaper, tema, warna aksen, blur ---- */
APP_INIT.settings = function (win) {
  const accentSwatches = win.querySelectorAll('.swatch');
  const wpSwatches = win.querySelectorAll('.wp-swatch');
  const themeBtns = win.querySelectorAll('.theme-btn');
  const blurRange = win.querySelector('#blurRange');

  const prefs = loadPrefs();

  // Tandai opsi yang sedang aktif sesuai preferensi tersimpan
  accentSwatches.forEach(sw => sw.classList.toggle('active', sw.dataset.accent === prefs.accent));
  wpSwatches.forEach(sw => sw.classList.toggle('active', sw.dataset.wp === prefs.wallpaper));
  themeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === prefs.theme));
  blurRange.value = prefs.blur;

  accentSwatches.forEach(sw => sw.addEventListener('click', () => {
    accentSwatches.forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    setAccent(sw.dataset.accent);
    savePrefs({ accent: sw.dataset.accent });
  }));

  wpSwatches.forEach(sw => sw.addEventListener('click', () => {
    wpSwatches.forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    setWallpaper(sw.dataset.wp);
    savePrefs({ wallpaper: sw.dataset.wp });
  }));

  themeBtns.forEach(btn => btn.addEventListener('click', () => {
    themeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setTheme(btn.dataset.theme);
    savePrefs({ theme: btn.dataset.theme });
  }));

  blurRange.addEventListener('input', () => {
    setBlur(blurRange.value);
    savePrefs({ blur: blurRange.value });
  });
};

/* ---- About: statis, tidak perlu inisialisasi khusus ---- */
APP_INIT.about = function () {};

/* --------------------------------------------------------------- */
/* 7. PERSISTENSI PENGATURAN                                          */
/* --------------------------------------------------------------- */
const PREFS_KEY = 'nexus-prefs';
const DEFAULT_PREFS = { accent: '#5eead4', wallpaper: 'wp-nexus', theme: 'dark', blur: 18 };

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
function savePrefs(patch) {
  const current = loadPrefs();
  const updated = { ...current, ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
}

function setAccent(hex) {
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-soft', hexToSoft(hex));
}
function hexToSoft(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.16)`;
}
function setWallpaper(wp) {
  const desktop = document.getElementById('desktop');
  desktop.className = wp; // reset lalu terapkan kelas wallpaper baru
}
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
function setBlur(px) {
  document.documentElement.style.setProperty('--blur', px + 'px');
}

function applyStoredPrefs() {
  const prefs = loadPrefs();
  setAccent(prefs.accent);
  setWallpaper(prefs.wallpaper);
  setTheme(prefs.theme);
  setBlur(prefs.blur);
}

/* --------------------------------------------------------------- */
/* 8. INISIALISASI GLOBAL                                             */
/* --------------------------------------------------------------- */
function init() {
  runBootSequence();
  applyStoredPrefs();
  buildStartMenu();

  updateClock();
  setInterval(updateClock, 1000 * 15); // cukup update tiap 15 detik, hemat baterai HP

  // Ikon di desktop membuka aplikasi
  document.querySelectorAll('.desktop-icon').forEach(icon => {
    icon.addEventListener('click', () => openWindow(icon.dataset.app));
  });

  // Tombol Start
  document.getElementById('startBtn').addEventListener('click', toggleStartMenu);
  document.getElementById('overlay').addEventListener('click', closeStartMenu);
  document.getElementById('startSearch').addEventListener('input', (e) => filterStartApps(e.target.value));

  // Tombol restart di Start Menu — reset tampilan (muat ulang halaman)
  document.getElementById('startPowerBtn').addEventListener('click', () => {
    if (confirm('Restart tampilan Hybrid Nexus OS?')) location.reload();
  });

  // Klik di area kosong desktop menutup start menu bila terbuka
  document.getElementById('desktop').addEventListener('mousedown', (e) => {
    if (e.target.id === 'desktop') closeStartMenu();
  });
}

document.addEventListener('DOMContentLoaded', init);
