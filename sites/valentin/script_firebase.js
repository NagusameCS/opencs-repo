// ============================================
// VALENTIN QUESTIONNAIRE - FIREBASE EDITION
// Enhanced with floating hearts & better UX
// ============================================

// Firebase Configuration - Valentin Project
const firebaseConfig = {
    apiKey: "AIzaSyDVFYEp5ILQoL05nb0Y0dkilIHj6cEnbq8",
    authDomain: "valentin-82f87.firebaseapp.com",
    databaseURL: "https://valentin-82f87-default-rtdb.firebaseio.com",
    projectId: "valentin-82f87",
    storageBucket: "valentin-82f87.firebasestorage.app",
    messagingSenderId: "1078170330098",
    appId: "1:1078170330098:web:9be952415c9558eaf6816b",
    measurementId: "G-DJGD772Y6B"
};

// Initialize Firebase
let db = null;
let firebaseInitialized = false;

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined' && !firebaseInitialized) {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            firebaseInitialized = true;
            console.log("Firebase initialized successfully");
        }
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
}

// ============================================
// FLOATING HEARTS BACKGROUND
// ============================================

function createFloatingHearts() {
    const container = document.getElementById('heartsContainer');
    if (!container) return;
    
    const hearts = ['💕', '❤️', '💗', '💖', '💝', '💘', '🩷', '💓', '💞', '🤍'];
    const numHearts = 45;
    
    // Clear existing hearts
    container.innerHTML = '';
    
    for (let i = 0; i < numHearts; i++) {
        const heart = document.createElement('span');
        heart.className = `floating-heart style-${(i % 5) + 1}`;
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        
        const size = 28 + Math.random() * 35;
        const left = Math.random() * 100;
        const duration = 10 + Math.random() * 8; // Slower: 10-18 seconds
        const delay = Math.random() * duration;
        
        heart.style.cssText = `
            left: ${left}%;
            font-size: ${size}px;
            animation-duration: ${duration}s;
            animation-delay: -${delay}s;
        `;
        
        container.appendChild(heart);
    }
    
    // Add sparkles
    for (let i = 0; i < 15; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.cssText = `
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 2}s;
        `;
        container.appendChild(sparkle);
    }
}

// ============================================
// QUESTION DEFINITIONS
// ============================================

