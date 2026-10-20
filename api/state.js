const L = require('./_lib');

// What a GUEST may receive: settings + own orders only.
function guestView(state, me) {
  const out = {};
  for (const k of Object.keys(state || {})) out[k] = Array.isArray(state[k]) ? [] : (k === 'appSettings' || k === 'rolePermissions' ? state[k] : {});
  out.designOrders = (state.designOrders || []).filter(o => o.requesterId === me.id);
  return out;
}

module.exports = L.wrap(async (req, res) => {
  const me = await L.authUser(req);
  if (!me) return L.send(res, 401, { error: 'Belum login' });
  const cur = (await L.getJ('bim:state')) || { rev: 0, state: null };

  if (req.method === 'GET') {
    const st = cur.state && me.role === 'GUEST' ? guestView(cur.state, me) : cur.state;
    return L.send(res, 200, { rev: cur.rev, state: st });
  }
  if (req.method !== 'PUT') return L.send(res, 405, { error: 'Method not allowed' });

  const b = req.body || {};
  if (!b.state || typeof b.state !== 'object') return L.send(res, 400, { error: 'State tidak valid' });
  delete b.state.users; // users are managed only via /api/users

  if (me.role === 'GUEST') {
    // Guests may only add/update their own design orders.
    if (!cur.state) return L.send(res, 409, { error: 'Sistem belum diinisialisasi oleh Master' });
    const all = cur.state.designOrders || [];
    for (const o of (b.state.designOrders || [])) {
      if (o.requesterId !== me.id) continue;
      const i = all.findIndex(x => x.id === o.id);
      if (i === -1) all.unshift(o);
      else if (all[i].requesterId === me.id) all[i] = o;
    }
    cur.state.designOrders = all;
  } else {
    if (cur.state && b.baseRev !== cur.rev) return L.send(res, 409, { error: 'Data telah diperbarui pengguna lain', rev: cur.rev });
    cur.state = b.state;
  }
  cur.rev += 1; cur.updatedAt = new Date().toISOString();
  await L.setJ('bim:state', cur);
  return L.send(res, 200, { rev: cur.rev });
});
