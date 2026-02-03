require('dotenv').config();

const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const apiRouter = express.Router(); // Router for all API routes
const server = http.createServer(app);
const io = new Server(server);

// Trust proxy to get correct protocol and host
app.set('trust proxy', true);

// Middleware to redirect raw IP to domain
app.use((req, res, next) => {
    const host = req.get('host');
    if (host && host.startsWith('159.198.42.248')) {
        return res.redirect(301, 'https://opencs.dev' + req.originalUrl);
    }
    next();
});

const PORT = process.env.PORT || 3000;
const CONFIG_DIR = process.env.CONFIG_DIR || '/home/deploy/management/config';
const REPOS_FILE = path.join(CONFIG_DIR, 'repos.json');
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json');
const PASSKEYS_FILE = path.join(CONFIG_DIR, 'passkeys.enc.json');
const ENCRYPTION_KEY_FILE = path.join(CONFIG_DIR, '.encryption_key');
const SECURITY_LOG_FILE = path.join(CONFIG_DIR, 'security.json');
const KNOWN_IPS_FILE = path.join(CONFIG_DIR, 'known_ips.json');
const CLONED_REPOS_FILE = path.join(CONFIG_DIR, 'cloned_repos.json');
const TEAM_FILE = path.join(CONFIG_DIR, 'team.json');
const HOMEPAGE_FILE = path.join(CONFIG_DIR, 'homepage.json');
const DEV_TOOLS_FILE = path.join(CONFIG_DIR, 'devtools.json');
const GALLERY_FILE = path.join(CONFIG_DIR, 'gallery.json');
const GALLERY_DIR = path.join(CONFIG_DIR, 'gallery');
const CONTACTS_FILE = path.join(CONFIG_DIR, 'contacts.json');
const VALENTIN_SUBMISSIONS_FILE = path.join(CONFIG_DIR, 'valentin_submissions.json');
const VALENTIN_MATCHES_FILE = path.join(CONFIG_DIR, 'valentin_matches.json');
const VALENTIN_SETTINGS_FILE = path.join(CONFIG_DIR, 'valentin_settings.json');

// Ensure gallery directory exists
if (!fs.existsSync(GALLERY_DIR)) {
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
}

// Multer config for gallery uploads
const galleryStorage = multer.diskStorage({
    destination: GALLERY_DIR,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
});
const galleryUpload = multer({ storage: galleryStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// GitHub OAuth config (create app at https://github.com/settings/developers)
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_OAUTH_CALLBACK = process.env.GITHUB_OAUTH_CALLBACK || 'https://opencs.dev/portal/api/auth/github/callback';

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

// ============ ENCRYPTION HELPERS ============

// Get or create encryption key (stored separately, should be backed up securely)
function getEncryptionKey() {
    if (!fs.existsSync(ENCRYPTION_KEY_FILE)) {
        const key = crypto.randomBytes(32);
        fs.writeFileSync(ENCRYPTION_KEY_FILE, key.toString('hex'), { mode: 0o600 });
        return key;
    }
    return Buffer.from(fs.readFileSync(ENCRYPTION_KEY_FILE, 'utf8'), 'hex');
}

const ENCRYPTION_KEY = getEncryptionKey();

function encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted
    };
}

