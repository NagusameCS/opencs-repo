# OpenCS

Open source tools and projects by students.

🌐 [opencs.dev](https://opencs.dev) · 💻 [GitHub](https://github.com/OpenCS-dev)

## Projects

| Project | Description | Status |
|---------|-------------|--------|
| [Valentin](https://opencs.dev/valentin) | Valentine's Day matchmaking app | 🟢 Live |
| [Heatmap](https://opencs.dev/heatmap) | Interactive heatmap visualization | 🟢 Live |
| [Linehook](https://opencs.dev/linehook) | GitHub stats badge generator | 🟢 Live |
| [Knowtif](https://github.com/OpenCS-dev/knowtif) | Notification library for TypeScript | 🟡 WIP |

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Database:** JSON files, Firebase
- **Hosting:** Self-hosted VPS with Nginx + PM2

## Structure

```
homepage/          # Main website
sites/
  ├── valentin/    # Matchmaking app
  ├── heatmap/     # Heatmap tool
  ├── knowtif/     # Notification lib
  └── linehook/    # Badge generator
webui/             # Admin portal & API
config/            # Server config
```

## Deployment

Auto-deploys via GitHub webhook on push to `main`.

```bash
# Manual deploy
git pull && cd webui && npm install && pm2 restart vps-portal
```

## License

MIT
