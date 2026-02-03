// State
let currentPath = '/home/deploy';
let currentEditFile = null;
let socket = null;
let commandHistory = [];
let historyIndex = -1;
let currentWorkingDir = '/home/deploy';

// API base URL - detect if we're behind /portal/ path
const API_BASE = window.location.pathname.includes('/portal') ? '/portal' : '';

// Helper for API calls
function api(path) {
    return API_BASE + path;
}

// Fetch wrapper that includes credentials
async function apiFetch(path, options = {}) {
    return fetch(api(path), {
        ...options,
        credentials: 'include'
    });
}

// Password visibility toggle
function showPassword() {
    document.getElementById('password').type = 'text';
    document.getElementById('password-toggle').textContent = 'visibility_off';
}

function hidePassword() {
    document.getElementById('password').type = 'password';
    document.getElementById('password-toggle').textContent = 'visibility';
}

function togglePassword() {
    const input = document.getElementById('password');
    const toggle = document.getElementById('password-toggle');
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        toggle.textContent = 'visibility';
    }
}

// Check auth on load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App loaded');
    
    try {
        // Check if passkeys exist
        const passkeysRes = await apiFetch('/api/passkeys/exists');
        const passkeysData = await passkeysRes.json();
        console.log('Passkeys check:', passkeysData);
        
        const passkeyBtn = document.getElementById('passkey-login');
        if (passkeyBtn && !passkeysData.exists) {
            passkeyBtn.disabled = true;
            passkeyBtn.title = 'No passkeys registered';
        }
        
        // Check auth status
        const res = await apiFetch('/api/auth/status');
        const data = await res.json();
        console.log('Auth status:', data);
        
        if (data.authenticated) {
            showMainScreen();
        }
    } catch (err) {
        console.error('Init error:', err);
    }
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        
        try {
            const res = await apiFetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            const data = await res.json();
            
            if (data.success) {
                showMainScreen();
            } else if (data.requiresGitHubAuth) {
                // Need GitHub verification - pass the token
                const authUrl = api(`/api/auth/github?token=${encodeURIComponent(data.verificationToken)}`);
                document.getElementById('login-error').innerHTML = 
                    `<a href="${authUrl}" style="color: var(--accent)">Verify with GitHub</a> (new device detected)`;
            } else {
                document.getElementById('login-error').textContent = data.error || 'Invalid password';
            }
        } catch (err) {
            document.getElementById('login-error').textContent = 'Connection error';
        }
    });
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await apiFetch('/api/logout', { method: 'POST' });
        location.reload();
    });
    
    // Password change form
    document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('new-password').value;
        const confirm = document.getElementById('confirm-password').value;
        
        if (newPass !== confirm) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        try {
            const res = await apiFetch('/api/password/change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: newPass })
            });
            
            if (res.ok) {
                showToast('Password updated', 'success');
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
            } else {
                showToast('Failed to update password', 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });
    
    // Terminal input
    document.getElementById('terminal-input')?.addEventListener('keydown', handleTerminalInput);
});

// WebAuthn / Passkey Functions
async function loginWithPasskey() {
    try {
        // Start authentication
        const startRes = await apiFetch('/api/passkey/login/start', { method: 'POST' });
        
        if (!startRes.ok) {
            const data = await startRes.json();
            if (data.noPasskeys) {
                showToast('No passkeys registered', 'error');
                return;
            }
            throw new Error(data.error);
        }
        
        const options = await startRes.json();
        
        // Convert base64url to ArrayBuffer
        options.challenge = base64urlToBuffer(options.challenge);
        options.allowCredentials = options.allowCredentials.map(cred => ({
            ...cred,
            id: base64urlToBuffer(cred.id)
        }));
        
        // Request credential
        const credential = await navigator.credentials.get({
            publicKey: options
        });
        
        // Complete authentication
        const completeRes = await apiFetch('/api/passkey/login/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: credential.id,
                rawId: bufferToBase64url(credential.rawId),
                response: {
                    authenticatorData: bufferToBase64url(credential.response.authenticatorData),
                    clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                    signature: bufferToBase64url(credential.response.signature)
                },
                type: credential.type
            })
        });
        
        if (completeRes.ok) {
            showMainScreen();
        } else {
            throw new Error('Authentication failed');
        }
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showToast('Authentication cancelled', 'error');
        } else {
            showToast('Passkey login failed: ' + err.message, 'error');
        }
    }
}

async function registerPasskey() {
    // Check for HTTPS - WebAuthn requires secure context
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        showToast('Passkeys require HTTPS. Access via https:// to use passkeys.', 'error');
        return;
    }
    
    if (!navigator.credentials || !navigator.credentials.create) {
        showToast('Passkeys are not supported in this browser', 'error');
        return;
    }
    
    try {
        const deviceName = prompt('Name this device (e.g., "MacBook Pro"):') || 'Unknown Device';
        
        // Start registration
        const startRes = await apiFetch('/api/passkey/register/start', { method: 'POST' });
        if (!startRes.ok) throw new Error('Failed to start registration');
        
        const options = await startRes.json();
        
        // Convert base64url to ArrayBuffer
        options.challenge = base64urlToBuffer(options.challenge);
        options.user.id = base64urlToBuffer(options.user.id);
        
        // Create credential
        const credential = await navigator.credentials.create({
            publicKey: options
        });
        
        // Complete registration
        const completeRes = await apiFetch('/api/passkey/register/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: credential.id,
                rawId: bufferToBase64url(credential.rawId),
                response: {
                    attestationObject: bufferToBase64url(credential.response.attestationObject),
                    clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                    publicKey: bufferToBase64url(credential.response.getPublicKey())
                },
                type: credential.type,
                deviceName
            })
        });
        
        if (completeRes.ok) {
            showToast('Passkey registered successfully', 'success');
            loadPasskeys();
            // Enable passkey login button
            document.getElementById('passkey-login').disabled = false;
        } else {
            throw new Error('Failed to complete registration');
        }
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showToast('Registration cancelled', 'error');
        } else {
            showToast('Failed to register passkey: ' + err.message, 'error');
        }
    }
}