const questions = [
    // Basic Info (always first)
    {
        id: "gender",
        type: "select",
        emoji: "👤",
        question: "What's your gender?",
        options: [
            { name: "Male", icon: "👨" },
            { name: "Female", icon: "👩" },
            { name: "Other", icon: "🌈" }
        ]
    },
    {
        id: "gender_pref",
        type: "select",
        emoji: "💕",
        question: "Who are you interested in?",
        options: [
            { name: "Men", icon: "👨" },
            { name: "Women", icon: "👩" },
            { name: "Everyone", icon: "💝" }
        ]
    },
    {
        id: "grade",
        type: "number",
        emoji: "🎓",
        question: "What grade are you in?",
        min: 9,
        max: 12
    },
    {
        id: "age",
        type: "number",
        emoji: "🎂",
        question: "How old are you?",
        min: 13,
        max: 19
    },
    
    // Personality & Preferences
    {
        id: "extrovert_scale",
        type: "slider",
        emoji: "🎭",
        question: "How social are you?",
        minLabel: "🤫 Introvert",
        maxLabel: "Extrovert 🎉"
    },
    {
        id: "love_language",
        type: "select",
        emoji: "💝",
        question: "What's your love language?",
        options: [
            { name: "Words of Affirmation", icon: "💬" },
            { name: "Quality Time", icon: "⏰" },
            { name: "Physical Touch", icon: "🤗" },
            { name: "Acts of Service", icon: "🛠️" },
            { name: "Gifts", icon: "🎁" }
        ]
    },
    {
        id: "qualities_want",
        type: "pick-multi",
        emoji: "✨",
        question: "Pick 3 qualities that matter most in a partner",
        subtitle: "Select exactly 3",
        maxPicks: 3,
        options: [
            { name: "Intelligence", icon: "🧠" },
            { name: "Humor", icon: "😂" },
            { name: "Kindness", icon: "💖" },
            { name: "Confidence", icon: "😎" },
            { name: "Ambition", icon: "🚀" }
        ]
    },
    {
        id: "qualities_have",
        type: "pick-multi",
        emoji: "💪",
        question: "Pick 3 qualities you have",
        subtitle: "Be honest! Select exactly 3",
        maxPicks: 3,
        options: [
            { name: "Intelligence", icon: "🧠" },
            { name: "Humor", icon: "😂" },
            { name: "Kindness", icon: "💖" },
            { name: "Confidence", icon: "😎" },
            { name: "Ambition", icon: "🚀" }
        ]
    },
    {
        id: "text_or_call",
        type: "binary",
        emoji: "📱",
        question: "Text or Call?",
        options: [
            { name: "Text", icon: "💬" },
            { name: "Call", icon: "📞" }
        ]
    },
    {
        id: "home_or_out",
        type: "binary",
        emoji: "🏠",
        question: "Weekend plans?",
        options: [
            { name: "Stay Home", icon: "🏠" },
            { name: "Go Out", icon: "🎉" }
        ]
    },
    
    // Lifestyle
    {
        id: "music_genre",
        type: "grid",
        emoji: "🎵",
        question: "Favorite music genre?",
        options: [
            { name: "Pop", icon: "🎤" },
            { name: "Hip Hop", icon: "🎧" },
            { name: "Rock", icon: "🎸" },
            { name: "R&B", icon: "🎹" },
            { name: "EDM", icon: "🔊" },
            { name: "Latin", icon: "💃" },
            { name: "Indie", icon: "🌟" },
            { name: "K-Pop", icon: "🇰🇷" }
        ]
    },
    {
        id: "favorite_subject",
        type: "grid",
        emoji: "📚",
        question: "Favorite school subject?",
        options: [
            { name: "Math", icon: "📐" },
            { name: "Science", icon: "🔬" },
            { name: "English", icon: "📝" },
            { name: "History", icon: "📜" },
            { name: "Art", icon: "🎨" },
            { name: "Music", icon: "🎵" },
            { name: "PE", icon: "⚽" },
            { name: "Computer Science", icon: "💻" }
        ]
    },
    {
        id: "sleep_time",
        type: "clock",
        emoji: "😴",
        question: "When do you usually go to sleep?"
    },
    {
        id: "social_battery",
        type: "battery",
        emoji: "🔋",
        question: "Your typical social energy level?"
    },
    {
        id: "favorite_season",
        type: "season",
        emoji: "🌸",
        question: "Favorite season?"
    },
    
    // Fun & Preferences
    {
        id: "ice_cream",
        type: "ice-cream",
        emoji: "🍦",
        question: "Pick your ice cream flavor",
        options: [
            { name: "Vanilla", color: "#FFF8DC", drip: "#F5DEB3" },
            { name: "Chocolate", color: "#5C4033", drip: "#3D2817" },
            { name: "Strawberry", color: "#FFB6C1", drip: "#FF69B4" },
            { name: "Mint Chip", color: "#98FB98", drip: "#3CB371", chips: true },
            { name: "Cookie Dough", color: "#D2B48C", drip: "#BC8F8F", chunks: true }
        ]
    },
    {
        id: "favorite_color",
        type: "color",
        emoji: "🎨",
        question: "What's your favorite color?"
    },
    {
        id: "city_or_country",
        type: "binary",
        emoji: "🌆",
        question: "Where would you rather live?",
        options: [
            { name: "City", icon: "🏙️" },
            { name: "Countryside", icon: "🌾" }
        ]
    },
    {
        id: "date_ideas",
        type: "rank",
        emoji: "💑",
        question: "Rank these date ideas (1 = favorite)",
        options: ["🎬 Movie Night", "🍽️ Nice Dinner", "🌳 Park Walk", "🎮 Gaming", "☕ Coffee Date"]
    },
    {
        id: "dream_location",
        type: "map",
        emoji: "🗺️",
        question: "Where would you love to travel?"
    }
];

// State
let currentQuestionIndex = 0;
const answers = {};
let mapInstance = null;

// DOM Elements
let container, progressBar, progressPercent, prevBtn, nextBtn, questionNumber, successModal;

// ============================================
// OAUTH HANDLING
// ============================================

