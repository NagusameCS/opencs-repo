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
exports.setupConfig = exports.uninstall = exports.getActionConfig = exports.getEnabledDestinations = exports.hasDestinations = exports.toggleDestination = exports.removeDestination = exports.addDestination = exports.saveConfig = exports.getConfig = exports.decrypt = exports.encrypt = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const conf_1 = __importDefault(require("conf"));
const defaultConfig = {
    events: ['push', 'workflow_run'],
    branches: ['main', 'master'],
    destinations: [],
    installed: false,
};
// Get machine-specific encryption key
const getMachineKey = () => {
    const machineId = os.hostname() + os.userInfo().username + os.platform();
    return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32);
};
// Encrypt sensitive data
const encrypt = (text) => {
    const key = getMachineKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};
exports.encrypt = encrypt;
// Decrypt sensitive data
const decrypt = (text) => {
    try {
        const key = getMachineKey();
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
    catch {
        return text; // Return as-is if decryption fails (might be unencrypted)
    }
};
exports.decrypt = decrypt;
// Encrypt destination config
const encryptDestination = (dest) => {
    const sensitiveKeys = ['webhook', 'token', 'pass', 'secret', 'password', 'apiKey'];
    const encryptedConfig = {};
    for (const [key, value] of Object.entries(dest.config)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
            encryptedConfig[key] = (0, exports.encrypt)(value);
        }
        else {
            encryptedConfig[key] = value;
        }
    }
    return { ...dest, config: encryptedConfig };
};
// Decrypt destination config
const decryptDestination = (dest) => {
    const sensitiveKeys = ['webhook', 'token', 'pass', 'secret', 'password', 'apiKey'];
    const decryptedConfig = {};
    for (const [key, value] of Object.entries(dest.config)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk)) && value.includes(':')) {
            decryptedConfig[key] = (0, exports.decrypt)(value);
        }
        else {
            decryptedConfig[key] = value;
        }
    }
    return { ...dest, config: decryptedConfig };
};
// Local config store (in user's home directory)
const store = new conf_1.default({
    projectName: 'knowtif',
    defaults: defaultConfig,
});
// Project-level config file (non-sensitive data only)
const getProjectConfigPath = () => path.join(process.cwd(), '.knowtif.json');
// Secure config path (in user's home, encrypted)
const getSecureConfigPath = () => path.join(os.homedir(), '.knowtif', 'credentials.json');
const getConfig = () => {
    // First check for project-level config
    const projectPath = getProjectConfigPath();
    let config = { ...defaultConfig };
    if (fs.existsSync(projectPath)) {
        try {
            const content = fs.readFileSync(projectPath, 'utf-8');
            const projectConfig = JSON.parse(content);
            config = { ...config, ...projectConfig };
        }
        catch {
            // Fall through
        }
    }
    // Load encrypted credentials from secure location
    const securePath = getSecureConfigPath();
    if (fs.existsSync(securePath)) {
        try {
            const content = fs.readFileSync(securePath, 'utf-8');
            const secureConfig = JSON.parse(content);
            if (secureConfig.destinations) {
                config.destinations = secureConfig.destinations.map(decryptDestination);
            }
        }
        catch {
            // Fall through
        }
    }
    return config;
};
exports.getConfig = getConfig;
const saveConfig = (config) => {
    const current = (0, exports.getConfig)();
    const updated = { ...current, ...config };
    // Save non-sensitive data to project config
    const projectConfig = {
        events: updated.events,
        branches: updated.branches,
        healthCheckUrl: updated.healthCheckUrl,
        installed: updated.installed,
        repoOwner: updated.repoOwner,
        repoName: updated.repoName,
    };
    const projectPath = getProjectConfigPath();
    fs.writeFileSync(projectPath, JSON.stringify(projectConfig, null, 2));
    // Save encrypted credentials to secure location
    if (updated.destinations && updated.destinations.length > 0) {
        const securePath = getSecureConfigPath();
        const secureDir = path.dirname(securePath);
        if (!fs.existsSync(secureDir)) {
            fs.mkdirSync(secureDir, { recursive: true, mode: 0o700 });
        }
        const secureConfig = {
            destinations: updated.destinations.map(encryptDestination),
        };
        fs.writeFileSync(securePath, JSON.stringify(secureConfig, null, 2), { mode: 0o600 });
    }
    return updated;
};
exports.saveConfig = saveConfig;
const addDestination = (dest) => {
    const config = (0, exports.getConfig)();
    // Remove existing with same name/type
    config.destinations = config.destinations.filter(d => !(d.type === dest.type && d.name === dest.name));
    config.destinations.push(dest);
    return (0, exports.saveConfig)(config);
};
exports.addDestination = addDestination;
const removeDestination = (name) => {
    const config = (0, exports.getConfig)();
    config.destinations = config.destinations.filter(d => d.name !== name);
    return (0, exports.saveConfig)(config);
};
exports.removeDestination = removeDestination;
const toggleDestination = (name) => {
    const config = (0, exports.getConfig)();
    const dest = config.destinations.find(d => d.name === name);
    if (dest) {
        dest.enabled = !dest.enabled;
    }
    return (0, exports.saveConfig)(config);
};
exports.toggleDestination = toggleDestination;
const hasDestinations = (config) => {
    return config.destinations.some(d => d.enabled);
};
exports.hasDestinations = hasDestinations;
const getEnabledDestinations = (config) => {
    return config.destinations.filter(d => d.enabled);
};
exports.getEnabledDestinations = getEnabledDestinations;
// For GitHub Actions - get config from environment variables
const getActionConfig = () => {
    return {
        discord: process.env.DISCORD_WEBHOOK ? { webhook: process.env.DISCORD_WEBHOOK } : null,
        pushover: process.env.PUSHOVER_USER && process.env.PUSHOVER_TOKEN
            ? { user: process.env.PUSHOVER_USER, token: process.env.PUSHOVER_TOKEN } : null,
        ntfy: process.env.NTFY_TOPIC
            ? { topic: process.env.NTFY_TOPIC, server: process.env.NTFY_SERVER || 'https://ntfy.sh' } : null,
        email: process.env.SMTP_HOST
            ? { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, to: process.env.EMAIL_TO } : null,
        webhook: process.env.WEBHOOK_URL
            ? { url: process.env.WEBHOOK_URL, secret: process.env.WEBHOOK_SECRET } : null,
    };
};
exports.getActionConfig = getActionConfig;
// Uninstall - remove all config and workflow files
const uninstall = () => {
    const results = { projectConfig: false, secureConfig: false, workflow: false };
    // Remove project config
    const projectPath = getProjectConfigPath();
    if (fs.existsSync(projectPath)) {
        fs.unlinkSync(projectPath);
        results.projectConfig = true;
    }
    // Remove secure credentials
    const securePath = getSecureConfigPath();
    if (fs.existsSync(securePath)) {
        fs.unlinkSync(securePath);
        results.secureConfig = true;
    }
    // Remove workflow file
    const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'knowtif.yml');
    if (fs.existsSync(workflowPath)) {
        fs.unlinkSync(workflowPath);
        results.workflow = true;
    }
    // Clear conf store
    store.clear();
    return results;
};
exports.uninstall = uninstall;
// Legacy support
const setupConfig = async () => {
    const { runSetup } = await Promise.resolve().then(() => __importStar(require('./setup')));
    await runSetup();
};
exports.setupConfig = setupConfig;
