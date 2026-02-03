"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clear = exports.list = exports.section = exports.keyValue = exports.progress = exports.table = exports.spinner = exports.warn = exports.info = exports.error = exports.success = exports.menuItem = exports.statusBadge = exports.divider = exports.header = exports.box = exports.icons = exports.colors = void 0;
const chalk_1 = __importDefault(require("chalk"));
// Box drawing characters
const BOX = {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    teeRight: '├',
    teeLeft: '┤',
    cross: '┼',
    doubleLine: '═',
};
// Space Mono inspired palette (matches website)
exports.colors = {
    primary: chalk_1.default.hex('#b794f6'), // Purple (--purple)
    secondary: chalk_1.default.hex('#67e8f9'), // Cyan (--cyan)
    success: chalk_1.default.hex('#4ade80'), // Green (--green)
    warning: chalk_1.default.hex('#fb923c'), // Orange (--orange)
    error: chalk_1.default.hex('#f87171'), // Red (--red)
    muted: chalk_1.default.hex('#888888'), // Gray (--text-dim)
    text: chalk_1.default.hex('#eeeeee'), // Light (--text)
    dim: chalk_1.default.hex('#555555'), // Dim (--text-xdim)
    bright: chalk_1.default.hex('#ffffff'), // White
};
// Render width helper (strips ANSI codes)
const stripAnsi = (str) => str.replace(/\x1B\[[0-9;]*m/g, '');
// ASCII icons - no emojis, Space Mono style
exports.icons = {
    check: exports.colors.success('[OK]'),
    cross: exports.colors.error('[X]'),
    arrow: exports.colors.primary('->'),
    bullet: exports.colors.dim('::'),
    // Service icons as text tags (like website)
    discord: exports.colors.warning('[DIS]'),
    phone: exports.colors.warning('[PHN]'),
    browser: exports.colors.warning('[WEB]'),
    email: exports.colors.warning('[EML]'),
    webhook: exports.colors.warning('[API]'),
    // Action icons
    settings: exports.colors.secondary('[CFG]'),
    lock: exports.colors.dim('[ENC]'),
    unlock: '[DEC]',
    trash: exports.colors.error('[DEL]'),
    add: exports.colors.success('[ADD]'),
    edit: '[EDT]',
    test: exports.colors.secondary('[TST]'),
    rocket: exports.colors.success('[GO]'),
    bell: exports.colors.secondary('[NFY]'),
    on: exports.colors.success('[ON]'),
    off: exports.colors.muted('[OFF]'),
    dot: exports.colors.primary('::'),
};
const box = (content, options = {}) => {
    const { title, width = 60, padding = 1, borderColor = exports.colors.dim, style = 'single' } = options;
    const lines = content.split('\n');
    const innerWidth = width - 2;
    const hChar = style === 'double' ? '═' : BOX.horizontal;
    const pad = ' '.repeat(padding);
    const emptyLine = borderColor(BOX.vertical) + ' '.repeat(innerWidth) + borderColor(BOX.vertical);
    // Top border
    let result = borderColor(style === 'double' ? '╔' : BOX.topLeft);
    if (title) {
        const titleText = ` ${title} `;
        const remaining = innerWidth - titleText.length;
        const left = Math.floor(remaining / 2);
        const right = remaining - left;
        result += borderColor(hChar.repeat(left)) + exports.colors.bright.bold(titleText) + borderColor(hChar.repeat(right));
    }
    else {
        result += borderColor(hChar.repeat(innerWidth));
    }
    result += borderColor(style === 'double' ? '╗' : BOX.topRight) + '\n';
    // Padding top
    for (let i = 0; i < padding; i++) {
        result += emptyLine + '\n';
    }
    // Content
    for (const line of lines) {
        const stripped = stripAnsi(line);
        const paddingNeeded = innerWidth - stripped.length - (padding * 2);
        result += borderColor(BOX.vertical) + pad + line + ' '.repeat(Math.max(0, paddingNeeded)) + pad + borderColor(BOX.vertical) + '\n';
    }
    // Padding bottom
    for (let i = 0; i < padding; i++) {
        result += emptyLine + '\n';
    }
    // Bottom border
    result += borderColor(style === 'double' ? '╚' : BOX.bottomLeft) + borderColor(hChar.repeat(innerWidth)) + borderColor(style === 'double' ? '╝' : BOX.bottomRight);
    return result;
};
exports.box = box;
const header = () => {
    console.log();
    console.log(exports.colors.dim('  ┌') + exports.colors.dim('─'.repeat(38)) + exports.colors.dim('┐'));
    console.log(exports.colors.dim('  │') + exports.colors.primary(' > ') + exports.colors.text('know') + exports.colors.primary('tif') + ' '.repeat(27) + exports.colors.dim('│'));
    console.log(exports.colors.dim('  │') + exports.colors.muted('   GitHub Notifications') + ' '.repeat(14) + exports.colors.dim('│'));
    console.log(exports.colors.dim('  └') + exports.colors.dim('─'.repeat(38)) + exports.colors.dim('┘'));
    console.log();
};
exports.header = header;
const divider = (width = 50, style = 'light') => {
    const char = style === 'heavy' ? '═' : '─';
    console.log(exports.colors.dim('  ' + char.repeat(width)));
};
exports.divider = divider;
const statusBadge = (enabled, label) => {
    if (enabled) {
        return `${exports.colors.success('+')} ${exports.colors.text(label)}`;
    }
    return `${exports.colors.dim('-')} ${exports.colors.muted(label)}`;
};
exports.statusBadge = statusBadge;
const menuItem = (key, label, description) => {
    const keyPart = exports.colors.primary(`[${key}]`);
    const labelPart = exports.colors.text(label);
    if (description) {
        return `  ${keyPart} ${labelPart} ${exports.colors.muted('- ' + description)}`;
    }
    return `  ${keyPart} ${labelPart}`;
};
exports.menuItem = menuItem;
const success = (message) => {
    console.log(`\n  ${exports.icons.check} ${exports.colors.success(message)}\n`);
};
exports.success = success;
const error = (message) => {
    console.log(`\n  ${exports.icons.cross} ${exports.colors.error(message)}\n`);
};
exports.error = error;
const info = (message) => {
    console.log(`  ${exports.icons.arrow} ${exports.colors.text(message)}`);
};
exports.info = info;
const warn = (message) => {
    console.log(`  ${exports.colors.warning('!')} ${exports.colors.warning(message)}`);
};
exports.warn = warn;
const spinner = async (message, fn) => {
    const frames = ['|', '/', '-', '\\'];
    let i = 0;
    const interval = setInterval(() => {
        process.stdout.write(`\r  ${exports.colors.primary(frames[i])} ${exports.colors.muted(message)}`);
        i = (i + 1) % frames.length;
    }, 100);
    try {
        const result = await fn();
        clearInterval(interval);
        process.stdout.write(`\r  ${exports.icons.check} ${exports.colors.success(message)}          \n`);
        return result;
    }
    catch (err) {
        clearInterval(interval);
        process.stdout.write(`\r  ${exports.icons.cross} ${exports.colors.error(message)}          \n`);
        throw err;
    }
};
exports.spinner = spinner;
const table = (data) => {
    const maxLabel = Math.max(...data.map(d => d.label.length));
    for (const row of data) {
        const label = exports.colors.muted(row.label.padEnd(maxLabel));
        const status = row.status !== undefined
            ? (row.status ? exports.colors.success(' +') : exports.colors.error(' -'))
            : '';
        console.log(`  ${label}  ${exports.colors.text(row.value)}${status}`);
    }
};
exports.table = table;
const progress = (current, total, width = 30) => {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const bar = exports.colors.primary('#'.repeat(filled)) + exports.colors.dim('.'.repeat(empty));
    const pct = Math.round((current / total) * 100);
    return `[${bar}] ${exports.colors.muted(pct + '%')}`;
};
exports.progress = progress;
const keyValue = (key, value, keyWidth = 15) => {
    return `  ${exports.colors.muted(key.padEnd(keyWidth))} ${exports.colors.text(value)}`;
};
exports.keyValue = keyValue;
const section = (title) => {
    console.log();
    console.log(exports.colors.bright.bold(`  ${title}`));
    console.log(exports.colors.dim('  ' + '─'.repeat(title.length + 2)));
};
exports.section = section;
const list = (items, prefix) => {
    for (const item of items) {
        console.log(`  ${prefix || exports.colors.dim('*')} ${exports.colors.text(item)}`);
    }
};
exports.list = list;
const clear = () => {
    console.clear();
};
exports.clear = clear;
