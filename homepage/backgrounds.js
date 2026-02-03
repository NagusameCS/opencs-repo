/**
 * Artist-themed animated backgrounds
 * Each background replicates the distinctive style of a famous artist
 */

const ArtistBackgrounds = {
    
    // 1. MC ESCHER - Impossible geometry and infinite stairways
    escher: {
        name: 'M.C. Escher',
        description: 'Impossible geometry and infinite stairways',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            let offset = 0;
            
            // Isometric projection helpers
            const isoAngle = Math.PI / 6; // 30 degrees
            const cos30 = Math.cos(isoAngle);
            const sin30 = Math.sin(isoAngle);
            
            function isoPoint(x, y, z) {
                return {
                    x: (x - y) * cos30,
                    y: (x + y) * sin30 - z
                };
            }
            
            // Draw a single 3D step block
            function drawStep(cx, cy, x, y, z, w, h, d, alpha) {
                const p1 = isoPoint(x, y, z);
                const p2 = isoPoint(x + w, y, z);
                const p3 = isoPoint(x + w, y + d, z);
                const p4 = isoPoint(x, y + d, z);
                const p5 = isoPoint(x, y, z + h);
                const p6 = isoPoint(x + w, y, z + h);
                const p7 = isoPoint(x + w, y + d, z + h);
                const p8 = isoPoint(x, y + d, z + h);
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.globalAlpha = alpha;
                
                // Top face (lightest)
                ctx.beginPath();
                ctx.moveTo(p5.x, p5.y);
                ctx.lineTo(p6.x, p6.y);
                ctx.lineTo(p7.x, p7.y);
                ctx.lineTo(p8.x, p8.y);
                ctx.closePath();
                ctx.fillStyle = accentColor;
                ctx.globalAlpha = alpha * 0.4;
                ctx.fill();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Left face (medium)
                ctx.beginPath();
                ctx.moveTo(p4.x, p4.y);
                ctx.lineTo(p8.x, p8.y);
                ctx.lineTo(p7.x, p7.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.closePath();
                ctx.globalAlpha = alpha * 0.25;
                ctx.fill();
                ctx.globalAlpha = alpha;
                ctx.stroke();
                
                // Right face (darkest)
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p5.x, p5.y);
                ctx.lineTo(p8.x, p8.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
                ctx.globalAlpha = alpha * 0.15;
                ctx.fill();
                ctx.globalAlpha = alpha;
                ctx.stroke();
                
                ctx.restore();
            }
            
            // Draw Penrose-style infinite staircase
            function drawPenroseStairs(cx, cy, size, rotation, alpha) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rotation);
                
                const steps = 12;
                const stepW = size / 3;
                const stepH = size / 8;
                const stepD = size / 4;
                
                // Draw 4 connected staircases forming an impossible loop
                for (let side = 0; side < 4; side++) {
                    ctx.save();
                    ctx.rotate(side * Math.PI / 2);
                    
                    for (let i = 0; i < steps / 4; i++) {
                        const progress = i / (steps / 4);
                        const x = -size / 2 + i * stepW;
                        const y = -size / 4;
                        const z = i * stepH;
                        
                        drawStep(0, 0, x, y, z, stepW, stepH, stepD, alpha * (0.6 + progress * 0.4));
                    }
                    
                    ctx.restore();
                }
                
                ctx.restore();
            }
            
            // Draw impossible staircase that goes up forever
            function drawInfiniteStairs(cx, cy, size, phase, alpha) {
                const steps = 16;
                const stepW = size / 8;
                const stepH = size / 16;
                const stepD = size / 6;
                
                for (let i = 0; i < steps; i++) {
                    const angle = (i / steps) * Math.PI * 2 + phase;
                    const radius = size / 3;
                    
                    // Calculate position on a circular path
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius * 0.4; // Flatten for isometric look
                    const z = (i * stepH) % (stepH * 4); // Loop the height
                    
                    // Depth sorting - draw back stairs first
                    const drawOrder = (Math.sin(angle) + 1) / 2;
                    
                    ctx.save();
                    ctx.translate(cx, cy);
                    
                    drawStep(0, 0, x - stepW/2, y - stepD/2, z + drawOrder * 20, 
                             stepW, stepH, stepD, alpha * (0.3 + drawOrder * 0.5));
                    
                    ctx.restore();
                }
            }
            
            // Draw impossible triangle (Penrose triangle)
            function drawPenroseTriangle(cx, cy, size, alpha) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.globalAlpha = alpha;
                
                const h = size * Math.sqrt(3) / 2;
                const thickness = size / 5;
                
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 2;
                ctx.fillStyle = accentColor;
                
                // Draw 3 bars that appear to connect impossibly
                for (let i = 0; i < 3; i++) {
                    ctx.save();
                    ctx.rotate(i * Math.PI * 2 / 3);
                    
                    // Outer edge
                    ctx.beginPath();
                    ctx.moveTo(-size/2, h/3);
                    ctx.lineTo(0, -h*2/3);
                    ctx.lineTo(thickness/2, -h*2/3 + thickness);
                    ctx.lineTo(-size/2 + thickness, h/3);
                    ctx.closePath();
                    ctx.globalAlpha = alpha * 0.3;
                    ctx.fill();
                    ctx.globalAlpha = alpha;
                    ctx.stroke();
                    
                    ctx.restore();
                }
                
                ctx.restore();
            }
            
            // Draw tessellated lizard/fish pattern (Escher's famous tessellations)
            function drawTessellation(phase) {
                ctx.globalAlpha = 0.08;
                const tileSize = 60;
                const cols = Math.ceil(canvas.width / tileSize) + 2;
                const rows = Math.ceil(canvas.height / tileSize) + 2;
                
                for (let row = -1; row < rows; row++) {
                    for (let col = -1; col < cols; col++) {
                        const x = col * tileSize + (row % 2) * (tileSize / 2) + (phase % tileSize);
                        const y = row * tileSize * 0.866;
                        
                        ctx.strokeStyle = accentColor;
                        ctx.lineWidth = 1;
                        
                        // Hexagonal tessellation
                        ctx.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const angle = i * Math.PI / 3;
                            const px = x + Math.cos(angle) * tileSize / 2;
                            const py = y + Math.sin(angle) * tileSize / 2;
                            if (i === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1;
            }
            
            function draw() {
                // Dark background with subtle gradient
                const gradient = ctx.createRadialGradient(
                    canvas.width/2, canvas.height/2, 0,
                    canvas.width/2, canvas.height/2, canvas.width
                );
                gradient.addColorStop(0, '#0a0a0f');
                gradient.addColorStop(1, '#000000');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw tessellation background
                drawTessellation(offset * 0.3);
                
                // Draw main Penrose staircase in center
                drawPenroseStairs(
                    canvas.width / 2, 
                    canvas.height / 2, 
                    Math.min(canvas.width, canvas.height) * 0.35,
                    offset * 0.003,
                    0.4
                );
                
                // Draw floating infinite staircases
                drawInfiniteStairs(
                    canvas.width * 0.2, 
                    canvas.height * 0.3, 
                    150,
                    offset * 0.008,
                    0.25
                );
                
                drawInfiniteStairs(
                    canvas.width * 0.8, 
                    canvas.height * 0.6, 
                    120,
                    -offset * 0.01,
                    0.2
                );
                
                // Draw Penrose triangles
                drawPenroseTriangle(
                    canvas.width * 0.15, 
                    canvas.height * 0.7, 
                    80,
                    0.15 + Math.sin(offset * 0.01) * 0.05
                );
                
                drawPenroseTriangle(
                    canvas.width * 0.85, 
                    canvas.height * 0.25, 
                    100,
                    0.12 + Math.cos(offset * 0.012) * 0.05
                );
                
                drawPenroseTriangle(
                    canvas.width * 0.5, 
                    canvas.height * 0.15, 
                    60,
                    0.1 + Math.sin(offset * 0.015) * 0.03
                );
                
                offset += 0.5;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 2. VAN GOGH - Swirling brushstrokes, Starry Night style
    vangogh: {
        name: 'Vincent van Gogh',
        description: 'Swirling starry night brushstrokes',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            const swirls = [];
            const stars = [];
            
            // Van Gogh's authentic palette
            const vgColors = {
                skyDark: '#0a1628',
                skyMid: '#1e3a5f',
                skyLight: '#2d5a87',
                yellow: '#ffd93d',
                yellowBright: '#ffe566',
                orange: '#f5a623',
                white: '#fffde7'
            };
            
            // Create swirling patterns
            for (let i = 0; i < 10; i++) {
                swirls.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight * 0.7,
                    radius: 80 + Math.random() * 150,
                    speed: 0.002 + Math.random() * 0.004,
                    angle: Math.random() * Math.PI * 2,
                    layers: 4 + Math.floor(Math.random() * 3),
                    hue: Math.random() > 0.5 ? 45 : 210 // Yellow or blue swirls
                });
            }
            
            // Create stars with Van Gogh's iconic radiating style
            for (let i = 0; i < 25; i++) {
                stars.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight * 0.6,
                    size: 5 + Math.random() * 15,
                    pulse: Math.random() * Math.PI * 2,
                    pulseSpeed: 0.015 + Math.random() * 0.025,
                    rays: 6 + Math.floor(Math.random() * 6)
                });
            }
            
            function draw() {
                // Authentic Starry Night gradient - deep cobalt blue
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, vgColors.skyDark);
                gradient.addColorStop(0.4, vgColors.skyMid);
                gradient.addColorStop(0.7, vgColors.skyLight);
                gradient.addColorStop(1, '#0d1f3c');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw swirls with brushstroke texture
                swirls.forEach(swirl => {
                    swirl.angle += swirl.speed;
                    
                    for (let layer = 0; layer < swirl.layers; layer++) {
                        ctx.beginPath();
                        const layerRadius = swirl.radius - layer * 18;
                        
                        for (let a = 0; a < Math.PI * 5; a += 0.08) {
                            const spiralRadius = layerRadius * (1 - a / (Math.PI * 10));
                            const x = swirl.x + Math.cos(a + swirl.angle + layer * 0.4) * spiralRadius;
                            const y = swirl.y + Math.sin(a + swirl.angle + layer * 0.4) * spiralRadius * 0.5;
                            
                            if (a === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        
                        // Use yellow or blue based on swirl type
                        const color = swirl.hue === 45 
                            ? `rgba(255, 217, 61, ${0.2 - layer * 0.03})`
                            : `rgba(45, 90, 135, ${0.25 - layer * 0.04})`;
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 4 - layer * 0.6;
                        ctx.stroke();
                    }
                });
                
                // Draw Van Gogh style radiating stars
                stars.forEach(star => {
                    star.pulse += star.pulseSpeed;
                    const scale = 1 + Math.sin(star.pulse) * 0.4;
                    const size = star.size * scale;
                    
                    // Outer glow - yellow corona
                    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, size * 4);
                    glow.addColorStop(0, 'rgba(255, 229, 102, 0.9)');
                    glow.addColorStop(0.2, 'rgba(255, 217, 61, 0.6)');
                    glow.addColorStop(0.5, 'rgba(245, 166, 35, 0.3)');
                    glow.addColorStop(1, 'transparent');
                    
                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, size * 4, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Radiating rays (Van Gogh signature style)
                    ctx.strokeStyle = 'rgba(255, 229, 102, 0.7)';
                    ctx.lineWidth = 2;
                    for (let i = 0; i < star.rays; i++) {
                        const angle = (i / star.rays) * Math.PI * 2 + star.pulse * 0.3;
                        const rayLength = size * 2 + Math.sin(star.pulse + i) * size;
                        
                        ctx.beginPath();
                        ctx.moveTo(star.x + Math.cos(angle) * size, star.y + Math.sin(angle) * size);
                        ctx.lineTo(star.x + Math.cos(angle) * rayLength, star.y + Math.sin(angle) * rayLength);
                        ctx.stroke();
                    }
                    
                    // Star core - bright white/yellow
                    ctx.fillStyle = vgColors.white;
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
                    ctx.fill();
                });
                
                // Visible brushstroke texture overlay
                ctx.globalAlpha = 0.06;
                for (let i = 0; i < 300; i++) {
                    const x = Math.random() * canvas.width;
                    const y = Math.random() * canvas.height;
                    const angle = Math.sin(x * 0.008 + y * 0.008) * 0.8;
                    const hue = y < canvas.height * 0.5 ? 45 : 210;
                    
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(angle);
                    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
                    ctx.fillRect(-20, -3, 40, 6);
                    ctx.restore();
                }
                ctx.globalAlpha = 1;
                
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 3. MONDRIAN - Primary colors, geometric grids
    mondrian: {
        name: 'Piet Mondrian',
        description: 'Bold primary colors and geometric grids',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            // Authentic Mondrian colors - pure primaries
            const colors = [
                '#fafafa', // White (most common)
                '#fafafa',
                '#fafafa',
                '#dd0100', // Mondrian red
                '#0a2f9a', // Mondrian blue  
                '#fac901', // Mondrian yellow
                '#fafafa',
            ];
            
            const grid = [];
            let time = 0;
            
            function generateGrid() {
                grid.length = 0;
                let x = 0;
                
                while (x < canvas.width + 100) {
                    let y = 0;
                    const colWidth = 100 + Math.random() * 250;
                    
                    while (y < canvas.height + 100) {
                        const rowHeight = 80 + Math.random() * 200;
                        grid.push({
                            x, y,
                            width: colWidth,
                            height: rowHeight,
                            color: colors[Math.floor(Math.random() * colors.length)],
                            targetOpacity: Math.random() * 0.25 + 0.15,
                            opacity: 0,
                            phase: Math.random() * Math.PI * 2
                        });
                        y += rowHeight;
                    }
                    x += colWidth;
                }
            }
            
            generateGrid();
            
            function draw() {
                // Warm white/cream background
                ctx.fillStyle = '#f8f6f0';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                time += 0.008;
                
                // Draw colored rectangles
                grid.forEach(cell => {
                    const pulse = Math.sin(time + cell.phase) * 0.08 + 0.92;
                    cell.opacity += (cell.targetOpacity * pulse - cell.opacity) * 0.015;
                    
                    if (cell.color !== '#fafafa') {
                        ctx.globalAlpha = cell.opacity;
                        ctx.fillStyle = cell.color;
                        ctx.fillRect(cell.x + 8, cell.y + 8, cell.width - 16, cell.height - 16);
                    }
                });
                
                ctx.globalAlpha = 1;
                
                // Draw thick black grid lines (Mondrian's signature)
                ctx.strokeStyle = '#1a1a1a';
                ctx.lineWidth = 10;
                
                grid.forEach(cell => {
                    ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
                });
                
                requestAnimationFrame(draw);
            }
            
            draw();
            
            // Regenerate occasionally
            setInterval(generateGrid, 10000);
        }
    },
    
    // 4. KANDINSKY - Abstract circles and geometric shapes
    kandinsky: {
        name: 'Wassily Kandinsky',
        description: 'Abstract circles, lines, and geometric harmony',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            const shapes = [];
            // Kandinsky's rich, vibrant palette
            const palette = [
                '#1a237e', // Deep blue
                '#c62828', // Vivid red
                '#f9a825', // Golden yellow
                '#2e7d32', // Forest green
                '#6a1b9a', // Royal purple
                '#00838f', // Teal
                '#ef6c00', // Burnt orange
                '#d81b60', // Magenta
                '#303f9f', // Indigo
            ];
            
            for (let i = 0; i < 30; i++) {
                shapes.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    type: ['circle', 'triangle', 'line', 'arc', 'square'][Math.floor(Math.random() * 5)],
                    size: 25 + Math.random() * 120,
                    color: palette[Math.floor(Math.random() * palette.length)],
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.015,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    opacity: 0.25 + Math.random() * 0.45
                });
            }
            
            function draw() {
                // Warm cream background like Kandinsky's canvases
                const bg = ctx.createRadialGradient(
                    canvas.width/2, canvas.height/2, 0,
                    canvas.width/2, canvas.height/2, canvas.width * 0.7
                );
                bg.addColorStop(0, '#f5efe6');
                bg.addColorStop(1, '#e8ddd0');
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                shapes.forEach(shape => {
                    shape.x += shape.vx;
                    shape.y += shape.vy;
                    shape.rotation += shape.rotationSpeed;
                    
                    // Wrap around
                    if (shape.x < -120) shape.x = canvas.width + 120;
                    if (shape.x > canvas.width + 120) shape.x = -120;
                    if (shape.y < -120) shape.y = canvas.height + 120;
                    if (shape.y > canvas.height + 120) shape.y = -120;
                    
                    ctx.save();
                    ctx.translate(shape.x, shape.y);
                    ctx.rotate(shape.rotation);
                    ctx.globalAlpha = shape.opacity;
                    
                    switch (shape.type) {
                        case 'circle':
                            // Concentric circles with color variation
                            for (let r = shape.size; r > 8; r -= 12) {
                                ctx.beginPath();
                                ctx.arc(0, 0, r, 0, Math.PI * 2);
                                ctx.strokeStyle = shape.color;
                                ctx.lineWidth = 3;
                                ctx.stroke();
                            }
                            // Filled center
                            ctx.beginPath();
                            ctx.arc(0, 0, shape.size * 0.25, 0, Math.PI * 2);
                            ctx.fillStyle = shape.color;
                            ctx.fill();
                            break;
                            
                        case 'triangle':
                            ctx.beginPath();
                            ctx.moveTo(0, -shape.size);
                            ctx.lineTo(-shape.size * 0.866, shape.size * 0.5);
                            ctx.lineTo(shape.size * 0.866, shape.size * 0.5);
                            ctx.closePath();
                            ctx.strokeStyle = shape.color;
                            ctx.lineWidth = 4;
                            ctx.stroke();
                            // Inner fill
                            ctx.globalAlpha = shape.opacity * 0.3;
                            ctx.fillStyle = shape.color;
                            ctx.fill();
                            break;
                            
                        case 'line':
                            ctx.beginPath();
                            ctx.moveTo(-shape.size, 0);
                            ctx.lineTo(shape.size, 0);
                            ctx.strokeStyle = shape.color;
                            ctx.lineWidth = 6;
                            ctx.lineCap = 'round';
                            ctx.stroke();
                            break;
                            
                        case 'arc':
                            ctx.beginPath();
                            ctx.arc(0, 0, shape.size, 0, Math.PI * 1.5);
                            ctx.strokeStyle = shape.color;
                            ctx.lineWidth = 5;
                            ctx.stroke();
                            break;
                            
                        case 'square':
                            ctx.strokeStyle = shape.color;
                            ctx.lineWidth = 4;
                            ctx.strokeRect(-shape.size/2, -shape.size/2, shape.size, shape.size);
                            ctx.globalAlpha = shape.opacity * 0.2;
                            ctx.fillStyle = shape.color;
                            ctx.fillRect(-shape.size/2, -shape.size/2, shape.size, shape.size);
                            break;
                    }
                    
                    ctx.restore();
                });
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 5. POLLOCK - Drip painting, splatter patterns
    pollock: {
        name: 'Jackson Pollock',
        description: 'Energetic drip and splatter expressionism',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            const drips = [];
            const colors = ['#1a1a1a', '#8b4513', '#daa520', '#2f4f4f', '#800000'];
            
            function addDrip() {
                drips.push({
                    x: Math.random() * canvas.width,
                    y: -10,
                    vx: (Math.random() - 0.5) * 4,
                    vy: Math.random() * 3 + 1,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    size: 2 + Math.random() * 4,
                    trail: [],
                    maxTrail: 50 + Math.floor(Math.random() * 100)
                });
            }
            
            // Initial drips
            for (let i = 0; i < 20; i++) {
                addDrip();
                drips[drips.length - 1].y = Math.random() * canvas.height;
            }
            
            let splatters = [];
            
            function draw() {
                // Slightly fade background
                ctx.fillStyle = 'rgba(245, 240, 230, 0.01)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Add new drips
                if (Math.random() < 0.1) addDrip();
                
                drips.forEach((drip, index) => {
                    // Physics
                    drip.x += drip.vx;
                    drip.y += drip.vy;
                    drip.vx *= 0.99;
                    drip.vy += 0.05;
                    
                    // Add to trail
                    drip.trail.push({ x: drip.x, y: drip.y });
                    if (drip.trail.length > drip.maxTrail) {
                        drip.trail.shift();
                    }
                    
                    // Draw trail
                    if (drip.trail.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(drip.trail[0].x, drip.trail[0].y);
                        for (let i = 1; i < drip.trail.length; i++) {
                            ctx.lineTo(drip.trail[i].x, drip.trail[i].y);
                        }
                        ctx.strokeStyle = drip.color;
                        ctx.lineWidth = drip.size;
                        ctx.lineCap = 'round';
                        ctx.globalAlpha = 0.6;
                        ctx.stroke();
                    }
                    
                    // Splatter on impact
                    if (drip.y > canvas.height && Math.random() < 0.5) {
                        for (let s = 0; s < 8; s++) {
                            splatters.push({
                                x: drip.x + (Math.random() - 0.5) * 40,
                                y: canvas.height - Math.random() * 20,
                                size: drip.size * (0.5 + Math.random()),
                                color: drip.color,
                                life: 1
                            });
                        }
                        drips.splice(index, 1);
                    }
                    
                    // Remove if off screen
                    if (drip.y > canvas.height + 50 || drip.x < -50 || drip.x > canvas.width + 50) {
                        drips.splice(index, 1);
                    }
                });
                
                // Draw splatters
                splatters.forEach((splat, index) => {
                    ctx.globalAlpha = splat.life * 0.8;
                    ctx.fillStyle = splat.color;
                    ctx.beginPath();
                    ctx.arc(splat.x, splat.y, splat.size, 0, Math.PI * 2);
                    ctx.fill();
                    
                    splat.life -= 0.002;
                    if (splat.life <= 0) splatters.splice(index, 1);
                });
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            // Initial background
            ctx.fillStyle = '#f5f0e6';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            draw();
        }
    },
    
    // 6. HOKUSAI - The Great Wave style, Japanese woodblock
    hokusai: {
        name: 'Katsushika Hokusai',
        description: 'The Great Wave Japanese woodblock style',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            let time = 0;
            
            function draw() {
                // Sky gradient
                const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                skyGradient.addColorStop(0, '#87ceeb');
                skyGradient.addColorStop(0.4, '#e6d5ac');
                skyGradient.addColorStop(1, '#1a4a6e');
                ctx.fillStyle = skyGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                time += 0.02;
                
                // Draw waves
                for (let layer = 0; layer < 5; layer++) {
                    const yOffset = canvas.height * 0.4 + layer * 80;
                    const amplitude = 40 - layer * 5;
                    const frequency = 0.008 + layer * 0.002;
                    const speed = 0.5 - layer * 0.08;
                    
                    ctx.beginPath();
                    ctx.moveTo(0, canvas.height);
                    
                    for (let x = 0; x <= canvas.width; x += 5) {
                        const y = yOffset + 
                            Math.sin(x * frequency + time * speed) * amplitude +
                            Math.sin(x * frequency * 2 + time * speed * 1.5) * (amplitude * 0.5);
                        
                        if (x === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    
                    ctx.lineTo(canvas.width, canvas.height);
                    ctx.lineTo(0, canvas.height);
                    ctx.closePath();
                    
                    const waveGradient = ctx.createLinearGradient(0, yOffset - amplitude, 0, yOffset + amplitude * 2);
                    waveGradient.addColorStop(0, `rgba(26, 74, 110, ${0.9 - layer * 0.15})`);
                    waveGradient.addColorStop(1, `rgba(10, 40, 60, ${0.95 - layer * 0.1})`);
                    ctx.fillStyle = waveGradient;
                    ctx.fill();
                    
                    // Wave crests (foam)
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 - layer * 0.08})`;
                    ctx.lineWidth = 2;
                    
                    for (let x = 0; x <= canvas.width; x += 5) {
                        const y = yOffset + 
                            Math.sin(x * frequency + time * speed) * amplitude +
                            Math.sin(x * frequency * 2 + time * speed * 1.5) * (amplitude * 0.5);
                        
                        if (x === 0) {
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    ctx.stroke();
                }
                
                // Add foam spray particles
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                for (let i = 0; i < 30; i++) {
                    const x = (i * 73 + time * 50) % canvas.width;
                    const baseY = canvas.height * 0.4 + Math.sin(x * 0.01 + time * 0.5) * 40;
                    const y = baseY - 20 - Math.abs(Math.sin(time * 2 + i)) * 30;
                    const size = 2 + Math.sin(time + i) * 1;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 7. KLIMT - Gold patterns, Art Nouveau
    klimt: {
        name: 'Gustav Klimt',
        description: 'Opulent gold patterns and Art Nouveau elegance',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            const spirals = [];
            const circles = [];
            let time = 0;
            
            // Create decorative spirals
            for (let i = 0; i < 12; i++) {
                spirals.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    size: 60 + Math.random() * 80,
                    rotation: Math.random() * Math.PI * 2,
                    speed: (Math.random() - 0.5) * 0.005
                });
            }
            
            // Create scattered circles
            for (let i = 0; i < 50; i++) {
                circles.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    size: 5 + Math.random() * 20,
                    phase: Math.random() * Math.PI * 2
                });
            }
            
            function drawSpiral(x, y, size, rotation) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rotation);
                
                // Gold gradient
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
                gradient.addColorStop(0, '#ffd700');
                gradient.addColorStop(0.5, '#daa520');
                gradient.addColorStop(1, '#b8860b');
                
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 3;
                
                ctx.beginPath();
                for (let angle = 0; angle < Math.PI * 6; angle += 0.1) {
                    const r = (angle / (Math.PI * 6)) * size;
                    const px = Math.cos(angle) * r;
                    const py = Math.sin(angle) * r;
                    if (angle === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
                
                ctx.restore();
            }
            
            function draw() {
                // Rich dark background
                const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                bgGradient.addColorStop(0, '#1a1510');
                bgGradient.addColorStop(0.5, '#2d2416');
                bgGradient.addColorStop(1, '#1a1510');
                ctx.fillStyle = bgGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                time += 0.01;
                
                // Draw mosaic pattern
                ctx.globalAlpha = 0.08;
                const tileSize = 30;
                for (let x = 0; x < canvas.width; x += tileSize) {
                    for (let y = 0; y < canvas.height; y += tileSize) {
                        const hue = (x + y + time * 20) % 60 + 30;
                        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
                        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                    }
                }
                ctx.globalAlpha = 1;
                
                // Draw spirals
                spirals.forEach(spiral => {
                    spiral.rotation += spiral.speed;
                    ctx.globalAlpha = 0.4;
                    drawSpiral(spiral.x, spiral.y, spiral.size, spiral.rotation);
                });
                
                // Draw golden circles
                circles.forEach(circle => {
                    const pulse = 1 + Math.sin(time * 2 + circle.phase) * 0.2;
                    const size = circle.size * pulse;
                    
                    ctx.globalAlpha = 0.3 + Math.sin(time + circle.phase) * 0.1;
                    
                    const gradient = ctx.createRadialGradient(
                        circle.x, circle.y, 0,
                        circle.x, circle.y, size
                    );
                    gradient.addColorStop(0, '#ffd700');
                    gradient.addColorStop(0.7, '#daa520');
                    gradient.addColorStop(1, 'transparent');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(circle.x, circle.y, size, 0, Math.PI * 2);
                    ctx.fill();
                });
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 8. KEITH HARING - Bold outlines, dancing figures
    haring: {
        name: 'Keith Haring',
        description: 'Bold pop art with dancing figures',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            const colors = ['#ff0000', '#ffff00', '#00ff00', '#0000ff', '#ff00ff', '#00ffff'];
            const figures = [];
            let time = 0;
            
            for (let i = 0; i < 8; i++) {
                figures.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    color: colors[i % colors.length],
                    phase: Math.random() * Math.PI * 2,
                    scale: 0.8 + Math.random() * 0.4,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5
                });
            }
            
            function drawFigure(x, y, scale, phase, color) {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);
                
                const dance = Math.sin(phase) * 0.3;
                
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Body
                ctx.beginPath();
                ctx.arc(0, 0, 25, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.stroke();
                
                // Head
                ctx.beginPath();
                ctx.arc(0, -50, 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Arms (dancing)
                ctx.beginPath();
                ctx.moveTo(-25, -10);
                ctx.lineTo(-50 + dance * 30, -40 - dance * 20);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(25, -10);
                ctx.lineTo(50 - dance * 30, -40 + dance * 20);
                ctx.stroke();
                
                // Legs (dancing)
                ctx.beginPath();
                ctx.moveTo(-15, 25);
                ctx.lineTo(-30 - dance * 20, 70);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(15, 25);
                ctx.lineTo(30 + dance * 20, 70);
                ctx.stroke();
                
                // Radiating lines (energy)
                ctx.lineWidth = 3;
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2 + phase * 0.5;
                    const innerR = 60;
                    const outerR = 75 + Math.sin(phase * 2 + i) * 10;
                    
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR - 20);
                    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR - 20);
                    ctx.stroke();
                }
                
                ctx.restore();
            }
            
            function draw() {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                time += 0.05;
                
                figures.forEach(fig => {
                    fig.phase += 0.08;
                    fig.x += fig.vx;
                    fig.y += fig.vy;
                    
                    // Bounce
                    if (fig.x < 80 || fig.x > canvas.width - 80) fig.vx *= -1;
                    if (fig.y < 80 || fig.y > canvas.height - 80) fig.vy *= -1;
                    
                    ctx.globalAlpha = 0.5;
                    drawFigure(fig.x, fig.y, fig.scale, fig.phase, fig.color);
                });
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 9. MONET - Impressionist water lilies
    monet: {
        name: 'Claude Monet',
        description: 'Soft impressionist water lilies and reflections',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            const lilies = [];
            const ripples = [];
            let time = 0;
            
            for (let i = 0; i < 15; i++) {
                lilies.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    size: 30 + Math.random() * 40,
                    rotation: Math.random() * Math.PI * 2,
                    phase: Math.random() * Math.PI * 2,
                    hue: 300 + Math.random() * 60 // Pink to magenta
                });
            }
            
            function drawLily(x, y, size, rotation, phase, hue) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rotation);
                
                const bob = Math.sin(phase) * 3;
                
                // Lily pad
                ctx.beginPath();
                ctx.ellipse(0, bob, size, size * 0.6, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(34, 139, 34, 0.4)`;
                ctx.fill();
                
                // Petals
                const petals = 8;
                for (let i = 0; i < petals; i++) {
                    const angle = (i / petals) * Math.PI * 2;
                    const petalSize = size * 0.4;
                    
                    ctx.save();
                    ctx.rotate(angle);
                    ctx.translate(0, -size * 0.3);
                    
                    ctx.beginPath();
                    ctx.ellipse(0, 0, petalSize * 0.3, petalSize, 0, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${hue + i * 5}, 70%, 75%, 0.6)`;
                    ctx.fill();
                    
                    ctx.restore();
                }
                
                // Center
                ctx.beginPath();
                ctx.arc(0, bob, size * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = '#ffeb3b';
                ctx.fill();
                
                ctx.restore();
            }
            
            function draw() {
                // Water gradient
                const waterGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                waterGradient.addColorStop(0, '#1e5631');
                waterGradient.addColorStop(0.3, '#2e8b57');
                waterGradient.addColorStop(0.7, '#3cb371');
                waterGradient.addColorStop(1, '#1e5631');
                ctx.fillStyle = waterGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                time += 0.02;
                
                // Water ripples
                ctx.globalAlpha = 0.1;
                for (let i = 0; i < 20; i++) {
                    const x = (i * 137 + time * 30) % (canvas.width + 200) - 100;
                    const y = canvas.height * 0.5 + Math.sin(x * 0.01 + time) * 100;
                    
                    ctx.beginPath();
                    ctx.ellipse(x, y, 80 + Math.sin(time + i) * 20, 20, 0, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                
                // Draw lilies
                lilies.forEach(lily => {
                    lily.phase += 0.02;
                    lily.x += Math.sin(time + lily.phase) * 0.2;
                    lily.y += Math.cos(time * 0.5 + lily.phase) * 0.1;
                    
                    // Wrap
                    if (lily.x < -50) lily.x = canvas.width + 50;
                    if (lily.x > canvas.width + 50) lily.x = -50;
                    
                    ctx.globalAlpha = 0.7;
                    drawLily(lily.x, lily.y, lily.size, lily.rotation, lily.phase, lily.hue);
                });
                
                // Impressionist brush texture
                ctx.globalAlpha = 0.03;
                for (let i = 0; i < 500; i++) {
                    const x = Math.random() * canvas.width;
                    const y = Math.random() * canvas.height;
                    const hue = 80 + Math.random() * 60;
                    
                    ctx.fillStyle = `hsl(${hue}, 50%, 50%)`;
                    ctx.fillRect(x, y, 20, 4);
                }
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 10. DALI - Surrealist melting forms
    dali: {
        name: 'Salvador Dalí',
        description: 'Surrealist melting clocks and dreamscapes',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            const clocks = [];
            let time = 0;
            
            for (let i = 0; i < 5; i++) {
                clocks.push({
                    x: 100 + Math.random() * (window.innerWidth - 200),
                    y: 100 + Math.random() * (window.innerHeight - 200),
                    size: 60 + Math.random() * 60,
                    meltPhase: Math.random() * Math.PI * 2,
                    meltSpeed: 0.01 + Math.random() * 0.02,
                    drip: Math.random() * 50
                });
            }
            
            function drawMeltingClock(x, y, size, meltPhase, drip) {
                ctx.save();
                ctx.translate(x, y);
                
                const melt = Math.sin(meltPhase) * 0.3 + 0.7;
                
                // Melting clock face
                ctx.beginPath();
                ctx.ellipse(0, drip * melt, size, size * melt, 0, 0, Math.PI * 2);
                
                const clockGradient = ctx.createRadialGradient(0, drip * melt, 0, 0, drip * melt, size);
                clockGradient.addColorStop(0, '#f5f5dc');
                clockGradient.addColorStop(0.8, '#daa520');
                clockGradient.addColorStop(1, '#8b7355');
                
                ctx.fillStyle = clockGradient;
                ctx.fill();
                ctx.strokeStyle = '#4a4a4a';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Clock numbers (distorted)
                ctx.fillStyle = '#333';
                ctx.font = `${size * 0.2}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                for (let h = 1; h <= 12; h++) {
                    const angle = (h / 12) * Math.PI * 2 - Math.PI / 2;
                    const numR = size * 0.7;
                    const nx = Math.cos(angle) * numR;
                    const ny = Math.sin(angle) * numR * melt + drip * melt;
                    
                    ctx.globalAlpha = 0.6;
                    ctx.fillText(h.toString(), nx, ny);
                }
                
                // Clock hands
                ctx.globalAlpha = 0.8;
                const now = Date.now() / 1000;
                
                // Hour hand
                const hourAngle = ((now / 3600) % 12) / 12 * Math.PI * 2 - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(0, drip * melt * 0.5);
                ctx.lineTo(
                    Math.cos(hourAngle) * size * 0.4,
                    Math.sin(hourAngle) * size * 0.4 * melt + drip * melt * 0.5
                );
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 4;
                ctx.stroke();
                
                // Minute hand
                const minAngle = ((now / 60) % 60) / 60 * Math.PI * 2 - Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(0, drip * melt * 0.5);
                ctx.lineTo(
                    Math.cos(minAngle) * size * 0.6,
                    Math.sin(minAngle) * size * 0.6 * melt + drip * melt * 0.5
                );
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.restore();
            }
            
            function draw() {
                // Desert gradient background
                const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                skyGradient.addColorStop(0, '#87ceeb');
                skyGradient.addColorStop(0.5, '#f4a460');
                skyGradient.addColorStop(0.8, '#daa520');
                skyGradient.addColorStop(1, '#8b4513');
                ctx.fillStyle = skyGradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                time += 0.016;
                
                // Draw ants marching (Dalí motif)
                ctx.fillStyle = '#1a1a1a';
                for (let i = 0; i < 30; i++) {
                    const antX = (i * 60 + time * 20) % (canvas.width + 40) - 20;
                    const antY = canvas.height * 0.85 + Math.sin(antX * 0.05) * 20;
                    
                    ctx.beginPath();
                    ctx.ellipse(antX, antY, 4, 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(antX + 5, antY, 3, 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Draw elephants on stilts (simplified, distant)
                ctx.globalAlpha = 0.2;
                for (let i = 0; i < 3; i++) {
                    const ex = canvas.width * 0.2 + i * canvas.width * 0.3;
                    const ey = canvas.height * 0.6;
                    
                    // Long spindly legs
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    for (let leg = 0; leg < 4; leg++) {
                        ctx.beginPath();
                        ctx.moveTo(ex - 15 + leg * 10, ey);
                        ctx.lineTo(ex - 15 + leg * 10 + Math.sin(time + leg) * 5, canvas.height);
                        ctx.stroke();
                    }
                    
                    // Body
                    ctx.fillStyle = '#666';
                    ctx.beginPath();
                    ctx.ellipse(ex, ey, 30, 20, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                
                // Draw melting clocks
                clocks.forEach(clock => {
                    clock.meltPhase += clock.meltSpeed;
                    ctx.globalAlpha = 0.8;
                    drawMeltingClock(clock.x, clock.y, clock.size, clock.meltPhase, clock.drip);
                });
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 11. ROTHKO - Color field meditation
    rothko: {
        name: 'Mark Rothko',
        description: 'Meditative color field blocks with soft edges',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            // Rothko-style color palettes
            const palettes = [
                { top: '#8b0000', middle: '#ff6b35', bottom: '#1a1a2e' },
                { top: '#2d4a6d', middle: '#5c7c99', bottom: '#1a1a2e' },
                { top: '#4a0e4e', middle: '#932f6d', bottom: '#1a1a2e' },
                { top: '#1e3d59', middle: '#3d6b93', bottom: '#0d1b2a' },
                { top: '#5c4033', middle: '#8b6914', bottom: '#1a1a1a' }
            ];
            
            const palette = palettes[Math.floor(Math.random() * palettes.length)];
            let time = 0;
            
            function draw() {
                time += 0.005;
                
                // Deep background
                ctx.fillStyle = palette.bottom;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Subtle pulsing for the blocks
                const pulse = Math.sin(time) * 0.05;
                
                // Top color block with fuzzy edges
                const topHeight = canvas.height * (0.35 + pulse);
                const topGrad = ctx.createLinearGradient(0, 0, 0, topHeight + 40);
                topGrad.addColorStop(0, palette.top);
                topGrad.addColorStop(0.7, palette.top);
                topGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = topGrad;
                ctx.fillRect(canvas.width * 0.1, canvas.height * 0.08, canvas.width * 0.8, topHeight);
                
                // Middle color block
                const midY = canvas.height * 0.48;
                const midHeight = canvas.height * (0.35 - pulse);
                const midGrad = ctx.createLinearGradient(0, midY - 30, 0, midY + midHeight + 30);
                midGrad.addColorStop(0, 'transparent');
                midGrad.addColorStop(0.1, palette.middle);
                midGrad.addColorStop(0.9, palette.middle);
                midGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = midGrad;
                ctx.fillRect(canvas.width * 0.1, midY, canvas.width * 0.8, midHeight);
                
                // Subtle grain texture
                ctx.globalAlpha = 0.03;
                for (let i = 0; i < 5000; i++) {
                    const x = Math.random() * canvas.width;
                    const y = Math.random() * canvas.height;
                    const brightness = Math.random() * 100;
                    ctx.fillStyle = `hsl(0, 0%, ${brightness}%)`;
                    ctx.fillRect(x, y, 2, 2);
                }
                ctx.globalAlpha = 1;
                
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 12. WARHOL - Pop art with repeating patterns
    warhol: {
        name: 'Andy Warhol',
        description: 'Pop art colors and repeating patterns',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            // Warhol pop colors
            const popColors = [
                '#ff1493', '#00ff00', '#ff6600', '#00ffff',
                '#ffff00', '#ff00ff', '#ff0000', '#0066ff'
            ];
            
            let time = 0;
            
            function draw() {
                time += 0.01;
                
                // Black background
                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const cols = 4;
                const rows = 3;
                const cellW = canvas.width / cols;
                const cellH = canvas.height / rows;
                
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const x = col * cellW;
                        const y = row * cellH;
                        const colorIndex = (row * cols + col) % popColors.length;
                        const color = popColors[colorIndex];
                        
                        // Cell background with slight color variation
                        ctx.globalAlpha = 0.2;
                        ctx.fillStyle = color;
                        ctx.fillRect(x + 5, y + 5, cellW - 10, cellH - 10);
                        
                        // Floating shape in each cell
                        ctx.globalAlpha = 0.6;
                        const shapeX = x + cellW / 2;
                        const shapeY = y + cellH / 2;
                        const size = Math.min(cellW, cellH) * 0.3;
                        const offset = Math.sin(time + row + col) * 10;
                        
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(shapeX + offset, shapeY + offset * 0.5, size, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Outline
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                }
                
                // Halftone dot overlay
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = '#000';
                for (let x = 0; x < canvas.width; x += 15) {
                    for (let y = 0; y < canvas.height; y += 15) {
                        const size = 2 + Math.sin(x * 0.1 + y * 0.1 + time) * 1;
                        ctx.beginPath();
                        ctx.arc(x, y, size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    },
    
    // 13. MINIMALIST - Clean geometric minimalism
    minimalist: {
        name: 'Minimalist',
        description: 'Clean lines and subtle geometric forms',
        init: (container, accentColor) => {
            const canvas = document.createElement('canvas');
            canvas.className = 'artist-bg-canvas';
            container.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            function resize() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            resize();
            window.addEventListener('resize', resize);
            
            let time = 0;
            
            function draw() {
                time += 0.003;
                
                // Dark gradient background
                const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                bgGrad.addColorStop(0, '#0a0a0f');
                bgGrad.addColorStop(0.5, '#12121a');
                bgGrad.addColorStop(1, '#0a0a0f');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Subtle grid
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.lineWidth = 1;
                const gridSize = 60;
                
                for (let x = 0; x < canvas.width; x += gridSize) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, canvas.height);
                    ctx.stroke();
                }
                
                for (let y = 0; y < canvas.height; y += gridSize) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                    ctx.stroke();
                }
                
                // Floating geometric shapes with accent color
                ctx.strokeStyle = accentColor;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3;
                
                // Large circle
                const circleX = canvas.width * 0.7 + Math.sin(time) * 30;
                const circleY = canvas.height * 0.4 + Math.cos(time * 0.7) * 20;
                ctx.beginPath();
                ctx.arc(circleX, circleY, 150, 0, Math.PI * 2);
                ctx.stroke();
                
                // Rectangle
                ctx.save();
                ctx.translate(canvas.width * 0.25, canvas.height * 0.6);
                ctx.rotate(time * 0.2);
                ctx.strokeRect(-80, -80, 160, 160);
                ctx.restore();
                
                // Diagonal line
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height * 0.8);
                ctx.lineTo(canvas.width, canvas.height * 0.2);
                ctx.stroke();
                
                ctx.globalAlpha = 1;
                requestAnimationFrame(draw);
            }
            
            draw();
        }
    }
};

// Initialize background by key
function initArtistBackground(key, container, accentColor = '#22c55e') {
    // Add canvas styles with improved visual quality
    const style = document.createElement('style');
    style.textContent = `
        .artist-bg-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
            opacity: 0.6;
            filter: saturate(0.8) brightness(0.9);
        }
        
        /* Subtle overlay for better content readability */
        #artist-bg-container::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                180deg,
                rgba(0, 0, 0, 0.4) 0%,
                rgba(0, 0, 0, 0.2) 50%,
                rgba(0, 0, 0, 0.5) 100%
            );
            pointer-events: none;
            z-index: 0;
        }
    `;
    document.head.appendChild(style);
    
    const background = ArtistBackgrounds[key];
    if (background) {
        background.init(container, accentColor);
        return true;
    }
    return false;
}

// Get list of all backgrounds
function getBackgroundList() {
    return Object.entries(ArtistBackgrounds).map(([key, bg]) => ({
        key,
        name: bg.name,
        description: bg.description
    }));
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArtistBackgrounds, initArtistBackground, getBackgroundList };
}