async function loadPasskeys() {
    try {
        const res = await apiFetch('/api/passkeys');
        const data = await res.json();
        
        const container = document.getElementById('passkeys-list');
        if (!data.passkeys || data.passkeys.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">No passkeys registered yet.</p>';
            return;
        }
        
        container.innerHTML = data.passkeys.map(pk => `
            <div class="passkey-item">
                <div class="passkey-info">
                    <span class="material-symbols-outlined">key</span>
                    <div>
                        <div class="passkey-name">${escapeHtml(pk.deviceName)}</div>
                        <div class="passkey-date">Added ${new Date(pk.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
                <button onclick="deletePasskey('${pk.id}')" class="icon-btn" title="Remove">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load passkeys:', err);
    }
}

async function deletePasskey(id) {
    if (!confirm('Remove this passkey?')) return;
    
    try {
        await fetch(api(`/api/passkeys/${encodeURIComponent(id)}`), { method: 'DELETE' });
        loadPasskeys();
        showToast('Passkey removed', 'success');
    } catch (err) {
        showToast('Failed to remove passkey', 'error');
    }
}

// Base64URL helpers
function base64urlToBuffer(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
}

function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function showMainScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    loadDashboard();
    loadGitHubProfile();
    initSocket();
}

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });
    
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === section);
    });
    
    // Load section data
    switch (section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'bots':
            loadBots();
            break;
        case 'pages':
            loadPages();
            break;
        case 'files':
            loadFiles(currentPath);
            break;
        case 'terminal':
            document.getElementById('terminal-input').focus();
            break;
        case 'git':
            loadGitHubRepos();
            break;
        case 'security':
            loadSecurityLog();
            break;
        case 'devtools':
            loadDevTools();
            break;
        case 'team':
            loadTeam();
            break;
        case 'contacts':
            loadContacts();
            break;
        case 'gallery':
            loadGallery();
            break;
        case 'page-editor':
            loadPageEditor();
            break;
        case 'homepage':
            loadHomepageConfig();
            break;
        case 'settings':
            loadPasskeys();
            loadWebhookSecret();
            break;
    }
}

// Socket.io
function initSocket() {
    // Connect to socket.io with correct path when behind /portal/
    const socketPath = API_BASE ? API_BASE + '/socket.io' : '/socket.io';
    socket = io({
        path: socketPath
    });
    
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
}

// Dashboard
async function loadDashboard() {
    try {
        const res = await apiFetch('/api/status');
        const data = await res.json();
        
        // Server status
        const statusEl = document.getElementById('server-status');
        statusEl.textContent = 'Online';
        statusEl.style.color = 'var(--success)';
        document.querySelector('.status-card:first-child .card-icon').classList.add('online');
        
        // Uptime
        const uptime = formatUptime(data.uptime);
        document.getElementById('uptime').textContent = uptime;
        
        // CPU
        document.getElementById('cpu-load').textContent = data.loadavg.map(l => l.toFixed(2)).join(' / ');
        
        // Memory
        const memPercent = ((data.memory.used / data.memory.total) * 100).toFixed(1);
        document.getElementById('memory-usage').textContent = 
            `${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}`;
        const memBar = document.getElementById('memory-bar');
        memBar.style.width = memPercent + '%';
        memBar.className = 'progress' + (memPercent > 80 ? ' danger' : memPercent > 60 ? ' warning' : '');
        
        // Disk
        document.getElementById('disk-usage').textContent = 
            `${data.disk.used} used, ${data.disk.free} free`;
        const diskPercent = parseInt(data.disk.percent) || 0;
        const diskBar = document.getElementById('disk-bar');
        diskBar.style.width = diskPercent + '%';
        diskBar.className = 'progress' + (diskPercent > 80 ? ' danger' : diskPercent > 60 ? ' warning' : '');
        
        // Nginx
        const nginxEl = document.getElementById('nginx-status');
        nginxEl.textContent = data.nginx ? 'Running' : 'Stopped';
        nginxEl.style.color = data.nginx ? 'var(--success)' : 'var(--danger)';
        
        // PM2 processes
        renderPM2List(data.pm2);
        
    } catch (err) {
        document.getElementById('server-status').textContent = 'Offline';
        document.getElementById('server-status').style.color = 'var(--danger)';
    }
}

function renderPM2List(processes) {
    const container = document.getElementById('pm2-list');
    
    if (!processes || processes.length === 0) {
        container.innerHTML = '<div class="process-item"><span style="color: var(--text-secondary);">No processes running</span></div>';
        return;
    }
    
    container.innerHTML = processes.map(p => `
        <div class="process-item">
            <div class="process-info">
                <div class="process-status ${p.pm2_env.status}"></div>
                <div>
                    <div class="process-name">${escapeHtml(p.name)}</div>
                    <div class="process-meta">
                        PID: ${p.pid} | Restarts: ${p.pm2_env.restart_time} | 
                        CPU: ${p.monit?.cpu || 0}% | Memory: ${formatBytes(p.monit?.memory || 0)}
                    </div>
                </div>
            </div>
            <div class="process-actions">
                <button onclick="pm2Action('restart', '${escapeHtml(p.name)}')">
                    <span class="material-symbols-outlined">restart_alt</span> Restart
                </button>
                <button onclick="pm2Action('stop', '${escapeHtml(p.name)}')">
                    <span class="material-symbols-outlined">stop</span> Stop
                </button>
                <button onclick="viewLogs('${escapeHtml(p.name)}')">
                    <span class="material-symbols-outlined">article</span> Logs
                </button>
            </div>
        </div>
    `).join('');
}

async function pm2Action(action, name) {
    try {
        await fetch(api(`/api/pm2/${action}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        showToast(`${action} successful`, 'success');
        setTimeout(loadDashboard, 1000);
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function viewLogs(name) {
    try {
        const res = await fetch(api(`/api/pm2/logs?name=${encodeURIComponent(name)}&lines=100`));
        const data = await res.json();
        
        showModal('Logs: ' + name, `<pre style="max-height: 400px; overflow: auto; font-size: 12px; font-family: 'JetBrains Mono', monospace; background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-sm);">${escapeHtml(data.logs)}</pre>`);
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Bots
async function loadBots() {
    try {
        const [reposRes, pm2Res] = await Promise.all([
            apiFetch('/api/repos'),
            apiFetch('/api/pm2/list')
        ]);
        
        const repos = await reposRes.json();
        const pm2List = await pm2Res.json();
        
        const container = document.getElementById('bots-list');
        
        if (!repos.bots || repos.bots.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No bots registered. Click "Add Bot" to get started.</p>';
            return;
        }
        
        container.innerHTML = repos.bots.map(bot => {
            const pm2Info = pm2List.find(p => p.name === bot.name);
            const status = pm2Info ? pm2Info.pm2_env.status : 'stopped';
            
            return `
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">
                            <span class="material-symbols-outlined">smart_toy</span>
                            ${escapeHtml(bot.name)}
                        </span>
                        <span class="card-status ${status}">${status}</span>
                    </div>
                    <div class="card-meta">
                        <div>Path: ${escapeHtml(bot.path)}</div>
                        <div>Command: ${escapeHtml(bot.start_cmd)}</div>
                    </div>
                    <div class="card-actions">
                        <button onclick="pm2Action('restart', '${escapeHtml(bot.name)}')">
                            <span class="material-symbols-outlined">restart_alt</span> Restart
                        </button>
                        <button onclick="pm2Action('stop', '${escapeHtml(bot.name)}')">
                            <span class="material-symbols-outlined">stop</span> Stop
                        </button>
                        <button onclick="pm2Action('start', '${escapeHtml(bot.name)}')">
                            <span class="material-symbols-outlined">play_arrow</span> Start
                        </button>
                        <button onclick="pullBot('${escapeHtml(bot.name)}', '${escapeHtml(bot.path)}')">
                            <span class="material-symbols-outlined">download</span> Pull
                        </button>
                        <button onclick="viewLogs('${escapeHtml(bot.name)}')">
                            <span class="material-symbols-outlined">article</span> Logs
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
    }
}

async function pullBot(name, path) {
    try {
        showToast('Pulling updates...', 'info');
        const res = await apiFetch('/api/git/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        const data = await res.json();
        
        if (data.success) {
            await pm2Action('restart', name);
            showToast('Updates pulled and bot restarted', 'success');
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function showAddBotModal() {
    showModal('Add New Bot', `
        <form id="add-bot-form">
            <div class="form-group">
                <label>Bot Name</label>
                <input type="text" name="name" required placeholder="my-bot">
            </div>
            <div class="form-group">
                <label>GitHub URL</label>
                <input type="text" name="url" required placeholder="https://github.com/user/repo">
            </div>
            <div class="form-group">
                <label>Start Command</label>
                <input type="text" name="startCmd" required placeholder="npm start or python bot.py">
            </div>
            <div class="form-group">
                <label>Environment File (optional)</label>
                <input type="text" name="envFile" placeholder="/path/to/.env">
            </div>
            <button type="submit" class="btn-primary">
                <span class="material-symbols-outlined">add</span>
                Add Bot
            </button>
        </form>
    `);
    
    document.getElementById('add-bot-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            showToast('Adding bot...', 'info');
            const res = await apiFetch('/api/bots/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData))
            });
            
            if (res.ok) {
                closeModal();
                showToast('Bot added successfully', 'success');
                loadBots();
            } else {
                const data = await res.json();
                showToast('Error: ' + data.error, 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });
}

// Pages
async function loadPages() {
    try {
        // Get both registered pages and auto-detected pages
        const [reposRes, detectRes] = await Promise.all([
            apiFetch('/api/repos'),
            apiFetch('/api/pages/detect')
        ]);
        const repos = await reposRes.json();
        const detectData = await detectRes.json();
        
        const container = document.getElementById('pages-list');
        const registeredPages = repos.pages || [];
        const detectedPages = detectData.detected || [];
        
        // Merge: registered pages take priority, add unregistered detected pages
        const registeredPaths = new Set(registeredPages.map(p => p.web_path || p.path));
        const unregisteredDetected = detectedPages.filter(d => !registeredPaths.has(d.path));
        
        if (registeredPages.length === 0 && unregisteredDetected.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No pages found. Click "Add Page" to get started.</p>';
            return;
        }
        
        let html = '';
        
        // Registered pages
        html += registeredPages.map(page => `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">
                        <span class="material-symbols-outlined">web</span>
                        ${escapeHtml(page.name)}
                    </span>
                    <span class="card-status deployed">registered</span>
                </div>
                <div class="card-meta">
                    <div>URL: opencs.dev${escapeHtml(page.url_path)}</div>
                    <div>Path: ${escapeHtml(page.web_path)}</div>
                    <div>Build: ${escapeHtml(page.build_cmd) || 'none'}</div>
                </div>
                <div class="card-actions">
                    <button onclick="updatePage('${escapeHtml(page.name)}')">
                        <span class="material-symbols-outlined">sync</span> Update
                    </button>
                    <button onclick="window.open('https://opencs.dev${escapeHtml(page.url_path)}', '_blank')">
                        <span class="material-symbols-outlined">open_in_new</span> View
                    </button>
                    <button onclick="browsePath('${escapeHtml(page.web_path)}')">
                        <span class="material-symbols-outlined">folder</span> Files
                    </button>
                </div>
            </div>
        `).join('');
        
        // Detected but unregistered pages
        if (unregisteredDetected.length > 0) {
            html += '<h3 style="margin: 1.5rem 0 1rem; color: var(--text-secondary);">Auto-Detected Pages</h3>';
            html += unregisteredDetected.map(page => `
                <div class="card" style="border-color: var(--text-secondary);">
                    <div class="card-header">
                        <span class="card-title">
                            <span class="material-symbols-outlined">search</span>
                            ${escapeHtml(page.name)}
                        </span>
                        <span class="card-status" style="background: var(--text-secondary);">${escapeHtml(page.type)}</span>
                    </div>
                    <div class="card-meta">
                        <div>Path: ${escapeHtml(page.path)}</div>
                        <div>Index: ${escapeHtml(page.indexFile)}</div>
                        ${page.domain ? `<div>Domain: ${escapeHtml(page.domain)}</div>` : ''}
                    </div>
                    <div class="card-actions">
                        <button onclick="registerDetectedPage('${escapeHtml(page.name)}', '${escapeHtml(page.path)}', '${escapeHtml(page.urlPath)}')">
                            <span class="material-symbols-outlined">add</span> Register
                        </button>
                        <button onclick="browsePath('${escapeHtml(page.path)}')">
                            <span class="material-symbols-outlined">folder</span> Files
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

// Register a detected page
async function registerDetectedPage(name, webPath, urlPath) {
    const pageName = prompt('Page name:', name);
    if (!pageName) return;
    
    try {
        const repos = await apiFetch('/api/repos').then(r => r.json());
        if (!repos.pages) repos.pages = [];
        
        repos.pages.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            name: pageName,
            url_path: urlPath || '/',
            web_path: webPath,
            build_cmd: '',
            detected: true
        });
        
        await apiFetch('/api/repos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(repos)
        });
        
        showToast('Page registered', 'success');
        loadPages();
    } catch (err) {
        showToast('Failed to register page: ' + err.message, 'error');
    }
}

async function updatePage(name) {
    try {
        const reposRes = await apiFetch('/api/repos');
        const repos = await reposRes.json();
        const page = repos.pages.find(p => p.name === name);
        
        if (!page) {
            showToast('Page not found', 'error');
            return;
        }
        
        showToast('Updating page...', 'info');
        
        // Pull updates
        await apiFetch('/api/git/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: page.repo_path })
        });
        
        // Rebuild if needed
        if (page.build_cmd) {
            await apiFetch('/api/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: page.build_cmd, cwd: page.repo_path })
            });
        }
        
        // Deploy
        const sourceDir = page.build_dir && page.build_dir !== '.' 
            ? `${page.repo_path}/${page.build_dir}` 
            : page.repo_path;
        
        await apiFetch('/api/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                command: `rsync -av --delete --exclude='.git' --exclude='node_modules' "${sourceDir}/" "${page.web_path}/"`,
                cwd: page.repo_path
            })
        });
        
        showToast('Page updated successfully', 'success');
        loadPages();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function showAddPageModal() {
    showModal('Add New Page', `
        <form id="add-page-form">
            <div class="form-group">
                <label>Page Name</label>
                <input type="text" name="name" required placeholder="my-page">
            </div>
            <div class="form-group">
                <label>GitHub URL</label>
                <input type="text" name="url" required placeholder="https://github.com/user/repo">
            </div>
            <div class="form-group">
                <label>URL Path</label>
                <input type="text" name="urlPath" required placeholder="/ or /subdir">
                <span class="hint">Use / for root or /subdirectory for a subpath</span>
            </div>
            <div class="form-group">
                <label>Build Command (optional)</label>
                <input type="text" name="buildCmd" placeholder="npm run build">
            </div>
            <div class="form-group">
                <label>Build Output Directory</label>
                <input type="text" name="buildDir" placeholder="dist, build, or . for root" value=".">
            </div>
            <button type="submit" class="btn-primary">
                <span class="material-symbols-outlined">add</span>
                Add Page
            </button>
        </form>
    `);
    
    document.getElementById('add-page-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            showToast('Adding page...', 'info');
            const res = await apiFetch('/api/pages/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData))
            });
            
            if (res.ok) {
                closeModal();
                showToast('Page added successfully', 'success');
                loadPages();
            } else {
                const data = await res.json();
                showToast('Error: ' + data.error, 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });
}

// Files
async function loadFiles(dirPath) {
    currentPath = dirPath;
    document.getElementById('current-path').value = dirPath;
    
    try {
        const res = await fetch(api(`/api/files?path=${encodeURIComponent(dirPath)}`));
        const data = await res.json();
        
        const container = document.getElementById('file-list');
        
        if (data.files.length === 0) {
            container.innerHTML = '<div class="file-item"><span style="color: var(--text-secondary);">Empty directory</span></div>';
            return;
        }
        
        container.innerHTML = data.files.map(file => `
            <div class="file-item ${file.isDirectory ? 'directory' : ''}" data-path="${escapeAttr(file.path)}" ondblclick="${file.isDirectory ? `loadFiles('${escapeAttr(file.path)}')` : `editFile('${escapeAttr(file.path)}')`}">
                <div class="file-info">
                    <span class="material-symbols-outlined file-icon ${file.isDirectory ? 'folder' : ''}">${file.isDirectory ? 'folder' : 'description'}</span>
                    <span class="file-name ${file.isDirectory ? 'directory' : ''}">${escapeHtml(file.name)}</span>
                </div>
                <div class="file-meta">
                    <span>${file.isDirectory ? '--' : formatBytes(file.size)}</span>
                    <span>${file.modified ? new Date(file.modified).toLocaleDateString() : '--'}</span>
                </div>
                <div class="file-actions">
                    ${file.isDirectory ? `
                        <button onclick="event.stopPropagation(); downloadZip('${escapeAttr(file.path)}')" title="Download ZIP">
                            <span class="material-symbols-outlined">folder_zip</span>
                        </button>
                    ` : `
                        <button onclick="event.stopPropagation(); downloadFile('${escapeAttr(file.path)}')" title="Download">
                            <span class="material-symbols-outlined">download</span>
                        </button>
                        <button onclick="event.stopPropagation(); editFile('${escapeAttr(file.path)}')" title="Edit">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                    `}
                    <button onclick="event.stopPropagation(); renameFile('${escapeAttr(file.path)}', '${escapeAttr(file.name)}')" title="Rename">
                        <span class="material-symbols-outlined">drive_file_rename_outline</span>
                    </button>
                    <button onclick="event.stopPropagation(); deleteFile('${escapeAttr(file.path)}')" title="Delete">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('Error loading files: ' + err.message, 'error');
    }
}

function navigateUp() {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadFiles(parentPath);
}

function refreshFiles() {
    loadFiles(currentPath);
}

function browsePath(path) {
    switchSection('files');
    loadFiles(path);
}

async function editFile(path) {
    try {
        const res = await fetch(api(`/api/files/read?path=${encodeURIComponent(path)}`));
        const data = await res.json();
        
        if (data.error) {
            showToast('Error: ' + data.error, 'error');
            return;
        }
        
        currentEditFile = path;
        document.getElementById('editor-title').textContent = path.split('/').pop();
        document.getElementById('file-editor').value = data.content;
        document.getElementById('editor-modal').classList.remove('hidden');
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function saveFile() {
    if (!currentEditFile) return;
    
    try {
        const content = document.getElementById('file-editor').value;
        const res = await apiFetch('/api/files/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentEditFile, content })
        });
        
        if (res.ok) {
            showToast('File saved', 'success');
        } else {
            const data = await res.json();
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function closeEditor() {
    document.getElementById('editor-modal').classList.add('hidden');
    currentEditFile = null;
}

function downloadFile(path) {
    window.open(`/api/files/download?path=${encodeURIComponent(path)}`);
}

function downloadZip(path) {
    window.open(`/api/files/download-zip?path=${encodeURIComponent(path)}`);
}

async function deleteFile(path) {
    if (!confirm(`Delete ${path}?`)) return;
    
    try {
        const res = await fetch(api(`/api/files?path=${encodeURIComponent(path)}`), {
            method: 'DELETE'
        });
        
        if (res.ok) {
            showToast('Deleted', 'success');
            refreshFiles();
        } else {
            const data = await res.json();
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function renameFile(oldPath, oldName) {
    const newName = prompt('New name:', oldName);
    if (!newName || newName === oldName) return;
    
    const newPath = oldPath.replace(oldName, newName);
    
    apiFetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath })
    }).then(res => {
        if (res.ok) {
            showToast('Renamed', 'success');
            refreshFiles();
        } else {
            res.json().then(data => showToast('Error: ' + data.error, 'error'));
        }
    });
}

function showNewFolderModal() {
    const name = prompt('Folder name:');
    if (!name) return;
    
    apiFetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `${currentPath}/${name}` })
    }).then(res => {
        if (res.ok) {
            showToast('Folder created', 'success');
            refreshFiles();
        } else {
            res.json().then(data => showToast('Error: ' + data.error, 'error'));
        }
    });
}

function showUploadModal() {
    showModal('Upload Files', `
        <form id="upload-form">
            <div class="form-group">
                <label>Select files to upload to: ${currentPath}</label>
                <input type="file" name="files" multiple style="padding: 1rem; border: 2px dashed var(--border-color); width: 100%; border-radius: var(--radius-sm);">
            </div>
            <button type="submit" class="btn-primary">
                <span class="material-symbols-outlined">upload</span>
                Upload
            </button>
        </form>
    `);
    
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            showToast('Uploading...', 'info');
            const res = await fetch(api(`/api/files/upload?path=${encodeURIComponent(currentPath)}`), {
                method: 'POST',
                body: formData
            });
            
            if (res.ok) {
                closeModal();
                showToast('Upload complete', 'success');
                refreshFiles();
            } else {
                const data = await res.json();
                showToast('Error: ' + data.error, 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });
}

// Fast typing animation for terminal output
async function typeOutput(container, text, speed = 2) {
    const outputDiv = document.createElement('div');
    outputDiv.className = 'output';
    container.appendChild(outputDiv);
    
    const escaped = escapeHtml(text);
    const chars = escaped.split('');
    let i = 0;
    
    return new Promise(resolve => {
        const type = () => {
            // Type multiple characters at once for speed
            const chunk = chars.slice(i, i + 5).join('');
            outputDiv.innerHTML += chunk;
            i += 5;
            container.scrollTop = container.scrollHeight;
            
            if (i < chars.length) {
                setTimeout(type, speed);
            } else {
                resolve();
            }
        };
        type();
    });
}

// Fast typing animation for terminal output
async function typeOutput(container, text, chunkSize = 8) {
    const outputDiv = document.createElement('div');
    outputDiv.className = 'output';
    container.appendChild(outputDiv);
    
    const escaped = escapeHtml(text);
    let i = 0;
    
    return new Promise(resolve => {
        const type = () => {
            // Type multiple characters at once for speed
            const chunk = escaped.slice(i, i + chunkSize);
            outputDiv.innerHTML += chunk;
            i += chunkSize;
            container.scrollTop = container.scrollHeight;
            
            if (i < escaped.length) {
                requestAnimationFrame(type);
            } else {
                resolve();
            }
        };
        type();
    });
}

// Terminal (fallback command execution)
function handleTerminalInput(e) {
    if (e.key === 'Enter') {
        sendCommand();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            document.getElementById('terminal-input').value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            document.getElementById('terminal-input').value = commandHistory[commandHistory.length - 1 - historyIndex];
        } else {
            historyIndex = -1;
            document.getElementById('terminal-input').value = '';
        }
    }
}

async function sendCommand() {
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');
    const command = input.value.trim();
    
    if (!command) return;
    
    // Add to history
    commandHistory.push(command);
    historyIndex = -1;
    
    // Show command
    output.innerHTML += `<div class="command">$ ${escapeHtml(command)}</div>`;
    input.value = '';
    
    // Handle cd command
    if (command.startsWith('cd ')) {
        const dir = command.slice(3).trim();
        let newDir;
        if (dir.startsWith('/')) {
            newDir = dir;
        } else if (dir === '..') {
            newDir = currentWorkingDir.split('/').slice(0, -1).join('/') || '/';
        } else if (dir === '~') {
            newDir = '/home/deploy';
        } else {
            newDir = currentWorkingDir + '/' + dir;
        }
        currentWorkingDir = newDir;
        output.innerHTML += `<div class="output">Changed directory to ${escapeHtml(newDir)}</div>`;
        output.scrollTop = output.scrollHeight;
        return;
    }
    
    try {
        const res = await apiFetch('/api/terminal/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, cwd: currentWorkingDir })
        });
        
        const data = await res.json();
        
        if (data.output) {
            await typeOutput(output, data.output);
        }
        if (data.error && data.exitCode !== 0) {
            output.innerHTML += `<div class="error">Exit code: ${data.exitCode}</div>`;
        }
    } catch (err) {
        output.innerHTML += `<div class="error">Error: ${escapeHtml(err.message)}</div>`;
    }
    
    output.scrollTop = output.scrollHeight;
}

// GitHub Profile
async function loadGitHubProfile() {
    try {
        const res = await apiFetch('/api/github/profile');
        const data = await res.json();
        
        const avatar = document.getElementById('user-avatar');
        const label = document.getElementById('user-label');
        
        if (data.avatar) {
            avatar.src = data.avatar;
            avatar.style.display = 'block';
        }
        if (data.username) {
            label.textContent = data.username;
        }
    } catch (err) {
        console.error('Failed to load GitHub profile:', err);
    }
}

// GitHub Repos
async function loadGitHubRepos() {
    const container = document.getElementById('github-repos');
    container.innerHTML = '<p style="color: var(--text-secondary);">Loading repositories...</p>';
    
    try {
        const res = await apiFetch('/api/github/repos');
        const repos = await res.json();
        
        if (!repos || repos.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No repositories found.</p>';
            return;
        }
        
        container.innerHTML = repos.map(repo => `
            <div class="github-repo-card">
                <div class="repo-header">
                    <span class="repo-name">${escapeHtml(repo.name)}</span>
                    ${repo.private ? '<span class="repo-private">Private</span>' : ''}
                </div>
                <div class="repo-desc">${escapeHtml(repo.description || 'No description')}</div>
                <div class="repo-meta">
                    ${repo.language ? `
                        <span class="repo-lang">
                            <span class="lang-dot" style="background: ${getLanguageColor(repo.language)}"></span>
                            ${escapeHtml(repo.language)}
                        </span>
                    ` : ''}
                    <span><span class="material-symbols-outlined" style="font-size:14px">star</span> ${repo.stars}</span>
                    <span><span class="material-symbols-outlined" style="font-size:14px">fork_right</span> ${repo.forks}</span>
                </div>
                <div class="repo-actions">
                    <button class="btn-clone" onclick="cloneGitHubRepo('${escapeAttr(repo.cloneUrl)}', '${escapeAttr(repo.name)}')">
                        <span class="material-symbols-outlined" style="font-size:14px">download</span> Clone
                    </button>
                    <button class="btn-view" onclick="viewGitHubRepo('${escapeAttr(repo.owner)}', '${escapeAttr(repo.name)}')">
                        <span class="material-symbols-outlined" style="font-size:14px">folder_open</span> Browse
                    </button>
                    <button class="btn-view" onclick="window.open('${escapeAttr(repo.url)}', '_blank')">
                        <span class="material-symbols-outlined" style="font-size:14px">open_in_new</span> GitHub
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p style="color: var(--danger);">Error: ${escapeHtml(err.message)}</p>`;
    }
}

function getLanguageColor(lang) {
    const colors = {
        JavaScript: '#f1e05a',
        TypeScript: '#3178c6',
        Python: '#3572A5',
        Java: '#b07219',
        Go: '#00ADD8',
        Rust: '#dea584',
        Ruby: '#701516',
        PHP: '#4F5D95',
        'C++': '#f34b7d',
        C: '#555555',
        'C#': '#178600',
        HTML: '#e34c26',
        CSS: '#563d7c',
        Shell: '#89e051',
        Lua: '#000080',
        Swift: '#F05138',
        Kotlin: '#A97BFF'
    };
    return colors[lang] || '#8888a0';
}

function cloneGitHubRepo(url, name) {
    document.getElementById('git-clone-url').value = url;
    document.getElementById('git-clone-dest').value = `/home/deploy/repos/${name}`;
    showToast(`Ready to clone ${name}. Click Clone button to proceed.`, 'info');
}

// Git
async function gitClone() {
    const url = document.getElementById('git-clone-url').value;
    const dest = document.getElementById('git-clone-dest').value;
    const branchSelect = document.getElementById('git-clone-branch');
    const selectedBranches = Array.from(branchSelect.selectedOptions).map(o => o.value);
    
    if (!url || !dest) {
        showToast('Please provide both URL and destination', 'error');
        return;
    }
    
    try {
        // Clone each selected branch
        for (const branch of selectedBranches) {
            const branchDest = selectedBranches.length > 1 ? `${dest}-${branch}` : dest;
            showToast(`Cloning ${branch} branch...`, 'info');
            
            const res = await apiFetch('/api/git/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, destination: branchDest, branch })
            });
            
            const data = await res.json();
            if (!data.success) {
                showToast(`Error cloning ${branch}: ` + data.error, 'error');
            }
        }
        
        showToast('Repository cloned successfully', 'success');
        document.getElementById('git-clone-url').value = '';
        document.getElementById('git-clone-dest').value = '';
        document.getElementById('branch-select-row').style.display = 'none';
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function gitStatus() {
    const path = document.getElementById('git-repo-path').value;
    if (!path) {
        showToast('Please provide repository path', 'error');
        return;
    }
    
    try {
        const res = await fetch(api(`/api/git/status?path=${encodeURIComponent(path)}`));
        const data = await res.json();
        
        if (data.error) {
            document.getElementById('git-output').textContent = 'Error: ' + data.error;
        } else {
            const output = `Branch: ${data.status.current}
Tracking: ${data.status.tracking || 'none'}
Ahead: ${data.status.ahead} | Behind: ${data.status.behind}
Modified: ${data.status.modified.length}
Created: ${data.status.created.length}
Deleted: ${data.status.deleted.length}

Recent commits:
${data.log.all.map(c => `  ${c.hash.substring(0, 7)} - ${c.message}`).join('\n')}`;
            
            document.getElementById('git-output').textContent = output;
        }
    } catch (err) {
        document.getElementById('git-output').textContent = 'Error: ' + err.message;
    }
}

async function gitPull() {
    const path = document.getElementById('git-repo-path').value;
    if (!path) {
        showToast('Please provide repository path', 'error');
        return;
    }
    
    try {
        showToast('Pulling...', 'info');
        const res = await apiFetch('/api/git/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('Pull successful', 'success');
            document.getElementById('git-output').textContent = data.output || 'Already up to date.';
            gitWorkflowStatus(path);
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Get detailed git status
async function gitWorkflowStatus(repoPath) {
    const path = repoPath || document.getElementById('git-repo-path').value;
    if (!path) return;
    
    try {
        const res = await apiFetch('/api/git/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        
        const data = await res.json();
        
        if (data.error) {
            document.getElementById('git-output').textContent = 'Error: ' + data.error;
            return;
        }
        
        let output = `=== Git Status ===\n`;
        if (data.hasChanges) {
            output += `\nChanged files:\n`;
            data.changes.forEach(c => {
                const statusLabel = c.status.includes('M') ? 'Modified' : 
                                   c.status.includes('A') ? 'Added' :
                                   c.status.includes('D') ? 'Deleted' :
                                   c.status.includes('?') ? 'Untracked' : c.status;
                output += `  [${statusLabel}] ${c.file}\n`;
            });
        } else {
            output += '\nNo uncommitted changes.\n';
        }
        
        document.getElementById('git-output').textContent = output;
        
        // Update UI to show commit/push buttons if there are changes
        const commitBtn = document.getElementById('git-commit-btn');
        if (commitBtn) {
            commitBtn.style.display = data.hasChanges ? 'inline-flex' : 'none';
        }
    } catch (err) {
        document.getElementById('git-output').textContent = 'Error: ' + err.message;
    }
}

// Show commit modal
function showCommitModal() {
    const path = document.getElementById('git-repo-path').value;
    if (!path) {
        showToast('Please provide repository path', 'error');
        return;
    }
    
    const content = `
        <div class="form-group">
            <label>Commit Message</label>
            <input type="text" id="commit-message" placeholder="Your commit message">
        </div>
        <p class="hint">All changed files will be staged and committed.</p>
        <button onclick="gitCommit('${escapeAttr(path)}')" class="btn-primary" style="width:100%">
            <span class="material-symbols-outlined">check</span>
            Commit Changes
        </button>
    `;
    showModal('Commit Changes', content);
}

// Git commit
async function gitCommit(repoPath) {
    const message = document.getElementById('commit-message').value;
    if (!message) {
        showToast('Commit message is required', 'error');
        return;
    }
    
    try {
        showToast('Committing...', 'info');
        const res = await apiFetch('/api/git/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: repoPath, message })
        });
        
        const data = await res.json();
        if (data.success) {
            closeModal();
            showToast('Changes committed', 'success');
            document.getElementById('git-output').textContent = data.output;
            gitWorkflowStatus(repoPath);
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Git push
async function gitPush() {
    const path = document.getElementById('git-repo-path').value;
    if (!path) {
        showToast('Please provide repository path', 'error');
        return;
    }
    
    try {
        showToast('Pushing to remote...', 'info');
        const res = await apiFetch('/api/git/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('Pushed successfully', 'success');
            document.getElementById('git-output').textContent = data.output || 'Push complete.';
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Show local development info
async function showLocalDevInfo() {
    const path = document.getElementById('git-repo-path').value;
    if (!path) {
        showToast('Please provide repository path', 'error');
        return;
    }
    
    try {
        const res = await apiFetch('/api/git/remote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        
        const data = await res.json();
        const remotes = data.remotes || {};
        const originUrl = remotes.origin?.fetch || 'Not configured';
        
        const content = `
            <h4>Local Development Workflow</h4>
            <p>To work on this repo locally in VS Code:</p>
            
            <div class="code-block">
                <pre># Clone from the server
git clone root@159.198.42.248:${path} myproject
cd myproject

# Make your changes, then push
git add -A
git commit -m "Your changes"
git push</pre>
                <button onclick="navigator.clipboard.writeText('git clone root@159.198.42.248:${path} myproject')" class="copy-btn">Copy</button>
            </div>
            
            <h4 style="margin-top:1.5rem">Or add server as remote</h4>
            <div class="code-block">
                <pre># In your existing local repo
git remote add vps root@159.198.42.248:${path}
git push vps main</pre>
                <button onclick="navigator.clipboard.writeText('git remote add vps root@159.198.42.248:${path}')" class="copy-btn">Copy</button>
            </div>
            
            <h4 style="margin-top:1.5rem">Remote Info</h4>
            <p><strong>Origin:</strong> ${originUrl}</p>
        `;
        
        showModal('Local Development Setup', content);
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Settings
async function loadWebhookSecret() {
    try {
        const res = await apiFetch('/api/webhook-secret');
        const data = await res.json();
        document.getElementById('webhook-secret').textContent = data.secret;
    } catch (err) {
        document.getElementById('webhook-secret').textContent = 'Error loading secret';
    }
}

function copyWebhookSecret() {
    const secret = document.getElementById('webhook-secret').textContent;
    navigator.clipboard.writeText(secret).then(() => {
        showToast('Copied to clipboard', 'success');
    });
}

// Quick actions
async function checkUpdates() {
    try {
        showToast('Checking for updates...', 'info');
        const res = await apiFetch('/api/repos');
        const repos = await res.json();
        
        let updates = [];
        
        for (const bot of repos.bots || []) {
            try {
                const statusRes = await fetch(api(`/api/git/status?path=${encodeURIComponent(bot.path)}`));
                const status = await statusRes.json();
                if (status.status?.behind > 0) {
                    updates.push(`${bot.name}: ${status.status.behind} commits behind`);
                }
            } catch (e) {}
        }
        
        for (const page of repos.pages || []) {
            try {
                const statusRes = await fetch(api(`/api/git/status?path=${encodeURIComponent(page.repo_path)}`));
                const status = await statusRes.json();
                if (status.status?.behind > 0) {
                    updates.push(`${page.name}: ${status.status.behind} commits behind`);
                }
            } catch (e) {}
        }
        
        if (updates.length === 0) {
            showToast('All repositories are up to date', 'success');
        } else {
            showModal('Updates Available', `<ul style="list-style: none;">${updates.map(u => `<li style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">${escapeHtml(u)}</li>`).join('')}</ul>`);
        }
    } catch (err) {
        showToast('Error checking updates: ' + err.message, 'error');
    }
}

async function restartAllBots() {
    if (!confirm('Restart all bots?')) return;
    
    try {
        await apiFetch('/api/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'pm2 restart all' })
        });
        showToast('All bots restarted', 'success');
        loadDashboard();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function reloadNginx() {
    try {
        await apiFetch('/api/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'sudo systemctl reload nginx' })
        });
        showToast('Nginx reloaded', 'success');
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Modal
function showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

// Toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
    toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${escapeHtml(message)}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utilities
function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'editor-modal') {
        closeEditor();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeEditor();
        closeRepoBrowser();
        closePageSettings();
        hideContextMenu();
    }
});

// ================== SECURITY SECTION ==================

async function loadSecurityLog() {
    try {
        const [logRes, ipsRes] = await Promise.all([
            apiFetch('/api/security/log'),
            apiFetch('/api/security/known-ips')
        ]);
        
        if (!logRes.ok || !ipsRes.ok) {
            console.log('Security data requires authentication');
            return;
        }
        
        const log = await logRes.json();
        const ips = await ipsRes.json();
        
        if (!log.events || !ips.known) {
            console.log('Invalid security data format');
            return;
        }
        
        // Update stats
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        const failedLast24h = log.events.filter(e => 
            e.type === 'login_failed' && (now - new Date(e.timestamp).getTime()) < day
        ).length;
        
        document.getElementById('failed-login-count').textContent = failedLast24h;
        document.getElementById('locked-ip-count').textContent = ips.locked.length;
        document.getElementById('known-ip-count').textContent = ips.known.length;
        
        // Update log table
        const tbody = document.getElementById('security-log-body');
        if (log.events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">No security events</td></tr>';
        } else {
            tbody.innerHTML = log.events.slice(0, 50).map(event => {
                const time = new Date(event.timestamp).toLocaleString();
                const statusClass = event.success ? 'status-success' : 
                                   event.locked ? 'status-locked' : 'status-failed';
                const statusText = event.success ? 'Success' : 
                                  event.locked ? 'Locked' : 'Failed';
                return `
                    <tr>
                        <td>${escapeHtml(time)}</td>
                        <td><code>${escapeHtml(event.ip)}</code></td>
                        <td>${escapeHtml(event.type.replace(/_/g, ' '))}</td>
                        <td class="${statusClass}">${statusText}</td>
                        <td>${escapeHtml(event.details || '-')}</td>
                    </tr>
                `;
            }).join('');
        }
        
        // Update locked IPs list
        const lockedList = document.getElementById('locked-ips-list');
        if (ips.locked.length === 0) {
            lockedList.innerHTML = '<p style="color: var(--text-secondary);">No locked IPs</p>';
        } else {
            lockedList.innerHTML = ips.locked.map(ip => `
                <div class="ip-tag locked">
                    <code>${escapeHtml(ip)}</code>
                    <button class="ip-unlock" onclick="unlockIP('${escapeAttr(ip)}')" title="Unlock">
                        <span class="material-symbols-outlined">lock_open</span>
                    </button>
                </div>
            `).join('');
        }
        
        // Update known IPs list
        const knownList = document.getElementById('known-ips-list');
        if (ips.known.length === 0) {
            knownList.innerHTML = '<p style="color: var(--text-secondary);">No known IPs</p>';
        } else {
            knownList.innerHTML = ips.known.map(ip => `
                <div class="ip-tag">
                    <code>${escapeHtml(ip)}</code>
                    <button class="ip-remove" onclick="removeKnownIP('${escapeAttr(ip)}')" title="Remove">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            `).join('');
        }
        
    } catch (err) {
        console.error('Failed to load security log:', err);
        showToast('Failed to load security data', 'error');
    }
}

async function unlockIP(ip) {
    if (!confirm(`Unlock IP ${ip}?`)) return;
    
    try {
        const res = await apiFetch('/api/security/unlock-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
        
        if (res.ok) {
            showToast('IP unlocked', 'success');
            loadSecurityLog();
        } else {
            showToast('Failed to unlock IP', 'error');
        }
    } catch (err) {
        showToast('Error unlocking IP', 'error');
    }
}

async function removeKnownIP(ip) {
    if (!confirm(`Remove ${ip} from known IPs? They will need to verify via GitHub next time.`)) return;
    
    try {
        const res = await apiFetch('/api/security/known-ips/' + encodeURIComponent(ip), {
            method: 'DELETE'
        });
        
        if (res.ok) {
            showToast('IP removed', 'success');
            loadSecurityLog();
        } else {
            showToast('Failed to remove IP', 'error');
        }
    } catch (err) {
        showToast('Error removing IP', 'error');
    }
}

// ================== REPO BROWSER ==================

let repoBrowserHistory = [];
let currentRepoOwner = '';
let currentRepoName = '';

function viewGitHubRepo(owner, repo) {
    currentRepoOwner = owner;
    currentRepoName = repo;
    repoBrowserHistory = [];
    
    document.getElementById('repo-browser-title').textContent = `${owner}/${repo}`;
    document.getElementById('repo-browser-modal').classList.remove('hidden');
    
    browseRepoPath('');
}

async function browseRepoPath(path) {
    const content = document.getElementById('repo-browser-content');
    const pathDisplay = document.getElementById('repo-browser-path');
    const backBtn = document.getElementById('repo-back-btn');
    
    pathDisplay.textContent = '/' + (path || '');
    backBtn.disabled = repoBrowserHistory.length === 0;
    
    content.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">Loading...</p>';
    
    try {
        const res = await fetch(api(`/api/github/repo/${currentRepoOwner}/${currentRepoName}/contents?path=${encodeURIComponent(path)}`));
        const data = await res.json();
        
        if (!Array.isArray(data)) {
            throw new Error('Invalid response');
        }
        
        // Sort: directories first, then files
        data.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });
        
        content.innerHTML = `
            <ul class="repo-file-list">
                ${data.map(item => `
                    <li class="repo-file-item ${item.type === 'dir' ? 'dir' : ''}" 
                        onclick="repoItemClick('${escapeAttr(item.path)}', '${item.type}')">
                        <span class="material-symbols-outlined">
                            ${item.type === 'dir' ? 'folder' : 'description'}
                        </span>
                        <span class="file-name">${escapeHtml(item.name)}</span>
                        ${item.size ? `<span class="file-size">${formatBytes(item.size)}</span>` : ''}
                    </li>
                `).join('')}
            </ul>
        `;
        
    } catch (err) {
        console.error('Failed to browse repo:', err);
        content.innerHTML = '<p style="color: var(--danger); padding: 1rem;">Failed to load repository contents</p>';
    }
}

function repoItemClick(path, type) {
    if (type === 'dir') {
        // Save current path to history for back navigation
        const currentPath = document.getElementById('repo-browser-path').textContent.slice(1);
        repoBrowserHistory.push(currentPath);
        browseRepoPath(path);
    } else {
        viewRepoFile(path);
    }
}

async function viewRepoFile(path) {
    const content = document.getElementById('repo-browser-content');
    content.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">Loading file...</p>';
    
    try {
        const res = await fetch(api(`/api/github/repo/${currentRepoOwner}/${currentRepoName}/file?path=${encodeURIComponent(path)}`));
        const data = await res.json();
        
        if (data.content) {
            content.innerHTML = `
                <div class="repo-file-viewer">
                    <pre><code>${escapeHtml(data.content)}</code></pre>
                </div>
            `;
        } else {
            content.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">Cannot display this file</p>';
        }
        
        // Add to history so back button works
        const currentPath = document.getElementById('repo-browser-path').textContent.slice(1);
        const parentPath = path.split('/').slice(0, -1).join('/');
        if (currentPath !== parentPath) {
            repoBrowserHistory.push(parentPath);
        }
        
        document.getElementById('repo-browser-path').textContent = '/' + path;
        document.getElementById('repo-back-btn').disabled = false;
        
    } catch (err) {
        console.error('Failed to view file:', err);
        content.innerHTML = '<p style="color: var(--danger); padding: 1rem;">Failed to load file</p>';
    }
}

function repoBrowserBack() {
    if (repoBrowserHistory.length > 0) {
        const prevPath = repoBrowserHistory.pop();
        browseRepoPath(prevPath);
    }
}

function closeRepoBrowser() {
    document.getElementById('repo-browser-modal').classList.add('hidden');
    repoBrowserHistory = [];
}

// ================== PAGE SETTINGS ==================

function openPageSettings(pageId, name, url) {
    document.getElementById('page-settings-id').value = pageId;
    document.getElementById('page-settings-name').value = name;
    document.getElementById('page-settings-url').value = url;
    document.getElementById('page-favicon-preview').src = '';
    document.getElementById('page-banner-preview').src = '';
    document.getElementById('page-favicon-input').value = '';
    document.getElementById('page-banner-input').value = '';
    document.getElementById('page-settings-modal').classList.remove('hidden');
}

function closePageSettings() {
    document.getElementById('page-settings-modal').classList.add('hidden');
}

function previewFavicon(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('page-favicon-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewBanner(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('page-banner-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function savePageSettings() {
    const pageId = document.getElementById('page-settings-id').value;
    const name = document.getElementById('page-settings-name').value;
    const faviconFile = document.getElementById('page-favicon-input').files[0];
    const bannerFile = document.getElementById('page-banner-input').files[0];
    
    try {
        // Update name first
        const updateRes = await fetch(api(`/api/pages/${pageId}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (!updateRes.ok) {
            throw new Error('Failed to update page');
        }
        
        // Upload favicon if provided
        if (faviconFile) {
            const formData = new FormData();
            formData.append('favicon', faviconFile);
            await fetch(api(`/api/pages/${pageId}/favicon`), {
                method: 'POST',
                body: formData
            });
        }
        
        // Upload banner if provided
        if (bannerFile) {
            const formData = new FormData();
            formData.append('banner', bannerFile);
            await fetch(api(`/api/pages/${pageId}/banner`), {
                method: 'POST',
                body: formData
            });
        }
        
        showToast('Page settings saved', 'success');
        closePageSettings();
        loadPages();
        
    } catch (err) {
        console.error('Failed to save page settings:', err);
        showToast('Failed to save settings', 'error');
    }
}

async function deletePage() {
    const pageId = document.getElementById('page-settings-id').value;
    const name = document.getElementById('page-settings-name').value;
    
    if (!confirm(`Delete page "${name}"? This cannot be undone.`)) return;
    
    try {
        const res = await fetch(api(`/api/pages/${pageId}`), {
            method: 'DELETE'
        });
        
        if (res.ok) {
            showToast('Page deleted', 'success');
            closePageSettings();
            loadPages();
        } else {
            showToast('Failed to delete page', 'error');
        }
    } catch (err) {
        showToast('Error deleting page', 'error');
    }
}

// ================== CONTEXT MENU ==================

let contextMenuTarget = null;

function showContextMenu(e, items) {
    e.preventDefault();
    
    const menu = document.getElementById('context-menu');
    const menuItems = document.getElementById('context-menu-items');
    
    menuItems.innerHTML = items.map(item => {
        if (item.divider) {
            return '<li class="divider"></li>';
        }
        return `
            <li class="${item.danger ? 'danger' : ''}" onclick="handleContextMenuItem('${item.action}')">
                <span class="material-symbols-outlined">${item.icon}</span>
                ${item.label}
            </li>
        `;
    }).join('');
    
    menu.classList.remove('hidden');
    
    // Position the menu
    const menuRect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    
    // Keep menu within viewport
    if (x + menuRect.width > window.innerWidth) {
        x = window.innerWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > window.innerHeight) {
        y = window.innerHeight - menuRect.height - 10;
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
    contextMenuTarget = null;
}

function handleContextMenuItem(action) {
    hideContextMenu();
    
    switch (action) {
        case 'open':
            if (contextMenuTarget?.path) {
                if (contextMenuTarget.isDirectory) {
                    loadFiles(contextMenuTarget.path);
                } else {
                    editFile(contextMenuTarget.path);
                }
            }
            break;
        case 'edit':
            if (contextMenuTarget?.path) {
                editFile(contextMenuTarget.path);
            }
            break;
        case 'delete':
            if (contextMenuTarget?.path) {
                deleteFile(contextMenuTarget.path);
            }
            break;
        case 'download':
            if (contextMenuTarget?.path) {
                window.open(api('/api/files/download?path=' + encodeURIComponent(contextMenuTarget.path)));
            }
            break;
        case 'copy-path':
            if (contextMenuTarget?.path) {
                navigator.clipboard.writeText(contextMenuTarget.path);
                showToast('Path copied', 'success');
            }
            break;
        case 'page-settings':
            if (contextMenuTarget?.page) {
                openPageSettings(
                    contextMenuTarget.page.id,
                    contextMenuTarget.page.name,
                    contextMenuTarget.page.url
                );
            }
            break;
        case 'page-open':
            if (contextMenuTarget?.page?.url) {
                window.open(contextMenuTarget.page.url, '_blank');
            }
            break;
        case 'page-delete':
            if (contextMenuTarget?.page) {
                document.getElementById('page-settings-id').value = contextMenuTarget.page.id;
                deletePage();
            }
            break;
    }
}

// Attach context menu to file items
document.addEventListener('contextmenu', (e) => {
    const fileItem = e.target.closest('.file-item');
    const pageCard = e.target.closest('.page-card');
    
    if (fileItem) {
        const path = fileItem.dataset.path;
        const isDirectory = fileItem.classList.contains('directory');
        contextMenuTarget = { path, isDirectory };
        
        const items = [
            { icon: 'folder_open', label: 'Open', action: 'open' }
        ];
        
        if (!isDirectory) {
            items.push({ icon: 'edit', label: 'Edit', action: 'edit' });
            items.push({ icon: 'download', label: 'Download', action: 'download' });
        }
        
        items.push({ icon: 'content_copy', label: 'Copy Path', action: 'copy-path' });
        items.push({ divider: true });
        items.push({ icon: 'delete', label: 'Delete', action: 'delete', danger: true });
        
        showContextMenu(e, items);
    } else if (pageCard) {
        const pageId = pageCard.dataset.id;
        const pageName = pageCard.querySelector('h4')?.textContent || 'Page';
        const pageUrl = pageCard.querySelector('.page-url')?.textContent || '';
        contextMenuTarget = { page: { id: pageId, name: pageName, url: pageUrl } };
        
        showContextMenu(e, [
            { icon: 'open_in_new', label: 'Open Page', action: 'page-open' },
            { icon: 'settings', label: 'Page Settings', action: 'page-settings' },
            { divider: true },
            { icon: 'delete', label: 'Delete Page', action: 'page-delete', danger: true }
        ]);
    }
});

// Hide context menu on click outside
document.addEventListener('click', () => {
    hideContextMenu();
});

// Update loadPages to include settings button and data attributes
async function loadPagesWithSettings() {
    try {
        const res = await apiFetch('/api/pages');
        const pages = await res.json();
        
        const list = document.getElementById('pages-list');
        if (pages.length === 0) {
            list.innerHTML = '<p style="color: var(--text-secondary);">No pages configured</p>';
            return;
        }
        
        list.innerHTML = pages.map(page => `
            <div class="card page-card" data-id="${page.id}">
                <div class="card-header">
                    <h4>${escapeHtml(page.name)}</h4>
                    <button class="icon-btn" onclick="openPageSettings('${page.id}', '${escapeAttr(page.name)}', '${escapeAttr(page.url)}')" title="Settings">
                        <span class="material-symbols-outlined">settings</span>
                    </button>
                </div>
                <p class="page-url">${escapeHtml(page.url)}</p>
                <div class="card-actions">
                    <a href="${page.url}" target="_blank" class="btn-secondary">
                        <span class="material-symbols-outlined">open_in_new</span>
                        Visit
                    </a>
                </div>
            </div>
        `).join('');
        
    } catch (err) {
        console.error('Failed to load pages:', err);
    }
}

// ================== DEVELOPER TOOLS ==================

let allDevTools = [];

async function loadDevTools() {
    try {
        const res = await apiFetch('/api/devtools');
        const data = await res.json();
        allDevTools = data.tools || [];
        renderDevTools(allDevTools);
    } catch (err) {
        console.error('Failed to load dev tools:', err);
    }
}

function renderDevTools(tools) {
    const container = document.getElementById('devtools-grid');
    
    if (tools.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No tools found</p>';
        return;
    }
    
    container.innerHTML = tools.map(tool => `
        <div class="tool-card" onclick="window.open('${escapeAttr(tool.url)}', '_blank')">
            <div class="tool-header">
                <span class="tool-name">${escapeHtml(tool.name)}</span>
                <span class="tool-category">${escapeHtml(tool.category)}</span>
            </div>
            <div class="tool-desc">${escapeHtml(tool.desc)}</div>
            <div class="tool-url">${escapeHtml(tool.url)}</div>
        </div>
    `).join('');
}

function filterTools() {
    const search = document.getElementById('tools-search').value.toLowerCase();
    const category = document.getElementById('tools-category').value;
    
    let filtered = allDevTools;
    
    if (search) {
        filtered = filtered.filter(t => 
            t.name.toLowerCase().includes(search) || 
            t.desc.toLowerCase().includes(search)
        );
    }
    
    if (category) {
        filtered = filtered.filter(t => t.category === category);
    }
    
    renderDevTools(filtered);
}

function showAddToolModal() {
    const content = `
        <div class="form-group">
            <label>Tool Name</label>
            <input type="text" id="new-tool-name" placeholder="JSON Formatter">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="new-tool-desc" placeholder="Format and validate JSON data">
        </div>
        <div class="form-group">
            <label>URL</label>
            <input type="text" id="new-tool-url" placeholder="https://example.com">
        </div>
        <div class="form-group">
            <label>Category</label>
            <select id="new-tool-category">
                <option value="Text">Text</option>
                <option value="Data">Data</option>
                <option value="Security">Security</option>
                <option value="API">API</option>
                <option value="Design">Design</option>
                <option value="DevOps">DevOps</option>
                <option value="Docs">Docs</option>
                <option value="Git">Git</option>
                <option value="Web">Web</option>
                <option value="NPM">NPM</option>
                <option value="Code">Code</option>
                <option value="AI">AI & ML</option>
                <option value="Database">Database</option>
                <option value="Testing">Testing</option>
                <option value="Hosting">Hosting</option>
                <option value="Utility">Utility</option>
            </select>
        </div>
        <button onclick="addDevTool()" class="btn-primary" style="width:100%">
            <span class="material-symbols-outlined">add</span>
            Add Tool
        </button>
    `;
    showModal('Add Developer Tool', content);
}

async function addDevTool() {
    const tool = {
        name: document.getElementById('new-tool-name').value,
        desc: document.getElementById('new-tool-desc').value,
        url: document.getElementById('new-tool-url').value,
        category: document.getElementById('new-tool-category').value
    };
    
    if (!tool.name || !tool.url) {
        showToast('Name and URL are required', 'error');
        return;
    }
    
    try {
        await apiFetch('/api/devtools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool })
        });
        closeModal();
        loadDevTools();
        showToast('Tool added', 'success');
    } catch (err) {
        showToast('Failed to add tool', 'error');
    }
}

// ================== TEAM MANAGEMENT ==================

async function loadTeam() {
    try {
        const res = await apiFetch('/api/team');
        const data = await res.json();
        
        const container = document.getElementById('team-members');
        
        if (!data.members || data.members.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No team members. Click "Add Member" to add a GitHub user.</p>';
            return;
        }
        
        container.innerHTML = data.members.map(member => `
            <div class="team-member-card">
                <div class="member-header">
                    <img src="${escapeAttr(member.avatar)}" alt="" class="member-avatar">
                    <div class="member-info">
                        <h4>${escapeHtml(member.displayName)}</h4>
                        <span class="member-username">@${escapeHtml(member.username)}</span>
                    </div>
                </div>
                <div class="member-bio">${escapeHtml(member.bio || 'No bio')}</div>
                <div class="member-stats">
                    <div class="stat">
                        <span>${member.repos?.length || 0}</span>
                        <label>Repos</label>
                    </div>
                    <div class="stat">
                        <span>${member.hostedRepos?.length || 0}</span>
                        <label>Hosted</label>
                    </div>
                    <div class="stat">
                        <span>${member.visible ? '✓' : '✗'}</span>
                        <label>Visible</label>
                    </div>
                </div>
                <div class="member-actions">
                    <button onclick="editMember('${escapeAttr(member.username)}')" class="btn-secondary">
                        <span class="material-symbols-outlined">edit</span>
                        Edit
                    </button>
                    <button onclick="viewMemberPage('${escapeAttr(member.username)}')" class="btn-secondary">
                        <span class="material-symbols-outlined">visibility</span>
                        Preview
                    </button>
                    <button onclick="removeMember('${escapeAttr(member.username)}')" class="btn-danger">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load team:', err);
    }
}

function showAddMemberModal() {
    const content = `
        <div class="form-group">
            <label>GitHub Username</label>
            <input type="text" id="new-member-github" placeholder="NagusameCS">
        </div>
        <p class="hint">The user's profile, bio, and repositories will be fetched from GitHub automatically.</p>
        <button onclick="addTeamMember()" class="btn-primary" style="width:100%">
            <span class="material-symbols-outlined">person_add</span>
            Add Team Member
        </button>
    `;
    showModal('Add Team Member', content);
}

async function addTeamMember() {
    const githubUsername = document.getElementById('new-member-github').value;
    
    if (!githubUsername) {
        showToast('GitHub username is required', 'error');
        return;
    }
    
    try {
        const res = await apiFetch('/api/team/member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ githubUsername })
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error);
        }
        
        closeModal();
        loadTeam();
        showToast('Team member added', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function editMember(username) {
    try {
        const res = await apiFetch('/api/team');
        const data = await res.json();
        const member = data.members.find(m => m.username === username);
        
        if (!member) return;
        
        // Artist backgrounds list
        const artistBackgrounds = [
            { key: '', name: 'None (Default)', description: 'Simple tessellation pattern' },
            { key: 'escher', name: 'M.C. Escher', description: 'Impossible geometry and infinite tessellations' },
            { key: 'vangogh', name: 'Vincent van Gogh', description: 'Swirling starry night brushstrokes' },
            { key: 'mondrian', name: 'Piet Mondrian', description: 'Bold primary colors and geometric grids' },
            { key: 'kandinsky', name: 'Wassily Kandinsky', description: 'Abstract circles, lines, and geometric harmony' },
            { key: 'pollock', name: 'Jackson Pollock', description: 'Energetic drip and splatter expressionism' },
            { key: 'hokusai', name: 'Katsushika Hokusai', description: 'The Great Wave Japanese woodblock style' },
            { key: 'klimt', name: 'Gustav Klimt', description: 'Opulent gold patterns and Art Nouveau elegance' },
            { key: 'haring', name: 'Keith Haring', description: 'Bold pop art with dancing figures' },
            { key: 'monet', name: 'Claude Monet', description: 'Soft impressionist water lilies and reflections' },
            { key: 'dali', name: 'Salvador Dalí', description: 'Surrealist melting clocks and dreamscapes' }
        ];
        
        const bgOptions = artistBackgrounds.map(bg => 
            `<option value="${bg.key}" ${member.artistBackground === bg.key ? 'selected' : ''} title="${escapeAttr(bg.description)}">${bg.name}</option>`
        ).join('');
        
        const content = `
            <div class="form-group">
                <label>Display Name</label>
                <input type="text" id="edit-member-name" value="${escapeAttr(member.displayName)}">
            </div>
            <div class="form-group">
                <label>Bio</label>
                <textarea id="edit-member-bio" rows="3">${escapeHtml(member.bio || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Visible on Homepage</label>
                <select id="edit-member-visible">
                    <option value="true" ${member.visible ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!member.visible ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="form-group">
                <label>Artist Background</label>
                <div style="display:flex;gap:0.5rem;align-items:center;">
                    <select id="edit-member-artist-bg" style="flex:1">
                        ${bgOptions}
                    </select>
                    <button type="button" onclick="previewArtistBackground()" class="btn-secondary" style="padding:0.5rem 1rem;white-space:nowrap;">
                        <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:middle;">visibility</span>
                        Preview
                    </button>
                </div>
                <p class="hint" id="bg-description" style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted)">
                    ${artistBackgrounds.find(b => b.key === (member.artistBackground || ''))?.description || 'Select an artist to see their signature style'}
                </p>
            </div>
            <div class="form-group">
                <label>Page Theme</label>
                <div class="form-row">
                    <div class="color-input">
                        <label>Accent Color</label>
                        <input type="color" id="edit-member-theme-primary" value="${member.theme?.primary || '#22c55e'}">
                    </div>
                    <div class="color-input">
                        <label>Background</label>
                        <input type="color" id="edit-member-theme-bg" value="${member.theme?.background || '#000000'}">
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Socials</label>
                <div class="form-row">
                    <input type="text" id="edit-member-twitter" placeholder="Twitter username" value="${escapeAttr(member.socials?.twitter || '')}">
                    <input type="text" id="edit-member-discord" placeholder="Discord username" value="${escapeAttr(member.socials?.discord || '')}">
                </div>
                <input type="text" id="edit-member-website" placeholder="Website URL" style="margin-top:0.5rem" value="${escapeAttr(member.socials?.website || '')}">
            </div>
            <div class="form-group">
                <label>NPM Username</label>
                <input type="text" id="edit-member-npm" placeholder="npm username for package stats" value="${escapeAttr(member.npmUsername || '')}">
            </div>
            <div class="form-group">
                <label>Hosted Repos (comma-separated)</label>
                <input type="text" id="edit-member-hosted" placeholder="repo1, repo2" value="${escapeAttr((member.hostedRepos || []).join(', '))}">
            </div>
            <div class="form-group">
                <label>Featured Repos (for homepage)</label>
                <div id="featured-repos-list" class="checkbox-list">
                    ${(member.repos || []).slice(0, 20).map(r => `
                        <label class="checkbox-item">
                            <input type="checkbox" name="featured-repo" value="${escapeAttr(r.name)}" 
                                ${(member.featuredRepos || []).includes(r.name) ? 'checked' : ''}>
                            <span>${escapeHtml(r.name)}</span>
                            ${r.stars ? `<span class="stars">⭐ ${r.stars}</span>` : ''}
                        </label>
                    `).join('')}
                </div>
                <p class="hint" style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted)">
                    Select repos to appear in the homepage "Featured Projects" section
                </p>
            </div>
            <button onclick="saveMember('${escapeAttr(username)}')" class="btn-primary" style="width:100%">
                <span class="material-symbols-outlined">save</span>
                Save Changes
            </button>
        `;
        showModal(`Edit ${member.displayName}`, content);
        
        // Add change listener for description
        document.getElementById('edit-member-artist-bg').addEventListener('change', (e) => {
            const selected = artistBackgrounds.find(b => b.key === e.target.value);
            document.getElementById('bg-description').textContent = selected?.description || '';
        });
    } catch (err) {
        showToast('Failed to load member', 'error');
    }
}

async function saveMember(username) {
    const hostedInput = document.getElementById('edit-member-hosted').value;
    const hostedRepos = hostedInput ? hostedInput.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    // Get selected featured repos
    const featuredRepos = Array.from(document.querySelectorAll('input[name="featured-repo"]:checked'))
        .map(cb => cb.value);
    
    const updates = {
        displayName: document.getElementById('edit-member-name').value,
        bio: document.getElementById('edit-member-bio').value,
        visible: document.getElementById('edit-member-visible').value === 'true',
        artistBackground: document.getElementById('edit-member-artist-bg').value || null,
        npmUsername: document.getElementById('edit-member-npm').value || null,
        featuredRepos: featuredRepos,
        theme: {
            primary: document.getElementById('edit-member-theme-primary').value,
            background: document.getElementById('edit-member-theme-bg').value
        },
        socials: {
            twitter: document.getElementById('edit-member-twitter').value,
            discord: document.getElementById('edit-member-discord').value,
            website: document.getElementById('edit-member-website').value
        },
        hostedRepos: hostedRepos
    };
    
    try {
        await fetch(api(`/api/team/member/${username}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        closeModal();
        loadTeam();
        showToast('Member updated', 'success');
    } catch (err) {
        showToast('Failed to update member', 'error');
    }
}

async function removeMember(username) {
    if (!confirm(`Remove ${username} from the team?`)) return;
    
    try {
        await fetch(api(`/api/team/member/${username}`), { method: 'DELETE' });
        loadTeam();
        showToast('Member removed', 'success');
    } catch (err) {
        showToast('Failed to remove member', 'error');
    }
}

function viewMemberPage(username) {
    window.open(`https://opencs.dev/${username}`, '_blank');
}

function previewArtistBackground() {
    const selected = document.getElementById('edit-member-artist-bg').value;
    if (!selected) {
        showToast('Select a background to preview', 'warning');
        return;
    }
    window.open(`https://opencs.dev/preview-bg.html?bg=${selected}`, '_blank', 'width=1200,height=800');
}

// ================== CONTACTS MANAGEMENT ==================

async function loadContacts() {
    try {
        const res = await apiFetch('/api/contacts');
        const contacts = await res.json();
        
        const container = document.getElementById('contacts-list');
        
        if (!contacts || contacts.length === 0) {
            container.innerHTML = `
                <div class="no-contacts">
                    <span class="material-symbols-outlined">inbox</span>
                    <p>No contact submissions yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = contacts.map(contact => {
            const date = new Date(contact.createdAt);
            const timeAgo = formatTimeAgo(date);
            
            return `
                <div class="contact-card ${contact.read ? '' : 'unread'}">
                    <div class="contact-header">
                        <div class="contact-info">
                            <h3>${escapeHtml(contact.name)}</h3>
                            <span class="email">${escapeHtml(contact.email)}</span>
                        </div>
                        <div class="contact-meta">
                            ${!contact.read ? '<span class="contact-badge">New</span>' : ''}
                            <span class="contact-time">${timeAgo}</span>
                        </div>
                    </div>
                    <div class="contact-message">${escapeHtml(contact.message)}</div>
                    <div class="contact-actions">
                        ${!contact.read ? `
                            <button class="mark-read" onclick="markContactRead('${contact.id}')">
                                <span class="material-symbols-outlined">check</span>
                                Mark Read
                            </button>
                        ` : ''}
                        <button class="delete-contact" onclick="deleteContact('${contact.id}')">
                            <span class="material-symbols-outlined">delete</span>
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load contacts:', err);
        showToast('Failed to load contacts', 'error');
    }
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

async function markContactRead(id) {
    try {
        await apiFetch(`/api/contacts/${id}/read`, { method: 'PUT' });
        loadContacts();
        showToast('Marked as read', 'success');
    } catch (err) {
        showToast('Failed to update contact', 'error');
    }
}

async function deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    
    try {
        await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' });
        loadContacts();
        showToast('Contact deleted', 'success');
    } catch (err) {
        showToast('Failed to delete contact', 'error');
    }
}

// ================== GALLERY MANAGEMENT ==================

async function loadGallery() {
    try {
        const res = await apiFetch('/api/gallery');
        const gallery = await res.json();
        
        const container = document.getElementById('gallery-items');
        
        if (!gallery.items || gallery.items.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">photo_library</span>
                    <p style="margin-top: 1rem;">No gallery items yet</p>
                    <p style="font-size: 0.9rem;">Upload images or add screenshots from your repos</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = gallery.items.map(item => `
            <div class="gallery-item">
                <span class="gallery-item-badge ${item.type || 'upload'}">${item.type || 'upload'}</span>
                <img src="${api('/api/gallery/image/' + item.filename)}" alt="${escapeAttr(item.title)}" loading="lazy">
                <div class="gallery-item-actions">
                    <button onclick="editGalleryItem('${item.id}')" title="Edit">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="danger" onclick="deleteGalleryItem('${item.id}')" title="Delete">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
                <div class="gallery-item-info">
                    <div class="gallery-item-title">${escapeHtml(item.title || 'Untitled')}</div>
                    <div class="gallery-item-desc">${escapeHtml(item.description || 'No description')}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load gallery:', err);
        showToast('Failed to load gallery', 'error');
    }
}

function showUploadToGallery() {
    showModal('Upload to Gallery', `
        <form id="gallery-upload-form" enctype="multipart/form-data">
            <div class="form-group">
                <label>Image</label>
                <input type="file" id="gallery-image" accept="image/*" required>
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="gallery-title" placeholder="Image title">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="gallery-description" placeholder="Optional description" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" id="gallery-tags" placeholder="project, screenshot, demo">
            </div>
            <button type="submit" class="btn-primary" style="width:100%;">
                <span class="material-symbols-outlined">upload</span>
                Upload
            </button>
        </form>
    `);
    
    document.getElementById('gallery-upload-form').onsubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('image', document.getElementById('gallery-image').files[0]);
        formData.append('title', document.getElementById('gallery-title').value);
        formData.append('description', document.getElementById('gallery-description').value);
        formData.append('tags', JSON.stringify(document.getElementById('gallery-tags').value.split(',').map(t => t.trim()).filter(Boolean)));
        formData.append('type', 'upload');
        
        try {
            await apiFetch('/api/gallery', {
                method: 'POST',
                body: formData
            });
            closeModal();
            loadGallery();
            showToast('Image uploaded', 'success');
        } catch (err) {
            showToast('Failed to upload image', 'error');
        }
    };
}

async function showAddRepoToGallery() {
    showModal('Add from Repositories', `
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Select repositories to capture screenshots for the gallery:</p>
        <div id="repos-select-container" class="repos-select-grid">
            <p style="color: var(--text-secondary);">Loading repositories...</p>
        </div>
        <div style="margin-top: 1.5rem;">
            <button onclick="addSelectedReposToGallery()" class="btn-primary" style="width:100%;">
                <span class="material-symbols-outlined">add_photo_alternate</span>
                Add Selected
            </button>
        </div>
    `);
    
    // Load user's repos
    try {
        const teamRes = await apiFetch('/api/team');
        const teamData = await teamRes.json();
        
        let allRepos = [];
        
        // Fetch repos from team members
        for (const member of teamData.members || []) {
            if (member.username) {
                try {
                    const ghRes = await fetch(`https://api.github.com/users/${member.username}/repos?sort=updated&per_page=10`);
                    const repos = await ghRes.json();
                    if (Array.isArray(repos)) {
                        repos.forEach(r => {
                            if (!allRepos.find(er => er.full_name === r.full_name)) {
                                allRepos.push({
                                    name: r.name,
                                    full_name: r.full_name,
                                    description: r.description,
                                    owner: member.username,
                                    homepage: r.homepage
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.log('Failed to fetch repos for', member.username);
                }
            }
        }
        
        const container = document.getElementById('repos-select-container');
        
        if (allRepos.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No repositories found</p>';
            return;
        }
        
        container.innerHTML = allRepos.map(repo => `
            <label class="repo-select-card">
                <input type="checkbox" value="${escapeAttr(repo.full_name)}" data-homepage="${escapeAttr(repo.homepage || '')}">
                <div class="repo-select-info">
                    <div class="repo-select-name">${escapeHtml(repo.name)}</div>
                    <div class="repo-select-desc">${escapeHtml(repo.description || 'No description')}</div>
                </div>
            </label>
        `).join('');
    } catch (err) {
        console.error('Failed to load repos:', err);
    }
}

async function addSelectedReposToGallery() {
    const selected = document.querySelectorAll('#repos-select-container input:checked');
    
    if (selected.length === 0) {
        showToast('Select at least one repository', 'warning');
        return;
    }
    
    // For each selected repo, prompt for screenshot URL or use placeholder
    for (const input of selected) {
        const fullName = input.value;
        const homepage = input.dataset.homepage;
        const name = fullName.split('/')[1];
        
        // Create a placeholder entry - user can upload actual screenshot later
        const formData = new FormData();
        
        // Create a simple placeholder image
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 800, 450);
        gradient.addColorStop(0, '#1a1a25');
        gradient.addColorStop(1, '#12121a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 450);
        
        // Text
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name, 400, 200);
        ctx.fillStyle = '#888';
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText('github.com/' + fullName, 400, 240);
        ctx.fillText(homepage || 'No live demo', 400, 270);
        
        // Convert to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        formData.append('image', blob, `${name}-placeholder.png`);
        formData.append('title', name);
        formData.append('description', `Repository: ${fullName}${homepage ? ' | Demo: ' + homepage : ''}`);
        formData.append('tags', JSON.stringify(['repo', 'github']));
        formData.append('type', 'repo');
        
        try {
            await apiFetch('/api/gallery', {
                method: 'POST',
                body: formData
            });
        } catch (err) {
            console.error('Failed to add repo to gallery:', err);
        }
    }
    
    closeModal();
    loadGallery();
    showToast(`Added ${selected.length} repo(s) to gallery`, 'success');
}

async function editGalleryItem(id) {
    try {
        const res = await apiFetch('/api/gallery');
        const gallery = await res.json();
        const item = gallery.items.find(i => i.id === id);
        
        if (!item) return;
        
        showModal('Edit Gallery Item', `
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="edit-gallery-title" value="${escapeAttr(item.title || '')}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="edit-gallery-description" rows="3">${escapeHtml(item.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" id="edit-gallery-tags" value="${escapeAttr((item.tags || []).join(', '))}">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="edit-gallery-visible" ${item.visible !== false ? 'checked' : ''}>
                    Visible on public gallery
                </label>
            </div>
            <button onclick="saveGalleryItem('${id}')" class="btn-primary" style="width:100%;">
                <span class="material-symbols-outlined">save</span>
                Save Changes
            </button>
        `);
    } catch (err) {
        showToast('Failed to load item', 'error');
    }
}

async function saveGalleryItem(id) {
    const data = {
        title: document.getElementById('edit-gallery-title').value,
        description: document.getElementById('edit-gallery-description').value,
        tags: document.getElementById('edit-gallery-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        visible: document.getElementById('edit-gallery-visible').checked
    };
    
    try {
        await apiFetch(`/api/gallery/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        closeModal();
        loadGallery();
        showToast('Gallery item updated', 'success');
    } catch (err) {
        showToast('Failed to update item', 'error');
    }
}

async function deleteGalleryItem(id) {
    if (!confirm('Delete this gallery item?')) return;
    
    try {
        await apiFetch(`/api/gallery/${id}`, { method: 'DELETE' });
        loadGallery();
        showToast('Item deleted', 'success');
    } catch (err) {
        showToast('Failed to delete item', 'error');
    }
}

// ================== PAGE EDITOR ==================

let editModeActive = false;
let pageEdits = {};
let currentEditPage = '';

async function loadPageEditor() {
    // Load team members for their page cards
    try {
        const res = await apiFetch('/api/team');
        const data = await res.json();
        
        const teamCardsContainer = document.getElementById('team-page-cards');
        if (data.members && data.members.length > 0) {
            teamCardsContainer.innerHTML = data.members.map(m => `
                <div class="page-card" onclick="loadPageForEditing('/member/${m.username}')">
                    <img src="${m.avatar}" style="width:40px;height:40px;border-radius:50%;" alt="${m.username}">
                    <span>${m.username}</span>
                </div>
            `).join('');
        } else {
            teamCardsContainer.innerHTML = '<p style="color:var(--text-secondary);grid-column:1/-1;">No team members</p>';
        }
    } catch (err) {
        console.error('Failed to load team for page editor:', err);
    }
}

function loadPageForEditing(pagePath) {
    currentEditPage = pagePath;
    pageEdits = {};
    editModeActive = false;
    
    document.querySelector('.editor-page-selector').style.display = 'none';
    document.getElementById('editor-frame-container').style.display = 'flex';
    document.getElementById('editor-actions').style.display = 'flex';
    document.getElementById('editor-page-name').textContent = pagePath;
    document.getElementById('edit-mode-toggle').innerHTML = '<span class="material-symbols-outlined">edit</span> Enable Edit Mode';
    document.getElementById('save-edits-btn').disabled = true;
    document.getElementById('edit-hint').style.display = 'none';
    
    const iframe = document.getElementById('page-editor-iframe');
    iframe.src = pagePath;
    
    iframe.onload = () => {
        try {
            // Inject editing capabilities
            injectEditCapabilities(iframe);
        } catch (err) {
            console.error('Cannot access iframe contents (cross-origin):', err);
        }
    };
}

function injectEditCapabilities(iframe) {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Add editing styles
    const style = doc.createElement('style');
    style.textContent = `
        .editable-highlight {
            outline: 2px dashed #6366f1 !important;
            outline-offset: 2px;
            cursor: text !important;
        }
        .editable-editing {
            outline: 2px solid #22c55e !important;
            outline-offset: 2px;
            background: rgba(34, 197, 94, 0.1) !important;
        }
        .editable-modified {
            position: relative;
        }
        .editable-modified::after {
            content: '●';
            position: absolute;
            top: -5px;
            right: -5px;
            color: #f59e0b;
            font-size: 12px;
        }
    `;
    doc.head.appendChild(style);
    
    // Find editable elements
    const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, button';
    const editables = doc.querySelectorAll(editableSelectors);
    
    editables.forEach((el, index) => {
        // Skip elements that are just icons or have no text
        if (!el.textContent.trim() || el.children.length > 0 && !el.textContent.trim()) return;
        
        el.dataset.editId = `edit-${index}`;
        
        el.addEventListener('mouseenter', () => {
            if (editModeActive) {
                el.classList.add('editable-highlight');
            }
        });
        
        el.addEventListener('mouseleave', () => {
            el.classList.remove('editable-highlight');
        });
        
        el.addEventListener('click', (e) => {
            if (editModeActive) {
                e.preventDefault();
                e.stopPropagation();
                startEditing(el);
            }
        });
    });
}

function startEditing(el) {
    const doc = el.ownerDocument;
    
    // Remove any previous editing state
    doc.querySelectorAll('.editable-editing').forEach(e => {
        e.classList.remove('editable-editing');
        e.contentEditable = 'false';
    });
    
    el.classList.add('editable-editing');
    el.contentEditable = 'true';
    el.focus();
    
    // Select all text
    const selection = doc.getSelection();
    const range = doc.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    
    const originalText = el.dataset.originalText || el.textContent;
    if (!el.dataset.originalText) {
        el.dataset.originalText = originalText;
    }
    
    el.addEventListener('blur', () => {
        el.classList.remove('editable-editing');
        el.contentEditable = 'false';
        
        if (el.textContent !== el.dataset.originalText) {
            el.classList.add('editable-modified');
            pageEdits[el.dataset.editId] = {
                selector: getUniqueSelector(el),
                original: el.dataset.originalText,
                new: el.textContent,
                tagName: el.tagName.toLowerCase()
            };
            document.getElementById('save-edits-btn').disabled = false;
        }
    }, { once: true });
}

function getUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.tagName.toLowerCase();
        if (el.id) {
            selector = `#${el.id}`;
            path.unshift(selector);
            break;
        } else if (el.className) {
            selector += '.' + Array.from(el.classList).join('.');
        }
        
        let sibling = el;
        let nth = 1;
        while (sibling = sibling.previousElementSibling) {
            if (sibling.tagName === el.tagName) nth++;
        }
        if (nth > 1) selector += `:nth-of-type(${nth})`;
        
        path.unshift(selector);
        el = el.parentNode;
    }
    
    return path.join(' > ');
}

function toggleEditMode() {
    editModeActive = !editModeActive;
    
    const btn = document.getElementById('edit-mode-toggle');
    const hint = document.getElementById('edit-hint');
    
    if (editModeActive) {
        btn.innerHTML = '<span class="material-symbols-outlined">edit_off</span> Disable Edit Mode';
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
        hint.style.display = 'flex';
    } else {
        btn.innerHTML = '<span class="material-symbols-outlined">edit</span> Enable Edit Mode';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        hint.style.display = 'none';
    }
}

async function savePageEdits() {
    const editCount = Object.keys(pageEdits).length;
    if (editCount === 0) {
        showToast('No changes to save', 'warning');
        return;
    }
    
    try {
        const res = await apiFetch('/api/page-edits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                page: currentEditPage,
                edits: Object.values(pageEdits)
            })
        });
        
        if (res.ok) {
            showToast(`Saved ${editCount} edit(s)`, 'success');
            pageEdits = {};
            document.getElementById('save-edits-btn').disabled = true;
            
            // Reload the iframe to show changes
            const iframe = document.getElementById('page-editor-iframe');
            iframe.src = iframe.src;
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to save edits', 'error');
        }
    } catch (err) {
        showToast('Failed to save edits', 'error');
    }
}

function closePageEditor() {
    if (Object.keys(pageEdits).length > 0) {
        if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    
    editModeActive = false;
    pageEdits = {};
    currentEditPage = '';
    
    document.querySelector('.editor-page-selector').style.display = 'block';
    document.getElementById('editor-frame-container').style.display = 'none';
    document.getElementById('editor-actions').style.display = 'none';
    
    const iframe = document.getElementById('page-editor-iframe');
    iframe.src = 'about:blank';
}

// ================== HOMEPAGE CONFIG ==================

async function loadHomepageConfig() {
    try {
        const res = await apiFetch('/api/homepage');
        const config = await res.json();
        
        document.getElementById('homepage-title').value = config.title || '';
        document.getElementById('homepage-tagline').value = config.tagline || '';
        document.getElementById('homepage-color-primary').value = config.theme?.primary || '#22c55e';
        document.getElementById('homepage-color-primary-hex').value = config.theme?.primary || '#22c55e';
        document.getElementById('homepage-color-bg').value = config.theme?.background || '#0a0a0f';
        document.getElementById('homepage-color-bg-hex').value = config.theme?.background || '#0a0a0f';
        
        // Load team config
        const teamRes = await apiFetch('/api/team');
        const teamData = await teamRes.json();
        
        const teamConfig = document.getElementById('homepage-team-config');
        if (teamData.members && teamData.members.length > 0) {
            teamConfig.innerHTML = teamData.members.map(m => `
                <div class="team-config-row" style="display:flex;gap:1rem;align-items:center;margin-bottom:0.5rem;">
                    <img src="${escapeAttr(m.avatar)}" style="width:32px;height:32px;border-radius:50%;">
                    <span style="flex:1">${escapeHtml(m.displayName)} (@${escapeHtml(m.username)})</span>
                    <label>
                        <input type="checkbox" ${m.visible ? 'checked' : ''} onchange="toggleMemberVisibility('${escapeAttr(m.username)}', this.checked)">
                        Visible
                    </label>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load homepage config:', err);
    }
}

async function saveHomepage() {
    const config = {
        title: document.getElementById('homepage-title').value,
        tagline: document.getElementById('homepage-tagline').value,
        theme: {
            primary: document.getElementById('homepage-color-primary').value,
            background: document.getElementById('homepage-color-bg').value
        }
    };
    
    try {
        await apiFetch('/api/homepage', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        showToast('Homepage saved', 'success');
    } catch (err) {
        showToast('Failed to save homepage', 'error');
    }
}

async function toggleMemberVisibility(username, visible) {
    try {
        await fetch(api(`/api/team/member/${username}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visible })
        });
    } catch (err) {
        showToast('Failed to update visibility', 'error');
    }
}

// ================== BRANCH SELECTION ==================

async function loadBranches() {
    const url = document.getElementById('git-clone-url').value;
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    
    if (!match) {
        document.getElementById('branch-select-row').style.display = 'none';
        return;
    }
    
    const [, owner, repo] = match;
    
    try {
        const res = await fetch(api(`/api/github/repo/${owner}/${repo}/branches`));
        const branches = await res.json();
        
        const select = document.getElementById('git-clone-branch');
        select.innerHTML = branches.map(b => 
            `<option value="${escapeAttr(b.name)}" ${b.name === 'main' || b.name === 'master' ? 'selected' : ''}>${escapeHtml(b.name)}</option>`
        ).join('');
        
        document.getElementById('branch-select-row').style.display = 'flex';
    } catch (err) {
        console.error('Failed to load branches:', err);
    }
}

// Color input sync
document.addEventListener('DOMContentLoaded', () => {
    const colorInputs = [
        ['homepage-color-primary', 'homepage-color-primary-hex'],
        ['homepage-color-bg', 'homepage-color-bg-hex']
    ];
    
    colorInputs.forEach(([colorId, hexId]) => {
        const color = document.getElementById(colorId);
        const hex = document.getElementById(hexId);
        
        if (color && hex) {
            color.addEventListener('input', () => hex.value = color.value);
            hex.addEventListener('input', () => color.value = hex.value);
        }
    });
});
