const express = require('express');
const { Rcon } = require('rcon-client');
const router = express.Router();

const RCON_HOST = 'localhost';
const RCON_PORT = 25575;
const RCON_PASSWORD = 'ecd27f323ffe4645058f4dee5fc2fd75';

// Store recent server messages (last 100)
const messageHistory = [];
const MAX_HISTORY = 100;

// WebSocket-like polling for clients
const subscribers = new Map();
let subscriberId = 0;

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
        console.error('RCON error:', error);
        return null;
    }
}

// POST /api/dialogue/say - Send message to server
router.post('/say', async (req, res) => {
    try {
        const { message, sender } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message required' });
        }

        const senderName = sender || 'API';
        const formattedMessage = `[${senderName}] ${message}`;
        
        // Send to Minecraft chat
        const result = await executeRconCommand(`say ${formattedMessage}`);
        
        if (result !== null) {
            // Add to history
            const msg = {
                type: 'chat',
                sender: senderName,
                message: message,
                timestamp: new Date().toISOString(),
                source: 'api'
            };
            
            messageHistory.push(msg);
            if (messageHistory.length > MAX_HISTORY) {
                messageHistory.shift();
            }

            // Notify subscribers
            subscribers.forEach((callback) => callback(msg));

            res.json({ success: true, message: 'Message sent to server' });
        } else {
            res.status(503).json({ error: 'Server not available or RCON failed' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/dialogue/command - Execute command
router.post('/command', async (req, res) => {
    try {
        const { command, sender } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: 'Command required' });
        }

        const result = await executeRconCommand(command);
        
        if (result !== null) {
            const msg = {
                type: 'command',
                sender: sender || 'API',
                command: command,
                response: result,
                timestamp: new Date().toISOString(),
                source: 'api'
            };
            
            messageHistory.push(msg);
            if (messageHistory.length > MAX_HISTORY) {
                messageHistory.shift();
            }

            res.json({ success: true, response: result });
        } else {
            res.status(503).json({ error: 'Server not available or RCON failed' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/dialogue/messages - Get message history
router.get('/messages', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const since = req.query.since ? new Date(req.query.since) : null;
    
    let messages = messageHistory;
    
    if (since) {
        messages = messages.filter(m => new Date(m.timestamp) > since);
    }
    
    messages = messages.slice(-limit);
    
    res.json({ messages });
});

// GET /api/dialogue/listen - Long-polling endpoint for real-time updates
router.get('/listen', (req, res) => {
    const timeout = parseInt(req.query.timeout) || 30;
    const since = req.query.since ? new Date(req.query.since) : null;
    
    // Check if there are new messages already
    const newMessages = since 
        ? messageHistory.filter(m => new Date(m.timestamp) > since)
        : [];
    
    if (newMessages.length > 0) {
        return res.json({ messages: newMessages });
    }
    
    // Set up long-polling
    const id = subscriberId++;
    let responded = false;
    
    const callback = (message) => {
        if (!responded) {
            responded = true;
            subscribers.delete(id);
            clearTimeout(timeoutId);
            res.json({ messages: [message] });
        }
    };
    
    subscribers.set(id, callback);
    
    const timeoutId = setTimeout(() => {
        if (!responded) {
            responded = true;
            subscribers.delete(id);
            res.json({ messages: [] });
        }
    }, timeout * 1000);
    
    req.on('close', () => {
        subscribers.delete(id);
        if (!responded) {
            responded = true;
            clearTimeout(timeoutId);
        }
    });
});

// GET /api/dialogue/players - Get online players
router.get('/players', async (req, res) => {
    try {
        const result = await executeRconCommand('list');
        
        if (result !== null) {
            const match = result.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)/);
            if (match) {
                const players = match[3] ? match[3].split(',').map(p => p.trim()).filter(p => p) : [];
                res.json({
                    online: parseInt(match[1]),
                    max: parseInt(match[2]),
                    players: players
                });
            } else {
                res.json({ online: 0, max: 7, players: [] });
            }
        } else {
            res.status(503).json({ error: 'Server not available' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/dialogue/broadcast - Broadcast to all players with title
router.post('/broadcast', async (req, res) => {
    try {
        const { title, subtitle, sender } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Title required' });
        }

        // Send title command to all players
        const titleCmd = `title @a title {"text":"${title}","color":"gold"}`;
        await executeRconCommand(titleCmd);
        
        if (subtitle) {
            const subtitleCmd = `title @a subtitle {"text":"${subtitle}","color":"white"}`;
            await executeRconCommand(subtitleCmd);
        }
        
        res.json({ success: true, message: 'Broadcast sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
