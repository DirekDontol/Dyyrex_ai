/* =====================================================================
   CODEFORGE — SCRIPT UTAMA (BAGIAN 1: FONDASI)
   Struktur file ini akan terus dikembangkan di bagian-bagian berikutnya.
   Daftar isi:
     1. Utilitas umum
     2. Store — lapisan data & Local Storage
     3. Toast — notifikasi sementara
     4. Modal — dialog generik
     5. Loading overlay
     6. Notification panel (lonceng di topbar)
     7. Router — perpindahan antar view & sidebar
     8. Render: sidebar level/XP
     9. Render: Dashboard (Project of the Day, Recent Projects)
     10. Empty state helper
     11. Generate Project (stub — logika penuh ditambahkan di Bagian 2)
     12. Event bindings & inisialisasi
   ===================================================================== */

/* --------------------------------------------------------------- */
/* 1. UTILITAS UMUM                                                   */
/* --------------------------------------------------------------- */
const Utils = {
  uid() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  },
  formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  daysBetween(a, b) {
    const MS = 1000 * 60 * 60 * 24;
    return Math.round((new Date(b) - new Date(a)) / MS);
  },
  debounce(fn, delay = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  },
  clamp(n, min, max) { return Math.min(max, Math.max(min, n)); },
  escapeHtml(str = '') {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
};

/* --------------------------------------------------------------- */
/* 2. STORE — LAPISAN DATA & LOCAL STORAGE                            */
/* --------------------------------------------------------------- */
// Semua data aplikasi disimpan dalam satu objek besar di localStorage
// dengan key CODEFORGE_KEY. Modul Store menjadi satu-satunya pintu
// untuk membaca/menulis data agar konsisten dan mudah dikembangkan.
const CODEFORGE_KEY = 'codeforge-data-v1';

const DEFAULT_DATA = {
  projects: [],           // daftar semua project yang pernah digenerate
  stats: {
    totalGenerated: 0,
    completed: 0,
    inProgress: 0,
    streak: 0,
    lastActiveDate: null, // tanggal (YYYY-MM-DD) terakhir user "aktif" (generate/checklist/focus)
    xp: 0,
    level: 1,
  },
  achievements: { unlocked: [] }, // array id achievement yang sudah terbuka
  focusSessions: [],       // { date, minutes } — diisi di Bagian 5
  dailyChallenge: null,    // { date, ...challenge } — diisi di Bagian 5
  notifications: [],       // { id, title, body, date, read }
  settings: { lofiEnabled: false },
};

const Store = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(CODEFORGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      // Merge dangkal terhadap default supaya field baru di update selanjutnya
      // tetap punya nilai default tanpa merusak data lama milik user.
      this.data = {
        ...structuredClone(DEFAULT_DATA),
        ...parsed,
        stats: { ...DEFAULT_DATA.stats, ...(parsed.stats || {}) },
        achievements: { ...DEFAULT_DATA.achievements, ...(parsed.achievements || {}) },
        settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
      };
    } catch (err) {
      console.error('Gagal memuat data CodeForge, memakai default.', err);
      this.data = structuredClone(DEFAULT_DATA);
    }
    return this.data;
  },

  save() {
    localStorage.setItem(CODEFORGE_KEY, JSON.stringify(this.data));
  },

  // --- helper akses cepat, dipakai luas oleh bagian-bagian selanjutnya ---
  getProjects() { return this.data.projects; },
  getProject(id) { return this.data.projects.find(p => p.id === id) || null; },
  addProject(project) {
    this.data.projects.unshift(project);
    this.data.stats.totalGenerated++;
    this.data.stats.inProgress++;
    this.save();
  },
  updateProject(id, patch) {
    const p = this.getProject(id);
    if (!p) return;
    Object.assign(p, patch);
    this.save();
  },
  deleteProject(id) {
    this.data.projects = this.data.projects.filter(p => p.id !== id);
    this.save();
  },

  addNotification(title, body) {
    this.data.notifications.unshift({
      id: Utils.uid(), title, body, date: new Date().toISOString(), read: false,
    });
    this.data.notifications = this.data.notifications.slice(0, 30); // batasi riwayat
    this.save();
  },
};

