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
exports.testNotifications = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
const ui = __importStar(require("./ui"));
const testDestination = async (dest) => {
    try {
        switch (dest.type) {
            case 'discord':
                await axios_1.default.post(dest.config.webhook, {
                    embeds: [{
                            title: 'Knowtif Test',
                            description: 'Your GitHub notifications are working!',
                            color: 5763719,
                            timestamp: new Date().toISOString(),
                            footer: { text: 'Knowtif' },
                        }]
                });
                return true;
            case 'pushover':
                await axios_1.default.post('https://api.pushover.net/1/messages.json', {
                    token: dest.config.token,
                    user: dest.config.user,
                    title: 'Knowtif Test',
                    message: 'Your GitHub notifications are working!',
                    sound: 'magic',
                });
                return true;
            case 'ntfy':
                await axios_1.default.post(`${dest.config.server}/${dest.config.topic}`, 'Your GitHub notifications are working!', {
                    headers: {
                        'Title': 'Knowtif Test',
                        'Priority': '3',
                        'Tags': 'white_check_mark'
                    },
                });
                return true;
            case 'email':
                // Email test is more complex, skip for now
                return false;
            case 'webhook':
                await axios_1.default.post(dest.config.url, {
                    title: 'Knowtif Test',
                    message: 'Your GitHub notifications are working!',
                    type: 'test',
                    timestamp: new Date().toISOString(),
                });
                return true;
        }
        return false;
    }
    catch {
        return false;
    }
};
const testNotifications = async () => {
    ui.clear();
    ui.header();
    const config = (0, config_1.getConfig)();
    if (config.destinations.length === 0) {
        ui.error('No destinations configured. Run "npx knowtif setup" first.');
        return;
    }
    const enabled = config.destinations.filter(d => d.enabled);
    if (enabled.length === 0) {
        ui.error('No enabled destinations. Enable one in the control panel.');
        return;
    }
    console.log(ui.colors.text.bold('\n  Testing notifications...\n'));
    for (const dest of enabled) {
        const icon = getIcon(dest.type);
        try {
            const success = await ui.spinner(`Testing ${dest.name}`, async () => {
                const result = await testDestination(dest);
                if (!result)
                    throw new Error('Failed');
                return result;
            });
        }
        catch {
            // Error already shown by spinner
        }
    }
    console.log();
    ui.success('Test complete! Check your notification channels.');
    console.log();
};
exports.testNotifications = testNotifications;
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
