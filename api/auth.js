const L = require('./_lib');

module.exports = L.wrap(async (req, res) => {
  const configured = !!((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && process.env.SESSION_SECRET);
  if (req.method === 'GET') {
    if (!configured) return L.send(res, 200, { serverMode: true, configured: false });
    const u = await L.authUser(req);
    return L.send(res, 200, { serverMode: true, configured: true, user: u ? L.pub(u) : null });
  }
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
  const b = req.body || {};
  if (b.action === 'logout') { res.setHeader('Set-Cookie', L.cookie('', 0)); return L.send(res, 200, { ok: true }); }
  if (b.action !== 'login') return L.send(res, 400, { error: 'Aksi tidak dikenal' });

  const id = String(b.identifier || '').trim().toLowerCase(), pw = String(b.password || '');
  if (!id || !pw) return L.send(res, 400, { error: 'Email dan kata sandi wajib diisi' });

  const rlKey = 'bim:rl:' + id;
  const n = await L.rd('INCR', rlKey);
  if (n === 1) await L.rd('EXPIRE', rlKey, 900);
  if (n > 10) return L.send(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });

  let users = await L.loadUsers();
  // First-run bootstrap: create the first MASTER from env credentials.
  if (!users.length && process.env.MASTER_EMAIL && process.env.MASTER_PASSWORD &&
      id === process.env.MASTER_EMAIL.toLowerCase() && pw === process.env.MASTER_PASSWORD) {
    users = [{
      id: 'usr_master', email: process.env.MASTER_EMAIL.toLowerCase(), username: 'master', fullName: process.env.MASTER_NAME || 'Master Admin',
      employeeId: 'BIM-001', jobTitle: 'System Owner (Master)', phone: '', role: 'MASTER', subRole: 'Super Admin', branch: 'Pusat',
      isActive: true, themePreference: 'light', aiQuotaLimit: 1000, aiQuotaUsed: 0, lastLoginAt: '', pw: L.hashPw(pw)
    }];
    await L.setJ('bim:users', users);
  }
  const u = users.find(x => x.email.toLowerCase() === id || (x.username || '').toLowerCase() === id);
  if (!u || !L.checkPw(pw, u.pw)) return L.send(res, 401, { error: 'Email/username atau kata sandi salah' });
  if (!u.isActive) return L.send(res, 403, { error: 'Akun dinonaktifkan oleh Master Admin' });

  await L.rd('DEL', rlKey);
  u.lastLoginAt = new Date().toISOString();
  await L.setJ('bim:users', users);
  res.setHeader('Set-Cookie', L.cookie(L.makeToken(u.id), 604800));
  return L.send(res, 200, { user: L.pub(u) });
});
