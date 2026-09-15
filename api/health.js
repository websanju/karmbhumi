import { dbConfigured, redis } from "./_lib.js";

export default async function handler(_req, res) {
  let database = dbConfigured ? "connected" : "not configured";
  if (dbConfigured) {
    try { await redis.ping(); } catch (e) { database = "error: " + e.message; }
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: database === "connected", database });
}