function parseOAuthToken(callback) {
    let accessToken = null;
    
    try {
        accessToken = sessionStorage.getItem('oauth_token');
        if (accessToken) {
            sessionStorage.removeItem('oauth_token');
        }
    } catch(e) {
        console.warn("sessionStorage access failed:", e);
    }
    
    // Fallback to URL hash
    if (!accessToken && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        accessToken = params.get('access_token');
        if (accessToken) {
            window.history.replaceState(null, null, window.location.pathname);
        }
    }
    
    if (accessToken) {
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        })
        .then(response => response.json())
        .then(data => {
            if (data.email && data.email.toLowerCase().endsWith('@asf.edu.mx')) {
                answers.email = data.email;
                answers.name = data.name || '';
                callback(true);
            } else {
                alert('Please use an @asf.edu.mx email address');
                window.location.href = './';
            }
        })
        .catch(error => {
            console.error('OAuth error:', error);
            alert('Failed to verify your Google account');
            window.location.href = './';
        });
    } else {
        alert('Please login with Google first');
        window.location.href = './';
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", function() {
    container = document.getElementById("questionContainer");
    progressBar = document.getElementById("progressBar");
    progressPercent = document.getElementById("progressPercent");
    prevBtn = document.getElementById("prevBtn");
    nextBtn = document.getElementById("nextBtn");
    questionNumber = document.getElementById("questionNumber");
    successModal = document.getElementById("successModal");
    
    // Initialize Firebase
    initFirebase();
    
    // Create floating hearts
    createFloatingHearts();
    
    // Parse OAuth and start
    parseOAuthToken(function(success) {
        if (success && container) {
            renderQuestion();
            updateNavigation();
            updateProgress();
        }
    });
});

// ============================================
// PROGRESS & NAVIGATION
// ============================================

function updateProgress() {
    if (!progressBar || !questionNumber || !progressPercent) return;
    
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    progressBar.style.width = progress + "%";
    questionNumber.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    progressPercent.textContent = Math.round(progress) + "%";
}

function updateNavigation() {
    if (!prevBtn || !nextBtn) return;
    
    prevBtn.disabled = currentQuestionIndex === 0;
    
    if (currentQuestionIndex === questions.length - 1) {
        nextBtn.innerHTML = '💕 Submit';
    } else {
        nextBtn.innerHTML = 'Next →';
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
        updateNavigation();
        updateProgress();
    }
}

function nextQuestion() {
    const currentQ = questions[currentQuestionIndex];
    
    // Validate answer exists
    if (answers[currentQ.id] === undefined && answers[currentQ.id] !== 0) {
        showToast('Please answer the question first 💕');
        return;
    }
    
    if (currentQuestionIndex === questions.length - 1) {
        submitData();
    } else {
        currentQuestionIndex++;
        renderQuestion();
        updateNavigation();
        updateProgress();
    }
}

function autoAdvance() {
    setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
            nextQuestion();
        }
    }, 350);
}

// ============================================
// TOAST NOTIFICATION
// ============================================

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 15px 30px;
        border-radius: 50px;
        font-weight: 500;
        z-index: 10000;
        animation: slideUp 0.3s ease;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// RENDER QUESTION
// ============================================

function renderQuestion() {
    if (!container) return;
    
    const q = questions[currentQuestionIndex];
    container.innerHTML = '';
    
    // Header with emoji
    const header = document.createElement('div');
    header.className = 'question-header animate-in';
    header.innerHTML = `
        <span class="question-emoji">${q.emoji || '💕'}</span>
        <h2>${q.question}</h2>
        ${q.subtitle ? `<p class="question-subtitle">${q.subtitle}</p>` : ''}
    `;
    container.appendChild(header);
    
    // Render based on type
    const renderers = {
        'select': renderSelect,
        'number': renderNumber,
        'slider': renderSlider,
        'multi-slider': renderMultiSlider,
        'pick-multi': renderPickMulti,
        'grid': renderGrid,
        'binary': renderBinary,
        'color': renderColor,
        'ice-cream': renderIceCream,
        'clock': renderClock,
        'battery': renderBattery,
        'season': renderSeason,
        'rank': renderRank,
        'map': renderMap
    };
    
    if (renderers[q.type]) {
        renderers[q.type](q);
    }
}

// ============================================
// QUESTION TYPE RENDERERS
// ============================================