function decrypt(encryptedObj) {
    try {
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            ENCRYPTION_KEY,
            Buffer.from(encryptedObj.iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
        let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (err) {
        console.error('Decryption failed:', err.message);
        return null;
    }
}

// Secure passkey storage functions
function readPasskeys() {
    if (!fs.existsSync(PASSKEYS_FILE)) {
        return { passkeys: [] };
    }
    try {
        const encryptedData = JSON.parse(fs.readFileSync(PASSKEYS_FILE, 'utf8'));
        if (encryptedData.iv && encryptedData.authTag && encryptedData.data) {
            return decrypt(encryptedData) || { passkeys: [] };
        }
        // Handle legacy unencrypted data - migrate it
        return encryptedData;
    } catch (err) {
        console.error('Failed to read passkeys:', err.message);
        return { passkeys: [] };
    }
}

function writePasskeys(data) {
    const encrypted = encrypt(data);
    fs.writeFileSync(PASSKEYS_FILE, JSON.stringify(encrypted), { mode: 0o600 });
}

// ============ SECURITY LOGGING ============

function getSecurityLog() {
    if (fs.existsSync(SECURITY_LOG_FILE)) {
        return JSON.parse(fs.readFileSync(SECURITY_LOG_FILE, 'utf8'));
    }
    return { attempts: [], lockedIPs: {} };
}

function saveSecurityLog(log) {
    fs.writeFileSync(SECURITY_LOG_FILE, JSON.stringify(log, null, 2), { mode: 0o600 });
}

function getKnownIPs() {
    if (fs.existsSync(KNOWN_IPS_FILE)) {
        return JSON.parse(fs.readFileSync(KNOWN_IPS_FILE, 'utf8'));
    }
    return { ips: [], pendingVerification: {} };
}

function saveKnownIPs(data) {
    fs.writeFileSync(KNOWN_IPS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// Simple IP geolocation using ip-api.com (free, no key needed)
async function getIPLocation(ip) {
    // Skip for local/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return { city: 'Local', region: '', country: 'Network', isp: 'Local' };
    }
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country,isp`);
        if (response.ok) {
            const data = await response.json();
            return { city: data.city || '', region: data.regionName || '', country: data.country || '', isp: data.isp || '' };
        }
    } catch (e) {
        // Ignore geolocation errors
    }
    return null;
}

async function logSecurityEvent(type, ip, details = {}) {
    const log = getSecurityLog();
    
    // Get location for login events
    let location = null;
    if (type.includes('login') || type.includes('auth')) {
        location = await getIPLocation(ip);
    }
    
    log.attempts.push({
        type,
        ip,
        timestamp: new Date().toISOString(),
        userAgent: details.userAgent || 'unknown',
        location,
        ...details
    });
    // Keep last 100 entries only
    if (log.attempts.length > 100) {
        log.attempts = log.attempts.slice(-100);
    }
    saveSecurityLog(log);
}

function isIPLocked(ip) {
    const log = getSecurityLog();
    const lockInfo = log.lockedIPs[ip];
    if (lockInfo) {
        if (new Date(lockInfo.until) > new Date()) {
            return true;
        } else {
            delete log.lockedIPs[ip];
            saveSecurityLog(log);
        }
    }
    return false;
}

function lockIP(ip, minutes = 30) {
    const log = getSecurityLog();
    log.lockedIPs[ip] = {
        until: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
        reason: 'Failed GitHub verification'
    };
    saveSecurityLog(log);
}

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress;
}

// ============ CLONED REPOS MANAGEMENT ============

function getClonedRepos() {
    if (fs.existsSync(CLONED_REPOS_FILE)) {
        return JSON.parse(fs.readFileSync(CLONED_REPOS_FILE, 'utf8'));
    }
    return { repos: [] };
}

function saveClonedRepos(data) {
    fs.writeFileSync(CLONED_REPOS_FILE, JSON.stringify(data, null, 2));
}

function addClonedRepo(repoData) {
    const data = getClonedRepos();
    const existing = data.repos.find(r => r.path === repoData.path);
    if (existing) {
        Object.assign(existing, repoData, { updatedAt: new Date().toISOString() });
    } else {
        data.repos.push({
            ...repoData,
            clonedAt: new Date().toISOString(),
            lastChecked: new Date().toISOString()
        });
    }
    saveClonedRepos(data);
}

// Auto-update repos every 12 hours
setInterval(async () => {
    const data = getClonedRepos();
    for (const repo of data.repos) {
        if (repo.autoUpdate !== false) {
            exec(`cd "${repo.path}" && git pull origin ${repo.branch || 'main'}`, (err, stdout) => {
                if (!err) {
                    repo.lastUpdated = new Date().toISOString();
                    repo.lastChecked = new Date().toISOString();
                    saveClonedRepos(data);
                }
            });
        }
    }
}, 12 * 60 * 60 * 1000); // 12 hours

// ============ TEAM MANAGEMENT ============

function getTeam() {
    if (fs.existsSync(TEAM_FILE)) {
        return JSON.parse(fs.readFileSync(TEAM_FILE, 'utf8'));
    }
    return { members: [] };
}

function saveTeam(data) {
    fs.writeFileSync(TEAM_FILE, JSON.stringify(data, null, 2));
}

// ============ HOMEPAGE CONFIG ============

function getHomepageConfig() {
    if (fs.existsSync(HOMEPAGE_FILE)) {
        return JSON.parse(fs.readFileSync(HOMEPAGE_FILE, 'utf8'));
    }
    return {
        title: 'OpenCS',
        tagline: 'Open-source tools by the community',
        theme: { primary: '#22c55e', background: '#0a0a0f' }
    };
}

function saveHomepageConfig(config) {
    fs.writeFileSync(HOMEPAGE_FILE, JSON.stringify(config, null, 2));
}

// ============ DEVELOPER TOOLS ============

function getDevTools() {
    if (fs.existsSync(DEV_TOOLS_FILE)) {
        return JSON.parse(fs.readFileSync(DEV_TOOLS_FILE, 'utf8'));
    }
    // Default developer tools catalog - comprehensive list
    return { tools: [
        // Text Tools
        { id: 'regex', name: 'Regex Tester', desc: 'Test and debug regular expressions', category: 'Text', url: 'https://regex101.com' },
        { id: 'diff', name: 'Diff Checker', desc: 'Compare text differences', category: 'Text', url: 'https://www.diffchecker.com' },
        { id: 'lorem', name: 'Lorem Ipsum', desc: 'Generate placeholder text', category: 'Text', url: 'https://loremipsum.io' },
        { id: 'texttools', name: 'Text Tools', desc: 'Case converter, word counter, etc', category: 'Text', url: 'https://texttools.org' },
        { id: 'markdown', name: 'Markdown Editor', desc: 'Live markdown preview editor', category: 'Text', url: 'https://stackedit.io' },
        
        // Data Tools
        { id: 'json', name: 'JSON Formatter', desc: 'Format and validate JSON data', category: 'Data', url: 'https://jsonformatter.org' },
        { id: 'base64', name: 'Base64 Encoder', desc: 'Encode/decode base64 strings', category: 'Data', url: 'https://www.base64encode.org' },
        { id: 'uuid', name: 'UUID Generator', desc: 'Generate random UUIDs', category: 'Data', url: 'https://www.uuidgenerator.net' },
        { id: 'timestamp', name: 'Unix Timestamp', desc: 'Convert Unix timestamps', category: 'Data', url: 'https://www.unixtimestamp.com' },
        { id: 'yaml', name: 'YAML Validator', desc: 'Validate and format YAML', category: 'Data', url: 'https://yamlvalidator.com' },
        { id: 'csv', name: 'CSV Editor', desc: 'Edit and convert CSV files', category: 'Data', url: 'https://www.convertcsv.com/csv-viewer-editor.htm' },
        { id: 'sql', name: 'SQL Formatter', desc: 'Format SQL queries', category: 'Data', url: 'https://sqlformat.org' },
        
        // Security Tools
        { id: 'jwt', name: 'JWT Decoder', desc: 'Decode and verify JWT tokens', category: 'Security', url: 'https://jwt.io' },
        { id: 'hash', name: 'Hash Generator', desc: 'Generate MD5/SHA hashes', category: 'Security', url: 'https://emn178.github.io/online-tools/sha256.html' },
        { id: 'ssl', name: 'SSL Checker', desc: 'Verify SSL certificates', category: 'Security', url: 'https://www.sslshopper.com/ssl-checker.html' },
        { id: 'password', name: 'Password Generator', desc: 'Generate secure passwords', category: 'Security', url: 'https://passwordsgenerator.net' },
        { id: 'cors', name: 'CORS Tester', desc: 'Test CORS configuration', category: 'Security', url: 'https://cors-test.codehappy.dev' },
        { id: 'csp', name: 'CSP Evaluator', desc: 'Evaluate Content Security Policy', category: 'Security', url: 'https://csp-evaluator.withgoogle.com' },
        
        // API Tools
        { id: 'curl', name: 'cURL Converter', desc: 'Convert cURL to code', category: 'API', url: 'https://curlconverter.com' },
        { id: 'postman', name: 'Postman', desc: 'API testing platform', category: 'API', url: 'https://www.postman.com' },
        { id: 'httpbin', name: 'HTTPBin', desc: 'HTTP request testing service', category: 'API', url: 'https://httpbin.org' },
        { id: 'reqbin', name: 'ReqBin', desc: 'Online REST & SOAP API testing', category: 'API', url: 'https://reqbin.com' },
        { id: 'swagger', name: 'Swagger Editor', desc: 'Design OpenAPI specs', category: 'API', url: 'https://editor.swagger.io' },
        { id: 'webhook', name: 'Webhook.site', desc: 'Test webhooks and HTTP requests', category: 'API', url: 'https://webhook.site' },
        { id: 'graphql', name: 'GraphQL Playground', desc: 'Interactive GraphQL IDE', category: 'API', url: 'https://www.graphqlbin.com' },
        
        // Design Tools
        { id: 'colors', name: 'Color Picker', desc: 'Pick and convert colors', category: 'Design', url: 'https://coolors.co' },
        { id: 'carbon', name: 'Carbon', desc: 'Create beautiful code images', category: 'Design', url: 'https://carbon.now.sh' },
        { id: 'excalidraw', name: 'Excalidraw', desc: 'Virtual whiteboard for diagrams', category: 'Design', url: 'https://excalidraw.com' },
        { id: 'figma', name: 'Figma', desc: 'Collaborative design tool', category: 'Design', url: 'https://www.figma.com' },
        { id: 'contrast', name: 'Contrast Checker', desc: 'Check color contrast accessibility', category: 'Design', url: 'https://webaim.org/resources/contrastchecker' },
        { id: 'fontpair', name: 'Font Pair', desc: 'Google font pairing suggestions', category: 'Design', url: 'https://www.fontpair.co' },
        { id: 'svgomg', name: 'SVGOMG', desc: 'SVG optimizer', category: 'Design', url: 'https://svgomg.net' },
        { id: 'squoosh', name: 'Squoosh', desc: 'Image compression tool', category: 'Design', url: 'https://squoosh.app' },
        
        // DevOps Tools
        { id: 'cron', name: 'Cron Expression', desc: 'Generate and explain cron expressions', category: 'DevOps', url: 'https://crontab.guru' },
        { id: 'ngrok', name: 'ngrok', desc: 'Expose local servers publicly', category: 'DevOps', url: 'https://ngrok.com' },
        { id: 'dns', name: 'DNS Checker', desc: 'Check DNS propagation', category: 'DevOps', url: 'https://dnschecker.org' },
        { id: 'headers', name: 'HTTP Headers', desc: 'Analyze HTTP response headers', category: 'DevOps', url: 'https://securityheaders.com' },
        { id: 'uptime', name: 'UptimeRobot', desc: 'Website monitoring service', category: 'DevOps', url: 'https://uptimerobot.com' },
        { id: 'pagespeed', name: 'PageSpeed Insights', desc: 'Analyze web performance', category: 'DevOps', url: 'https://pagespeed.web.dev' },
        { id: 'gtmetrix', name: 'GTmetrix', desc: 'Website speed analysis', category: 'DevOps', url: 'https://gtmetrix.com' },
        
        // Docs & References
        { id: 'devdocs', name: 'DevDocs', desc: 'Fast offline documentation', category: 'Docs', url: 'https://devdocs.io' },
        { id: 'readme', name: 'readme.so', desc: 'Easy README generator', category: 'Docs', url: 'https://readme.so' },
        { id: 'mdn', name: 'MDN Web Docs', desc: 'Web technology documentation', category: 'Docs', url: 'https://developer.mozilla.org' },
        { id: 'cheatsheets', name: 'Cheatsheets', desc: 'Programming cheat sheets', category: 'Docs', url: 'https://quickref.me' },
        { id: 'tldr', name: 'tldr pages', desc: 'Simplified man pages', category: 'Docs', url: 'https://tldr.sh' },
        
        // Git Tools
        { id: 'gitignore', name: 'gitignore.io', desc: 'Generate .gitignore files', category: 'Git', url: 'https://gitignore.io' },
        { id: 'gitmoji', name: 'Gitmoji', desc: 'Emoji guide for commit messages', category: 'Git', url: 'https://gitmoji.dev' },
        { id: 'gitexplorer', name: 'Git Explorer', desc: 'Find the right git commands', category: 'Git', url: 'https://gitexplorer.com' },
        { id: 'conventional', name: 'Conventional Commits', desc: 'Commit message convention', category: 'Git', url: 'https://www.conventionalcommits.org' },
        { id: 'linehook', name: 'Linehook', desc: 'Git hooks management tool', category: 'Git', url: 'https://github.com/nicholasgalante1997/linehook' },
        
        // Web Tools
        { id: 'caniuse', name: 'Can I Use', desc: 'Browser compatibility tables', category: 'Web', url: 'https://caniuse.com' },
        { id: 'validator', name: 'W3C Validator', desc: 'Validate HTML markup', category: 'Web', url: 'https://validator.w3.org' },
        { id: 'cssminify', name: 'CSS Minifier', desc: 'Minify CSS code', category: 'Web', url: 'https://cssminifier.com' },
        { id: 'autoprefixer', name: 'Autoprefixer', desc: 'Add vendor prefixes to CSS', category: 'Web', url: 'https://autoprefixer.github.io' },
        { id: 'responsive', name: 'Responsively', desc: 'Test responsive designs', category: 'Web', url: 'https://responsively.app' },
        { id: 'metatags', name: 'Meta Tags', desc: 'Preview social media cards', category: 'Web', url: 'https://metatags.io' },
        
        // NPM Tools
        { id: 'bundlephobia', name: 'Bundlephobia', desc: 'Analyze npm package sizes', category: 'NPM', url: 'https://bundlephobia.com' },
        { id: 'npms', name: 'npms.io', desc: 'Search npm packages by quality', category: 'NPM', url: 'https://npms.io' },
        { id: 'npm-trends', name: 'npm trends', desc: 'Compare npm download trends', category: 'NPM', url: 'https://npmtrends.com' },
        { id: 'socket', name: 'Socket.dev', desc: 'Detect npm supply chain risks', category: 'NPM', url: 'https://socket.dev' },
        
        // Code Tools
        { id: 'playground', name: 'TypeScript Playground', desc: 'Test TypeScript code', category: 'Code', url: 'https://www.typescriptlang.org/play' },
        { id: 'codesandbox', name: 'CodeSandbox', desc: 'Online code editor', category: 'Code', url: 'https://codesandbox.io' },
        { id: 'stackblitz', name: 'StackBlitz', desc: 'Full-stack web IDE', category: 'Code', url: 'https://stackblitz.com' },
        { id: 'replit', name: 'Replit', desc: 'Online coding environment', category: 'Code', url: 'https://replit.com' },
        { id: 'prettier', name: 'Prettier Playground', desc: 'Format code online', category: 'Code', url: 'https://prettier.io/playground' },
        { id: 'ast', name: 'AST Explorer', desc: 'Explore code AST', category: 'Code', url: 'https://astexplorer.net' },
        { id: 'goplay', name: 'Go Playground', desc: 'Run Go code online', category: 'Code', url: 'https://go.dev/play/' },
        { id: 'rustplay', name: 'Rust Playground', desc: 'Run Rust code online', category: 'Code', url: 'https://play.rust-lang.org/' },
        { id: 'pytutor', name: 'Python Tutor', desc: 'Visualize code execution', category: 'Code', url: 'https://pythontutor.com/' },
        
        // AI & ML Tools
        { id: 'huggingface', name: 'Hugging Face', desc: 'ML models and datasets', category: 'AI', url: 'https://huggingface.co' },
        { id: 'replicate', name: 'Replicate', desc: 'Run ML models via API', category: 'AI', url: 'https://replicate.com' },
        { id: 'openai', name: 'OpenAI Playground', desc: 'Test GPT models', category: 'AI', url: 'https://platform.openai.com/playground' },
        { id: 'gradio', name: 'Gradio', desc: 'Build ML demos quickly', category: 'AI', url: 'https://www.gradio.app' },
        { id: 'tensorflow', name: 'TensorFlow Playground', desc: 'Neural network visualizer', category: 'AI', url: 'https://playground.tensorflow.org' },
        
        // Database Tools
        { id: 'dbdiagram', name: 'dbdiagram.io', desc: 'Database diagram designer', category: 'Database', url: 'https://dbdiagram.io' },
        { id: 'sqlfiddle', name: 'SQL Fiddle', desc: 'Test SQL queries online', category: 'Database', url: 'http://sqlfiddle.com' },
        { id: 'planetscale', name: 'PlanetScale', desc: 'Serverless MySQL platform', category: 'Database', url: 'https://planetscale.com' },
        { id: 'supabase', name: 'Supabase', desc: 'Open source Firebase alternative', category: 'Database', url: 'https://supabase.com' },
        { id: 'neon', name: 'Neon', desc: 'Serverless Postgres', category: 'Database', url: 'https://neon.tech' },
        
        // Testing Tools
        { id: 'playwright', name: 'Playwright', desc: 'End-to-end testing', category: 'Testing', url: 'https://playwright.dev' },
        { id: 'cypress', name: 'Cypress', desc: 'JavaScript testing framework', category: 'Testing', url: 'https://www.cypress.io' },
        { id: 'mockaroo', name: 'Mockaroo', desc: 'Generate test data', category: 'Testing', url: 'https://mockaroo.com' },
        { id: 'faker', name: 'Faker.js', desc: 'Generate fake data', category: 'Testing', url: 'https://fakerjs.dev' },
        
        // Hosting & Deploy
        { id: 'vercel', name: 'Vercel', desc: 'Deploy frontend projects', category: 'Hosting', url: 'https://vercel.com' },
        { id: 'netlify', name: 'Netlify', desc: 'Web hosting platform', category: 'Hosting', url: 'https://www.netlify.com' },
        { id: 'railway', name: 'Railway', desc: 'Deploy apps instantly', category: 'Hosting', url: 'https://railway.app' },
        { id: 'fly', name: 'Fly.io', desc: 'Deploy apps globally', category: 'Hosting', url: 'https://fly.io' },
        { id: 'render', name: 'Render', desc: 'Cloud application hosting', category: 'Hosting', url: 'https://render.com' },
        { id: 'deno', name: 'Deno Deploy', desc: 'Edge runtime deployment', category: 'Hosting', url: 'https://deno.com/deploy' },
        
        // Utility Tools
        { id: 'explainshell', name: 'Explain Shell', desc: 'Explain shell commands', category: 'Utility', url: 'https://explainshell.com' },
        { id: 'transform', name: 'Transform', desc: 'Multi-format converter', category: 'Utility', url: 'https://transform.tools' },
        { id: 'jsoncrack', name: 'JSON Crack', desc: 'Visualize JSON as graph', category: 'Utility', url: 'https://jsoncrack.com' },
        { id: 'regex-vis', name: 'Regex Visualizer', desc: 'Visualize regex patterns', category: 'Utility', url: 'https://regex-vis.com' },
        { id: 'epoch', name: 'Epoch Converter', desc: 'Convert timestamps', category: 'Utility', url: 'https://www.epochconverter.com' },
        { id: 'tableconvert', name: 'Table Convert', desc: 'Convert table formats', category: 'Utility', url: 'https://tableconvert.com' }
    ]};
}

function saveDevTools(data) {
    fs.writeFileSync(DEV_TOOLS_FILE, JSON.stringify(data, null, 2));
}

// Initialize auth file with default password
if (!fs.existsSync(AUTH_FILE)) {
    const defaultHash = bcrypt.hashSync('admin', 10);
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ passwordHash: defaultHash }));
}

// Initialize passkeys file (encrypted)
if (!fs.existsSync(PASSKEYS_FILE)) {
    writePasskeys({ passkeys: [] });
}

// GitHub configuration
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'NagusameCS';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''; // Optional: for private repos

// Trust proxy for CDN/reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(express.json());

// Determine which directories to serve (dist for production, source for dev)
const HOMEPAGE_DIR = fs.existsSync(path.join(__dirname, '..', 'homepage-dist')) && process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '..', 'homepage-dist')
    : path.join(__dirname, '..', 'homepage');
const PORTAL_DIR = fs.existsSync(path.join(__dirname, 'dist')) && process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'dist')
    : path.join(__dirname, 'public');
const SITES_DIR = path.join(__dirname, '..', 'sites');

// Homepage static files (for main site)
app.use('/assets', express.static(path.join(HOMEPAGE_DIR, 'assets')));

// ============ VALENTIN HELPER FUNCTIONS ============

function getValentinSubmissions() {
    if (fs.existsSync(VALENTIN_SUBMISSIONS_FILE)) {
        return JSON.parse(fs.readFileSync(VALENTIN_SUBMISSIONS_FILE, 'utf8'));
    }
    return { submissions: [] };
}

function saveValentinSubmissions(data) {
    fs.writeFileSync(VALENTIN_SUBMISSIONS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function getValentinMatches() {
    if (fs.existsSync(VALENTIN_MATCHES_FILE)) {
        return JSON.parse(fs.readFileSync(VALENTIN_MATCHES_FILE, 'utf8'));
    }
    return { matches: [], lastCalculated: null };
}

function saveValentinMatches(data) {
    fs.writeFileSync(VALENTIN_MATCHES_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function getValentinSettings() {
    if (fs.existsSync(VALENTIN_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(VALENTIN_SETTINGS_FILE, 'utf8'));
    }
    return { resultsVisible: false, formsClosed: false };
}

function saveValentinSettings(data) {
    fs.writeFileSync(VALENTIN_SETTINGS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// ============ VALENTIN API ROUTES ============

// Valentin API routes (must be before static file serving)
app.post('/sites/valentin/submit', express.json(), (req, res) => {
    try {
        const answers = req.body;
        
        // Validate required fields
        if (!answers.email || !answers.gender || !answers.age) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required fields: email, gender, age' 
            });
        }
        
        // Validate email domain
        if (!answers.email.toLowerCase().endsWith('@asf.edu.mx')) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Only @asf.edu.mx email addresses are allowed' 
            });
        }
        
        const data = getValentinSubmissions();
        
        // Check if email already submitted
        const existing = data.submissions.findIndex(s => s.email === answers.email);
        
        const submission = {
            ...answers,
            submittedAt: new Date().toISOString(),
            ip: getClientIP(req)
        };
        
        if (existing >= 0) {
            data.submissions[existing] = submission;
        } else {
            data.submissions.push(submission);
        }
        
        saveValentinSubmissions(data);
        
        res.json({ 
            status: 'success', 
            message: 'Submission received! Check back for matches.' 
        });
        
    } catch (error) {
        console.error('Valentin submission error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to save submission' 
        });
    }
});

// Get all submissions (for matchmaking page)
app.get('/sites/valentin/api/submissions', (req, res) => {
    try {
        const data = getValentinSubmissions();
        res.json(data);
    } catch (error) {
        console.error('Valentin submissions fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to load submissions',
            message: error.message 
        });
    }
});

app.get('/sites/valentin/api/results', (req, res) => {
    try {
        const userEmail = req.query.email;
        const submissions = getValentinSubmissions();
        const matchesData = getValentinMatches();
        const settings = getValentinSettings();
        
        // Check if results are visible
        if (!settings.resultsVisible) {
            return res.json({
                error: 'results_not_ready',
                message: 'Results have not been released yet. Check back later!'
            });
        }
        
        // Calculate stats
        const totalParticipants = submissions.submissions.length;
        const matchCount = matchesData.matches.length;
        const avgCompatibility = matchCount > 0 
            ? Math.round(matchesData.matches.reduce((sum, m) => sum + m.score, 0) / matchCount)
            : 0;
        
        // If user email provided, find their specific match
        if (userEmail) {
            const userEmailLower = userEmail.toLowerCase();
            
            // Check if user submitted
            const userSubmission = submissions.submissions.find(s => 
                s.email && s.email.toLowerCase() === userEmailLower
            );
            
            if (!userSubmission) {
                return res.json({
                    error: 'not_submitted',
                    message: 'No submission found for your account.'
                });
            }
            
            // Find their match
            const userMatch = matchesData.matches.find(m => 
                (m.person1?.email?.toLowerCase() === userEmailLower) ||
                (m.person2?.email?.toLowerCase() === userEmailLower)
            );
            
            if (!userMatch) {
                return res.json({
                    error: 'no_match',
                    message: 'No match found for your account.'
                });
            }
            
            // Determine which person is the user and which is their match
            const isUser1 = userMatch.person1?.email?.toLowerCase() === userEmailLower;
            const matchedPerson = isUser1 ? userMatch.person2 : userMatch.person1;
            
            return res.json({
                stats: {
                    totalParticipants,
                    matchCount,
                    avgCompatibility
                },
                match: {
                    email: matchedPerson.email,
                    name: matchedPerson.name || matchedPerson.email?.split('@')[0],
                    gender: matchedPerson.gender,
                    grade: matchedPerson.grade,
                    age: matchedPerson.age,
                    compatibility: Math.round(userMatch.score)
                },
                lastCalculated: matchesData.lastCalculated
            });
        }
        
        // No email - return all matches (for admin)
        res.json({
            stats: {
                totalParticipants,
                matchCount,
                avgCompatibility
            },
            matches: matchesData.matches,
            lastCalculated: matchesData.lastCalculated
        });
        
    } catch (error) {
        console.error('Valentin results error:', error);
        res.status(500).json({ 
            error: 'Failed to load results',
            message: error.message 
        });
    }
});

// Get valentin status (results visibility, form state)
app.get('/sites/valentin/api/status', (req, res) => {
    try {
        const settings = getValentinSettings();
        res.json({
            resultsVisible: settings.resultsVisible || false,
            formsClosed: settings.formsClosed || settings.resultsVisible || false
        });
    } catch (error) {
        console.error('Valentin status error:', error);
        res.json({ resultsVisible: false, formsClosed: false });
    }
});

// Toggle valentin results visibility (for admin)
app.post('/sites/valentin/api/toggle-results', express.json(), (req, res) => {
    try {
        const { resultsVisible } = req.body;
        const settings = getValentinSettings();
        settings.resultsVisible = resultsVisible;
        settings.formsClosed = resultsVisible; // Forms close when results are shown
        saveValentinSettings(settings);
        res.json({ success: true, resultsVisible, formsClosed: settings.formsClosed });
    } catch (error) {
        console.error('Valentin toggle error:', error);
        res.status(500).json({ error: 'Failed to toggle results', message: error.message });
    }
});

// Hosted project sites (each folder in sites/ is served under /sites/<name>/)
if (fs.existsSync(SITES_DIR)) {
    fs.readdirSync(SITES_DIR).forEach(site => {
        const sitePath = path.join(SITES_DIR, site);
        if (fs.statSync(sitePath).isDirectory()) {
            // URL rewriting - remove .html extension
            app.get(`/sites/${site}/:page`, (req, res, next) => {
                const page = req.params.page;
                const htmlPath = path.join(sitePath, page + '.html');
                if (fs.existsSync(htmlPath)) {
                    res.sendFile(htmlPath);
                } else {
                    next();
                }
            });
            
            app.use(`/sites/${site}`, express.static(sitePath));
            
            // Also serve index.html for root
            app.get(`/sites/${site}`, (req, res, next) => {
                const indexPath = path.join(sitePath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    res.sendFile(indexPath);
                } else {
                    next();
                }
            });
        }
    });
}

// Generate a persistent session secret
const SESSION_SECRET_FILE = path.join(CONFIG_DIR, '.session_secret');
let sessionSecret;
if (fs.existsSync(SESSION_SECRET_FILE)) {
    sessionSecret = fs.readFileSync(SESSION_SECRET_FILE, 'utf8');
} else {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SESSION_SECRET_FILE, sessionSecret, { mode: 0o600 });
}

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Trust the first proxy
    cookie: { 
        secure: 'auto', // Auto-detect based on connection
        httpOnly: true,
        sameSite: 'lax', // Allow cookies in navigational requests
        // No maxAge = session cookie (expires when browser/tab closes)
        path: '/' // Cookie valid for all paths
    }
}));

// Mount API router at /portal/api BEFORE portal static files
// to ensure API routes take precedence over static file serving
app.use('/portal/api', apiRouter);

// Portal static files (under /portal/)
app.use('/portal', express.static(PORTAL_DIR));

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
};

// ============ AUTH ROUTES ============

apiRouter.post('/login', (req, res) => {
    const { password } = req.body;
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Check if IP is locked
    if (isIPLocked(ip)) {
        logSecurityEvent('login_blocked', ip, { userAgent, reason: 'IP locked' });
        return res.status(403).json({ error: 'Access temporarily blocked. Try again later.' });
    }
    
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE));
    
    if (bcrypt.compareSync(password, auth.passwordHash)) {
        const knownIPs = getKnownIPs();
        
        // Check if IP is known
        if (!knownIPs.ips.includes(ip)) {
            // New IP - require GitHub verification
            const verificationToken = crypto.randomBytes(32).toString('hex');
            knownIPs.pendingVerification[ip] = {
                token: verificationToken,
                expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
                userAgent
            };
            saveKnownIPs(knownIPs);
            
            logSecurityEvent('new_ip_login', ip, { userAgent, requiresVerification: true });
            
            // Return special response requiring GitHub auth
            return res.json({ 
                success: false, 
                requiresGitHubAuth: true,
                message: 'New device detected. Please verify with GitHub.',
                verificationToken
            });
        }
        
        // Known IP - allow login
        logSecurityEvent('login_success', ip, { userAgent });
        req.session.authenticated = true;
        req.session.ip = ip;
        res.json({ success: true });
    } else {
        logSecurityEvent('login_failed', ip, { userAgent });
        res.status(401).json({ error: 'Invalid password' });
    }
});

// GitHub OAuth routes for new IP verification
apiRouter.get('/auth/github', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing verification token');
    
    req.session.verificationToken = token;
    req.session.verificationIP = getClientIP(req);
    
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_OAUTH_CALLBACK,
        scope: 'read:user',
        state: token
    });
    
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

apiRouter.get('/auth/github/callback', async (req, res) => {
    const { code, state } = req.query;
    const ip = getClientIP(req);
    
    try {
        // Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code
            })
        });
        
        const tokenData = await tokenRes.json();
        
        if (!tokenData.access_token) {
            throw new Error('Failed to get access token');
        }
        
        // Get user info
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'User-Agent': 'VPS-Portal'
            }
        });
        
        const userData = await userRes.json();
        
        // Check if it's the correct GitHub user
        if (userData.login.toLowerCase() !== GITHUB_USERNAME.toLowerCase()) {
            logSecurityEvent('github_auth_wrong_user', ip, { 
                attemptedUser: userData.login,
                expectedUser: GITHUB_USERNAME 
            });
            lockIP(ip, 30);
            return res.send(`<html><body><h1>Access Denied</h1><p>Wrong GitHub account. This IP has been locked for 30 minutes.</p></body></html>`);
        }
        
        // Verify the token matches pending verification
        const knownIPs = getKnownIPs();
        const pending = knownIPs.pendingVerification[ip];
        
        if (!pending || pending.token !== state) {
            return res.send(`<html><body><h1>Verification Failed</h1><p>Invalid or expired verification token.</p></body></html>`);
        }
        
        if (new Date(pending.expires) < new Date()) {
            delete knownIPs.pendingVerification[ip];
            saveKnownIPs(knownIPs);
            lockIP(ip, 30);
            return res.send(`<html><body><h1>Verification Expired</h1><p>Verification window expired. This IP has been locked for 30 minutes.</p></body></html>`);
        }
        
        // Success - add IP to known list
        knownIPs.ips.push(ip);
        delete knownIPs.pendingVerification[ip];
        saveKnownIPs(knownIPs);
        
        logSecurityEvent('github_auth_success', ip, { githubUser: userData.login });
        
        req.session.authenticated = true;
        req.session.ip = ip;
        
        res.send(`<html><body><script>window.opener?.postMessage('github-auth-success', '*'); window.close(); window.location.href = '/portal/';</script><h1>Verified!</h1><p>You can close this window.</p></body></html>`);
        
    } catch (err) {
        logSecurityEvent('github_auth_error', ip, { error: err.message });
        res.status(500).send(`<html><body><h1>Error</h1><p>${err.message}</p></body></html>`);
    }
});

// Security report endpoints
apiRouter.get('/security/log', requireAuth, (req, res) => {
    const log = getSecurityLog();
    res.json({ events: log.attempts.reverse() });
});

apiRouter.get('/security/known-ips', requireAuth, (req, res) => {
    const data = getKnownIPs();
    const log = getSecurityLog();
    res.json({ 
        known: data.ips, 
        locked: Object.keys(log.lockedIPs),
        pending: Object.keys(data.pendingVerification).length 
    });
});

apiRouter.delete('/security/known-ips/:ip', requireAuth, (req, res) => {
    const data = getKnownIPs();
    data.ips = data.ips.filter(ip => ip !== req.params.ip);
    saveKnownIPs(data);
    res.json({ success: true });
});

apiRouter.post('/security/unlock-ip', requireAuth, (req, res) => {
    const { ip } = req.body;
    const log = getSecurityLog();
    delete log.lockedIPs[ip];
    saveSecurityLog(log);
    logSecurityEvent('ip_unlocked', ip, { by: 'admin' });
    res.json({ success: true });
});

apiRouter.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

apiRouter.get('/auth/status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

apiRouter.post('/password/change', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE));
    
    if (!bcrypt.compareSync(currentPassword, auth.passwordHash)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    auth.passwordHash = bcrypt.hashSync(newPassword, 10);
    fs.writeFileSync(AUTH_FILE, JSON.stringify(auth));
    res.json({ success: true });
});

// ============ PASSKEY (WebAuthn) ROUTES ============

// Check if passkeys exist
apiRouter.get('/passkeys/exists', (req, res) => {
    const data = readPasskeys();
    res.json({ exists: data.passkeys && data.passkeys.length > 0 });
});

// List passkeys (requires auth)
apiRouter.get('/passkeys', requireAuth, (req, res) => {
    const data = readPasskeys();
    const passkeys = (data.passkeys || []).map(p => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt
    }));
    res.json({ passkeys });
});

// Delete passkey
apiRouter.delete('/passkeys/:id', requireAuth, (req, res) => {
    const data = readPasskeys();
    data.passkeys = (data.passkeys || []).filter(p => p.id !== req.params.id);
    writePasskeys(data);
    res.json({ success: true });
});

// Start passkey registration
apiRouter.post('/passkey/register/start', requireAuth, (req, res) => {
    const challenge = crypto.randomBytes(32).toString('base64url');
    req.session.passkeyChallenge = challenge;
    
    // Determine RP ID - use X-Forwarded-Host for reverse proxy, or hostname
    const host = req.get('X-Forwarded-Host') || req.get('Host') || req.hostname;
    const rpId = host.split(':')[0]; // Remove port if present
    
    res.json({
        challenge,
        rp: { name: 'VPS Portal', id: rpId },
        user: {
            id: crypto.randomBytes(16).toString('base64url'),
            name: 'admin',
            displayName: 'Admin'
        },
        pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'required'
        },
        timeout: 60000
    });
});

// Complete passkey registration
apiRouter.post('/passkey/register/complete', requireAuth, (req, res) => {
    // Support both wrapped { credential: {...} } and direct format
    const credential = req.body.credential || req.body;
    const name = req.body.name || req.body.deviceName;
    
    if (!req.session.passkeyChallenge) {
        return res.status(400).json({ error: 'No challenge found' });
    }
    
    if (!credential || !credential.id || !credential.response) {
        return res.status(400).json({ error: 'Invalid credential data' });
    }
    
    // Store the passkey securely (encrypted at rest)
    const data = readPasskeys();
    data.passkeys = data.passkeys || [];
    data.passkeys.push({
        id: credential.id,
        name: name || `Passkey ${data.passkeys.length + 1}`,
        publicKey: credential.response.publicKey,
        attestationObject: credential.response.attestationObject,
        clientDataJSON: credential.response.clientDataJSON,
        counter: 0, // Track signature counter for replay protection
        createdAt: new Date().toISOString()
    });
    writePasskeys(data);
    
    delete req.session.passkeyChallenge;
    res.json({ success: true });
});

// Start passkey login
apiRouter.post('/passkey/login/start', (req, res) => {
    const data = readPasskeys();
    
    if (!data.passkeys || data.passkeys.length === 0) {
        return res.status(400).json({ error: 'No passkeys registered', noPasskeys: true });
    }
    
    const challenge = crypto.randomBytes(32).toString('base64url');
    req.session.loginChallenge = challenge;
    
    // Determine RP ID - use X-Forwarded-Host for reverse proxy, or hostname
    const host = req.get('X-Forwarded-Host') || req.get('Host') || req.hostname;
    const rpId = host.split(':')[0]; // Remove port if present
    
    res.json({
        challenge,
        rpId,
        allowCredentials: data.passkeys.map(p => ({
            type: 'public-key',
            id: p.id
        })),
        userVerification: 'required',
        timeout: 60000
    });
});

// Complete passkey login
apiRouter.post('/passkey/login/complete', (req, res) => {
    // Support both { credential: {...} } and direct {...} format
    const credential = req.body.credential || req.body;
    
    if (!req.session.loginChallenge) {
        return res.status(400).json({ error: 'No challenge found' });
    }
    
    if (!credential || !credential.id) {
        return res.status(400).json({ error: 'Invalid credential data' });
    }
    
    const data = readPasskeys();
    const passkeyIndex = data.passkeys.findIndex(p => p.id === credential.id);
    
    if (passkeyIndex === -1) {
        return res.status(401).json({ error: 'Passkey not found' });
    }
    
    const passkey = data.passkeys[passkeyIndex];
    
    // Verify authenticator data flags
    try {
        const authData = Buffer.from(credential.response.authenticatorData, 'base64url');
        const flags = authData[32];
        const userPresent = (flags & 0x01) !== 0;
        const userVerified = (flags & 0x04) !== 0;
        
        if (!userPresent || !userVerified) {
            return res.status(401).json({ error: 'User verification failed' });
        }
        
        // Extract and verify counter (replay protection)
        const counter = authData.readUInt32BE(33);
        if (passkey.counter && counter <= passkey.counter) {
            console.error('Possible replay attack detected: counter not incremented');
            return res.status(401).json({ error: 'Authentication failed - possible replay' });
        }
        
        // Update counter
        data.passkeys[passkeyIndex].counter = counter;
        writePasskeys(data);
        
    } catch (err) {
        console.error('Auth data verification error:', err.message);
        return res.status(401).json({ error: 'Authentication verification failed' });
    }
    
    req.session.authenticated = true;
    delete req.session.loginChallenge;
    
    res.json({ success: true });
});

// ============ SYSTEM INFO ============

apiRouter.get('/system/info', requireAuth, (req, res) => {
    exec('hostname && uptime -p && df -h / | tail -1 && free -h | grep Mem', (err, stdout) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const lines = stdout.trim().split('\n');
        res.json({
            hostname: lines[0],
            uptime: lines[1],
            disk: lines[2],
            memory: lines[3]
        });
    });
});

// ============ REPOSITORY MANAGEMENT ============

const getRepos = () => {
    if (!fs.existsSync(REPOS_FILE)) return [];
    return JSON.parse(fs.readFileSync(REPOS_FILE));
};

const saveRepos = (repos) => {
    fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2));
};

// GitHub profile info
apiRouter.get('/github/profile', requireAuth, async (req, res) => {
    try {
        const headers = { 'User-Agent': 'VPS-Portal' };
        if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        
        const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, { headers });
        const data = await response.json();
        res.json({
            username: data.login,
            avatar: data.avatar_url,
            name: data.name,
            repos: data.public_repos
        });
    } catch (err) {
        res.json({ username: GITHUB_USERNAME, avatar: `https://github.com/${GITHUB_USERNAME}.png` });
    }
});

// GitHub branches for a repo
apiRouter.get('/github/repo/:owner/:repo/branches', requireAuth, async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const headers = { 'User-Agent': 'VPS-Portal' };
        if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers });
        const branches = await response.json();
        res.json(branches.map(b => ({
            name: b.name,
            sha: b.commit.sha,
            protected: b.protected
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GitHub repos list
apiRouter.get('/github/repos', requireAuth, async (req, res) => {
    try {
        const headers = { 'User-Agent': 'VPS-Portal' };
        if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        
        const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=50`, { headers });
        const repos = await response.json();
        res.json(repos.map(r => ({
            name: r.name,
            fullName: r.full_name,
            owner: r.owner?.login || GITHUB_USERNAME,
            description: r.description,
            url: r.html_url,
            cloneUrl: r.clone_url,
            sshUrl: r.ssh_url,
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            updatedAt: r.updated_at,
            private: r.private
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/repos', requireAuth, (req, res) => {
    res.json(getRepos());
});

apiRouter.post('/repos', requireAuth, (req, res) => {
    const { name, repoUrl, branch, deployPath } = req.body;
    const repos = getRepos();
    
    const id = crypto.randomBytes(8).toString('hex');
    repos.push({ id, name, repoUrl, branch: branch || 'main', deployPath, createdAt: new Date().toISOString() });
    saveRepos(repos);
    
    res.json({ success: true, id });
});

apiRouter.delete('/repos/:id', requireAuth, (req, res) => {
    let repos = getRepos();
    repos = repos.filter(r => r.id !== req.params.id);
    saveRepos(repos);
    res.json({ success: true });
});

apiRouter.post('/repos/:id/deploy', requireAuth, (req, res) => {
    const repos = getRepos();
    const repo = repos.find(r => r.id === req.params.id);
    
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    
    const deployScript = `
        cd ${repo.deployPath} 2>/dev/null || git clone ${repo.repoUrl} ${repo.deployPath}
        cd ${repo.deployPath}
        git fetch origin
        git checkout ${repo.branch}
        git pull origin ${repo.branch}
        if [ -f package.json ]; then npm install && npm run build 2>/dev/null; fi
        if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
    `;
    
    exec(deployScript, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        res.json({ success: true, output: stdout });
    });
});

// ============ WEBHOOK ============

apiRouter.get('/webhook-secret', requireAuth, (req, res) => {
    const secretFile = path.join(CONFIG_DIR, 'webhook-secret.txt');
    let secret;
    
    if (fs.existsSync(secretFile)) {
        secret = fs.readFileSync(secretFile, 'utf8').trim();
    } else {
        secret = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(secretFile, secret);
    }
    
    res.json({ secret });
});

// GitHub Webhook receiver - auto deploy on push
app.post('/webhook/github', express.raw({ type: 'application/json' }), (req, res) => {
    try {
        const secretFile = path.join(CONFIG_DIR, 'webhook-secret.txt');
        
        if (!fs.existsSync(secretFile)) {
            console.log('Webhook: No secret configured');
            return res.status(500).json({ error: 'Webhook secret not configured' });
        }
        
        const secret = fs.readFileSync(secretFile, 'utf8').trim();
        const signature = req.headers['x-hub-signature-256'];
        
        if (!signature) {
            console.log('Webhook: No signature provided');
            return res.status(401).json({ error: 'No signature' });
        }
        
        // Verify signature
        const payload = req.body;
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(payload).digest('hex');
        
        // Safe comparison that handles different lengths
        if (signature.length !== digest.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
            console.log('Webhook: Invalid signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Parse the payload
        const data = JSON.parse(payload.toString());
        const repo = data.repository?.name || 'unknown';
        const ref = data.ref || '';
        
        console.log(`Webhook: Received push to ${repo} on ${ref}`);
        
        // Only deploy on main/master branch pushes
        if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') {
            return res.json({ status: 'ignored', reason: 'Not main branch' });
        }
        
        // Respond immediately, then deploy
        res.json({ status: 'deploying', repo, ref });
        
        // Run deploy in background
        exec(`cd ${path.join(__dirname, '..')} && git pull && cd webui && npm install --production`, {
            shell: '/bin/bash',
            timeout: 120000
        }, (err, stdout, stderr) => {
            if (err) {
                console.error('Webhook deploy error:', stderr);
            } else {
                console.log('Webhook: Git pull complete');
            }
            
            // Restart the server via pm2
            exec('pm2 restart vps-portal', (err2) => {
                if (err2) {
                    console.error('Webhook: PM2 restart failed:', err2);
                } else {
                    console.log('Webhook: PM2 restart triggered');
                }
            });
        });
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ TERMINAL (Fallback mode) ============

apiRouter.post('/terminal/exec', requireAuth, (req, res) => {
    const { command } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'No command provided' });
    }
    
    exec(command, { 
        shell: '/bin/bash',
        timeout: 30000,
        maxBuffer: 1024 * 1024
    }, (err, stdout, stderr) => {
        res.json({
            output: stdout || '',
            error: stderr || '',
            exitCode: err ? err.code : 0
        });
    });
});

// ============ SOCKET.IO TERMINAL ============

io.on('connection', (socket) => {
    let pty = null;
    
    socket.on('terminal:start', () => {
        try {
            const nodePty = require('node-pty');
            pty = nodePty.spawn('/bin/bash', [], {
                name: 'xterm-256color',
                cols: 120,
                rows: 30,
                cwd: '/home/deploy',
                env: process.env
            });
            
            pty.onData(data => socket.emit('terminal:data', data));
            pty.onExit(() => socket.emit('terminal:exit'));
            
            socket.emit('terminal:ready');
        } catch (err) {
            socket.emit('terminal:error', 'PTY not available, use fallback mode');
        }
    });
    
    socket.on('terminal:input', data => {
        if (pty) pty.write(data);
    });
    
    socket.on('terminal:resize', ({ cols, rows }) => {
        if (pty) pty.resize(cols, rows);
    });
    
    socket.on('disconnect', () => {
        if (pty) pty.kill();
    });
});

// ============ ADDITIONAL API ENDPOINTS ============

// System status - detailed format for dashboard
apiRouter.get('/status', requireAuth, async (req, res) => {
    try {
        const uptime = os.uptime();
        const loadavg = os.loadavg();
        const totalmem = os.totalmem();
        const freemem = os.freemem();
        const cpus = os.cpus().length;

        // Get PM2 status
        const pm2Status = await new Promise((resolve) => {
            exec('pm2 jlist', (err, stdout) => {
                if (err) resolve([]);
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    resolve([]);
                }
            });
        });

        // Get nginx status
        const nginxStatus = await new Promise((resolve) => {
            exec('systemctl is-active nginx', (err, stdout) => {
                resolve(stdout.trim() === 'active');
            });
        });

        // Get disk usage
        const diskUsage = await new Promise((resolve) => {
            exec("df -h / | tail -1 | awk '{print $3, $4, $5}'", (err, stdout) => {
                if (err) resolve({ used: 'N/A', free: 'N/A', percent: 'N/A' });
                const parts = stdout.trim().split(' ');
                resolve({ used: parts[0], free: parts[1], percent: parts[2] });
            });
        });

        res.json({
            uptime,
            loadavg,
            memory: { total: totalmem, free: freemem, used: totalmem - freemem },
            cpus,
            pm2: pm2Status,
            nginx: nginxStatus,
            disk: diskUsage
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PM2 process list
apiRouter.get('/pm2/list', requireAuth, (req, res) => {
    exec('pm2 jlist', (err, stdout) => {
        if (err) return res.json([]);
        try {
            const processes = JSON.parse(stdout);
            res.json(processes.map(p => ({
                name: p.name,
                status: p.pm2_env.status,
                cpu: p.monit?.cpu || 0,
                memory: p.monit?.memory || 0,
                uptime: p.pm2_env.pm_uptime
            })));
        } catch {
            res.json([]);
        }
    });
});

// Execute command
apiRouter.post('/exec', requireAuth, (req, res) => {
    const { command, cwd } = req.body;
    exec(command, { cwd: cwd || '/home/deploy', shell: '/bin/bash' }, (err, stdout, stderr) => {
        res.json({ output: stdout, error: stderr, exitCode: err ? err.code : 0 });
    });
});

// Git operations
apiRouter.post('/git/clone', requireAuth, (req, res) => {
    const { repoUrl, url, path: targetPath, destination, name, branch = 'main', autoUpdate = true } = req.body;
    const cloneUrl = repoUrl || url;
    const clonePath = targetPath || destination;
    
    if (!cloneUrl || !clonePath) {
        return res.status(400).json({ error: 'URL and destination path required' });
    }
    
    exec(`git clone -b ${branch} ${cloneUrl} "${clonePath}"`, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        
        // Check if it has an index.html (is a website)
        const indexPath = path.join(clonePath, 'index.html');
        const hasIndex = fs.existsSync(indexPath);
        
        // Track this cloned repo
        addClonedRepo({
            name: name || path.basename(clonePath),
            url: cloneUrl,
            path: clonePath,
            branch,
            autoUpdate,
            isWebsite: hasIndex
        });
        
        // If it's a website, add to pages
        if (hasIndex) {
            const repos = getRepos();
            if (!repos.pages) repos.pages = [];
            
            // Check if already exists
            if (!repos.pages.find(p => p.path === clonePath)) {
                repos.pages.push({
                    id: crypto.randomBytes(8).toString('hex'),
                    name: name || path.basename(clonePath),
                    path: clonePath,
                    repoUrl: cloneUrl,
                    branch,
                    domain: '',
                    favicon: '',
                    socialBanner: '',
                    createdAt: new Date().toISOString()
                });
                saveRepos(repos);
            }
        }
        
        res.json({ success: true, output: stdout, isWebsite: hasIndex });
    });
});

// Get cloned repos
apiRouter.get('/git/cloned', requireAuth, (req, res) => {
    const data = getClonedRepos();
    res.json(data.repos);
});

// Manual update check for a repo
apiRouter.post('/git/check-updates', requireAuth, (req, res) => {
    const { path: repoPath } = req.body;
    
    exec(`cd "${repoPath}" && git fetch origin && git status -uno`, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        
        const hasUpdates = stdout.includes('behind');
        res.json({ hasUpdates, status: stdout });
    });
});

// Pull updates for a repo
apiRouter.post('/git/pull', requireAuth, (req, res) => {
    const { path: repoPath } = req.body;
    exec(`cd "${repoPath}" && git pull`, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        
        // Update last checked time
        const data = getClonedRepos();
        const repo = data.repos.find(r => r.path === repoPath);
        if (repo) {
            repo.lastChecked = new Date().toISOString();
            repo.lastUpdated = new Date().toISOString();
            saveClonedRepos(data);
        }
        
        res.json({ success: true, output: stdout });
    });
});

// Git status for a repo
apiRouter.post('/git/status', requireAuth, (req, res) => {
    const { path: repoPath } = req.body;
    exec(`cd "${repoPath}" && git status --porcelain`, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        
        const changes = stdout.trim().split('\n').filter(Boolean).map(line => {
            const status = line.substring(0, 2);
            const file = line.substring(3);
            return { status, file };
        });
        
        res.json({ changes, hasChanges: changes.length > 0 });
    });
});

// Git diff for a specific file
apiRouter.post('/git/diff', requireAuth, (req, res) => {
    const { path: repoPath, file } = req.body;
    exec(`cd "${repoPath}" && git diff HEAD -- "${file}"`, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        res.json({ diff: stdout });
    });
});

// Git commit
apiRouter.post('/git/commit', requireAuth, (req, res) => {
    const { path: repoPath, message, files } = req.body;
    
    if (!message) return res.status(400).json({ error: 'Commit message required' });
    
    let cmd = `cd "${repoPath}" && `;
    if (files && files.length > 0) {
        cmd += `git add ${files.map(f => `"${f}"`).join(' ')} && `;
    } else {
        cmd += 'git add -A && ';
    }
    cmd += `git commit -m "${message.replace(/"/g, '\\"')}"`;
    
    exec(cmd, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        res.json({ success: true, output: stdout });
    });
});

// Git push
apiRouter.post('/git/push', requireAuth, (req, res) => {
    const { path: repoPath, remote, branch } = req.body;
    
    const remoteName = remote || 'origin';
    const branchName = branch || '';
    
    let cmd = `cd "${repoPath}" && git push ${remoteName}`;
    if (branchName) cmd += ` ${branchName}`;
    
    exec(cmd, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        res.json({ success: true, output: stdout || stderr });
    });
});

// Git branch info
apiRouter.post('/git/branches', requireAuth, (req, res) => {
    const { path: repoPath } = req.body;
    
    exec(`cd "${repoPath}" && git branch -a --format='%(refname:short)'`, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        
        const branches = stdout.trim().split('\n').filter(Boolean);
        const current = branches.find(b => !b.startsWith('remotes/'));
        
        exec(`cd "${repoPath}" && git rev-parse --abbrev-ref HEAD`, { shell: '/bin/bash' }, (err2, stdout2) => {
            res.json({ 
                branches, 
                current: stdout2?.trim() || current 
            });
        });
    });
});

