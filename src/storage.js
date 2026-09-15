// Replacement for Claude's window.storage.
// shared = true  -> saved on the server (everyone sees the same data)
// shared = false -> saved in this browser only (admin login, WhatsApp number)

const LOCAL_PREFIX = "kb:";
const ADMIN_KEY = "karmbhumi-admin-pin";
const api = (key) => `/api/storage/${encodeURIComponent(key)}`;

const adminHeader = () => {
  const h = localStorage.getItem(LOCAL_PREFIX + ADMIN_KEY);
  return h ? { "X-Admin-Hash": h } : {};
};

async function check(res) {
  if (res.status === 404) throw new Error("Key not found");
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}

window.storage = {
  async get(key, shared = false) {
    if (!shared) {
      const value = localStorage.getItem(LOCAL_PREFIX + key);
      if (value === null) throw new Error("Key not found");
      return { key, value, shared };
    }
    return check(await fetch(api(key), { headers: adminHeader(), cache: "no-store" }));
  },

  async set(key, value, shared = false) {
    if (!shared) {
      localStorage.setItem(LOCAL_PREFIX + key, value);
      return { key, value, shared };
    }
    await check(await fetch(api(key), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...adminHeader() },
      body: JSON.stringify({ value }),
    }));
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    if (!shared) {
      localStorage.removeItem(LOCAL_PREFIX + key);
      return { key, deleted: true, shared };
    }
    return check(await fetch(api(key), { method: "DELETE", headers: adminHeader() }));
  },

  async list(prefix = "", shared = false) {
    if (!shared) {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(LOCAL_PREFIX + prefix))
        .map((k) => k.slice(LOCAL_PREFIX.length));
      return { keys, prefix, shared };
    }
    return check(await fetch(`/api/storage?prefix=${encodeURIComponent(prefix)}`));
  },
};
