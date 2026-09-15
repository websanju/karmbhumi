// Shared helpers for the Vercel API functions (files starting with "_" are not routes)
// Works with any of these Vercel/Upstash/Redis setups:
//   KV_REST_API_URL + KV_REST_API_TOKEN            (Vercel Storage -> Upstash)
//   <PREFIX>_KV_REST_API_URL + <PREFIX>_KV_REST_API_TOKEN (custom prefix chosen while connecting)
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (database created on upstash.com)
//   REDIS_URL / KV_URL / <PREFIX>_REDIS_URL          (Redis Cloud or any redis:// URL)
import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient } from "redis";

const env = process.env;
const findEnv = (...suffixes) => {
  for (const s of suffixes) if (env[s]) return env[s];
  for (const s of suffixes) {
    const k = Object.keys(env).find((name) => name.endsWith("_" + s) && env[name]);
    if (k) return env[k];
  }
  return null;
};

const restUrl = findEnv("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
const restToken = findEnv("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");
const tcpUrl = findEnv("REDIS_URL", "KV_URL");

export const dbMode = restUrl && restToken ? "upstash-rest" : tcpUrl ? "redis-url" : null;
export const dbConfigured = Boolean(dbMode);

// Names only (never values) of env vars that look database-related – for /api/health
export const dbEnvNames = Object.keys(env)
  .filter((n) => /REDIS|KV_|UPSTASH/i.test(n))
  .sort();

function makeRest() {
  const c = new UpstashRedis({ url: restUrl, token: restToken, automaticDeserialization: false, enableAutoPipelining: false });
  return {
    get: (k) => c.get(k),
    set: (k, v, opt) => (opt?.ex ? c.set(k, v, { ex: opt.ex }) : c.set(k, v)),
    incr: (k) => c.incr(k),
    expire: (k, s) => c.expire(k, s),
    del: (k) => c.del(k),
    ping: () => c.ping(),
    scan: async (cursor, { match, count }) => {
      const [next, keys] = await c.scan(cursor, { match, count });
      return [String(next), keys];
    },
  };
}

// Reuse one TCP connection across warm invocations
let tcpPromise = globalThis.__kbRedis;
function tcp() {
  if (!tcpPromise) {
    const client = createClient({ url: tcpUrl, socket: { connectTimeout: 8000 } });
    client.on("error", (e) => console.error("redis error", e.message));
    tcpPromise = globalThis.__kbRedis = client.connect().then(() => client).catch((e) => {
      tcpPromise = globalThis.__kbRedis = null;
      throw e;
    });
  }
  return tcpPromise;
}
function makeTcp() {
  return {
    get: async (k) => (await tcp()).get(k),
    set: async (k, v, opt) => (await tcp()).set(k, v, opt?.ex ? { EX: opt.ex } : undefined),
    incr: async (k) => (await tcp()).incr(k),
    expire: async (k, s) => (await tcp()).expire(k, s),
    del: async (k) => (await tcp()).del(k),
    ping: async () => (await tcp()).ping(),
    scan: async (cursor, { match, count }) => {
      const r = await (await tcp()).scan(String(cursor), { MATCH: match, COUNT: count });
      return [String(r.cursor), r.keys];
    },
  };
}

export const redis = dbMode === "upstash-rest" ? makeRest() : dbMode === "redis-url" ? makeTcp() : null;

export const KEY_RE = /^[\w:.-]{1,200}$/;
export const MAIN_KEY = "karmbhumi-society-v1";
export const storeKey = (k) => `kb:store:${k}`;

const WINDOW_SEC = 15 * 60;
const MAX_FAILS = 10;
const BACKUP_DAYS = 60;

export const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";

export const pinHashOf = (raw) => {
  try { return JSON.parse(raw)?.settings?.pinHash || null; } catch { return null; }
};

export async function isBlocked(ip) {
  const n = Number(await redis.get(`kb:fail:${ip}`)) || 0;
  return n >= MAX_FAILS;
}

export async function recordFail(ip) {
  const k = `kb:fail:${ip}`;
  const n = await redis.incr(k);
  if (Number(n) === 1) await redis.expire(k, WINDOW_SEC);
}

export async function dailyBackup(key, value) {
  if (key !== MAIN_KEY) return;
  const day = new Date().toISOString().slice(0, 10);
  await redis.set(`kb:backup:${day}`, value, { ex: BACKUP_DAYS * 86400 });
}

export function noDb(res) {
  res.status(503).json({
    error: "Database not connected. Connect a Redis/Upstash database to this Vercel project and redeploy.",
    foundEnvNames: dbEnvNames,
  });
}