// Git remote info (for local development setup)
apiRouter.post('/git/remote', requireAuth, (req, res) => {
    const { path: repoPath } = req.body;
    
    exec(`cd "${repoPath}" && git remote -v`, { shell: '/bin/bash' }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr || err.message });
        
        const lines = stdout.trim().split('\n');
        const remotes = {};
        lines.forEach(line => {
            const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
            if (match) {
                remotes[match[1]] = remotes[match[1]] || {};
                remotes[match[1]][match[3]] = match[2];
            }
        });
        
        res.json({ remotes });
    });
});

// Browse GitHub repo contents (for modal view)
apiRouter.get('/github/repo/:owner/:repo/contents', requireAuth, async (req, res) => {
    const { owner, repo } = req.params;
    const repoPath = req.query.path || '';
    
    try {
        const headers = { 'User-Agent': 'VPS-Portal' };
        if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}`,
            { headers }
        );
        
        if (!response.ok) throw new Error('Failed to fetch repo contents');
        
        const contents = await response.json();
        res.json(contents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get file content from GitHub
apiRouter.get('/github/repo/:owner/:repo/file', requireAuth, async (req, res) => {
    const { owner, repo } = req.params;
    const filePath = req.query.path;
    
    try {
        const headers = { 'User-Agent': 'VPS-Portal' };
        if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            { headers }
        );
        
        if (!response.ok) throw new Error('Failed to fetch file');
        
        const data = await response.json();
        
        // Decode base64 content
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        res.json({ content, name: data.name, path: data.path, size: data.size });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// File operations
apiRouter.get('/files', requireAuth, (req, res) => {
    const dirPath = req.query.path || '/home/deploy';
    
    try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        const files = items.map(item => {
            try {
                const stats = fs.statSync(path.join(dirPath, item.name));
                return {
                    name: item.name,
                    isDirectory: item.isDirectory(),
                    isSymlink: item.isSymbolicLink(),
                    path: path.join(dirPath, item.name),
                    size: item.isFile() ? stats.size : null,
                    modified: stats.mtime
                };
            } catch {
                return {
                    name: item.name,
                    isDirectory: item.isDirectory(),
                    path: path.join(dirPath, item.name),
                    size: null,
                    modified: null
                };
            }
        });
        
        res.json({
            currentPath: dirPath,
            parentPath: path.dirname(dirPath),
            files: files.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            })
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/files/read', requireAuth, (req, res) => {
    const filePath = req.query.path;
    
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > 2 * 1024 * 1024) {
            return res.status(400).json({ error: 'File too large (max 2MB)' });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content, path: filePath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.delete('/files', requireAuth, (req, res) => {
    const filePath = req.query.path;
    
    try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true });
        } else {
            fs.unlinkSync(filePath);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/files/download', requireAuth, (req, res) => {
    const filePath = req.query.path;
    
    try {
        res.download(filePath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.post('/files/save', requireAuth, (req, res) => {
    const { path: filePath, content } = req.body;
    try {
        fs.writeFileSync(filePath, content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.post('/files/mkdir', requireAuth, (req, res) => {
    const { path: dirPath } = req.body;
    exec(`mkdir -p "${dirPath}"`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

apiRouter.post('/files/rename', requireAuth, (req, res) => {
    const { oldPath, newPath } = req.body;
    exec(`mv "${oldPath}" "${newPath}"`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Bots/Pages management (alias for repos)
apiRouter.post('/bots/add', requireAuth, (req, res) => {
    const { name, repoUrl, branch } = req.body;
    const repos = getRepos();
    const id = crypto.randomBytes(8).toString('hex');
    repos.push({ id, name, repoUrl, branch: branch || 'main', type: 'bot', deployPath: `/home/deploy/bots/${name}`, createdAt: new Date().toISOString() });
    saveRepos(repos);
    res.json({ success: true, id });
});

apiRouter.post('/pages/add', requireAuth, (req, res) => {
    const { name, repoUrl, branch, path: pagePath } = req.body;
    const repos = getRepos();
    if (!repos.pages) repos.pages = [];
    
    const id = crypto.randomBytes(8).toString('hex');
    repos.pages.push({ 
        id, 
        name, 
        repoUrl, 
        branch: branch || 'main', 
        path: pagePath || `/var/www/${name}`,
        domain: '',
        favicon: '',
        socialBanner: '',
        createdAt: new Date().toISOString() 
    });
    saveRepos(repos);
    res.json({ success: true, id });
});

// Update page settings (name, favicon, social banner)
apiRouter.put('/pages/:id', requireAuth, (req, res) => {
    const { name, domain, favicon, socialBanner } = req.body;
    const repos = getRepos();
    if (!repos.pages) repos.pages = [];
    
    const page = repos.pages.find(p => p.id === req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    
    if (name) page.name = name;
    if (domain !== undefined) page.domain = domain;
    if (favicon !== undefined) page.favicon = favicon;
    if (socialBanner !== undefined) page.socialBanner = socialBanner;
    
    saveRepos(repos);
    res.json({ success: true, page });
});

// Delete page
apiRouter.delete('/pages/:id', requireAuth, (req, res) => {
    const repos = getRepos();
    if (!repos.pages) repos.pages = [];
    
    repos.pages = repos.pages.filter(p => p.id !== req.params.id);
    saveRepos(repos);
    res.json({ success: true });
});

// Upload favicon for a page
apiRouter.post('/pages/:id/favicon', requireAuth, (req, res) => {
    const { base64, filename } = req.body;
    const repos = getRepos();
    if (!repos.pages) return res.status(404).json({ error: 'No pages' });
    
    const page = repos.pages.find(p => p.id === req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    
    try {
        const faviconPath = path.join(page.path, filename || 'favicon.ico');
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(faviconPath, buffer);
        
        page.favicon = faviconPath;
        saveRepos(repos);
        
        res.json({ success: true, path: faviconPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload social banner for a page
apiRouter.post('/pages/:id/banner', requireAuth, (req, res) => {
    const { base64, filename } = req.body;
    const repos = getRepos();
    if (!repos.pages) return res.status(404).json({ error: 'No pages' });
    
    const page = repos.pages.find(p => p.id === req.params.id);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    
    try {
        const bannerPath = path.join(page.path, filename || 'og-image.png');
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(bannerPath, buffer);
        
        page.socialBanner = bannerPath;
        saveRepos(repos);
        
        res.json({ success: true, path: bannerPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ AUTO-DETECT PAGES ============

// Scan for all index.html files in web directories
apiRouter.get('/pages/detect', requireAuth, (req, res) => {
    const webRoot = '/var/www';
    const homepageDir = HOMEPAGE_DIR;
    const detected = [];
    
    function scanDir(dir, urlBase = '') {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                // Skip hidden dirs, node_modules, .git
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue;
                
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // Check for index.html in this directory
                    const indexPath = path.join(fullPath, 'index.html');
                    if (fs.existsSync(indexPath)) {
                        const urlPath = urlBase + '/' + entry.name;
                        detected.push({
                            name: entry.name,
                            path: fullPath,
                            indexFile: indexPath,
                            urlPath: urlPath,
                            type: 'directory'
                        });
                    }
                    // Recurse one level deep
                    if (urlBase === '' || urlBase.split('/').length < 3) {
                        scanDir(fullPath, urlBase + '/' + entry.name);
                    }
                }
            }
        } catch (err) {
            // Ignore permission errors
        }
    }
    
    // Scan web root
    try {
        const webDirs = fs.readdirSync(webRoot, { withFileTypes: true });
        for (const entry of webDirs) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                const fullPath = path.join(webRoot, entry.name);
                const indexPath = path.join(fullPath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    detected.push({
                        name: entry.name,
                        path: fullPath,
                        indexFile: indexPath,
                        urlPath: '/',
                        type: 'site-root',
                        domain: entry.name
                    });
                }
                // Scan subdirectories
                scanDir(fullPath, '');
            }
        }
    } catch (err) {
        // Web root may not be accessible
    }
    
    // Scan homepage directory for additional pages
    try {
        const entries = fs.readdirSync(homepageDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                const fullPath = path.join(homepageDir, entry.name);
                const indexPath = path.join(fullPath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    detected.push({
                        name: entry.name,
                        path: fullPath,
                        indexFile: indexPath,
                        urlPath: '/' + entry.name,
                        type: 'subpage'
                    });
                }
            }
        }
    } catch (err) {
        // Homepage dir may not exist
    }
    
    res.json({ detected });
});

// ============ DEVELOPER TOOLS API ============

apiRouter.get('/devtools', requireAuth, (req, res) => {
    res.json(getDevTools());
});

apiRouter.post('/devtools', requireAuth, (req, res) => {
    const { tool } = req.body;
    const data = getDevTools();
    tool.id = tool.id || crypto.randomBytes(4).toString('hex');
    data.tools.push(tool);
    saveDevTools(data);
    res.json({ success: true, tool });
});

apiRouter.delete('/devtools/:id', requireAuth, (req, res) => {
    const data = getDevTools();
    data.tools = data.tools.filter(t => t.id !== req.params.id);
    saveDevTools(data);
    res.json({ success: true });
});

// ============ TEAM API ============

apiRouter.get('/team', requireAuth, (req, res) => {
    res.json(getTeam());
});

// Public team info (for homepage)
apiRouter.get('/public/team', (req, res) => {
    const team = getTeam();
    // Only return public info
    res.json({
        members: team.members.filter(m => m.visible !== false).map(m => ({
            username: m.username,
            displayName: m.displayName,
            bio: m.bio,
            avatar: m.avatar,
            socials: m.socials,
            hostedRepos: m.hostedRepos || [],
            repoCount: m.repos ? m.repos.filter(r => r.visible !== false).length : 0,
            npmUsername: m.npmUsername || null
        }))
    });
});

// Public featured repos for homepage
apiRouter.get('/public/featured-repos', async (req, res) => {
    const team = getTeam();
    const featured = [];
    
    // Collect all featured repos from all members
    for (const member of team.members.filter(m => m.visible !== false)) {
        const memberFeatured = member.featuredRepos || [];
        for (const repoName of memberFeatured) {
            const repo = member.repos?.find(r => r.name === repoName);
            if (repo) {
                featured.push({
                    name: repo.name,
                    description: repo.description,
                    url: repo.url,
                    language: repo.language,
                    stars: repo.stars,
                    owner: member.username,
                    ownerAvatar: member.avatar
                });
            }
        }
    }
    
    // Shuffle for variety
    featured.sort(() => Math.random() - 0.5);
    
    // Return up to 6 featured repos
    res.json({ repos: featured.slice(0, 6) });
});

apiRouter.post('/team/member', requireAuth, async (req, res) => {
    const { githubUsername } = req.body;
    
    try {
        // Fetch GitHub profile
        const headers = { 'User-Agent': 'VPS-Portal' };
        const profileRes = await fetch(`https://api.github.com/users/${githubUsername}`, { headers });
        const profile = await profileRes.json();
        
        if (profile.message === 'Not Found') {
            return res.status(404).json({ error: 'GitHub user not found' });
        }
        
        // Fetch repos
        const reposRes = await fetch(`https://api.github.com/users/${githubUsername}/repos?sort=updated&per_page=100`, { headers });
        const repos = await reposRes.json();
        
        const team = getTeam();
        const existing = team.members.find(m => m.username.toLowerCase() === githubUsername.toLowerCase());
        
        const member = {
            username: profile.login,
            displayName: profile.name || profile.login,
            bio: profile.bio,
            avatar: profile.avatar_url,
            url: profile.html_url,
            repos: repos.map(r => ({
                name: r.name,
                description: r.description,
                url: r.html_url,
                language: r.language,
                stars: r.stargazers_count,
                hosted: false,
                visible: true
            })),
            socials: existing?.socials || {},
            hostedRepos: existing?.hostedRepos || [],
            visible: true,
            addedAt: existing?.addedAt || new Date().toISOString()
        };
        
        if (existing) {
            Object.assign(existing, member);
        } else {
            team.members.push(member);
        }
        
        saveTeam(team);
        res.json({ success: true, member });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.put('/team/member/:username', requireAuth, (req, res) => {
    const { username } = req.params;
    const updates = req.body;
    
    const team = getTeam();
    const member = team.members.find(m => m.username.toLowerCase() === username.toLowerCase());
    
    if (!member) {
        return res.status(404).json({ error: 'Member not found' });
    }
    
    // Update allowed fields
    if (updates.displayName) member.displayName = updates.displayName;
    if (updates.bio !== undefined) member.bio = updates.bio;
    if (updates.socials) member.socials = { ...member.socials, ...updates.socials };
    if (updates.visible !== undefined) member.visible = updates.visible;
    if (updates.theme) member.theme = updates.theme;
    if (updates.hostedRepos) member.hostedRepos = updates.hostedRepos;
    if (updates.artistBackground !== undefined) member.artistBackground = updates.artistBackground;
    if (updates.npmUsername !== undefined) member.npmUsername = updates.npmUsername;
    if (updates.featuredRepos !== undefined) member.featuredRepos = updates.featuredRepos;
    if (updates.repos) {
        // Update repo visibility
        updates.repos.forEach(ru => {
            const repo = member.repos.find(r => r.name === ru.name);
            if (repo) {
                if (ru.visible !== undefined) repo.visible = ru.visible;
                if (ru.hosted !== undefined) repo.hosted = ru.hosted;
            }
        });
    }
    
    saveTeam(team);
    res.json({ success: true, member });
});

apiRouter.delete('/team/member/:username', requireAuth, (req, res) => {
    const team = getTeam();
    team.members = team.members.filter(m => m.username.toLowerCase() !== req.params.username.toLowerCase());
    saveTeam(team);
    res.json({ success: true });
});

// ============ HOMEPAGE CONFIG API ============

apiRouter.get('/homepage', requireAuth, (req, res) => {
    res.json(getHomepageConfig());
});

apiRouter.get('/public/homepage', (req, res) => {
    res.json(getHomepageConfig());
});

apiRouter.put('/homepage', requireAuth, (req, res) => {
    const config = req.body;
    saveHomepageConfig(config);
    res.json({ success: true });
});

// ============ PUBLIC MEMBER PAGE ============

apiRouter.get('/public/member/:username', async (req, res) => {
    const { username } = req.params;
    const team = getTeam();
    const member = team.members.find(m => 
        m.username.toLowerCase() === username.toLowerCase() && m.visible !== false
    );
    
    if (!member) {
        return res.status(404).json({ error: 'Member not found' });
    }
    
    res.json({
        username: member.username,
        displayName: member.displayName,
        bio: member.bio,
        avatar: member.avatar,
        url: member.url,
        socials: member.socials,
        repos: member.repos.filter(r => r.visible !== false),
        hostedRepos: member.hostedRepos,
        followers: member.followers,
        theme: member.theme,
        artistBackground: member.artistBackground,
        npmUsername: member.npmUsername
    });
});

// ============ GALLERY API ============

function getGallery() {
    if (fs.existsSync(GALLERY_FILE)) {
        return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8'));
    }
    return { items: [] };
}

function saveGallery(data) {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(data, null, 2));
}

// Public devtools endpoint (no auth required)
apiRouter.get('/public/devtools', (req, res) => {
    res.json(getDevTools());
});

// Public gallery endpoint
apiRouter.get('/public/gallery', (req, res) => {
    const gallery = getGallery();
    // Return only visible items
    res.json({
        items: gallery.items.filter(item => item.visible !== false).map(item => ({
            id: item.id,
            url: `/portal/api/gallery/image/${item.filename}`,
            thumbnail: `/portal/api/gallery/image/${item.filename}`,
            title: item.title,
            description: item.description,
            tags: item.tags || [],
            createdAt: item.createdAt
        }))
    });
});

// Public hosted sites endpoint
apiRouter.get('/public/sites', (req, res) => {
    if (!fs.existsSync(SITES_DIR)) {
        return res.json({ sites: [] });
    }
    
    const sites = fs.readdirSync(SITES_DIR)
        .filter(name => {
            const sitePath = path.join(SITES_DIR, name);
            return fs.statSync(sitePath).isDirectory();
        })
        .map(name => {
            const sitePath = path.join(SITES_DIR, name);
            const hasIndex = fs.existsSync(path.join(sitePath, 'index.html'));
            const hasPackage = fs.existsSync(path.join(sitePath, 'package.json'));
            
            let description = '';
            if (hasPackage) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(path.join(sitePath, 'package.json'), 'utf8'));
                    description = pkg.description || '';
                } catch (e) {}
            }
            
            return {
                name,
                url: `/sites/${name}/`,
                hasIndex,
                isBot: hasPackage && !hasIndex,
                description
            };
        });
    
    res.json({ sites });
});