function renderSelect(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'options-grid animate-in';
    
    q.options.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'option-card';
        card.style.animationDelay = `${idx * 0.08}s`;
        
        if (answers[q.id] === opt.name) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <span class="option-icon">${opt.icon}</span>
            <span class="option-label">${opt.name}</span>
        `;
        
        card.addEventListener('click', () => {
            answers[q.id] = opt.name;
            wrapper.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            autoAdvance();
        });
        
        wrapper.appendChild(card);
    });
    
    container.appendChild(wrapper);
}

function renderNumber(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'number-picker animate-in';
    
    let value = answers[q.id] ?? q.min;
    
    const minusBtn = document.createElement('button');
    minusBtn.className = 'number-btn';
    minusBtn.textContent = '−';
    minusBtn.type = 'button';
    
    const display = document.createElement('div');
    display.className = 'number-display';
    display.textContent = value;
    
    const plusBtn = document.createElement('button');
    plusBtn.className = 'number-btn';
    plusBtn.textContent = '+';
    plusBtn.type = 'button';
    
    const updateValue = (newVal) => {
        value = Math.max(q.min, Math.min(q.max, newVal));
        display.textContent = value;
        answers[q.id] = value;
        display.style.transform = 'scale(1.15)';
        setTimeout(() => display.style.transform = 'scale(1)', 150);
    };
    
    minusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        updateValue(value - 1);
    });
    
    plusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        updateValue(value + 1);
    });
    
    answers[q.id] = value;
    
    wrapper.appendChild(minusBtn);
    wrapper.appendChild(display);
    wrapper.appendChild(plusBtn);
    container.appendChild(wrapper);
}

function renderSlider(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'slider-wrapper animate-in';
    
    const value = answers[q.id] ?? 50;
    
    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'slider-value-display';
    valueDisplay.textContent = value + '%';
    
    const labels = document.createElement('div');
    labels.className = 'slider-labels';
    labels.innerHTML = `<span>${q.minLabel}</span><span>${q.maxLabel}</span>`;
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = value;
    slider.style.background = `linear-gradient(to right, var(--primary-pink) ${value}%, #e0e0e0 ${value}%)`;
    
    slider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value);
        answers[q.id] = v;
        valueDisplay.textContent = v + '%';
        slider.style.background = `linear-gradient(to right, var(--primary-pink) ${v}%, #e0e0e0 ${v}%)`;
    });
    
    answers[q.id] = value;
    
    wrapper.appendChild(valueDisplay);
    wrapper.appendChild(labels);
    wrapper.appendChild(slider);
    container.appendChild(wrapper);
}

function renderMultiSlider(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'animate-in';
    
    if (!answers[q.id]) {
        answers[q.id] = {};
        q.items.forEach(item => { answers[q.id][item.name] = 50; });
    }
    
    q.items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'trait-row';
        row.style.animationDelay = `${idx * 0.08}s`;
        
        const label = document.createElement('div');
        label.className = 'trait-label';
        label.innerHTML = `${item.icon} ${item.name}`;
        
        const sliderDiv = document.createElement('div');
        sliderDiv.className = 'trait-slider';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = answers[q.id][item.name];
        slider.style.background = `linear-gradient(to right, var(--primary-pink) ${slider.value}%, #e0e0e0 ${slider.value}%)`;
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'trait-value';
        valueSpan.textContent = slider.value;
        
        slider.addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            answers[q.id][item.name] = v;
            valueSpan.textContent = v;
            slider.style.background = `linear-gradient(to right, var(--primary-pink) ${v}%, #e0e0e0 ${v}%)`;
        });
        
        sliderDiv.appendChild(slider);
        row.appendChild(label);
        row.appendChild(sliderDiv);
        row.appendChild(valueSpan);
        wrapper.appendChild(row);
    });
    
    container.appendChild(wrapper);
}

function renderPickMulti(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'options-grid animate-in';
    
    // Initialize as array if not already
    if (!answers[q.id] || !Array.isArray(answers[q.id])) {
        answers[q.id] = [];
    }
    
    const maxPicks = q.maxPicks || 3;
    
    // Add counter display
    const counter = document.createElement('div');
    counter.className = 'pick-counter';
    counter.style.cssText = 'text-align: center; margin-bottom: 20px; font-size: 1.1rem; color: #666;';
    counter.innerHTML = `<span id="pickCount">${answers[q.id].length}</span> / ${maxPicks} selected`;
    container.appendChild(counter);
    
    q.options.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'option-card';
        card.style.animationDelay = `${idx * 0.08}s`;
        
        if (answers[q.id].includes(opt.name)) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <span class="option-icon">${opt.icon}</span>
            <span class="option-label">${opt.name}</span>
        `;
        
        card.addEventListener('click', () => {
            const isSelected = answers[q.id].includes(opt.name);
            
            if (isSelected) {
                // Remove from selection
                answers[q.id] = answers[q.id].filter(n => n !== opt.name);
                card.classList.remove('selected');
            } else if (answers[q.id].length < maxPicks) {
                // Add to selection
                answers[q.id].push(opt.name);
                card.classList.add('selected');
            } else {
                // Max reached - show toast
                showToast(`You can only pick ${maxPicks} qualities!`);
            }
            
            // Update counter
            document.getElementById('pickCount').textContent = answers[q.id].length;
        });
        
        wrapper.appendChild(card);
    });
    
    container.appendChild(wrapper);
}

function renderGrid(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'options-grid animate-in';
    
    q.options.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'option-card';
        card.style.animationDelay = `${idx * 0.05}s`;
        
        if (answers[q.id] === opt.name) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <span class="option-icon">${opt.icon}</span>
            <span class="option-label">${opt.name}</span>
        `;
        
        card.addEventListener('click', () => {
            answers[q.id] = opt.name;
            wrapper.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            autoAdvance();
        });
        
        wrapper.appendChild(card);
    });
    
    container.appendChild(wrapper);
}

