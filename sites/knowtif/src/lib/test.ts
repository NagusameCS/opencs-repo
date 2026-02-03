import axios from 'axios';
import { getConfig, Destination } from './config';
import * as ui from './ui';

const testDestination = async (dest: Destination): Promise<boolean> => {
    try {
        switch (dest.type) {
            case 'discord':
                await axios.post(dest.config.webhook, {
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
                await axios.post('https://api.pushover.net/1/messages.json', {
                    token: dest.config.token,
                    user: dest.config.user,
                    title: 'Knowtif Test',
                    message: 'Your GitHub notifications are working!',
                    sound: 'magic',
                });
                return true;
            case 'ntfy':
                await axios.post(`${dest.config.server}/${dest.config.topic}`,
                    'Your GitHub notifications are working!', {
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
                await axios.post(dest.config.url, {
                    title: 'Knowtif Test',
                    message: 'Your GitHub notifications are working!',
                    type: 'test',
                    timestamp: new Date().toISOString(),
                });
                return true;
        }
        return false;
    } catch {
        return false;
    }
};

export const testNotifications = async () => {
    ui.clear();
    ui.header();

    const config = getConfig();

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
                if (!result) throw new Error('Failed');
                return result;
            });
        } catch {
            // Error already shown by spinner
        }
    }

    console.log();
    ui.success('Test complete! Check your notification channels.');
    console.log();
};

const getIcon = (type: string): string => {
    switch (type) {
        case 'discord': return ui.icons.discord;
        case 'pushover': return ui.icons.phone;
        case 'ntfy': return ui.icons.browser;
        case 'email': return ui.icons.email;
        case 'webhook': return ui.icons.webhook;
        default: return ui.icons.bullet;
    }
};