// ============ VALENTIN ADMIN API ENDPOINTS ============

// Get raw valentin data (admin only)
apiRouter.get('/valentin/data', requireAuth, (req, res) => {
    try {
        const submissions = getValentinSubmissions();
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load data' });
    }
});

// Calculate matches (admin only)
apiRouter.post('/valentin/calculate', requireAuth, express.json(), (req, res) => {
    try {
        const submissions = getValentinSubmissions();
        
        if (submissions.submissions.length < 2) {
            return res.json({ 
                success: false, 
                message: 'Need at least 2 submissions to calculate matches' 
            });
        }
        
        // Simple matching algorithm (placeholder - can be enhanced)
        const matches = [];
        const used = new Set();
        
        // Group by gender preference
        const males = submissions.submissions.filter(s => s.gender === 'Male' && !used.has(s.email));
        const females = submissions.submissions.filter(s => s.gender === 'Female' && !used.has(s.email));
        
        // Simple pairing based on compatibility score
        const pairs = Math.min(males.length, females.length);
        
        for (let i = 0; i < pairs; i++) {
            // Calculate simple compatibility score
            const score = 50 + Math.random() * 50; // Placeholder - implement real algorithm
            
            matches.push({
                person1: {
                    email: males[i].email,
                    gender: males[i].gender,
                    grade: males[i].grade,
                    age: males[i].age
                },
                person2: {
                    email: females[i].email,
                    gender: females[i].gender,
                    grade: females[i].grade,
                    age: females[i].age
                },
                score: Math.round(score)
            });
            
            used.add(males[i].email);
            used.add(females[i].email);
        }
        
        saveValentinMatches({
            matches,
            lastCalculated: new Date().toISOString()
        });
        
        res.json({ 
            success: true, 
            matchCount: matches.length,
            message: `Created ${matches.length} matches` 
        });
        
    } catch (error) {
        console.error('Match calculation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to calculate matches' 
        });
    }
});