function renderBinary(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'binary-container animate-in';
    
    q.options.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'binary-option';
        card.style.animationDelay = `${idx * 0.1}s`;
        
        if (answers[q.id] === opt.name) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <span class="binary-icon">${opt.icon}</span>
            <span class="binary-label">${opt.name}</span>
        `;
        
        card.addEventListener('click', () => {
            answers[q.id] = opt.name;
            wrapper.querySelectorAll('.binary-option').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            autoAdvance();
        });
        
        wrapper.appendChild(card);
    });
    
    container.appendChild(wrapper);
}

function renderColor(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'color-picker-wrapper animate-in';
    
    const currentColor = answers[q.id] || '#ff4d6d';
    
    const heartContainer = document.createElement('div');
    heartContainer.className = 'color-heart-container';
    
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'color-input';
    input.value = currentColor;
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.className = 'color-heart';
    svg.style.filter = `drop-shadow(0 6px 20px ${currentColor}66)`;
    svg.innerHTML = `<path fill="${currentColor}" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`;
    
    const preview = document.createElement('div');
    preview.className = 'color-preview';
    preview.textContent = currentColor.toUpperCase();
    
    input.addEventListener('input', (e) => {
        const color = e.target.value;
        answers[q.id] = color;
        preview.textContent = color.toUpperCase();
        svg.querySelector('path').setAttribute('fill', color);
        svg.style.filter = `drop-shadow(0 6px 20px ${color}66)`;
    });
    
    answers[q.id] = currentColor;
    
    heartContainer.appendChild(input);
    heartContainer.appendChild(svg);
    wrapper.appendChild(heartContainer);
    wrapper.appendChild(preview);
    container.appendChild(wrapper);
}

function renderIceCream(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ice-cream-container animate-in';
    
    // SVG ice cream cone generator
    function createIceCreamSVG(opt) {
        const color = opt.color || '#FFF8DC';
        const drip = opt.drip || color;
        const hasChips = opt.chips;
        const hasChunks = opt.chunks;
        
        let extras = '';
        if (hasChips) {
            // Mint chips
            extras = `
                <circle cx="30" cy="25" r="3" fill="#3D2817"/>
                <circle cx="45" cy="20" r="2.5" fill="#3D2817"/>
                <circle cx="38" cy="35" r="2" fill="#3D2817"/>
                <circle cx="52" cy="32" r="2.5" fill="#3D2817"/>
                <circle cx="25" cy="38" r="2" fill="#3D2817"/>
            `;
        }
        if (hasChunks) {
            // Cookie chunks
            extras = `
                <rect x="28" y="22" width="6" height="5" rx="1" fill="#8B4513" transform="rotate(15 31 24)"/>
                <rect x="45" y="28" width="5" height="4" rx="1" fill="#8B4513" transform="rotate(-10 47 30)"/>
                <rect x="35" y="35" width="4" height="4" rx="1" fill="#8B4513"/>
            `;
        }
        
        return `
            <svg viewBox="0 0 80 110" class="ice-cream-svg">
                <!-- Cone -->
                <path d="M25 55 L40 105 L55 55 Z" fill="#D2691E"/>
                <path d="M27 55 L40 100 L53 55 Z" fill="#DEB887"/>
                <line x1="30" y1="60" x2="40" y2="95" stroke="#C4A35A" stroke-width="1.5"/>
                <line x1="35" y1="55" x2="40" y2="90" stroke="#C4A35A" stroke-width="1.5"/>
                <line x1="45" y1="55" x2="40" y2="90" stroke="#C4A35A" stroke-width="1.5"/>
                <line x1="50" y1="60" x2="40" y2="95" stroke="#C4A35A" stroke-width="1.5"/>
                
                <!-- Ice cream scoop -->
                <ellipse cx="40" cy="35" rx="25" ry="22" fill="${color}"/>
                <ellipse cx="40" cy="30" rx="22" ry="18" fill="${color}" opacity="0.8"/>
                
                <!-- Drips -->
                <path d="M20 40 Q18 50 20 55 Q22 50 20 40" fill="${drip}"/>
                <path d="M30 48 Q28 58 30 65 Q32 58 30 48" fill="${drip}"/>
                <path d="M50 48 Q48 55 50 60 Q52 55 50 48" fill="${drip}"/>
                <path d="M60 40 Q58 48 60 52 Q62 48 60 40" fill="${drip}"/>
                
                <!-- Highlight -->
                <ellipse cx="32" cy="25" rx="8" ry="5" fill="white" opacity="0.4"/>
                
                ${extras}
            </svg>
        `;
    }
    
    q.options.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'ice-cream-option';
        card.style.animationDelay = `${idx * 0.08}s`;
        
        if (answers[q.id] === opt.name) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            ${createIceCreamSVG(opt)}
            <span class="ice-cream-label">${opt.name}</span>
        `;
        
        card.addEventListener('click', () => {
            answers[q.id] = opt.name;
            wrapper.querySelectorAll('.ice-cream-option').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            autoAdvance();
        });
        
        wrapper.appendChild(card);
    });
    
    container.appendChild(wrapper);
}

