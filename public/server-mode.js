/* BIM CREATIVE HUB — Production layer.
   When /api is available (Vercel + database), the app switches from demo/localStorage to
   real login, shared server data, and MASTER-managed users. Otherwise it stays in demo mode. */
(function () {
  if (!/^https?:/.test(location.protocol)) return;
  const DEMO_DB = DB;
  let me = null, rev = 0, timer = null, dirty = false;

  const cover = document.createElement('div');
  cover.style.cssText = 'position:fixed;inset:0;z-index:100;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;font:600 14px system-ui;padding:24px;text-align:center';
  cover.textContent = 'Memuat BIM CREATIVE HUB…';
  document.body.appendChild(cover);

  async function api(path, method, body) {
    try {
      const r = await fetch('/api/' + path, { method: method || 'GET', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      let data = {}; try { data = await r.json(); } catch (_) { data = { _nonjson: true }; }
      return { ok: r.ok, status: r.status, data };
    } catch (_) { return { ok: false, status: 0, data: {} }; }
  }

  function cleanDb() {
    const d = JSON.parse(JSON.stringify(DEMO_DB));
    Object.keys(d).forEach(k => { if (Array.isArray(d[k])) d[k] = d[k].filter(x => !(x && x.isDemo)); });
    d.users = []; d.auditLogs = [];
    Object.assign(d.appSettings, { showDemoData: false, productionAuthLock: true, announcement: '', orderSeqCounter: 0 });
    return d;
  }

  function toast(m, t) { try { showToast(m, t || 'info'); } catch (_) { alert(m); } }

  async function enter(user) {
    me = user;
    const [s, u] = await Promise.all([api('state'), api('users')]);
    const base = cleanDb();
    const st = s.data.state;
    rev = s.data.rev || 0;
    DB = Object.assign(base, st || {});
    DB.users = (u.data.users || []);
    DB.appSettings.showDemoData = false; DB.appSettings.productionAuthLock = true;
    APP_STATE.currentUserId = user.id;
    ['btn-prod-auth-lock', 'btn-toggle-demo'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.getElementById('login-screen').classList.add('hidden');
    cover.remove();
    applyThemeMode(user.themePreference || 'light');
    refreshAppIdentity();
    navigateToModule('dashboard');
    if (!st && user.role === 'MASTER') push();
    setInterval(poll, 30000);
  }

  async function push() {
    if (!me) return;
    dirty = false;
    const { users, ...rest } = DB;
    const r = await api('state', 'PUT', { state: me.role === 'GUEST' ? { designOrders: DB.designOrders } : rest, baseRev: rev });
    if (r.ok) { rev = r.data.rev; const el = document.getElementById('footer-storage-status'); if (el) el.textContent = 'Tersimpan di server (' + getNowTimeShort() + ')'; }
    else if (r.status === 409 && me.role !== 'GUEST') { toast('Data diperbarui pengguna lain. Memuat ulang data terbaru…', 'error'); await reload(); }
    else toast('Gagal menyimpan ke server: ' + (r.data.error || 'jaringan bermasalah'), 'error');
  }

  async function reload() {
    const [s, u] = await Promise.all([api('state'), api('users')]);
    if (!s.ok) return;
    rev = s.data.rev || rev;
    const users = u.data.users || DB.users;
    DB = Object.assign(cleanDb(), s.data.state || {}); DB.users = users;
    DB.appSettings.showDemoData = false; DB.appSettings.productionAuthLock = true;
    renderActiveModule();
  }
  async function poll() { if (me && !dirty && !timer && !document.hidden) { const s = await api('state'); if (s.ok && s.data.rev !== rev) await reload(); } }

  async function boot() {
    const r = await api('auth');
    if (r.data._nonjson || !r.data.serverMode) { cover.remove(); return; } // static host → demo mode
    if (!r.data.configured) {
      cover.innerHTML = '<div style="max-width:420px"><h2 style="font-size:18px;margin-bottom:8px">Server belum dikonfigurasi</h2>Atur environment variable <b>SESSION_SECRET</b>, <b>MASTER_EMAIL</b>, <b>MASTER_PASSWORD</b>, dan hubungkan database Upstash Redis di Vercel, lalu Redeploy. Lihat README.</div>';
      return;
    }
    // Production login screen: no demo credentials, no quick-role cards.
    const qb = document.getElementById('login-quick-rbac-box'); if (qb) qb.remove();
    document.getElementById('login-email').value = ''; document.getElementById('login-password').value = '';
    const cb = document.getElementById('btn-close-login'); if (cb) cb.style.display = 'none';
    window.quickLoginAs = () => {};
    if (r.data.user) return enter(r.data.user);
    cover.remove();
    document.getElementById('login-screen').classList.remove('hidden');
  }

  window.handleLoginSubmit = async function (e) {
    e.preventDefault();
    const box = document.getElementById('login-error-box');
    const r = await api('auth', 'POST', { action: 'login', identifier: document.getElementById('login-email').value, password: document.getElementById('login-password').value });
    if (!r.ok) { box.textContent = r.data.error || 'Gagal masuk'; box.classList.remove('hidden'); return; }
    box.classList.add('hidden'); location.reload();
  };
  window.openLoginModal = async function () { await api('auth', 'POST', { action: 'logout' }); location.reload(); };

  const origSave = window.saveDatabase;
  window.saveDatabase = function () {
    if (!me) return origSave();
    dirty = true; clearTimeout(timer);
    timer = setTimeout(async () => { timer = null; await push(); }, 800);
  };

  const origOpenCreate = window.openCreateUserModal;
  window.openCreateUserModal = function () {
    origOpenCreate();
    const p = document.getElementById('usr-new-pass');
    if (p) { p.value = genPass(); p.minLength = 8; }
  };
  const genPass = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const a = crypto.getRandomValues(new Uint32Array(12)); return Array.from(a, x => c[x % c.length]).join('') + '#7'; };

  window.saveNewUserAccountSubmit = async function (e) {
    e.preventDefault();
    const g = id => document.getElementById(id).value.trim();
    const pw = g('usr-new-pass');
    const r = await api('users', 'POST', { fullName: g('usr-new-name'), email: g('usr-new-email'), role: g('usr-new-role'), branch: g('usr-new-branch'), jobTitle: g('usr-new-job'), aiQuotaLimit: g('usr-new-quota'), password: pw });
    if (!r.ok) return toast(r.data.error || 'Gagal membuat akun', 'error');
    DB.users.push(r.data.user);
    closeUniversalModal(); renderMasterSettings();
    prompt('Akun dibuat. Salin dan berikan kata sandi awal ini kepada pengguna (tidak akan ditampilkan lagi):\n' + r.data.user.email, pw);
  };

  window.toggleUserActiveStatus = async function (id) {
    const u = DB.users.find(x => x.id === id); if (!u) return;
    const r = await api('users', 'PATCH', { id, isActive: !u.isActive });
    if (!r.ok) return toast(r.data.error || 'Gagal mengubah status', 'error');
    Object.assign(u, r.data.user); renderMasterSettings();
  };

  window.resetUserPassword = async function (id) {
    const u = DB.users.find(x => x.id === id); if (!u) return;
    if (!confirm('Reset kata sandi ' + u.fullName + '?')) return;
    const pw = genPass();
    const r = await api('users', 'PATCH', { id, password: pw });
    if (!r.ok) return toast(r.data.error || 'Gagal reset sandi', 'error');
    prompt('Kata sandi baru untuk ' + u.email + ' (salin dan berikan ke pengguna):', pw);
  };

  boot();
})();
