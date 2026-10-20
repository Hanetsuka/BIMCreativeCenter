const crypto = require('crypto');
const L = require('./_lib');
const ROLES = ['MASTER', 'USER', 'GUEST'];

module.exports = L.wrap(async (req, res) => {
  const me = await L.authUser(req);
  if (!me) return L.send(res, 401, { error: 'Belum login' });
  const users = await L.loadUsers();

  if (req.method === 'GET') {
    // GUEST only sees themselves.
    return L.send(res, 200, { users: (me.role === 'GUEST' ? users.filter(u => u.id === me.id) : users).map(L.pub) });
  }
  if (me.role !== 'MASTER') return L.send(res, 403, { error: 'Hanya MASTER yang dapat mengelola user' });
  const b = req.body || {};

  if (req.method === 'POST') {
    const email = String(b.email || '').trim().toLowerCase(), name = String(b.fullName || '').trim(), pw = String(b.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) return L.send(res, 400, { error: 'Nama dan email valid wajib diisi' });
    if (pw.length < 8) return L.send(res, 400, { error: 'Kata sandi minimal 8 karakter' });
    if (!ROLES.includes(b.role)) return L.send(res, 400, { error: 'Role tidak valid' });
    if (users.some(u => u.email.toLowerCase() === email)) return L.send(res, 409, { error: 'Email sudah terdaftar' });
    const u = {
      id: 'usr_' + crypto.randomUUID().slice(0, 12), email, username: email.split('@')[0], fullName: name,
      employeeId: 'BIM-' + String(users.length + 1).padStart(3, '0'), jobTitle: String(b.jobTitle || ''), phone: String(b.phone || ''),
      role: b.role, subRole: b.role === 'GUEST' ? 'Tamu Cabang' : b.role === 'MASTER' ? 'Super Admin' : 'Tim Internal',
      branch: String(b.branch || ''), isActive: true, themePreference: 'light',
      aiQuotaLimit: b.role === 'GUEST' ? 0 : Number(b.aiQuotaLimit) || 200, aiQuotaUsed: 0, lastLoginAt: '', pw: L.hashPw(pw)
    };
    users.push(u); await L.setJ('bim:users', users);
    return L.send(res, 201, { user: L.pub(u) });
  }

  if (req.method === 'PATCH') {
    const u = users.find(x => x.id === b.id);
    if (!u) return L.send(res, 404, { error: 'User tidak ditemukan' });
    if (u.id === me.id && (b.isActive === false || (b.role && b.role !== 'MASTER')))
      return L.send(res, 400, { error: 'Anda tidak dapat menonaktifkan/menurunkan akun Anda sendiri' });
    if (typeof b.isActive === 'boolean') u.isActive = b.isActive;
    if (b.role && ROLES.includes(b.role)) u.role = b.role;
    if (typeof b.branch === 'string') u.branch = b.branch;
    if (b.password) {
      if (String(b.password).length < 8) return L.send(res, 400, { error: 'Kata sandi minimal 8 karakter' });
      u.pw = L.hashPw(String(b.password));
    }
    if (!users.some(x => x.role === 'MASTER' && x.isActive)) return L.send(res, 400, { error: 'Harus ada minimal satu MASTER aktif' });
    await L.setJ('bim:users', users);
    return L.send(res, 200, { user: L.pub(u) });
  }
  return L.send(res, 405, { error: 'Method not allowed' });
});