function renderClock(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'clock-wrapper animate-in';
    
    let hours = answers[q.id] ?? 22;
    
    const clockFace = document.createElement('div');
    clockFace.className = 'clock-face';
    
    // Add hour markers
    for (let i = 0; i < 12; i++) {
        if (i % 3 === 0) {
            const num = document.createElement('div');
            const hour = i === 0 ? 12 : i;
            const angle = i * 30 * Math.PI / 180;
            const x = 80 * Math.sin(angle);
            const y = -80 * Math.cos(angle);
            num.textContent = hour;
            num.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px));
                font-weight: 600;
                color: #333;
                font-size: 1.1rem;
            `;
            clockFace.appendChild(num);
        }
    }
    
    const center = document.createElement('div');
    center.className = 'clock-center';
    clockFace.appendChild(center);
    
    const hand = document.createElement('div');
    hand.className = 'clock-hand';
    clockFace.appendChild(hand);
    
    const display = document.createElement('div');
    display.className = 'clock-display';
    
    const ampmToggle = document.createElement('div');
    ampmToggle.className = 'ampm-toggle';
    
    const amBtn = document.createElement('button');
    amBtn.className = 'ampm-btn';
    amBtn.textContent = 'AM';
    amBtn.type = 'button';
    
    const pmBtn = document.createElement('button');
    pmBtn.className = 'ampm-btn';
    pmBtn.textContent = 'PM';
    pmBtn.type = 'button';
    
    const updateClock = () => {
        const hourDeg = (hours % 12) * 30;
        hand.style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        display.textContent = `${h12}:00 ${ampm}`;
        answers[q.id] = hours;
        
        if (hours < 12) {
            amBtn.classList.add('active');
            pmBtn.classList.remove('active');
        } else {
            pmBtn.classList.add('active');
            amBtn.classList.remove('active');
        }
    };
    
    clockFace.addEventListener('click', (e) => {
        const rect = clockFace.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let angle = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        const newHour = Math.round(angle / 30) % 12;
        
        if (hours >= 12) {
            hours = newHour === 0 ? 12 : newHour + 12;
        } else {
            hours = newHour === 0 ? 0 : newHour;
        }
        updateClock();
    });
    
    amBtn.addEventListener('click', () => {
        if (hours >= 12) hours -= 12;
        updateClock();
    });
    
    pmBtn.addEventListener('click', () => {
        if (hours < 12) hours += 12;
        updateClock();
    });
    
    updateClock();
    
    ampmToggle.appendChild(amBtn);
    ampmToggle.appendChild(pmBtn);
    
    wrapper.appendChild(clockFace);
    wrapper.appendChild(display);
    wrapper.appendChild(ampmToggle);
    container.appendChild(wrapper);
}

function renderBattery(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'battery-wrapper animate-in';
    
    let level = answers[q.id] ?? 2;
    const labels = ['Empty 😴', 'Low 😕', 'Medium 😊', 'High 😄', 'Full 🤩'];
    
    const batteryContainer = document.createElement('div');
    batteryContainer.className = 'battery-container';
    
    const tip = document.createElement('div');
    tip.className = 'battery-tip';
    batteryContainer.appendChild(tip);
    
    const display = document.createElement('div');
    display.className = 'battery-label';
    
    const updateDisplay = () => {
        display.textContent = labels[level];
    };
    
    // Create segments (4 to 0, top to bottom)
    for (let i = 4; i >= 0; i--) {
        const segment = document.createElement('div');
        segment.className = 'battery-segment';
        segment.dataset.level = i;
        
        if (i <= level) segment.classList.add('active');
        
        segment.addEventListener('click', () => {
            level = i;
            answers[q.id] = level;
            batteryContainer.querySelectorAll('.battery-segment').forEach(s => {
                const segLevel = parseInt(s.dataset.level);
                s.classList.toggle('active', segLevel <= level);
            });
            updateDisplay();
        });
        
        batteryContainer.appendChild(segment);
    }
    
    updateDisplay();
    answers[q.id] = level;
    
    wrapper.appendChild(batteryContainer);
    wrapper.appendChild(display);
    container.appendChild(wrapper);
}

function renderSeason(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'season-container animate-in';
    
    const seasons = [
        { name: 'Spring', icon: '🌸', class: 'spring' },
        { name: 'Summer', icon: '☀️', class: 'summer' },
        { name: 'Autumn', icon: '🍂', class: 'autumn' },
        { name: 'Winter', icon: '❄️', class: 'winter' }
    ];
    
    seasons.forEach((season, idx) => {
        const card = document.createElement('div');
        card.className = `season-card ${season.class}`;
        card.style.animationDelay = `${idx * 0.1}s`;
        
        if (answers[q.id] === season.name) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <span class="season-icon">${season.icon}</span>
            <span class="season-name">${season.name}</span>
        `;
        
        card.addEventListener('click', () => {
            answers[q.id] = season.name;
            wrapper.querySelectorAll('.season-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            autoAdvance();
        });
        
        wrapper.appendChild(card);
    });
    
    container.appendChild(wrapper);
}

