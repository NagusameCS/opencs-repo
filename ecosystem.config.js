module.exports = {
  apps: [
    {
      name: "webui",
      script: "server.js",
      cwd: "/home/deploy/management/webui",
      env: {
        PORT: 3000,
        NODE_ENV: "production"
      }
    },
    {
      name: "valentin",
      script: "venv/bin/python",
      args: "app.py 5001",
      cwd: "/home/deploy/management/sites/valentin",
      interpreter: "none",
      env_file: "/home/deploy/management/sites/valentin/.env"
    }
  ]
};
