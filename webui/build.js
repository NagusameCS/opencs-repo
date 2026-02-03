#!/usr/bin/env node
/**
 * Build script for obfuscating/minifying JavaScript and CSS files
 * Usage: node build.js [--minify] [--obfuscate]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const doMinify = args.includes('--minify') || args.includes('-m');
const doObfuscate = args.includes('--obfuscate') || args.includes('-o');
const isProduction = args.includes('--production') || args.includes('-p');

const SOURCE_DIR = path.join(__dirname, 'public');
const BUILD_DIR = path.join(__dirname, 'dist');
const HOMEPAGE_SOURCE = path.join(__dirname, '..', 'homepage');
const HOMEPAGE_BUILD = path.join(__dirname, '..', 'homepage-dist');

console.log('🔨 Building VPS Portal...\n');

// Ensure build directories exist
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });
if (!fs.existsSync(HOMEPAGE_BUILD)) fs.mkdirSync(HOMEPAGE_BUILD, { recursive: true });

// Check if dependencies are installed
function checkDependencies() {
    try {
        require.resolve('terser');
    } catch (e) {
        console.log('📦 Installing terser for minification...');
        execSync('npm install --save-dev terser', { stdio: 'inherit' });
    }
    
    if (doObfuscate) {
        try {
            require.resolve('javascript-obfuscator');
        } catch (e) {
            console.log('📦 Installing javascript-obfuscator...');
            execSync('npm install --save-dev javascript-obfuscator', { stdio: 'inherit' });
        }
    }
}

// Simple minification for JS (removes comments, whitespace)
function minifyJS(code) {
    if (!doMinify && !isProduction) return code;
    
    try {
        const { minify } = require('terser');
        const result = minify(code, {
            compress: {
                dead_code: true,
                drop_console: isProduction,
                drop_debugger: true
            },
            mangle: true,
            output: {
                comments: false
            }
        });
        return result.code || code;
    } catch (e) {
        console.warn('⚠️  Minification failed:', e.message);
        return code;
    }
}

// Obfuscate JS code
function obfuscateJS(code) {
    if (!doObfuscate) return code;
    
    try {
        const JavaScriptObfuscator = require('javascript-obfuscator');
        const result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.5,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.2,
            debugProtection: isProduction,
            disableConsoleOutput: isProduction,
            identifierNamesGenerator: 'hexadecimal',
            renameGlobals: false,
            rotateStringArray: true,
            selfDefending: isProduction,
            shuffleStringArray: true,
            splitStrings: true,
            splitStringsChunkLength: 5,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.5,
            transformObjectKeys: true,
            unicodeEscapeSequence: false
        });
        return result.getObfuscatedCode();
    } catch (e) {
        console.warn('⚠️  Obfuscation failed:', e.message);
        return code;
    }
}

// Minify CSS
function minifyCSS(code) {
    if (!doMinify && !isProduction) return code;
    
    // Simple CSS minification
    return code
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ')             // Collapse whitespace
        .replace(/\s*([{}:;,>+~])\s*/g, '$1') // Remove space around selectors
        .replace(/;}/g, '}')              // Remove last semicolon
        .trim();
}

// Process a directory
function processDirectory(source, dest) {
    const files = fs.readdirSync(source);
    
    for (const file of files) {
        const sourcePath = path.join(source, file);
        const destPath = path.join(dest, file);
        const stat = fs.statSync(sourcePath);
        
        if (stat.isDirectory()) {
            if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
            processDirectory(sourcePath, destPath);
        } else {
            const ext = path.extname(file).toLowerCase();
            let content = fs.readFileSync(sourcePath, 'utf8');
            
            if (ext === '.js') {
                console.log(`  📜 Processing ${file}...`);
                content = minifyJS(content);
                if (doObfuscate) content = obfuscateJS(content);
            } else if (ext === '.css') {
                console.log(`  🎨 Processing ${file}...`);
                content = minifyCSS(content);
            } else if (ext === '.html') {
                console.log(`  📄 Copying ${file}...`);
                // For HTML, just minify inline JS if needed
                if (doMinify || isProduction) {
                    content = content.replace(/\s+/g, ' ');
                }
            } else {
                console.log(`  📁 Copying ${file}...`);
            }
            
            fs.writeFileSync(destPath, content);
        }
    }
}

// Main build
console.log('Options:', { minify: doMinify, obfuscate: doObfuscate, production: isProduction });
console.log('');

if (doMinify || doObfuscate) {
    checkDependencies();
}

console.log('📂 Building portal...');
processDirectory(SOURCE_DIR, BUILD_DIR);

console.log('\n📂 Building homepage...');
processDirectory(HOMEPAGE_SOURCE, HOMEPAGE_BUILD);

console.log('\n✅ Build complete!');
console.log(`   Portal: ${BUILD_DIR}`);
console.log(`   Homepage: ${HOMEPAGE_BUILD}`);
console.log('');

if (isProduction) {
    console.log('🚀 Production build ready. Update server.js to serve from dist directories.');
}
