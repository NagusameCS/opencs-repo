const express = require('express');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const { Rcon } = require('rcon-client');
const execPromise = util.promisify(exec);

const router = express.Router();

const MC_DIR = '/opt/minecraft';
const WHITELIST_FILE = `${MC_DIR}/whitelist.json`;
const SERVER_PROPERTIES = `${MC_DIR}/server.properties`;

const RCON_HOST = 'localhost';
const RCON_PORT = 25575;
const RCON_PASSWORD = 'ecd27f323ffe4645058f4dee5fc2fd75';

async function executeRconCommand(command) {
    try {
        const rcon = await Rcon.connect({
            host: RCON_HOST,
            port: RCON_PORT,
            password: RCON_PASSWORD,
            timeout: 5000
        });
        
        const response = await rcon.send(command);
        await rcon.end();
        return response;
    } catch (error) {
        console.error('RCON error:', error.message);
        return null;
    }
}

// Get server status
router.get('/status', async (req, res) => {
    try {
        const { stdout: isActive } = await execPromise('systemctl is-active minecraft');
        const isRunning = isActive.trim() === 'active';
        
        let status = {
            online: isRunning,
            version: '1.21.4',
            players: {
                online: 0,
                max: 20
            }
        };

        if (isRunning) {
            try {
                const versionContent = await fs.readFile(`${MC_DIR}/current_version.txt`, 'utf8');
                status.version = versionContent.trim();
            } catch (e) {}

            try {
                const propsContent = await fs.readFile(SERVER_PROPERTIES, 'utf8');
                const maxPlayersMatch = propsContent.match(/max-players=(\d+)/);
                if (maxPlayersMatch) {
                    status.players.max = parseInt(maxPlayersMatch[1]);
                }
            } catch (e) {}
        }

        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get server status' });
    }
});

// Get whitelist
router.get('/whitelist', async (req, res) => {
    try {
        const content = await fs.readFile(WHITELIST_FILE, 'utf8');
        const whitelist = JSON.parse(content);
        res.json({ whitelist });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read whitelist' });
    }
});

// Add player to whitelist via RCON
router.post('/whitelist', express.json(), async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || !/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
            return res.status(400).json({ error: 'Invalid Minecraft username' });
        }

        // Check if server is running
        const { stdout: isActive } = await execPromise('systemctl is-active minecraft');
        if (isActive.trim() !== 'active') {
            return res.status(503).json({ error: 'Server is offline' });
        }

        // Use RCON to add player
        const response = await executeRconCommand(`whitelist add ${username}`);
        
        if (response && response.includes('Added')) {
            // Reload whitelist from file to return updated list
            await new Promise(resolve => setTimeout(resolve, 500));
            const content = await fs.readFile(WHITELIST_FILE, 'utf8');
            const whitelist = JSON.parse(content);
            
            res.json({ 
                success: true, 
                message: `Added ${username} to whitelist`,
                whitelist 
            });
        } else if (response && response.includes('already')) {
            res.status(400).json({ error: 'Player already whitelisted' });
        } else {
            res.status(404).json({ error: 'Player not found or server error' });
        }
    } catch (error) {
        console.error('Whitelist add error:', error);
        res.status(500).json({ error: 'Failed to add player to whitelist' });
    }
});

// Remove player from whitelist via RCON
router.delete('/whitelist/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username || !/^[a-zA-Z0-9_]{1,16}$/.test(username)) {
            return res.status(400).json({ error: 'Invalid Minecraft username' });
        }

        // Check if server is running
        const { stdout: isActive } = await execPromise('systemctl is-active minecraft');
        if (isActive.trim() !== 'active') {
            return res.status(503).json({ error: 'Server is offline' });
        }

        // Use RCON to remove player
        const response = await executeRconCommand(`whitelist remove ${username}`);
        
        if (response && response.includes('Removed')) {
            // Reload whitelist from file
            await new Promise(resolve => setTimeout(resolve, 500));
            const content = await fs.readFile(WHITELIST_FILE, 'utf8');
            const whitelist = JSON.parse(content);
            
            res.json({ 
                success: true, 
                message: `Removed ${username} from whitelist`,
                whitelist 
            });
        } else {
            res.status(404).json({ error: 'Player not found in whitelist' });
        }
    } catch (error) {
        console.error('Whitelist remove error:', error);
        res.status(500).json({ error: 'Failed to remove player from whitelist' });
    }
});

module.exports = router;
