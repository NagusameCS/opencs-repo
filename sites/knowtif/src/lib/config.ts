import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import Conf from 'conf';

export interface Destination {
    type: 'discord' | 'pushover' | 'ntfy' | 'email' | 'webhook';
    name: string;
    enabled: boolean;
    config: Record<string, string>;
}

export interface KnowtifConfig {
    // Events
    events: string[];
    branches: string[];

    // Destinations (encrypted storage)
    destinations: Destination[];

    // Health check
    healthCheckUrl?: string;

    // Meta
    installed: boolean;
    repoOwner?: string;
    repoName?: string;

    // Encryption
    encryptionKey?: string;
}

const defaultConfig: KnowtifConfig = {
    events: ['push', 'workflow_run'],
    branches: ['main', 'master'],
    destinations: [],
    installed: false,
};

// Get machine-specific encryption key
const getMachineKey = (): string => {
    const machineId = os.hostname() + os.userInfo().username + os.platform();
    return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32);
};

// Encrypt sensitive data
export const encrypt = (text: string): string => {
    const key = getMachineKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Decrypt sensitive data
export const decrypt = (text: string): string => {
    try {
        const key = getMachineKey();
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch {
        return text; // Return as-is if decryption fails (might be unencrypted)
    }
};

// Encrypt destination config
const encryptDestination = (dest: Destination): Destination => {
    const sensitiveKeys = ['webhook', 'token', 'pass', 'secret', 'password', 'apiKey'];
    const encryptedConfig: Record<string, string> = {};

    for (const [key, value] of Object.entries(dest.config)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
            encryptedConfig[key] = encrypt(value);
        } else {
            encryptedConfig[key] = value;
        }
    }

    return { ...dest, config: encryptedConfig };
};

// Decrypt destination config
const decryptDestination = (dest: Destination): Destination => {
    const sensitiveKeys = ['webhook', 'token', 'pass', 'secret', 'password', 'apiKey'];
    const decryptedConfig: Record<string, string> = {};

    for (const [key, value] of Object.entries(dest.config)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk)) && value.includes(':')) {
            decryptedConfig[key] = decrypt(value);
        } else {
            decryptedConfig[key] = value;
        }
    }

    return { ...dest, config: decryptedConfig };
};

// Local config store (in user's home directory)
const store = new Conf<KnowtifConfig>({
    projectName: 'knowtif',
    defaults: defaultConfig,
});

// Project-level config file (non-sensitive data only)
const getProjectConfigPath = () => path.join(process.cwd(), '.knowtif.json');

// Secure config path (in user's home, encrypted)
const getSecureConfigPath = () => path.join(os.homedir(), '.knowtif', 'credentials.json');

export const getConfig = (): KnowtifConfig => {
    // First check for project-level config
    const projectPath = getProjectConfigPath();
    let config = { ...defaultConfig };

    if (fs.existsSync(projectPath)) {
        try {
            const content = fs.readFileSync(projectPath, 'utf-8');
            const projectConfig = JSON.parse(content);
            config = { ...config, ...projectConfig };
        } catch {
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
        } catch {
            // Fall through
        }
    }

    return config;
};

export const saveConfig = (config: Partial<KnowtifConfig>) => {
    const current = getConfig();
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

export const addDestination = (dest: Destination): KnowtifConfig => {
    const config = getConfig();
    // Remove existing with same name/type
    config.destinations = config.destinations.filter(
        d => !(d.type === dest.type && d.name === dest.name)
    );
    config.destinations.push(dest);
    return saveConfig(config);
};

export const removeDestination = (name: string): KnowtifConfig => {
    const config = getConfig();
    config.destinations = config.destinations.filter(d => d.name !== name);
    return saveConfig(config);
};

export const toggleDestination = (name: string): KnowtifConfig => {
    const config = getConfig();
    const dest = config.destinations.find(d => d.name === name);
    if (dest) {
        dest.enabled = !dest.enabled;
    }
    return saveConfig(config);
};

export const hasDestinations = (config: KnowtifConfig): boolean => {
    return config.destinations.some(d => d.enabled);
};

export const getEnabledDestinations = (config: KnowtifConfig): Destination[] => {
    return config.destinations.filter(d => d.enabled);
};

// For GitHub Actions - get config from environment variables
export const getActionConfig = () => {
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

// Uninstall - remove all config and workflow files
export const uninstall = (): { projectConfig: boolean; secureConfig: boolean; workflow: boolean } => {
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

// Legacy support
export const setupConfig = async () => {
    const { runSetup } = await import('./setup');
    await runSetup();
};