function renderRank(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'rank-container animate-in';
    
    const instruction = document.createElement('div');
    instruction.className = 'rank-instruction';
    instruction.innerHTML = '↕️ Drag anywhere on items to reorder (1 = favorite)';
    wrapper.appendChild(instruction);
    
    if (!answers[q.id]) {
        answers[q.id] = [...q.options];
    }
    
    const list = document.createElement('ul');
    list.className = 'rank-list';
    
    const renderItems = () => {
        list.innerHTML = '';
        answers[q.id].forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'rank-item';
            li.innerHTML = `
                <span class="rank-number">${idx + 1}</span>
                <span class="rank-text">${item}</span>
                <span class="rank-handle">⋮⋮</span>
            `;
            list.appendChild(li);
        });
        
        // Initialize Sortable if available - entire item is draggable
        if (typeof Sortable !== 'undefined') {
            new Sortable(list, {
                animation: 250,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                delay: 0,
                delayOnTouchOnly: true,
                touchStartThreshold: 3,
                onEnd: () => {
                    const newOrder = [];
                    list.querySelectorAll('.rank-text').forEach(t => newOrder.push(t.textContent));
                    answers[q.id] = newOrder;
                    list.querySelectorAll('.rank-number').forEach((n, i) => n.textContent = i + 1);
                }
            });
        }
    };
    
    renderItems();
    wrapper.appendChild(list);
    container.appendChild(wrapper);
}

function renderMap(q) {
    const wrapper = document.createElement('div');
    wrapper.className = 'map-wrapper animate-in';
    
    const mapDiv = document.createElement('div');
    mapDiv.id = 'mapContainer';
    
    const display = document.createElement('div');
    display.className = 'location-display';
    display.textContent = answers[q.id] ? `📍 ${answers[q.id].name}` : 'Click on the map to select a location';
    
    wrapper.appendChild(mapDiv);
    wrapper.appendChild(display);
    container.appendChild(wrapper);
    
    setTimeout(() => {
        if (typeof L === 'undefined') {
            // Fallback to text input
            mapDiv.style.display = 'none';
            display.textContent = '⚠️ Map unavailable. Enter location below:';
            display.style.color = '#ff4d6d';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'location-input';
            input.placeholder = 'Enter a city or country (e.g., Paris, Japan)';
            input.value = answers[q.id]?.name || '';
            
            input.addEventListener('input', (e) => {
                answers[q.id] = { lat: 0, lng: 0, name: e.target.value };
            });
            
            wrapper.insertBefore(input, display);
            return;
        }
        
        if (mapInstance) {
            mapInstance.remove();
            mapInstance = null;
        }
        
        // Configure Leaflet icons
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'assets/images/marker-icon-2x.png',
            iconUrl: 'assets/images/marker-icon.png',
            shadowUrl: 'assets/images/marker-shadow.png'
        });
        
        const defaultLat = answers[q.id]?.lat || 20;
        const defaultLng = answers[q.id]?.lng || 0;
        
        mapInstance = L.map('mapContainer').setView([defaultLat, defaultLng], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(mapInstance);
        
        let marker = null;
        if (answers[q.id]) {
            marker = L.marker([answers[q.id].lat, answers[q.id].lng]).addTo(mapInstance);
        }
        
        mapInstance.on('click', (e) => {
            const { lat, lng } = e.latlng;
            if (marker) marker.remove();
            marker = L.marker([lat, lng]).addTo(mapInstance);
            display.textContent = 'Loading location...';
            
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                .then(r => r.json())
                .then(data => {
                    const name = data.address?.country || data.display_name.split(',').pop().trim();
                    answers[q.id] = { lat, lng, name };
                    display.textContent = `📍 ${name}`;
                })
                .catch(() => {
                    answers[q.id] = { lat, lng, name: 'Selected Location' };
                    display.textContent = '📍 Selected Location';
                });
        });
        
        setTimeout(() => mapInstance.invalidateSize(), 100);
    }, 200);
}

