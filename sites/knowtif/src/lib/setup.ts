import inquirer from 'inquirer';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { getConfig, saveConfig, addDestination, Destination } from './config';
import * as ui from './ui';

const getRepoInfo = () => {
    try {
        const repoUrl = execSync('git config --get remote.origin.url', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
        const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^.]+)/);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
    } catch { }
    return null;
};

// Destination setup functions
const setupDiscord = async (): Promise<Destination | null> => {
    console.log();
    console.log(ui.box(
        `${ui.icons.discord} Discord Webhook Setup\n\n` +
        `${ui.colors.muted('1.')} Open Discord and go to your server\n` +
        `${ui.colors.muted('2.')} Server Settings -> Integrations -> Webhooks\n` +
        `${ui.colors.muted('3.')} Click "New Webhook" and copy the URL`,
        { title: 'Discord', width: 55 }
    ));
    console.log();

    const { webhook, name } = await inquirer.prompt([
        {
            type: 'input',
            name: 'webhook',
            message: ui.colors.primary('Webhook URL:'),
            validate: (input: string) => {
                if (!input) return 'Webhook URL is required';
                if (!input.startsWith('https://discord.com/api/webhooks/') &&
                    !input.startsWith('https://discordapp.com/api/webhooks/')) {
                    return 'Invalid URL. Should start with https://discord.com/api/webhooks/';
                }
                return true;
            },
        },
        {
            type: 'input',
            name: 'name',
            message: ui.colors.primary('Name for this destination:'),
            default: 'Discord',
        },
    ]);

    // Test the webhook
    try {
        await ui.spinner('Testing webhook', async () => {
            await axios.post(webhook, {
                embeds: [{
                    title: 'Knowtif Connected!',
                    description: 'You will receive GitHub notifications here.',
                    color: 5763719,
                    footer: { text: 'Knowtif' },
                }]
            });
        });
    } catch {
        ui.error('Failed to send test message. Check your webhook URL.');
        const { cont } = await inquirer.prompt([
            { type: 'confirm', name: 'cont', message: 'Save anyway?', default: false }
        ]);
        if (!cont) return null;
    }

    return {
        type: 'discord',
        name,
        enabled: true,
        config: { webhook },
    };
};

const setupPushover = async (): Promise<Destination | null> => {
    console.log();
    console.log(ui.box(
        `${ui.icons.phone} Pushover Setup\n\n` +
        `${ui.colors.muted('1.')} Install Pushover app on your phone\n` +
        `${ui.colors.muted('2.')} Create account at ${ui.colors.secondary('https://pushover.net')}\n` +
        `${ui.colors.muted('3.')} Copy your User Key from the dashboard\n` +
        `${ui.colors.muted('4.')} Create an Application and copy API Token`,
        { title: 'Pushover', width: 55 }
    ));
    console.log();

    const { user, token, name } = await inquirer.prompt([
        {
            type: 'input',
            name: 'user',
            message: ui.colors.primary('User Key:'),
            validate: (input: string) => input.length > 0 || 'User Key is required',
        },
        {
            type: 'password',
            name: 'token',
            message: ui.colors.primary('API Token:'),
            mask: '*',
            validate: (input: string) => input.length > 0 || 'API Token is required',
        },
        {
            type: 'input',
            name: 'name',
            message: ui.colors.primary('Name for this destination:'),
            default: 'Phone',
        },
    ]);

    // Test
    try {
        await ui.spinner('Testing Pushover', async () => {
            await axios.post('https://api.pushover.net/1/messages.json', {
                token,
                user,
                title: 'Knowtif Connected!',
                message: 'You will receive GitHub notifications here.',
                sound: 'magic',
            });
        });
    } catch {
        ui.error('Failed to send test. Check your credentials.');
        const { cont } = await inquirer.prompt([
            { type: 'confirm', name: 'cont', message: 'Save anyway?', default: false }
        ]);
        if (!cont) return null;
    }

    return {
        type: 'pushover',
        name,
        enabled: true,
        config: { user, token },
    };
};

