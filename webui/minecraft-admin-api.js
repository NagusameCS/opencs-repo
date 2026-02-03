const express = require('express');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const { Rcon } = require('rcon-client');
const execPromise = util.promisify(exec);

const router = express.Router();

const MC_DIR = '/opt/minecraft';
const ADMIN_KEY = '73aa9919a18943e628f3c90caed3692b82bc39dae97dde9345b62571bc58308a';
const RCON_HOST = 'localhost';
const RCON_PORT = 25575;
const RCON_PASSWORD = 'ecd27f323ffe4645058f4dee5fc2fd75';

const checkAdminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    if (key === ADMIN_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

async function executeRconCommand(command) {
    try {
        const rcon = await Rcon.connect({
            host: RCON_HOST,
            port: RCON_PORT,
            password: RCON_PASSWORD
        });
        
        const response = await rcon.send(command);
        await rcon.end();
        return response;
    } catch (error) {
        console.error('RCON error:', error);
        throw error;
    }
}

router.get('/status', checkAdminAuth, async (req, res) => {
    try {
        const { stdout: isActive } = await execPromise('systemctl is-active minecraft');
        const isRunning = isActive.trim() === 'active';
        
        let status = {
            online: isRunning,
            sleeping: false,
            version: 'Paper 1.21.4',
            players: { online: 0, max: 20 },
            uptime: '-',
            cpu: '-',
            memory: '-',
            disk: '-',
            onlinePlayers: []
        };

        if (isRunning) {
            try {
                const { stdout: uptimeStr } = await execPromise('systemctl show minecraft --property=ActiveEnterTimestamp --value');
                const startTime = new Date(uptimeStr.trim());
                const uptime = Math.floor((Date.now() - startTime) / 1000);
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                status.uptime = `${hours}h ${minutes}m`;
            } catch(e) {}

            try {
                const { stdout: cpuStr } = await execPromise("ps aux | grep 'java.*server.jar' | grep -v grep | awk '{print $3}'");
                status.cpu = cpuStr.trim() + '%';
            } catch(e) {}

            try {
                const { stdout: memStr } = await execPromise("ps aux | grep 'java.*server.jar' | grep -v grep | awk '{print $4}'");
                status.memory = memStr.trim() + '%';
            } catch(e) {}

            try {
                const { stdout: diskStr } = await execPromise("df -h /opt/minecraft | tail -1 | awk '{print $5}'");
                status.disk = diskStr.trim();
            } catch(e) {}

            // Get player list via RCON
            try {
                const listResponse = await executeRconCommand('list');
                // Parse "There are X of a max of Y players online: player1, player2"
                const match = listResponse.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)/);
                if (match) {
                    status.players.online = parseInt(match[1]);
                    status.players.max = parseInt(match[2]);
                    if (match[3]) {
                        status.onlinePlayers = match[3].split(',').map(p => p.trim()).filter(p => p);
                    }
                }
            } catch(e) {
                console.error('Failed to get player list via RCON:', e);
            }
        } else {
            status.sleeping = true;
        }

        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/start', checkAdminAuth, async (req, res) => {
    try {
        await execPromise('systemctl start minecraft');
        res.json({ success: true, message: 'Server starting...' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/stop', checkAdminAuth, async (req, res) => {
    try {
        // Use RCON to send stop command for graceful shutdown
        try {
            await executeRconCommand('stop');
        } catch(e) {
            // If RCON fails, fallback to systemctl
            await execPromise('systemctl stop minecraft');
        }
        res.json({ success: true, message: 'Server stopping...' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/restart', checkAdminAuth, async (req, res) => {
    try {
        await execPromise('systemctl restart minecraft');
        res.json({ success: true, message: 'Server restarting...' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/wake', checkAdminAuth, async (req, res) => {
    try {
        await execPromise('systemctl start minecraft');
        res.json({ success: true, message: 'Server waking up...' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/backup', checkAdminAuth, async (req, res) => {
    try {
        await execPromise('cd /opt/minecraft && ./backup.sh');
        res.json({ success: true, message: 'Backup started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/command', checkAdminAuth, async (req, res) => {
    try {
        const { command } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: 'Command required' });
        }

        const response = await executeRconCommand(command);
        res.json({ success: true, output: response });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/logs', checkAdminAuth, async (req, res) => {
    try {
        const lines = req.query.lines || 100;
        const { stdout } = await execPromise(`tail -${lines} ${MC_DIR}/logs/latest.log`);
        // Split logs into array of lines for frontend
        const logLines = stdout.trim().split('\n').filter(line => line);
        res.json({ logs: logLines });
    } catch (error) {
        res.status(500).json({ error: error.message, logs: [] });
    }
});

router.get('/backups', checkAdminAuth, async (req, res) => {
    try {
        const backupDir = `${MC_DIR}/backups`;
        const files = await fs.readdir(backupDir);
        const backups = await Promise.all(files.filter(f => f.endsWith('.tar.gz')).map(async f => {
            const stats = await fs.stat(`${backupDir}/${f}`);
            return {
                name: f,
                size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                date: stats.mtime.toISOString()
            };
        }));
        res.json({ backups: backups.sort((a, b) => new Date(b.date) - new Date(a.date)) });
    } catch (error) {
        res.status(500).json({ error: error.message, backups: [] });
    }
});

module.exports = router;
