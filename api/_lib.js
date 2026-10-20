// Shared helpers: Redis (Upstash/Vercel KV REST), password hashing, signed session cookie.
const crypto = require('crypto');
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function rd(...cmd) {
  if (!URL_ || !TOK) throw new Error('DB_NOT_CONFIGURED');
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const getJ = async k => { const v = await rd('GET', k); return v ? JSON.parse(v) : null; };
const setJ = (k, v) => rd('SET', k, JSON.stringify(v));

const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  ({ salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') });
const checkPw = (pw, pwObj) => {
  if (!pwObj) return false;
  const a = Buffer.from(hashPw(pw, pwObj.salt).hash, 'hex'), b = Buffer.from(pwObj.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET_MISSING');
  return s;
}
const hmac = p => crypto.createHmac('sha256', secret()).update(p).digest('base64url');
const makeToken = uid => { const p = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 7 * 864e5 })).toString('base64url'); return p + '.' + hmac(p); };
function readToken(req) {
  const m = /(?:^|;\s*)bim_session=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, sig] = m[1].split('.');
  if (!p || !sig || sig.length !== hmac(p).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac(p)))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.exp > Date.now() ? d : null; } catch { return null; }
}
const cookie = (tok, maxAge) => `bim_session=${tok}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

const pub = u => { const { pw, ...rest } = u; return rest; };
const loadUsers = async () => (await getJ('bim:users')) || [];

async function authUser(req) {
  const t = readToken(req);
  if (!t) return null;
  const u = (await loadUsers()).find(x => x.id === t.uid);
  return u && u.isActive ? u : null;
}

const send = (res, code, data) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e.message === 'DB_NOT_CONFIGURED') return send(res, 503, { error: 'Database belum dikonfigurasi', code: 'DB_NOT_CONFIGURED' });
    if (e.message === 'SESSION_SECRET_MISSING') return send(res, 503, { error: 'SESSION_SECRET belum diatur (min. 32 karakter)', code: 'SESSION_SECRET_MISSING' });
    console.error(e); send(res, 500, { error: 'Kesalahan server' });
  }
};
module.exports = { rd, getJ, setJ, hashPw, checkPw, makeToken, cookie, pub, loadUsers, authUser, send, wrap, readToken };