/* --------------------------------------------------------------- */
/* 3. TOAST — NOTIFIKASI SEMENTARA                                    */
/* --------------------------------------------------------------- */
const Toast = {
  layer: null,
  icons: { success: 'icon-check', info: 'icon-sparkle', warning: 'icon-flame', error: 'icon-x' },

  init() { this.layer = document.getElementById('toastLayer'); },

  show(message, type = 'info', duration = 3200) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon"><svg class="icon"><use href="#${this.icons[type] || 'icon-sparkle'}"/></svg></span>
      <span class="toast-msg">${Utils.escapeHtml(message)}</span>
    `;
    this.layer.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  },
};

/* --------------------------------------------------------------- */
/* 4. MODAL — DIALOG GENERIK                                          */
/* --------------------------------------------------------------- */
// Modal.open(htmlString) menyalin HTML ke dalam kotak modal dan menampilkannya.
// Dipakai luas oleh Bagian 2-5 untuk detail project, roadmap, dsb.
const Modal = {
  overlay: null, content: null,

  init() {
    this.overlay = document.getElementById('modalOverlay');
    this.content = document.getElementById('modalContent');
    document.getElementById('modalClose').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  },

  open(html) {
    this.content.innerHTML = html;
    this.overlay.classList.add('open');
  },
  close() {
    this.overlay.classList.remove('open');
  },
};

/* --------------------------------------------------------------- */
/* 5. LOADING OVERLAY                                                  */
/* --------------------------------------------------------------- */
const Loading = {
  el: null, textEl: null,
  init() {
    this.el = document.getElementById('loadingOverlay');
    this.textEl = document.getElementById('loadingText');
  },
  show(text = 'Memproses…') {
    this.textEl.textContent = text;
    this.el.classList.add('show');
  },
  hide() { this.el.classList.remove('show'); },
};

/* --------------------------------------------------------------- */
/* 6. NOTIFICATION PANEL (lonceng di topbar)                           */
/* --------------------------------------------------------------- */
const NotifPanel = {
  panelEl: null, listEl: null, dotEl: null,

  init() {
    this.panelEl = document.getElementById('notifPanel');
    this.listEl = document.getElementById('notifList');
    this.dotEl = document.getElementById('notifDot');

    document.getElementById('notifBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.getElementById('notifClear').addEventListener('click', () => {
      Store.data.notifications = [];
      Store.save();
      this.render();
    });
    document.addEventListener('click', (e) => {
      if (!this.panelEl.contains(e.target)) this.panelEl.classList.remove('open');
    });

    this.render();
  },

  toggle() {
    this.panelEl.classList.toggle('open');
    // Menandai semua sudah dibaca saat panel dibuka
    if (this.panelEl.classList.contains('open')) {
      Store.data.notifications.forEach(n => n.read = true);
      Store.save();
      this.updateDot();
    }
  },

  render() {
    const items = Store.data.notifications;
    this.listEl.innerHTML = items.length
      ? items.map(n => `
          <div class="notif-item">
            <b>${Utils.escapeHtml(n.title)}</b><br>${Utils.escapeHtml(n.body)}
          </div>`).join('')
      : `<div class="notif-empty">Belum ada notifikasi</div>`;
    this.updateDot();
  },

  updateDot() {
    const hasUnread = Store.data.notifications.some(n => !n.read);
    this.dotEl.hidden = !hasUnread;
  },
};

/* --------------------------------------------------------------- */
/* 7. ROUTER — PERPINDAHAN ANTAR VIEW & SIDEBAR                        */
/* --------------------------------------------------------------- */
const Router = {
  current: 'dashboard',

  // Peta fungsi render tiap view. Bagian 2-5 akan menambah entri di sini
  // (mis. Router.renderers.projects = ProjectsView.render).
  renderers: {},

  init() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.goTo(btn.dataset.view));
    });
    // Tautan "Lihat semua" di dashboard, dsb.
    document.querySelectorAll('[data-view-link]').forEach(btn => {
      btn.addEventListener('click', () => this.goTo(btn.dataset.viewLink));
    });

    // Sidebar mobile
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    document.getElementById('menuToggle').addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  },

  goTo(viewId) {
    if (!viewId) return;
    this.current = viewId;

    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${viewId}`));

    // Tutup sidebar mobile setelah memilih menu
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');

    // Panggil renderer view terkait jika sudah didaftarkan (Bagian 2-5)
    if (typeof this.renderers[viewId] === 'function') this.renderers[viewId]();
  },
};

