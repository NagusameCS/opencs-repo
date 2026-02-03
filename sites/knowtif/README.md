# Knowtif

![Lines](https://raw.githubusercontent.com/NagusameCS/knowtif/main/.linehook/badges/lines.svg)
![Files](https://raw.githubusercontent.com/NagusameCS/knowtif/main/.linehook/badges/files.svg)
![Code](https://raw.githubusercontent.com/NagusameCS/knowtif/main/.linehook/badges/code.svg)
![Chars](https://raw.githubusercontent.com/NagusameCS/knowtif/main/.linehook/badges/chars.svg)

![Stats Card](https://raw.githubusercontent.com/NagusameCS/knowtif/main/.linehook/stats-card.svg)

**Get notified when your GitHub changes propagate.** Push, CI, Deploy, Health Check - all in one command.

No server required. Runs entirely on GitHub Actions.

## Quick Start

```bash
npx knowtif install
```

That's it! Follow the prompts to:
1. Choose which events to monitor
2. Set up your notification channels (Discord, Phone, Email)
3. Commit and push the generated workflow

## What You Get Notified About

| Event | Description |
|-------|-------------|
| **Push Received** | Your code has been received by GitHub |
| **CI Passed** | All workflows completed successfully |
| **CI Failed** | A workflow failed or timed out |
| **Deployment Successful** | Your app was deployed |
| **Deployment Failed** | Deployment encountered an error |
| **Health Check Passed** | Your app is reachable after deploy |
| **Health Check Failed** | App is not responding after deploy |
| **New Pull Request** | A PR was opened |
| **PR Merged** | A PR was merged |
| **PR Approved** | Someone approved a PR |
| **New Issue** | An issue was opened |
| **New Release** | A release was published |
| **New Star** | Someone starred your repo |
| **Repository Forked** | Someone forked your repo |

## Notification Channels

### Discord
Create a webhook in your Discord server:
1. Server Settings > Integrations > Webhooks > New Webhook
2. Copy the webhook URL
3. Paste it when prompted during `npx knowtif install`

### Pushover (Phone Notifications)
1. Create an account at [pushover.net](https://pushover.net)
2. Download the Pushover app on your phone
3. Create an application to get an API token
4. Use your User Key and API Token during setup

### Email (SMTP)
Use any SMTP provider (Gmail, SendGrid, etc.):
- **Gmail**: Use `smtp.gmail.com`, port `587`, and an [App Password](https://support.google.com/accounts/answer/185833)
- **SendGrid**: Use `smtp.sendgrid.net`, port `587`

### ntfy.sh (Browser Extensions)
Free push notifications - perfect for web extensions:
1. Pick a unique topic name
2. Your extension subscribes to `https://ntfy.sh/YOUR_TOPIC/sse`

### Custom Webhook
Send JSON payloads to your own backend:
- Includes HMAC signature verification
- Perfect for WebSocket broadcasting to clients

## Manual Setup

If you prefer to set things up manually:

### 1. Create the workflow file

Create `.github/workflows/knowtif.yml`:

```yaml
name: Knowtif Monitor

on:
  push:
    branches: [ "main", "master" ]
  workflow_run:
    workflows: ["*"]
    types: [completed]
  deployment_status:
  pull_request:
    types: [opened, closed]
  release:
    types: [published]

jobs:
  notify:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.name != 'Knowtif Monitor' || github.event_name != 'workflow_run' }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Send Notifications
        run: npx knowtif@latest action
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          DISCORD_WEBHOOK: ${{ secrets.KNOWTIF_DISCORD_WEBHOOK }}
          PUSHOVER_USER: ${{ secrets.KNOWTIF_PUSHOVER_USER }}
          PUSHOVER_TOKEN: ${{ secrets.KNOWTIF_PUSHOVER_TOKEN }}
          SMTP_HOST: ${{ secrets.KNOWTIF_SMTP_HOST }}
          SMTP_PORT: ${{ secrets.KNOWTIF_SMTP_PORT }}
          SMTP_USER: ${{ secrets.KNOWTIF_SMTP_USER }}
          SMTP_PASS: ${{ secrets.KNOWTIF_SMTP_PASS }}
          EMAIL_TO: ${{ secrets.KNOWTIF_EMAIL_TO }}
          HEALTH_CHECK_URL: "https://your-app.com/health"
```

### 2. Set repository secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**

Or use GitHub CLI:
```bash
gh secret set KNOWTIF_DISCORD_WEBHOOK
```

## Local Development / CLI Usage

You can also use Knowtif locally to watch a repository:

```bash
# Install globally
npm install -g knowtif

# Configure your tokens
knowtif setup

# Watch the current repo
knowtif watch

# Watch with options
knowtif watch --repo owner/name --branch main --url https://my-app.com
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `knowtif install` | Generate GitHub Action workflow and set up secrets |
| `knowtif setup` | Configure local notification settings |
| `knowtif watch` | Watch repository events locally (polling) |
| `knowtif action` | Run in GitHub Action mode (internal) |

## Environment Variables

When running in GitHub Actions, these environment variables are used:

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK` | Discord webhook URL |
| `PUSHOVER_USER` | Pushover user key |
| `PUSHOVER_TOKEN` | Pushover API token |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_TO` | Email recipient |
| `HEALTH_CHECK_URL` | URL to check after deployment |

## How It Works

1. **GitHub Actions** triggers on your selected events
2. **Knowtif** runs in the action, reads the event payload
3. **Notifications** are sent to your configured channels
4. **No server needed** - everything runs on GitHub's infrastructure

## Browser Extension

Get knowtif notifications directly in your browser with the companion extension.

**[knowtif-extension](https://github.com/NagusameCS/knowtif-extension)** - Real-time alerts without leaving your workflow.

![Lines](https://raw.githubusercontent.com/NagusameCS/knowtif-extension/main/.linehook/badges/lines.svg)
![Files](https://raw.githubusercontent.com/NagusameCS/knowtif-extension/main/.linehook/badges/files.svg)
![Code](https://raw.githubusercontent.com/NagusameCS/knowtif-extension/main/.linehook/badges/code.svg)
![Chars](https://raw.githubusercontent.com/NagusameCS/knowtif-extension/main/.linehook/badges/chars.svg)
![Languages](https://raw.githubusercontent.com/NagusameCS/knowtif-extension/main/.linehook/badges/languages.svg)
![Assets](https://raw.githubusercontent.com/NagusameCS/knowtif-extension/main/.linehook/badges/assets.svg)
![Pages](https://raw.githubusercontent.com/NagusameCS/knowtif-extension/main/.linehook/badges/pages.svg)

Available for Firefox, Edge, and Opera *(coming soon)*.

## License

ISC