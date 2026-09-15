// Shared helpers for the Vercel API functions (files starting with "_" are not routes)
import { Redis } from "@upstash/redis";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const dbConfigured = Boolean(url && token);
export const redis = dbConfigured ? new Redis({ url, token, automaticDeserialization: false, enableAutoPipelining: false }) : null;

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
  if (n === 1) await redis.expire(k, WINDOW_SEC);
}

export async function dailyBackup(key, value) {
  if (key !== MAIN_KEY) return;
  const day = new Date().toISOString().slice(0, 10);
  await redis.set(`kb:backup:${day}`, value, { ex: BACKUP_DAYS * 86400 });
}

export function noDb(res) {
  res.status(503).json({
    error: "Database not connected. Add Upstash Redis to this Vercel project and redeploy.",
  });
}