/* --------------------------------------------------------------- */
/* 8. RENDER: SIDEBAR LEVEL / XP                                        */
/* --------------------------------------------------------------- */
// Formula level sederhana: setiap level butuh (level * 100) XP.
// XP_TABLE dipakai bersama oleh Statistics & Achievement (Bagian 4).
const LEVEL_TITLES = [
  'Rookie Coder', 'Junior Dev', 'Code Apprentice', 'Logic Weaver',
  'Systems Builder', 'Senior Dev', 'Architect', 'Code Sage', 'Nexus Master',
];

function xpForLevel(level) { return level * 100; }

function getLevelInfo(xp) {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  const title = LEVEL_TITLES[Utils.clamp(level - 1, 0, LEVEL_TITLES.length - 1)];
  return { level, title, current: remaining, needed: xpForLevel(level) };
}

function renderSidebarLevel() {
  const { level, title, current, needed } = getLevelInfo(Store.data.stats.xp);
  document.getElementById('sidebarLevelBadge').textContent = `Lv.${level}`;
  document.getElementById('sidebarLevelName').textContent = title;
  document.getElementById('sidebarXpFill').style.width = `${Utils.clamp((current / needed) * 100, 0, 100)}%`;
  document.getElementById('sidebarXpLabel').textContent = `${current} / ${needed} XP`;
}

/* --------------------------------------------------------------- */
/* 9. RENDER: DASHBOARD                                                 */
/* --------------------------------------------------------------- */
function renderGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi,' : hour < 15 ? 'Selamat siang,' : hour < 19 ? 'Selamat sore,' : 'Selamat malam,';
  document.getElementById('heroGreeting').textContent = greeting;
}

// Membuat markup satu kartu project ringkas untuk dashboard/grid.
// Detail lengkap (roadmap, notes) baru aktif penuh di Bagian 2 & 3;
// fungsi ini dibuat modular agar tinggal dipanggil ulang nanti.
function projectCardHTML(project) {
  const badgeClass = { Beginner: 'badge-beginner', Intermediate: 'badge-intermediate', Advanced: 'badge-advanced' }[project.difficulty] || 'badge-status';
  const percent = project.roadmap?.percent ?? 0;
  return `
    <div class="project-card" data-project-id="${project.id}">
      <div class="project-card-top">
        <span class="project-card-name">${Utils.escapeHtml(project.name)}</span>
        <button class="bookmark-toggle ${project.bookmarked ? 'active' : ''}" data-bookmark-id="${project.id}" title="Bookmark">
          <svg class="icon"><use href="#icon-bookmark"/></svg>
        </button>
      </div>
      <p class="project-card-desc">${Utils.escapeHtml(project.description)}</p>
      <div class="project-card-badges">
        <span class="badge ${badgeClass}">${project.difficulty}</span>
        <span class="badge badge-status">${project.language}</span>
      </div>
      <div class="project-card-progress"><div class="project-card-progress-fill" style="width:${percent}%"></div></div>
      <div class="project-card-meta">
        <span>${percent}% selesai</span>
        <span>·</span>
        <span>${project.estTime || '-'}</span>
      </div>
    </div>
  `;
}