// ============ END VALENTIN API ============

// Serve gallery images
apiRouter.get('/gallery/image/:filename', (req, res) => {
    const filePath = path.join(GALLERY_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Image not found');
    }
});

// Get all gallery items (auth required - includes hidden)
apiRouter.get('/gallery', requireAuth, (req, res) => {
    const gallery = getGallery();
    res.json(gallery);
});

// Upload gallery image (auth required)
apiRouter.post('/gallery', requireAuth, galleryUpload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const gallery = getGallery();
    const item = {
        id: crypto.randomBytes(8).toString('hex'),
        filename: req.file.filename,
        title: req.body.title || '',
        description: req.body.description || '',
        tags: req.body.tags ? JSON.parse(req.body.tags) : [],
        type: req.body.type || 'upload',
        visible: true,
        createdAt: new Date().toISOString()
    };
    
    gallery.items.push(item);
    saveGallery(gallery);
    
    res.json({ success: true, item });
});

// Update gallery item (auth required)
apiRouter.put('/gallery/:id', requireAuth, (req, res) => {
    const gallery = getGallery();
    const item = gallery.items.find(i => i.id === req.params.id);
    
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    
    if (req.body.title !== undefined) item.title = req.body.title;
    if (req.body.description !== undefined) item.description = req.body.description;
    if (req.body.tags !== undefined) item.tags = req.body.tags;
    if (req.body.visible !== undefined) item.visible = req.body.visible;
    
    saveGallery(gallery);
    res.json({ success: true, item });
});