// ============================================
// SUBMISSION - DUAL: FIREBASE + LOCAL SERVER
// ============================================

function createHeartsFlood() {
    const existing = document.querySelector('.hearts-flood');
    if (existing) existing.remove();
    
    const flood = document.createElement('div');
    flood.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
    `;
    flood.className = 'hearts-flood';
    
    const hearts = ['💕', '❤️', '💗', '💖', '💝', '💘', '🩷', '💓', '💞'];
    
    for (let i = 0; i < 60; i++) {
        const heart = document.createElement('span');
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.cssText = `
            position: absolute;
            bottom: -60px;
            left: ${Math.random() * 100}%;
            font-size: ${20 + Math.random() * 40}px;
            opacity: 0.9;
            animation: heartBubble ${2 + Math.random() * 3}s ease-out ${Math.random() * 2}s forwards;
        `;
        flood.appendChild(heart);
    }
    
    // Add keyframes
    if (!document.getElementById('heartBubbleStyle')) {
        const style = document.createElement('style');
        style.id = 'heartBubbleStyle';
        style.textContent = `
            @keyframes heartBubble {
                0% { transform: translateY(0) rotate(0deg) scale(0.5); opacity: 0; }
                10% { opacity: 0.9; }
                100% { transform: translateY(-120vh) rotate(360deg) scale(1.2); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(flood);
    return flood;
}

async function submitData() {
    // Validate email
    if (!answers.email || !answers.email.toLowerCase().endsWith('@asf.edu.mx')) {
        alert("Please login with your @asf.edu.mx Google account first");
        window.location.href = './';
        return;
    }
    
    // Validate all questions answered
    const unanswered = questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
        alert('Please answer all questions before submitting.');
        return;
    }
    
    // Disable button & show loading
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = '<span class="loading-spinner"></span>Submitting...';
    }
    
    const submission = {
        ...answers,
        submittedAt: new Date().toISOString(),
        version: 2
    };
    
    // Start hearts animation
    const heartsFlood = createHeartsFlood();
    
    let success = false;
    
    // Try Firebase first
    if (db && firebaseInitialized) {
        try {
            const emailKey = answers.email.replace(/[.#$[\]]/g, '_');
            await db.ref('valentin_submissions/' + emailKey).set(submission);
            console.log('Saved to Firebase');
            success = true;
        } catch (error) {
            console.error('Firebase save failed:', error);
        }
    }
    
    // Also try local server (backup)
    try {
        const response = await fetch('/sites/valentin/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(answers)
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
                success = true;
            }
        }
    } catch (error) {
        console.error('Server save failed:', error);
    }
    
    if (success) {
        // Set cookies
        document.cookie = `valentin_submitted=true;path=/;max-age=${60*60*24*30}`;
        document.cookie = `valentin_email=${encodeURIComponent(answers.email)};path=/;max-age=${60*60*24*30}`;
        
        // Show success modal
        if (successModal) {
            successModal.classList.add('show');
        } else {
            alert('✅ Submission successful! Thank you!');
            window.location.href = './';
        }
    } else {
        heartsFlood.remove();
        
        // Save to localStorage as last resort
        try {
            localStorage.setItem('valentin_backup_' + Date.now(), JSON.stringify(submission));
            alert('Connection issue. Your answers have been saved locally. Please try again later.');
        } catch (e) {
            alert('Failed to save. Please try again.');
        }
        
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.innerHTML = '💕 Submit';
        }
    }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') nextQuestion();
    else if (e.key === 'ArrowLeft') prevQuestion();
});
