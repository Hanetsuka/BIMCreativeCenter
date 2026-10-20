const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE = path.join(__dirname, "data_store.json");

function loadServerStore() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {}
  return { designOrders: [], brandContexts: [], auditLogs: [], updatedAt: new Date().toISOString() };
}
function saveServerStore(store) {
  try {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {}
}
let SERVER_DB = loadServerStore();

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-user-role, x-user-id, x-user-name"
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 15 * 1024 * 1024) reject(new Error("Payload too large")); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || "/";

  if (pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { status: "ok", app: "BIM CREATIVE HUB", version: "3.0.0", time: new Date().toISOString() });
  }
  if (pathname === "/api/design-orders" && req.method === "GET") {
    return sendJson(res, 200, { orders: SERVER_DB.designOrders });
  }
  if (pathname === "/api/design-orders/id-card" && req.method === "POST") {
    try {
      const b = await parseJsonBody(req);
      const ord = { id: "ord_" + Date.now(), orderId: "IDC-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + String(SERVER_DB.designOrders.length + 1).padStart(3, "0"), status: "Menunggu", ...b, createdAt: new Date().toISOString() };
      SERVER_DB.designOrders.unshift(ord);
      saveServerStore(SERVER_DB);
      return sendJson(res, 201, { order: ord });
    } catch (e) { return sendJson(res, 400, { error: e.message }); }
  }
  if (pathname.startsWith("/api/design-orders/") && pathname.endsWith("/mark-sent") && req.method === "PATCH") {
    const role = String(req.headers["x-user-role"] || "USER").toUpperCase();
    if (role === "GUEST") return sendJson(res, 403, { error: "Forbidden for GUEST" });
    const id = decodeURIComponent(pathname.split("/")[3]);
    const ord = SERVER_DB.designOrders.find(o => o.id === id || o.orderId === id);
    if (!ord) return sendJson(res, 404, { error: "Order not found" });
    ord.status = "Selesai";
    ord.completedAt = new Date().toISOString();
    ord.completedByName = String(req.headers["x-user-name"] || "Staff");
    saveServerStore(SERVER_DB);
    return sendJson(res, 200, { order: ord });
  }
  if (pathname === "/api/ai/brand-context" && req.method === "POST") {
    try {
      const b = await parseJsonBody(req);
      const ctx = { id: "bctx_" + Date.now(), ...b, updatedAt: new Date().toISOString() };
      SERVER_DB.brandContexts.unshift(ctx);
      saveServerStore(SERVER_DB);
      return sendJson(res, 201, { status: "saved", brandContext: ctx });
    } catch (e) { return sendJson(res, 400, { error: e.message }); }
  }
  if (pathname === "/api/media/upload" && req.method === "POST") {
    try {
      const b = await parseJsonBody(req);
      return sendJson(res, 201, { status: "uploaded", mediaId: "med_srv_" + Date.now(), sizeBytes: String(b.dataUrl || "").length });
    } catch (e) { return sendJson(res, 400, { error: e.message }); }
  }
  if (pathname === "/api/ai/generate" && req.method === "POST") {
    try {
      const b = await parseJsonBody(req);
      return sendJson(res, 200, { status: "ok", mode: (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) ? "cloud_api_connected" : "local_rag_engine", model: "gemini-2.5-pro", reply: "OK" });
    } catch (e) { return sendJson(res, 400, { error: e.message }); }
  }
  if (pathname === "/" || pathname === "/index.html" || pathname === "/bim_creative_hub.html") {
    const f = fs.existsSync(path.join(__dirname, "public", "index.html")) ? path.join(__dirname, "public", "index.html") : path.join(__dirname, "index.html");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(f, "utf8"));
  }
  return sendJson(res, 404, { error: "Not found" });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log("BIM CREATIVE HUB v3.0 running on port " + PORT));
}
module.exports = { server };