// Delete gallery item (auth required)
apiRouter.delete('/gallery/:id', requireAuth, (req, res) => {
    const gallery = getGallery();
    const item = gallery.items.find(i => i.id === req.params.id);
    
    if (item) {
        // Delete the file
        const filePath = path.join(GALLERY_DIR, item.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    
    gallery.items = gallery.items.filter(i => i.id !== req.params.id);
    saveGallery(gallery);
    res.json({ success: true });
});

// ============ PAGE EDITS API ============

const PAGE_EDITS_FILE = path.join(CONFIG_DIR, 'page-edits.json');

function loadPageEdits() {
    if (!fs.existsSync(PAGE_EDITS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(PAGE_EDITS_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function savePageEdits(edits) {
    fs.writeFileSync(PAGE_EDITS_FILE, JSON.stringify(edits, null, 2));
}

// Map page paths to actual file paths
function getPageFilePath(pagePath) {
    const pageMap = {
        '/': path.join(HOMEPAGE_DIR, 'index.html'),
        '/tools': path.join(HOMEPAGE_DIR, 'devtools.html'),
        '/gallery': path.join(HOMEPAGE_DIR, 'gallery.html')
    };
    
    // Handle member pages
    if (pagePath.startsWith('/member/')) {
        return path.join(HOMEPAGE_DIR, 'member.html');
    }
    
    return pageMap[pagePath] || null;
}

// Save page edits (auth required)
apiRouter.post('/page-edits', requireAuth, (req, res) => {
    const { page, edits } = req.body;
    
    if (!page || !edits || !Array.isArray(edits)) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    
    const filePath = getPageFilePath(page);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Page not found' });
    }
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Apply each edit
        for (const edit of edits) {
            // Escape special regex characters in original text
            const escapedOriginal = edit.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Create regex to find the text (be careful with whitespace)
            const regex = new RegExp(escapedOriginal.replace(/\s+/g, '\\s+'), 'g');
            content = content.replace(regex, edit.new);
        }
        
        // Save the modified file
        fs.writeFileSync(filePath, content);
        
        // Store edit history
        const allEdits = loadPageEdits();
        if (!allEdits[page]) allEdits[page] = [];
        allEdits[page].push({
            timestamp: new Date().toISOString(),
            edits: edits
        });
        savePageEdits(allEdits);
        
        res.json({ success: true, editsApplied: edits.length });
    } catch (err) {
        console.error('Error applying page edits:', err);
        res.status(500).json({ error: 'Failed to apply edits' });
    }
});

// Get edit history for a page (auth required)
apiRouter.get('/page-edits/:page', requireAuth, (req, res) => {
    const allEdits = loadPageEdits();
    const pageEdits = allEdits[req.params.page] || [];
    res.json(pageEdits);
});

// ============ CONTACTS API ============

function loadContacts() {
    if (!fs.existsSync(CONTACTS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveContacts(contacts) {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
}

// Public contact submission (no auth required)
apiRouter.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields required' });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }
    
    const contacts = loadContacts();
    const newContact = {
        id: crypto.randomBytes(8).toString('hex'),
        name: name.slice(0, 100),
        email: email.slice(0, 200),
        message: message.slice(0, 5000),
        createdAt: new Date().toISOString(),
        read: false
    };
    
    contacts.unshift(newContact);
    saveContacts(contacts);
    
    res.json({ success: true, id: newContact.id });
});

// Get all contacts (auth required)
apiRouter.get('/contacts', requireAuth, (req, res) => {
    const contacts = loadContacts();
    res.json(contacts);
});

// Mark contact as read (auth required)
apiRouter.put('/contacts/:id/read', requireAuth, (req, res) => {
    const contacts = loadContacts();
    const contact = contacts.find(c => c.id === req.params.id);
    if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
    }
    contact.read = true;
    saveContacts(contacts);
    res.json({ success: true });
});

// Delete contact (auth required)
apiRouter.delete('/contacts/:id', requireAuth, (req, res) => {
    let contacts = loadContacts();
    const idx = contacts.findIndex(c => c.id === req.params.id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Contact not found' });
    }
    contacts.splice(idx, 1);
    saveContacts(contacts);
    res.json({ success: true });
});

// ============ ROUTING ============

// Mount the API router at /api
// Note: /portal/api is already mounted earlier before portal static files
// Minecraft API
const minecraftAPI = require('./minecraft-api.js');
app.use('/api/minecraft', minecraftAPI);
const minecraftAdminAPI = require('./minecraft-admin-api.js');
app.use('/api/minecraft/admin', minecraftAdminAPI);
const minecraftDialogueAPI = require('./minecraft-dialogue-api.js');
app.use('/api/dialogue', minecraftDialogueAPI);
app.use('/api', apiRouter);

// Main homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(HOMEPAGE_DIR, 'index.html'));
});

// Static homepage files
app.get('/gallery', (req, res) => {
    res.sendFile(path.join(HOMEPAGE_DIR, 'gallery.html'));
});

app.get('/tools', (req, res) => {
    res.sendFile(path.join(HOMEPAGE_DIR, 'devtools.html'));
});

app.get('/preview-bg.html', (req, res) => {
    res.sendFile(path.join(HOMEPAGE_DIR, 'preview-bg.html'));
});

app.get('/backgrounds.js', (req, res) => {
    res.sendFile(path.join(HOMEPAGE_DIR, 'backgrounds.js'));
});

app.get('/favicon.svg', (req, res) => {
    res.sendFile(path.join(HOMEPAGE_DIR, 'favicon.svg'));
});

// Portal SPA - serve index.html for portal routes
// Minecraft pages
app.get('/mcwhitelist', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mcwhitelist.html'));
});

app.get('/mcstatus', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mcstatus.html'));
});

