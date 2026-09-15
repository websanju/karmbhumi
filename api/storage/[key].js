import {
  redis, dbConfigured, noDb, KEY_RE, storeKey, clientIp,
  pinHashOf, isBlocked, recordFail, dailyBackup,
} from "../_lib.js";

// GET / PUT / DELETE /api/storage/:key
export default async function handler(req, res) {
  if (!dbConfigured) return noDb(res);
  res.setHeader("Cache-Control", "no-store");

  const key = String(req.query.key || "");
  if (!KEY_RE.test(key)) return res.status(400).json({ error: "Invalid key" });

  const ip = clientIp(req);
  const sent = req.headers["x-admin-hash"];

  try {
    if (await isBlocked(ip)) {
      return res.status(429).json({ error: "Too many wrong PIN attempts. Try again in 15 minutes." });
    }

    const current = await redis.get(storeKey(key));
    const pin = current ? pinHashOf(current) : null;

    if (req.method === "GET") {
      if (current === null) return res.status(200).json({ key, value: null, shared: true }); // empty database is normal
      let value = current;
      if (pin && sent !== pin) {
        if (sent) await recordFail(ip);
        const obj = JSON.parse(current);
        obj.settings.pinHash = "LOCKED"; // viewers only learn that a PIN exists
        value = JSON.stringify(obj);
      }
      return res.status(200).json({ key, value, shared: true });
    }

    if (req.method === "PUT" || req.method === "DELETE") {
      if (pin && sent !== pin) {
        await recordFail(ip);
        return res.status(403).json({ error: "Admin PIN required" });
      }
      if (req.method === "DELETE") {
        const n = await redis.del(storeKey(key));
        return res.status(200).json({ key, deleted: n > 0, shared: true });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (typeof body.value !== "string") return res.status(400).json({ error: "value must be a string" });
      await redis.set(storeKey(key), body.value);
      await dailyBackup(key, body.value);
      return res.status(200).json({ key, value: body.value, shared: true });
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("storage error", e);
    return res.status(500).json({ error: "Server error" });
  }
}