function renderDashboard() {
  renderGreeting();
  const projects = Store.getProjects();

  // --- Project of the Day: tetap sama sepanjang hari (deterministik dari tanggal) ---
  const potdBody = document.getElementById('potdBody');
  if (projects.length === 0) {
    potdBody.innerHTML = emptyStateHTML('icon-star', 'Belum ada project', 'Generate project pertamamu untuk melihat pilihan hari ini.');
  } else {
    const dayIndex = new Date().toISOString().slice(0, 10).split('-').join('');
    const idx = Number(dayIndex) % projects.length;
    potdBody.innerHTML = projectCardHTML(projects[idx]);
  }

  // --- Recent Projects: 4 terbaru ---
  const recentBody = document.getElementById('recentBody');
  if (projects.length === 0) {
    recentBody.innerHTML = emptyStateHTML('icon-folder', 'Belum ada project', 'Project yang kamu buat akan muncul di sini.');
  } else {
    recentBody.innerHTML = `<div class="project-grid">${projects.slice(0, 4).map(projectCardHTML).join('')}</div>`;
  }

  renderSidebarLevel();
  bindDashboardCardEvents();
}

// Klik kartu (buka detail) & tombol bookmark didelegasikan di sini.
// Bagian 2 akan mengisi ProjectDetail.open(id); untuk sekarang beri toast placeholder.
function bindDashboardCardEvents() {
  document.querySelectorAll('#viewport .project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-toggle')) return; // biarkan handler bookmark sendiri yang jalan
      const id = card.dataset.projectId;
      if (typeof window.openProjectDetail === 'function') window.openProjectDetail(id);
      else Toast.show('Detail project akan aktif di Bagian 2 & 3.', 'info');
    });
  });
  document.querySelectorAll('.bookmark-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.bookmarkId;
      const project = Store.getProject(id);
      if (!project) return;
      project.bookmarked = !project.bookmarked;
      Store.save();
      btn.classList.toggle('active', project.bookmarked);
      Toast.show(project.bookmarked ? 'Ditambahkan ke bookmark' : 'Dihapus dari bookmark', 'success');
    });
  });
}

/* --------------------------------------------------------------- */
/* 10. EMPTY STATE HELPER                                               */
/* --------------------------------------------------------------- */
// Dipakai di semua view yang datanya masih kosong (dashboard, projects,
// bookmarks, achievements, dsb). Konsisten di seluruh aplikasi.
function emptyStateHTML(icon, title, sub) {
  return `
    <div class="empty-state">
      <svg class="icon"><use href="#${icon}"/></svg>
      <span class="empty-state-title">${Utils.escapeHtml(title)}</span>
      <span class="empty-state-sub">${Utils.escapeHtml(sub)}</span>
    </div>
  `;
}

/* --------------------------------------------------------------- */
/* 11. GENERATE PROJECT — STUB (logika lengkap: Bagian 2)               */
/* --------------------------------------------------------------- */
// Placeholder sementara. Di Bagian 2, fungsi ini akan diganti dengan
// generator acak lengkap (nama, deskripsi, teknologi, fitur, dst),
// lalu memanggil Store.addProject() dan merender ulang dashboard.
function handleGenerateClick() {
  Toast.show('Project Generator akan aktif di Bagian 2 🚀', 'info');
}

/* --------------------------------------------------------------- */
/* 12. EVENT BINDINGS & INISIALISASI                                     */
/* --------------------------------------------------------------- */
function bindGlobalSearch() {
  const input = document.getElementById('globalSearch');
  input.addEventListener('input', Utils.debounce((e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    // Pencarian penuh (lintas view + highlight) diaktifkan di Bagian 2
    // begitu ada data project untuk dicari.
    if (Store.getProjects().length === 0) return;
    Router.goTo('projects');
    if (typeof window.filterProjectsBySearch === 'function') window.filterProjectsBySearch(q);
  }, 300));
}

function init() {
  Store.load();
  Toast.init();
  Modal.init();
  Loading.init();
  NotifPanel.init();
  Router.init();

  renderDashboard();
  bindGlobalSearch();

  document.getElementById('generateBtn').addEventListener('click', handleGenerateClick);

  // Selamat datang sekali di kunjungan pertama
  if (Store.data.stats.totalGenerated === 0 && Store.data.notifications.length === 0) {
    Store.addNotification('Selamat datang di CodeForge!', 'Tekan "Generate Project" untuk mulai membangun ide pertamamu.');
    NotifPanel.render();
  }
}

document.addEventListener('DOMContentLoaded', init);
