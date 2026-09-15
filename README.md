# Karmbhumi Society, Patan – Festival Accounts App

React (Vite) frontend + small Node.js/Express server.
Data is saved in `data/store.json` on the server, with one backup copy per day in `data/backups/` (last 60 days kept).

```
karmbhumi-app/
├─ src/App.jsx          the app (Gujarati UI)
├─ src/storage.js       connects the app to the server
├─ server/server.js     API + serves the built app, checks the admin PIN
├─ api/                 Vercel serverless API (uses Upstash Redis)
├─ vercel.json          Vercel build settings
├─ deploy/              PM2 and Nginx config
└─ Dockerfile           optional Docker deployment
```

---

## 1. Run on your computer

Requirement: **Node.js 18.18 or newer** (Node 20 LTS recommended). Check with `node -v`.

```bash
cd karmbhumi-app
npm install
npm run dev
```

Open **http://localhost:5173**.

- `npm run dev` starts two things: the API on port 3001 and the Vite dev server on port 5173.
- Local data is saved in `karmbhumi-app/data/store.json`.
- First step in the app: tap **"એડમિન PIN બનાવો"** and set your PIN.

### Test the production build locally

```bash
npm run build
npm start
```

Open **http://localhost:3001**. This is exactly what runs on the server.

---

## 2. Deploy on a server (Ubuntu VPS)

Works on any Ubuntu 22.04/24.04 VPS (Hostinger, DigitalOcean, AWS Lightsail, etc.).
Point a domain or subdomain (for example `karmbhumi.yourdomain.com`) to the server IP with an **A record** first.

### 2.1 Install Node.js, Nginx, PM2 (one time)

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```

### 2.2 Upload the project

From your computer (skip `node_modules`, `dist` and `data`):

```bash
scp -r karmbhumi-app user@SERVER_IP:/var/www/
```

Or push it to a private GitHub repo and `git clone` it into `/var/www/karmbhumi-app` on the server.

### 2.3 Build and start

```bash
cd /var/www/karmbhumi-app
npm ci
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup        # run the command it prints, so the app restarts after reboot
```

Check: `curl http://localhost:3001/api/health` should return `{"ok":true}`.

### 2.4 Nginx + free HTTPS

```bash
sudo cp deploy/nginx-karmbhumi.conf /etc/nginx/sites-available/karmbhumi
sudo nano /etc/nginx/sites-available/karmbhumi      # change server_name to your domain
sudo ln -s /etc/nginx/sites-available/karmbhumi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d karmbhumi.yourdomain.com
```

HTTPS is **required**: the admin PIN uses browser crypto that only works on `https://` (or localhost).

Open `https://karmbhumi.yourdomain.com`, create the admin PIN, then share the link in the society WhatsApp group.

### 2.5 Updating later

```bash
cd /var/www/karmbhumi-app
git pull              # or upload the new files
npm ci
npm run build
pm2 restart karmbhumi
```

Your data in `data/` is not touched by updates.

---

## 3. Deploy on Vercel

Vercel does not run `server/server.js` and cannot keep files, so on Vercel the
`api/` folder is used instead and data is stored in **Upstash Redis** (free tier is enough).

1. Push the code to GitHub and import the repo in Vercel (framework: Vite – detected from `vercel.json`).
2. In the Vercel project open **Storage → Create Database → Upstash (Redis)**, pick a region
   close to India (for example Mumbai `ap-south-1` if offered), and **connect it to this project**
   for Production, Preview and Development.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
   (If you create the database directly on upstash.com instead, add
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` under Settings → Environment Variables.)
3. **Redeploy** (Deployments → ⋯ → Redeploy). Environment variables only apply to new deployments.
4. Open `https://YOUR-SITE.vercel.app/api/health` – it must show
   `{"ok":true,"database":"connected"}`.
5. Open the site and create the admin PIN.

Daily backups are kept in Redis as `kb:backup:YYYY-MM-DD` for 60 days.
Use the in-app **"બેકઅપ લો"** button regularly as well.

**Forgot the PIN on Vercel?** In the Upstash data browser open key
`kb:store:karmbhumi-society-v1`, remove the `"pinHash"` entry from `settings`, save, then create a new PIN in the app.

## 4. Other hosting options

**Docker**

```bash
docker build -t karmbhumi .
docker run -d --name karmbhumi -p 3001:3001 -v karmbhumi-data:/app/data --restart unless-stopped karmbhumi
```

**Render / Railway**
Build command `npm ci && npm run build`, start command `npm start`.
You **must** attach a persistent disk and set `DATA_DIR` to its mount path (for example `/data`). Without a disk, all data is lost on every redeploy.

Shared hosting that only supports PHP will not work – Node.js is required.

---

## 5. Backups and PIN (own server)

- Automatic daily copies: `data/backups/store-YYYY-MM-DD.json`.
- Copy them off the server now and then:
  `scp user@SERVER_IP:/var/www/karmbhumi-app/data/store.json ./karmbhumi-backup.json`
- **Forgot the admin PIN?** On the server, open `data/store.json`, find `"pinHash"` inside the settings and delete that line (keep the JSON valid), then run `pm2 restart karmbhumi`. Open the app and create a new PIN straight away.
- After 10 wrong PIN attempts, that device is blocked for 15 minutes.

## 6. Settings

| Variable   | Default        | Purpose                   |
|------------|----------------|---------------------------|
| `PORT`     | `3001`         | Server port               |
| `DATA_DIR` | `./data`       | Where data and backups go |