app.get('/mcadmin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mcadmin-portal.html'));
});

app.get('/portal', (req, res) => {
    res.sendFile(path.join(PORTAL_DIR, 'index.html'));
});
app.get('/portal/*', (req, res) => {
    res.sendFile(path.join(PORTAL_DIR, 'index.html'));
});

// Member pages - serve member.html template for username routes
// This must be after API routes and specific paths
app.get('/:username', (req, res, next) => {
    const { username } = req.params;
    
    // Skip if it looks like a file request, API call, or reserved path
    const reservedPaths = ['api', 'portal', 'gallery', 'tools', 'preview-bg.html', 'backgrounds.js', 'favicon.svg', 'assets', 'robots.txt', 'mcwhitelist', 'mcstatus', 'mcadmin'];
    if (username.includes('.') || reservedPaths.includes(username.toLowerCase())) {
        return next();
    }
    
    // Check if user exists in team
    const team = getTeam();
    const member = team.members.find(m => 
        m.username.toLowerCase() === username.toLowerCase() && m.visible !== false
    );
    
    if (member) {
        res.sendFile(path.join(HOMEPAGE_DIR, 'member.html'));
    } else {
        // User not found - 404
        res.status(404).send('Member not found');
    }
});

// Fallback 404
app.use((req, res) => {
    res.status(404).send('Not found');
});

server.listen(PORT, () => {
    console.log(`VPS Portal running on port ${PORT}`);
});
// webhook trigger Tue Feb  3 23:48:02 UTC 2026
