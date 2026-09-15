// PM2 config: pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "karmbhumi",
    script: "server/server.js",
    cwd: __dirname + "/..",
    env: { NODE_ENV: "production", PORT: 3001 },
    max_memory_restart: "200M",
  }],
};
