// Karmbhumi Society - small API + static file server
// Data is kept in data/store.json, with one backup copy per day in data/backups/.
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 3001;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_FILE = path.join(DATA_DIR, "store.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BACKUP_DAYS = 60;
const KEY_RE = /^[\w:.-]{1,200}$/;

await fs.mkdir(BACKUP_DIR, { recursive: true });

let store = {};
try {
  store = JSON.parse(await fs.readFile(STORE_FILE, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}

// Serialise writes so two saves never corrupt the file
let writeChain = Promise.resolve();
function persist() {
  writeChain = writeChain.then(async () => {
    const json = JSON.stringify(store, null, 2);
    const tmp = STORE_FILE + ".tmp";
    await fs.writeFile(tmp, json);
    await fs.rename(tmp, STORE_FILE);
    const day = new Date().toISOString().slice(0, 10);
    await fs.writeFile(path.join(BACKUP_DIR, `store-${day}.json`), json);
    const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.startsWith("store-")).sort();
    for (const f of files.slice(0, Math.max(0, files.length - BACKUP_DAYS))) {
      await fs.unlink(path.join(BACKUP_DIR, f));
    }
  });
  return writeChain;
}

const pinHashOf = (raw) => {
  try { return JSON.parse(raw)?.settings?.pinHash || null; } catch { return null; }
};

// Basic protection against guessing the PIN
const failures = new Map(); // ip -> { count, since }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const blocked = (ip) => {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() - f.since > WINDOW_MS) { failures.delete(ip); return false; }
  return f.count >= MAX_FAILS;
};
const recordFail = (ip) => {
  const f = failures.get(ip);
  if (!f || Date.now() - f.since > WINDOW_MS) failures.set(ip, { count: 1, since: Date.now() });
  else f.count++;
};

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, database: "file", apiVersion: 2 }));

app.get("/api/storage", (req, res) => {
  const prefix = String(req.query.prefix || "");
  res.json({ keys: Object.keys(store).filter((k) => k.startsWith(prefix)), prefix, shared: true });
});

app.use("/api/storage/:key", (req, res, next) => {
  if (!KEY_RE.test(req.params.key)) return res.status(400).json({ error: "Invalid key" });
  if (blocked(req.ip)) return res.status(429).json({ error: "Too many wrong PIN attempts. Try again in 15 minutes." });
  next();
});

app.get("/api/storage/:key", (req, res) => {
  const { key } = req.params;
  if (!(key in store)) return res.status(200).json({ key, value: null, shared: true });
  let value = store[key];
  const pin = pinHashOf(value);
  const sent = req.get("X-Admin-Hash");
  if (pin && sent !== pin) {
    if (sent) recordFail(req.ip);
    // Viewers only learn that a PIN exists, never its hash
    const obj = JSON.parse(value);
    obj.settings.pinHash = "LOCKED";
    value = JSON.stringify(obj);
  }
  res.json({ key, value, shared: true });
});

const requireAdmin = (req, res, next) => {
  const pin = pinHashOf(store[req.params.key]);
  if (!pin) return next(); // first-time setup: no PIN created yet
  if (req.get("X-Admin-Hash") !== pin) {
    recordFail(req.ip);
    return res.status(403).json({ error: "Admin PIN required" });
  }
  next();
};

app.put("/api/storage/:key", requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  if (typeof value !== "string") return res.status(400).json({ error: "value must be a string" });
  store[key] = value;
  try {
    await persist();
    res.json({ key, value, shared: true });
  } catch (e) {
    console.error("Save failed:", e);
    res.status(500).json({ error: "Save failed" });
  }
});

app.delete("/api/storage/:key", requireAdmin, async (req, res) => {
  const { key } = req.params;
  const existed = key in store;
  delete store[key];
  if (existed) await persist();
  res.json({ key, deleted: existed, shared: true });
});

// Serve the built React app (after `npm run build`)
const DIST = path.join(ROOT, "dist");
app.use(express.static(DIST, { index: false, maxAge: "7d" }));
app.get("*", (_req, res, next) =>
  res.sendFile(path.join(DIST, "index.html"), (err) => err && next())
);

app.listen(PORT, () => console.log(`Karmbhumi server running on http://localhost:${PORT}  (data: ${DATA_DIR})`));