const setupNtfy = async (repoInfo: { owner: string; repo: string } | null): Promise<Destination | null> => {
    const defaultTopic = repoInfo
        ? `knowtif-${repoInfo.repo}-${crypto.createHash('sha256').update(`${repoInfo.owner}/${repoInfo.repo}`).digest('hex').substring(0, 8)}`
        : `knowtif-${crypto.randomBytes(4).toString('hex')}`;

    console.log();
    console.log(ui.box(
        `${ui.icons.browser} ntfy.sh Setup (Free Push Notifications)\n\n` +
        `${ui.colors.muted('ntfy.sh is a free service for push notifications.')}\n` +
        `${ui.colors.muted('No account needed - just subscribe to a topic!')}\n\n` +
        `${ui.colors.text('Subscribe at:')} ${ui.colors.secondary(`https://ntfy.sh/${defaultTopic}`)}`,
        { title: 'ntfy.sh', width: 55 }
    ));
    console.log();

    const { topic, server, name } = await inquirer.prompt([
        {
            type: 'input',
            name: 'topic',
            message: ui.colors.primary('Topic name:'),
            default: defaultTopic,
        },
        {
            type: 'input',
            name: 'server',
            message: ui.colors.primary('Server (leave default for ntfy.sh):'),
            default: 'https://ntfy.sh',
        },
        {
            type: 'input',
            name: 'name',
            message: ui.colors.primary('Name for this destination:'),
            default: 'Browser',
        },
    ]);

    // Test
    try {
        await ui.spinner('Testing ntfy', async () => {
            await axios.post(`${server}/${topic}`, 'Knowtif Connected! You will receive notifications here.', {
                headers: { 'Title': 'Knowtif Test', 'Priority': '3', 'Tags': 'white_check_mark' },
            });
        });
        console.log();
        ui.info(`Subscribe at: ${ui.colors.secondary(`${server}/${topic}`)}`);
    } catch {
        ui.warn('Could not verify, but saved anyway.');
    }

    return {
        type: 'ntfy',
        name,
        enabled: true,
        config: { topic, server },
    };
};

const setupEmail = async (): Promise<Destination | null> => {
    console.log();
    console.log(ui.box(
        `${ui.icons.email} Email (SMTP) Setup\n\n` +
        `${ui.colors.muted('For Gmail, use an App Password:')}\n` +
        `${ui.colors.muted('myaccount.google.com > Security > App passwords')}`,
        { title: 'Email', width: 55 }
    ));
    console.log();

    const answers = await inquirer.prompt([
        { type: 'input', name: 'host', message: ui.colors.primary('SMTP Host:'), default: 'smtp.gmail.com' },
        { type: 'input', name: 'port', message: ui.colors.primary('SMTP Port:'), default: '587' },
        { type: 'input', name: 'user', message: ui.colors.primary('Email/Username:') },
        { type: 'password', name: 'pass', message: ui.colors.primary('Password:'), mask: '*' },
        { type: 'input', name: 'to', message: ui.colors.primary('Send notifications to:') },
        { type: 'input', name: 'name', message: ui.colors.primary('Name for this destination:'), default: 'Email' },
    ]);

    return {
        type: 'email',
        name: answers.name,
        enabled: true,
        config: {
            host: answers.host,
            port: answers.port,
            user: answers.user,
            pass: answers.pass,
            to: answers.to,
        },
    };
};

