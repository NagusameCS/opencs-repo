import * as fs from 'fs';
import * as path from 'path';
import { getConfig, KnowtifConfig } from './config';

export const generateWorkflow = (config?: KnowtifConfig): string => {
    const cfg = config || getConfig();
    const events = cfg.events || ['push', 'workflow_run'];
    const branches = cfg.branches || ['main', 'master'];

    const eventTriggers = buildEventTriggers(events, branches);
    const envBlock = buildEnvBlock(cfg);

    return `# Knowtif - GitHub Notifications
# Docs: https://github.com/NagusameCS/knowtif

name: Knowtif

on:
${eventTriggers}
jobs:
  notify:
    runs-on: ubuntu-latest
    if: \${{ github.event.workflow_run.name != 'Knowtif' || github.event_name != 'workflow_run' }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx knowtif@latest action
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
${envBlock}
`;
};

export const saveWorkflow = (config?: KnowtifConfig): string => {
    const workflow = generateWorkflow(config);
    const workflowDir = path.join(process.cwd(), '.github', 'workflows');
    const workflowPath = path.join(workflowDir, 'knowtif.yml');

    if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
    }

    fs.writeFileSync(workflowPath, workflow);
    return workflowPath;
};

const buildEventTriggers = (events: string[], branches: string[]): string => {
    const branchArray = branches.map(b => `"${b}"`).join(', ');
    let triggers = '';

    if (events.includes('push')) {
        triggers += `  push:
    branches: [ ${branchArray} ]
`;
    }

    if (events.includes('workflow_run')) {
        triggers += `  workflow_run:
    workflows: ["*"]
    types: [completed]
`;
    }

    if (events.includes('deployment_status')) {
        triggers += `  deployment_status:
`;
    }

    if (events.includes('pull_request')) {
        triggers += `  pull_request:
    types: [opened, closed]
`;
    }

    if (events.includes('release')) {
        triggers += `  release:
    types: [published]
`;
    }

    if (events.includes('issues')) {
        triggers += `  issues:
    types: [opened, closed]
`;
    }

    if (events.includes('star')) {
        triggers += `  star:
    types: [created]
`;
    }

    if (events.includes('fork')) {
        triggers += `  fork:
`;
    }

    return triggers;
};

const buildEnvBlock = (config: KnowtifConfig): string => {
    const lines: string[] = [];

    for (const dest of config.destinations.filter(d => d.enabled)) {
        switch (dest.type) {
            case 'discord':
                lines.push(`          DISCORD_WEBHOOK: "${dest.config.webhook}"`);
                break;
            case 'pushover':
                lines.push(`          PUSHOVER_USER: "${dest.config.user}"`);
                lines.push(`          PUSHOVER_TOKEN: "${dest.config.token}"`);
                break;
            case 'ntfy':
                lines.push(`          NTFY_TOPIC: "${dest.config.topic}"`);
                lines.push(`          NTFY_SERVER: "${dest.config.server || 'https://ntfy.sh'}"`);
                break;
            case 'email':
                lines.push(`          SMTP_HOST: "${dest.config.host}"`);
                lines.push(`          SMTP_PORT: "${dest.config.port}"`);
                lines.push(`          SMTP_USER: "${dest.config.user}"`);
                lines.push(`          SMTP_PASS: "${dest.config.pass}"`);
                lines.push(`          EMAIL_TO: "${dest.config.to}"`);
                break;
            case 'webhook':
                lines.push(`          WEBHOOK_URL: "${dest.config.url}"`);
                if (dest.config.secret) {
                    lines.push(`          WEBHOOK_SECRET: "${dest.config.secret}"`);
                }
                break;
        }
    }

    if (config.healthCheckUrl) {
        lines.push(`          HEALTH_CHECK_URL: "${config.healthCheckUrl}"`);
    }

    return lines.join('\n');
};
