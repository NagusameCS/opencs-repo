# OpenCS

Open source tools and projects.

**Website:** [opencs.dev](https://opencs.dev)  
**GitHub:** [OpenCS-dev](https://github.com/OpenCS-dev)

## Projects

| Project | Description |
|---------|-------------|
| **Valentin** | Valentine's Day matchmaking app with questionnaire and compatibility matching |
| **Heatmap** | Interactive heatmap visualization tool |
| **Knowtif** | Notification library |
| **Linehook** | GitHub stats badge generator |

## Structure

```
├── homepage/          # Main website (opencs.dev)
├── sites/
│   ├── valentin/      # Matchmaking app
│   ├── heatmap/       # Heatmap tool
│   ├── knowtif/       # Notification lib
│   └── linehook/      # Badge generator
├── webui/             # Admin portal & API server
└── config/            # Server configuration
```

## Deployment

This repo auto-deploys via GitHub webhook on push to `main`.

**Webhook endpoint:** `https://opencs.dev/webhook/github`

### Manual deploy

```bash
git pull
cd webui && npm install
pm2 restart vps-portal
```

## License

MIT