const setupWebhook = async (): Promise<Destination | null> => {
    console.log();
    console.log(ui.box(
        `${ui.icons.webhook} Custom Webhook Setup\n\n` +
        `${ui.colors.muted('Send JSON payloads to your own endpoint.')}\n` +
        `${ui.colors.muted('Great for custom integrations!')}`,
        { title: 'Webhook', width: 55 }
    ));
    console.log();

    const answers = await inquirer.prompt([
        { type: 'input', name: 'url', message: ui.colors.primary('Webhook URL:') },
        { type: 'password', name: 'secret', message: ui.colors.primary('Secret (for HMAC, optional):'), mask: '*' },
        { type: 'input', name: 'name', message: ui.colors.primary('Name for this destination:'), default: 'Webhook' },
    ]);

    return {
        type: 'webhook',
        name: answers.name,
        enabled: true,
        config: {
            url: answers.url,
            secret: answers.secret || '',
        },
    };
};

// Generate GitHub Actions workflow
const generateWorkflow = (config: ReturnType<typeof getConfig>) => {
    const events = config.events || ['push', 'workflow_run'];

    let triggers = '';
    if (events.includes('push')) {
        const branches = (config.branches || ['main', 'master']).map(b => `"${b}"`).join(', ');
        triggers += `  push:\n    branches: [ ${branches} ]\n`;
    }
    if (events.includes('workflow_run')) {
        triggers += `  workflow_run:\n    workflows: ["*"]\n    types: [completed]\n`;
    }
    if (events.includes('deployment_status')) {
        triggers += `  deployment_status:\n`;
    }
    if (events.includes('pull_request')) {
        triggers += `  pull_request:\n    types: [opened, closed]\n`;
    }
    if (events.includes('release')) {
        triggers += `  release:\n    types: [published]\n`;
    }

    // Build env vars from destinations
    const envLines: string[] = ['          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}'];

    for (const dest of config.destinations.filter(d => d.enabled)) {
        switch (dest.type) {
            case 'discord':
                envLines.push(`          DISCORD_WEBHOOK: "${dest.config.webhook}"`);
                break;
            case 'pushover':
                envLines.push(`          PUSHOVER_USER: "${dest.config.user}"`);
                envLines.push(`          PUSHOVER_TOKEN: "${dest.config.token}"`);
                break;
            case 'ntfy':
                envLines.push(`          NTFY_TOPIC: "${dest.config.topic}"`);
                envLines.push(`          NTFY_SERVER: "${dest.config.server}"`);
                break;
            case 'email':
                envLines.push(`          SMTP_HOST: "${dest.config.host}"`);
                envLines.push(`          SMTP_PORT: "${dest.config.port}"`);
                envLines.push(`          SMTP_USER: "${dest.config.user}"`);
                envLines.push(`          SMTP_PASS: "${dest.config.pass}"`);
                envLines.push(`          EMAIL_TO: "${dest.config.to}"`);
                break;
            case 'webhook':
                envLines.push(`          WEBHOOK_URL: "${dest.config.url}"`);
                if (dest.config.secret) {
                    envLines.push(`          WEBHOOK_SECRET: "${dest.config.secret}"`);
                }
                break;
        }
    }

    return `# Knowtif - GitHub Notifications
# Docs: https://github.com/NagusameCS/knowtif

name: Knowtif

on:
${triggers}
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
${envLines.join('\n')}
`;
};

