import axios from 'axios';
import chalk from 'chalk';
import nodemailer from 'nodemailer';

export enum NotificationType {
    INFO = 'info',
    SUCCESS = 'success',
    FAILURE = 'failure',
}

// Get config from environment variables (set by GitHub Actions workflow or test command)
interface NotifyConfig {
    discordWebhook?: string;
    pushoverUser?: string;
    pushoverToken?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    emailTo?: string;
    ntfyTopic?: string;
    ntfyServer?: string;
    webhookUrl?: string;
    webhookSecret?: string;
}

const getNotifyConfig = (): NotifyConfig => {
    return {
        discordWebhook: process.env.DISCORD_WEBHOOK,
        pushoverUser: process.env.PUSHOVER_USER,
        pushoverToken: process.env.PUSHOVER_TOKEN,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS,
        emailTo: process.env.EMAIL_TO,
        ntfyTopic: process.env.NTFY_TOPIC,
        ntfyServer: process.env.NTFY_SERVER || 'https://ntfy.sh',
        webhookUrl: process.env.WEBHOOK_URL,
        webhookSecret: process.env.WEBHOOK_SECRET,
    };
};

export const sendNotification = async (title: string, message: string, type: NotificationType = NotificationType.INFO) => {
    const config = getNotifyConfig();
    const timestamp = new Date().toLocaleTimeString();

    // Terminal output
    let color = chalk.blue;
    let icon = '[INFO]';
    if (type === NotificationType.SUCCESS) { color = chalk.green; icon = '[OK]'; }
    if (type === NotificationType.FAILURE) { color = chalk.red; icon = '[FAIL]'; }

    console.log(`[${chalk.gray(timestamp)}] ${icon} ${color.bold(title)}`);
    console.log(chalk.white(message.replace(/\*\*/g, '').replace(/`/g, '')));
    console.log('');

    // Discord
    if (config.discordWebhook) {
        try {
            let discordColor = 3447003;
            if (type === NotificationType.SUCCESS) discordColor = 5763719;
            if (type === NotificationType.FAILURE) discordColor = 15548997;

            await axios.post(config.discordWebhook, {
                embeds: [{
                    title,
                    description: message,
                    color: discordColor,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Knowtif' },
                }]
            });
            console.log(chalk.gray('  -> Discord sent'));
        } catch (error: any) {
            console.error(chalk.yellow(`  -> Discord failed: ${error.message}`));
        }
    }

    // Pushover
    if (config.pushoverUser && config.pushoverToken) {
        try {
            let priority = 0;
            let sound = 'pushover';
            if (type === NotificationType.FAILURE) { priority = 1; sound = 'siren'; }
            else if (type === NotificationType.SUCCESS) { sound = 'magic'; }

            await axios.post('https://api.pushover.net/1/messages.json', {
                token: config.pushoverToken,
                user: config.pushoverUser,
                title: title.replace(/[^\w\s-]/g, '').trim(),
                message: message.replace(/\*\*/g, '').replace(/`/g, ''),
                priority,
                sound,
            });
            console.log(chalk.gray('  -> Pushover sent'));
        } catch (error: any) {
            console.error(chalk.yellow(`  -> Pushover failed: ${error.message}`));
        }
    }

    // Email
    if (config.smtpHost && config.smtpUser && config.smtpPass && config.emailTo) {
        try {
            const transporter = nodemailer.createTransport({
                host: config.smtpHost,
                port: config.smtpPort || 587,
                secure: config.smtpPort === 465,
                auth: { user: config.smtpUser, pass: config.smtpPass },
            });

            const htmlMessage = message
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');

            let bgColor = '#3498db';
            if (type === NotificationType.SUCCESS) bgColor = '#27ae60';
            if (type === NotificationType.FAILURE) bgColor = '#e74c3c';

            await transporter.sendMail({
                from: `"Knowtif" <${config.smtpUser}>`,
                to: config.emailTo,
                subject: `[Knowtif] ${title.replace(/[^\w\s-]/g, '').trim()}`,
                text: `${title}\n\n${message.replace(/\*\*/g, '')}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px;">
                        <div style="background: ${bgColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                            <h2 style="margin: 0;">${title}</h2>
                        </div>
                        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #eee;">
                            ${htmlMessage}
                        </div>
                    </div>
                `,
            });
            console.log(chalk.gray('  -> Email sent'));
        } catch (error: any) {
            console.error(chalk.yellow(`  -> Email failed: ${error.message}`));
        }
    }

    // ntfy.sh
    if (config.ntfyTopic) {
        try {
            let priority = 3;
            let tags = 'information_source';
            if (type === NotificationType.SUCCESS) { tags = 'white_check_mark'; }
            if (type === NotificationType.FAILURE) { priority = 5; tags = 'x,warning'; }

            await axios.post(`${config.ntfyServer}/${config.ntfyTopic}`, message.replace(/\*\*/g, ''), {
                headers: {
                    'Title': title.replace(/[^\w\s-]/g, '').trim(),
                    'Priority': priority.toString(),
                    'Tags': tags,
                },
            });
            console.log(chalk.gray('  -> ntfy sent'));
        } catch (error: any) {
            console.error(chalk.yellow(`  -> ntfy failed: ${error.message}`));
        }
    }

    // Custom Webhook
    if (config.webhookUrl) {
        try {
            const payload = {
                title,
                message,
                type,
                timestamp: new Date().toISOString(),
                repo: process.env.GITHUB_REPOSITORY,
                sha: process.env.GITHUB_SHA,
                event: process.env.GITHUB_EVENT_NAME,
            };

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (config.webhookSecret) {
                const crypto = await import('crypto');
                const sig = crypto.createHmac('sha256', config.webhookSecret).update(JSON.stringify(payload)).digest('hex');
                headers['X-Knowtif-Signature'] = `sha256=${sig}`;
            }

            await axios.post(config.webhookUrl, payload, { headers });
            console.log(chalk.gray('  -> Webhook sent'));
        } catch (error: any) {
            console.error(chalk.yellow(`  -> Webhook failed: ${error.message}`));
        }
    }
};
