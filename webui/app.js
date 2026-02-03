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
        const passkeysRes = await fetch(api('/api/passkeys/exists'));
        const passkeysData = await passkeysRes.json();
        console.log('Passkeys check:', passkeysData);
        
        const passkeyBtn = document.getElementById('passkey-login');
        if (passkeyBtn && !passkeysData.exists) {
            passkeyBtn.disabled = true;
            passkeyBtn.title = 'No passkeys registered';
        }
        
        // Check auth status
        const res = await fetch(api('/api/auth/status'));
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
            const res = await fetch(api('/api/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            if (res.ok) {
                showMainScreen();
            } else {
                document.getElementById('login-error').textContent = 'Invalid password';
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
        await fetch(api('/api/logout'), { method: 'POST' });
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
            const res = await fetch(api('/api/password/change'), {
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
        const startRes = await fetch(api('/api/passkey/login/start'), { method: 'POST' });
        
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
        const completeRes = await fetch(api('/api/passkey/login/complete'), {
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
        const startRes = await fetch(api('/api/passkey/register/start'), { method: 'POST' });
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
        const completeRes = await fetch(api('/api/passkey/register/complete'), {
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
        const res = await fetch(api('/api/passkeys'));
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
        await fetch(`/api/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
        const res = await fetch(api('/api/status'));
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
        await fetch(`/api/pm2/${action}`, {
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
        const res = await fetch(`/api/pm2/logs?name=${encodeURIComponent(name)}&lines=100`);
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
            fetch(api('/api/repos')),
            fetch(api('/api/pm2/list'))
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
        const res = await fetch(api('/api/git/pull'), {
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
            const res = await fetch(api('/api/bots/add'), {
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
        const res = await fetch(api('/api/repos'));
        const repos = await res.json();
        
        const container = document.getElementById('pages-list');
        
        if (!repos.pages || repos.pages.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No pages registered. Click "Add Page" to get started.</p>';
            return;
        }
        
        container.innerHTML = repos.pages.map(page => `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">
                        <span class="material-symbols-outlined">web</span>
                        ${escapeHtml(page.name)}
                    </span>
                    <span class="card-status deployed">deployed</span>
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
    } catch (err) {
        console.error(err);
    }
}

async function updatePage(name) {
    try {
        const reposRes = await fetch(api('/api/repos'));
        const repos = await reposRes.json();
        const page = repos.pages.find(p => p.name === name);
        
        if (!page) {
            showToast('Page not found', 'error');
            return;
        }
        
        showToast('Updating page...', 'info');
        
        // Pull updates
        await fetch(api('/api/git/pull'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: page.repo_path })
        });
        
        // Rebuild if needed
        if (page.build_cmd) {
            await fetch(api('/api/exec'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: page.build_cmd, cwd: page.repo_path })
            });
        }
        
        // Deploy
        const sourceDir = page.build_dir && page.build_dir !== '.' 
            ? `${page.repo_path}/${page.build_dir}` 
            : page.repo_path;
        
        await fetch(api('/api/exec'), {
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
            const res = await fetch(api('/api/pages/add'), {
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
            <div class="file-item" ondblclick="${file.isDirectory ? `loadFiles('${escapeAttr(file.path)}')` : `editFile('${escapeAttr(file.path)}')`}">
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
        const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
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
        const res = await fetch(api('/api/files/save'), {
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
        const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
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
    
    fetch(api('/api/files/rename'), {
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
    
    fetch(api('/api/files/mkdir'), {
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
            const res = await fetch(`/api/files/upload?path=${encodeURIComponent(currentPath)}`, {
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
        const res = await fetch(api('/api/terminal/exec'), {
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

// Git
async function gitClone() {
    const url = document.getElementById('git-clone-url').value;
    const dest = document.getElementById('git-clone-dest').value;
    
    if (!url || !dest) {
        showToast('Please provide both URL and destination', 'error');
        return;
    }
    
    try {
        showToast('Cloning repository...', 'info');
        const res = await fetch(api('/api/git/clone'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, destination: dest })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('Repository cloned successfully', 'success');
            document.getElementById('git-clone-url').value = '';
            document.getElementById('git-clone-dest').value = '';
        } else {
            showToast('Error: ' + data.error, 'error');
        }
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
        const res = await fetch(`/api/git/status?path=${encodeURIComponent(path)}`);
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
        const res = await fetch(api('/api/git/pull'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('Pull successful', 'success');
            document.getElementById('git-output').textContent = 
                `Pull successful\nFiles: ${data.result.files?.length || 0} updated`;
            gitStatus();
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Settings
async function loadWebhookSecret() {
    try {
        const res = await fetch(api('/api/webhook-secret'));
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
        const res = await fetch(api('/api/repos'));
        const repos = await res.json();
        
        let updates = [];
        
        for (const bot of repos.bots || []) {
            try {
                const statusRes = await fetch(`/api/git/status?path=${encodeURIComponent(bot.path)}`);
                const status = await statusRes.json();
                if (status.status?.behind > 0) {
                    updates.push(`${bot.name}: ${status.status.behind} commits behind`);
                }
            } catch (e) {}
        }
        
        for (const page of repos.pages || []) {
            try {
                const statusRes = await fetch(`/api/git/status?path=${encodeURIComponent(page.repo_path)}`);
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
        await fetch(api('/api/exec'), {
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
        await fetch(api('/api/exec'), {
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
    }
});
