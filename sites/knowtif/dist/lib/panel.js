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
exports.runControlPanel = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
const ui = __importStar(require("./ui"));
const setup_1 = require("./setup");
const CURRENT_VERSION = '1.0.0';
const checkForUpdates = async () => {
    try {
        const response = await axios_1.default.get('https://registry.npmjs.org/knowtif/latest', { timeout: 3000 });
        const latestVersion = response.data.version;
        if (latestVersion !== CURRENT_VERSION) {
            return latestVersion;
        }
    }
    catch {
        // Silently fail - network might not be available
    }
    return null;
};
const performUninstall = async () => {
    console.log();
    console.log(ui.box(`${ui.colors.error('This will remove:')}

` +
        `${ui.colors.muted('*')} Project config (.knowtif.json)
` +
        `${ui.colors.muted('*')} Encrypted credentials (~/.knowtif/)
` +
        `${ui.colors.muted('*')} GitHub workflow (.github/workflows/knowtif.yml)`, { title: 'Uninstall Knowtif', width: 55 }));
    console.log();
    const { confirm } = await inquirer_1.default.prompt([
        { type: 'confirm', name: 'confirm', message: ui.colors.error('Are you sure?'), default: false }
    ]);
    if (!confirm) {
        ui.info('Uninstall cancelled.');
        return false;
    }
    const results = (0, config_1.uninstall)();
    console.log();
    if (results.projectConfig)
        ui.info('Removed project config');
    if (results.secureConfig)
        ui.info('Removed encrypted credentials');
    if (results.workflow)
        ui.info('Removed GitHub workflow');
    ui.success('Knowtif uninstalled. Goodbye!');
    console.log(ui.colors.muted('  To reinstall: npx knowtif\n'));
    return true;
};
const showStatus = () => {
    const config = (0, config_1.getConfig)();
    console.log();
    console.log(ui.colors.text.bold('  Destinations'));
    console.log();
    if (config.destinations.length === 0) {
        console.log(ui.colors.muted('  No destinations configured'));
    }
    else {
        for (const dest of config.destinations) {
            const status = dest.enabled ? ui.colors.success('ON ') : ui.colors.muted('OFF');
            const icon = getIcon(dest.type);
            const name = dest.enabled ? ui.colors.text(dest.name) : ui.colors.muted(dest.name);
            console.log(`  ${status} ${icon} ${name}`);
        }
    }
    console.log();
    console.log(ui.colors.text.bold('  Events'));
    console.log();
    console.log(ui.colors.muted(`  ${(config.events || []).join(', ') || 'None'}`));
    console.log();
};
const getIcon = (type) => {
    switch (type) {
        case 'discord': return ui.icons.discord;
        case 'pushover': return ui.icons.phone;
        case 'ntfy': return ui.icons.browser;
        case 'email': return ui.icons.email;
        case 'webhook': return ui.icons.webhook;
        default: return ui.icons.bullet;
    }
};
const testDestination = async (dest) => {
    try {
        switch (dest.type) {
            case 'discord':
                await axios_1.default.post(dest.config.webhook, {
                    embeds: [{
                            title: 'Test from Knowtif',
                            description: 'Your notifications are working!',
                            color: 5763719,
                            footer: { text: 'Knowtif' },
                        }]
                });
                break;
            case 'pushover':
                await axios_1.default.post('https://api.pushover.net/1/messages.json', {
                    token: dest.config.token,
                    user: dest.config.user,
                    title: 'Test from Knowtif',
                    message: 'Your notifications are working!',
                    sound: 'magic',
                });
                break;
            case 'ntfy':
                await axios_1.default.post(`${dest.config.server}/${dest.config.topic}`, 'Test from Knowtif - Your notifications are working!', {
                    headers: { 'Title': 'Knowtif Test', 'Priority': '3', 'Tags': 'white_check_mark' },
                });
                break;
        }
        ui.success(`Test sent to ${dest.name}!`);
    }
    catch (err) {
        ui.error(`Failed to send test: ${err.message}`);
    }
};
const manageDestinations = async () => {
    const config = (0, config_1.getConfig)();
    if (config.destinations.length === 0) {
        console.log();
        ui.warn('No destinations configured. Add one first.');
        const { add } = await inquirer_1.default.prompt([
            { type: 'confirm', name: 'add', message: 'Add a destination now?', default: true }
        ]);
        if (add) {
            await (0, setup_1.runSetup)();
        }
        return;
    }
    const choices = config.destinations.map(dest => ({
        name: `${dest.enabled ? ui.colors.success('●') : ui.colors.muted('○')} ${getIcon(dest.type)} ${dest.name}`,
        value: dest.name,
    }));
    choices.push({ name: ui.colors.muted('← Back'), value: 'back' });
    const { selected } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'selected',
            message: ui.colors.primary('Select destination:'),
            choices,
        },
    ]);
    if (selected === 'back')
        return;
    const dest = config.destinations.find(d => d.name === selected);
    if (!dest)
        return;
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: ui.colors.primary(`${dest.name}:`),
            choices: [
                { name: `${ui.icons.test} Send test notification`, value: 'test' },
                { name: `${dest.enabled ? ui.icons.unlock : ui.icons.lock} ${dest.enabled ? 'Disable' : 'Enable'}`, value: 'toggle' },
                { name: `${ui.icons.trash} Delete`, value: 'delete' },
                { name: ui.colors.muted('← Back'), value: 'back' },
            ],
        },
    ]);
    switch (action) {
        case 'test':
            await testDestination(dest);
            break;
        case 'toggle':
            (0, config_1.toggleDestination)(dest.name);
            ui.success(`${dest.name} ${dest.enabled ? 'disabled' : 'enabled'}`);
            break;
        case 'delete':
            const { confirm } = await inquirer_1.default.prompt([
                { type: 'confirm', name: 'confirm', message: `Delete ${dest.name}?`, default: false }
            ]);
            if (confirm) {
                (0, config_1.removeDestination)(dest.name);
                ui.success(`${dest.name} deleted`);
            }
            break;
    }
};
const manageEvents = async () => {
    const config = (0, config_1.getConfig)();
    const { events } = await inquirer_1.default.prompt([
        {
            type: 'checkbox',
            name: 'events',
            message: ui.colors.primary('Select events to notify:'),
            choices: [
                { name: 'Push', value: 'push', checked: config.events?.includes('push') },
                { name: 'CI/Workflow completed', value: 'workflow_run', checked: config.events?.includes('workflow_run') },
                { name: 'Deployment status', value: 'deployment_status', checked: config.events?.includes('deployment_status') },
                { name: 'Releases', value: 'release', checked: config.events?.includes('release') },
                { name: 'Pull requests', value: 'pull_request', checked: config.events?.includes('pull_request') },
                { name: 'Issues', value: 'issues', checked: config.events?.includes('issues') },
                { name: 'Stars', value: 'star', checked: config.events?.includes('star') },
                { name: 'Forks', value: 'fork', checked: config.events?.includes('fork') },
            ],
        },
    ]);
    (0, config_1.saveConfig)({ events });
    ui.success('Events updated! Remember to regenerate the workflow.');
};
const regenerateWorkflow = async () => {
    ui.info('Run "npx knowtif setup" to regenerate the workflow with current settings.');
};
const runControlPanel = async () => {
    ui.clear();
    ui.header();
    // Check for updates
    const latestVersion = await checkForUpdates();
    if (latestVersion) {
        console.log(ui.colors.warning(`  Update available: ${CURRENT_VERSION} -> ${latestVersion}`));
        console.log(ui.colors.muted(`  Run: npm install -g knowtif@latest\n`));
    }
    const config = (0, config_1.getConfig)();
    if (!config.installed || config.destinations.length === 0) {
        console.log(ui.colors.muted('  First time? Let\'s set up your notifications.\n'));
        await (0, setup_1.runSetup)();
        return;
    }
    let running = true;
    while (running) {
        showStatus();
        ui.divider();
        console.log();
        const { action } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'action',
                message: ui.colors.primary('What would you like to do?'),
                choices: [
                    { name: `${ui.icons.test} Send test notification`, value: 'test' },
                    { name: `${ui.icons.add} Add destination`, value: 'add' },
                    { name: `${ui.icons.settings} Manage destinations`, value: 'manage' },
                    { name: `${ui.icons.bell} Change events`, value: 'events' },
                    { name: `${ui.icons.rocket} Regenerate workflow`, value: 'regenerate' },
                    { name: `${ui.icons.trash} Uninstall`, value: 'uninstall' },
                    { name: ui.colors.muted('Exit'), value: 'exit' },
                ],
            },
        ]);
        ui.clear();
        ui.header();
        switch (action) {
            case 'test':
                const enabledDests = config.destinations.filter(d => d.enabled);
                if (enabledDests.length === 0) {
                    ui.error('No enabled destinations to test.');
                }
                else {
                    for (const dest of enabledDests) {
                        await testDestination(dest);
                    }
                }
                break;
            case 'add':
                await (0, setup_1.runSetup)();
                break;
            case 'manage':
                await manageDestinations();
                break;
            case 'events':
                await manageEvents();
                break;
            case 'regenerate':
                await regenerateWorkflow();
                break;
            case 'uninstall':
                const uninstalled = await performUninstall();
                if (uninstalled) {
                    running = false;
                }
                break;
            case 'exit':
                running = false;
                console.log(ui.colors.muted('  Goodbye!\n'));
                break;
        }
    }
};
exports.runControlPanel = runControlPanel;
