import { redis, dbConfigured, noDb } from "../_lib.js";

// GET /api/storage?prefix=...
export default async function handler(req, res) {
  if (!dbConfigured) return noDb(res);
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const prefix = String(req.query.prefix || "");
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, { match: `kb:store:${prefix}*`, count: 100 });
    cursor = String(next);
    keys.push(...batch.map((k) => k.slice("kb:store:".length)));
  } while (cursor !== "0");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ keys, prefix, shared: true });
}