// Main setup flow
export const runSetup = async () => {
    ui.clear();
    ui.header();

    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        ui.error('Not in a GitHub repository. Please run this in a git repo.');
        process.exit(1);
    }

    console.log(ui.colors.muted(`  Repository: ${repoInfo.owner}/${repoInfo.repo}\n`));
    ui.divider();

    // Step 1: Choose events
    console.log();
    const { eventChoice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'eventChoice',
            message: ui.colors.primary('What should trigger notifications?'),
            choices: [
                { name: `${ui.icons.rocket} Everything (pushes, CI, deploys, releases, PRs)`, value: 'all' },
                { name: `${ui.icons.bell} Basic (pushes and CI results)`, value: 'basic' },
                { name: `${ui.icons.settings} Custom selection`, value: 'custom' },
            ],
        },
    ]);

    let events: string[];
    if (eventChoice === 'all') {
        events = ['push', 'workflow_run', 'deployment_status', 'release', 'pull_request'];
    } else if (eventChoice === 'basic') {
        events = ['push', 'workflow_run'];
    } else {
        const { customEvents } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'customEvents',
                message: ui.colors.primary('Select events:'),
                choices: [
                    { name: 'Push', value: 'push', checked: true },
                    { name: 'CI/Workflow completed', value: 'workflow_run', checked: true },
                    { name: 'Deployment status', value: 'deployment_status' },
                    { name: 'Releases', value: 'release' },
                    { name: 'Pull requests', value: 'pull_request' },
                ],
            },
        ]);
        events = customEvents;
    }

    saveConfig({ events, repoOwner: repoInfo.owner, repoName: repoInfo.repo });

    // Step 2: Add destinations
    console.log();
    ui.divider();
    console.log();

    let addingDestinations = true;
    while (addingDestinations) {
        const { destType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'destType',
                message: ui.colors.primary('Add notification destination:'),
                choices: [
                    { name: `${ui.icons.discord} Discord`, value: 'discord' },
                    { name: `${ui.icons.phone} Phone (Pushover)`, value: 'pushover' },
                    { name: `${ui.icons.browser} Browser (ntfy.sh - free!)`, value: 'ntfy' },
                    { name: `${ui.icons.email} Email`, value: 'email' },
                    { name: `${ui.icons.webhook} Custom Webhook`, value: 'webhook' },
                    { name: `${ui.colors.muted('─────────────────────────')}`, value: 'separator', disabled: true },
                    { name: `${ui.icons.check} Done adding destinations`, value: 'done' },
                ],
            },
        ]);

        if (destType === 'done') {
            addingDestinations = false;
            continue;
        }

        let dest: Destination | null = null;
        switch (destType) {
            case 'discord': dest = await setupDiscord(); break;
            case 'pushover': dest = await setupPushover(); break;
            case 'ntfy': dest = await setupNtfy(repoInfo); break;
            case 'email': dest = await setupEmail(); break;
            case 'webhook': dest = await setupWebhook(); break;
        }

        if (dest) {
            addDestination(dest);
            ui.success(`${dest.name} added!`);
        }

        const config = getConfig();
        if (config.destinations.length > 0) {
            const { addMore } = await inquirer.prompt([
                { type: 'confirm', name: 'addMore', message: 'Add another destination?', default: false }
            ]);
            if (!addMore) addingDestinations = false;
        }
    }

    // Step 3: Generate workflow
    const config = getConfig();

    if (config.destinations.length === 0) {
        ui.error('No destinations configured. Run setup again.');
        return;
    }

    const workflow = generateWorkflow(config);
    const workflowDir = path.join(process.cwd(), '.github', 'workflows');
    const workflowPath = path.join(workflowDir, 'knowtif.yml');

    if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
    }
    fs.writeFileSync(workflowPath, workflow);

    saveConfig({ installed: true });

    // Done!
    console.log();
    ui.divider();
    console.log();

    console.log(ui.box(
        `${ui.icons.check} ${ui.colors.success.bold('Setup Complete!')}\n\n` +
        `${ui.colors.text('Destinations:')} ${config.destinations.map(d => d.name).join(', ')}\n` +
        `${ui.colors.text('Events:')} ${events.join(', ')}\n\n` +
        `${ui.colors.muted('Next steps:')}\n` +
        `  ${ui.colors.secondary('git add .github/workflows/knowtif.yml')}\n` +
        `  ${ui.colors.secondary('git commit -m "Add notifications"')}\n` +
        `  ${ui.colors.secondary('git push')}\n\n` +
        `${ui.icons.lock} ${ui.colors.muted('Credentials encrypted in ~/.knowtif/')}`,
        { title: 'Done', width: 55, borderColor: ui.colors.success }
    ));
    console.log();
};

// Alias for install command
export const installWorkflow = runSetup;
