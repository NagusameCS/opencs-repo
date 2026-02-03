"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installWorkflow = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const getRepoInfo = () => {
    try {
        const repoUrl = (0, child_process_1.execSync)('git config --get remote.origin.url').toString().trim();
        const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^.]+)/);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
    }
    catch { }
    return null;
};
const generateTopicName = (owner, repo) => {
    const hash = crypto_1.default.createHash('sha256').update(`${owner}/${repo}`).digest('hex').substring(0, 8);
    return `knowtif-${repo}-${hash}`;
};
const testDiscordWebhook = async (url) => {
    try {
        await axios_1.default.post(url, {
            embeds: [{
                    title: 'Knowtif Connected!',
                    description: 'Your Discord notifications are set up. You will receive notifications here when GitHub events occur.',
                    color: 5763719,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Knowtif' },
                }]
        });
        return true;
    }
    catch {
        return false;
    }
};
const testPushover = async (user, token) => {
    try {
        await axios_1.default.post('https://api.pushover.net/1/messages.json', {
            token,
            user,
            title: 'Knowtif Connected!',
            message: 'Your phone notifications are set up.',
            sound: 'magic',
        });
        return true;
    }
    catch {
        return false;
    }
};
const testNtfy = async (topic, server) => {
    try {
        await axios_1.default.post(`${server}/${topic}`, 'Knowtif Connected! Your notifications are set up.', {
            headers: { 'Title': 'Knowtif Test', 'Priority': '3', 'Tags': 'white_check_mark' },
        });
        return true;
    }
    catch {
        return false;
    }
};
const installWorkflow = async () => {
    console.log(chalk_1.default.blue.bold('\n  Knowtif Setup\n'));
    // Check if we're in a git repo
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        console.error(chalk_1.default.red('  Not a GitHub repository. Run this in a git repo with a GitHub remote.'));
        process.exit(1);
    }
    console.log(chalk_1.default.gray(`  Repository: ${repoInfo.owner}/${repoInfo.repo}\n`));
    // Step 1: Choose notification channel
    const { channel } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'channel',
            message: 'Where do you want notifications?',
            choices: [
                { name: 'Discord (paste webhook URL)', value: 'discord' },
                { name: 'Phone (Pushover app)', value: 'pushover' },
                { name: 'Browser/ntfy.sh (free, instant)', value: 'ntfy' },
                { name: 'All of the above', value: 'all' },
            ],
        },
    ]);
    const channels = channel === 'all' ? ['discord', 'pushover', 'ntfy'] : [channel];
    const config = {};
    // Step 2: Collect credentials with validation
    if (channels.includes('discord')) {
        console.log(chalk_1.default.cyan('\n  Discord Setup'));
        console.log(chalk_1.default.gray('  Get webhook: Server Settings > Integrations > Webhooks > New Webhook > Copy URL\n'));
        const { webhook } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'webhook',
                message: 'Paste Discord Webhook URL:',
                validate: (input) => {
                    if (!input.startsWith('https://discord.com/api/webhooks/') &&
                        !input.startsWith('https://discordapp.com/api/webhooks/')) {
                        return 'Invalid webhook URL. Should start with https://discord.com/api/webhooks/';
                    }
                    return true;
                },
            },
        ]);
        console.log(chalk_1.default.gray('  Testing webhook...'));
        if (await testDiscordWebhook(webhook)) {
            console.log(chalk_1.default.green('  Discord connected! Check your channel for a test message.\n'));
            config.DISCORD_WEBHOOK = webhook;
        }
        else {
            console.log(chalk_1.default.red('  Failed to send test. Check your webhook URL.\n'));
            const { cont } = await inquirer_1.default.prompt([{ type: 'confirm', name: 'cont', message: 'Continue anyway?', default: false }]);
            if (cont)
                config.DISCORD_WEBHOOK = webhook;
        }
    }
    if (channels.includes('pushover')) {
        console.log(chalk_1.default.cyan('\n  Pushover Setup'));
        console.log(chalk_1.default.gray('  1. Install Pushover app on your phone'));
        console.log(chalk_1.default.gray('  2. Get your User Key from https://pushover.net'));
        console.log(chalk_1.default.gray('  3. Create an app and get the API Token\n'));
        const pushoverAnswers = await inquirer_1.default.prompt([
            { type: 'input', name: 'user', message: 'Pushover User Key:' },
            { type: 'input', name: 'token', message: 'Pushover API Token:' },
        ]);
        if (pushoverAnswers.user && pushoverAnswers.token) {
            console.log(chalk_1.default.gray('  Testing Pushover...'));
            if (await testPushover(pushoverAnswers.user, pushoverAnswers.token)) {
                console.log(chalk_1.default.green('  Pushover connected! Check your phone.\n'));
                config.PUSHOVER_USER = pushoverAnswers.user;
                config.PUSHOVER_TOKEN = pushoverAnswers.token;
            }
            else {
                console.log(chalk_1.default.red('  Failed to send test. Check your credentials.\n'));
            }
        }
    }
    if (channels.includes('ntfy')) {
        const defaultTopic = generateTopicName(repoInfo.owner, repoInfo.repo);
        console.log(chalk_1.default.cyan('\n  ntfy.sh Setup (free push notifications)'));
        console.log(chalk_1.default.gray('  Subscribe at: https://ntfy.sh/' + defaultTopic + '\n'));
        const { topic } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'topic',
                message: 'Topic name (or press Enter for auto):',
                default: defaultTopic,
            },
        ]);
        const server = 'https://ntfy.sh';
        console.log(chalk_1.default.gray('  Testing ntfy...'));
        if (await testNtfy(topic, server)) {
            console.log(chalk_1.default.green('  ntfy connected!\n'));
            config.NTFY_TOPIC = topic;
            config.NTFY_SERVER = server;
        }
        else {
            console.log(chalk_1.default.yellow('  Could not verify, but continuing...\n'));
            config.NTFY_TOPIC = topic;
            config.NTFY_SERVER = server;
        }
    }
    // Step 3: Choose events (simplified)
    const { eventSet } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'eventSet',
            message: 'What should trigger notifications?',
            choices: [
                { name: 'Everything (push, CI, deploy, releases, PRs)', value: 'all' },
                { name: 'Just pushes and CI results', value: 'basic' },
                { name: 'Only failures', value: 'failures' },
            ],
        },
    ]);
    let events;
    switch (eventSet) {
        case 'all':
            events = ['push', 'workflow_run', 'deployment_status', 'release', 'pull_request'];
            break;
        case 'failures':
            events = ['workflow_run', 'check_run'];
            break;
        default:
            events = ['push', 'workflow_run'];
    }
    // Step 4: Generate workflow
    const eventTriggers = buildEventTriggers(events);
    const envLines = Object.entries(config)
        .map(([key, val]) => `          ${key}: "${val}"`)
        .join('\n');
    const workflowContent = `# Knowtif - GitHub Notifications
# Generated by: npx knowtif install

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
${envLines}
`;
    const workflowDir = path.join(process.cwd(), '.github', 'workflows');
    if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
    }
    const workflowPath = path.join(workflowDir, 'knowtif.yml');
    fs.writeFileSync(workflowPath, workflowContent);
    // Step 5: Done!
    console.log(chalk_1.default.green.bold('\n  Setup complete!\n'));
    console.log(chalk_1.default.white('  Next: commit and push to activate\n'));
    console.log(chalk_1.default.cyan('    git add .github/workflows/knowtif.yml'));
    console.log(chalk_1.default.cyan('    git commit -m "Add notifications"'));
    console.log(chalk_1.default.cyan('    git push\n'));
    if (config.NTFY_TOPIC) {
        console.log(chalk_1.default.gray(`  Subscribe to ntfy: https://ntfy.sh/${config.NTFY_TOPIC}\n`));
    }
};
exports.installWorkflow = installWorkflow;
const buildEventTriggers = (events) => {
    let triggers = '';
    if (events.includes('push')) {
        triggers += `  push:
    branches: [ "main", "master" ]
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
    types: [opened, closed, merged]
`;
    }
    if (events.includes('release')) {
        triggers += `  release:
    types: [published]
`;
    }
    if (events.includes('check_run')) {
        triggers += `  check_run:
    types: [completed]
`;
    }
    return triggers;
};
