// Question definitions with icons
const fixedQuestions = [
    { id: "gender", type: "select", question: "What is your gender?", options: ["Male", "Female", "Prefer not to say"], icons: ["👨", "👩", "🤐"] },
    { id: "gender_pref", type: "select", question: "Gender Preference", options: ["Male", "Female", "No Preference"], icons: ["👨", "👩", "💕"] },
    { id: "grade", type: "number", question: "What grade are you in?", min: 9, max: 12 },
    { id: "age", type: "number", question: "How old are you?", min: 13, max: 19 }
];

const randomQuestions = [
    { id: "location", type: "map", question: "Where do you want to live?" },
    { id: "extrovert_introvert", type: "slider", question: "How social are you?", minLabel: "🤫 Introverted", maxLabel: "Extroverted 🎉" },
    { id: "qualities_prefer", type: "multi-slider", question: "Qualities you prefer in a partner", subtitle: "(Distribute 100 points)", items: [
        { name: "Intelligence", icon: "🧠" }, { name: "Strength", icon: "💪" }, { name: "Confidence", icon: "😎" }, { name: "Humor", icon: "😂" }, { name: "Kindness", icon: "💝" }
    ]},
    { id: "qualities_have", type: "multi-slider", question: "Rate your own qualities", subtitle: "(Distribute 100 points)", items: [
        { name: "Intelligence", icon: "🧠" }, { name: "Strength", icon: "💪" }, { name: "Confidence", icon: "😎" }, { name: "Humor", icon: "😂" }, { name: "Kindness", icon: "💝" }
    ]},
    { id: "fav_subject", type: "grid", question: "What is your favorite subject?", options: [
        { name: "Math", icon: "📐" }, { name: "Science", icon: "🔬" }, { name: "Art", icon: "🎨" }, { name: "History", icon: "📜" },
        { name: "English", icon: "📚" }, { name: "PE", icon: "⚽" }, { name: "Music", icon: "🎵" }, { name: "CS", icon: "💻" }
    ]},
    { id: "music_genre", type: "grid", question: "Favorite Music Genre", options: [
        { name: "Pop", icon: "🎤" }, { name: "Rock", icon: "🎸" }, { name: "Hip Hop", icon: "🎧" }, { name: "Jazz", icon: "🎷" },
        { name: "Classical", icon: "🎻" }, { name: "Country", icon: "🤠" }, { name: "EDM", icon: "🎹" }, { name: "Indie", icon: "🌟" }
    ]},
    { id: "text_call", type: "binary", question: "Text or Call?", options: [{ name: "Text", icon: "💬" }, { name: "Call", icon: "📞" }] },
    { id: "fav_color", type: "color", question: "What is your favorite color?" },
    { id: "ice_cream", type: "ice-cream", question: "Favorite Ice Cream Flavor", options: [
        { name: "Vanilla", color: "#FFF8DC" }, { name: "Chocolate", color: "#8B4513" },
        { name: "Strawberry", color: "#FFB6C1" }, { name: "Mint", color: "#98FF98" }, { name: "Cookie Dough", color: "#D2B48C" }
    ]},
    { id: "sleep_time", type: "clock", question: "When do you usually go to sleep?" },
    { id: "social_battery", type: "battery", question: "How much social energy do you have?" },
    { id: "fav_season", type: "season", question: "Favorite Season", options: [
        { name: "Spring", icon: "🌸" }, { name: "Summer", icon: "☀️" }, { name: "Autumn", icon: "🍂" }, { name: "Winter", icon: "❄️" }
    ]},
    { id: "date_ideas", type: "rank", question: "Rank these date ideas", options: ["🎬 Movie", "🍽️ Dinner", "🌳 Park", "🎮 Arcade", "🏛️ Museum"] },
    { id: "home_out", type: "binary", question: "Stay Home or Go Out?", options: [{ name: "Home", icon: "🏠" }, { name: "Going Out", icon: "🚗" }] },
    { id: "city_country", type: "binary", question: "City or Countryside?", options: [{ name: "City", icon: "🏙️" }, { name: "Countryside", icon: "🌾" }] }
];

function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

const allQuestions = [...fixedQuestions, ...shuffle(randomQuestions)];
let currentQuestionIndex = 0;
const answers = {};

let container, progressBar, prevBtn, nextBtn, questionNumber, successModal, mapInstance;

function createFloatingHearts() {
    if (document.querySelector(".floating-hearts")) return;
    const heartsDiv = document.createElement("div");
    heartsDiv.className = "floating-hearts";
    const hearts = ["💕", "❤️", "💗", "💖", "💝", "💘"];
    const positions = [10, 25, 40, 60, 75, 90];
    hearts.forEach(function(heart, i) {
        const span = document.createElement("span");
        span.className = "floating-heart";
        span.style.cssText = "--delay:" + (i * 1.2) + "s;--x:" + positions[i] + "%";
        span.textContent = heart;
        heartsDiv.appendChild(span);
    });
    document.body.insertBefore(heartsDiv, document.body.firstChild);
}

document.addEventListener("DOMContentLoaded", function() {
    container = document.getElementById("questionContainer");
    progressBar = document.getElementById("progressBar");
    prevBtn = document.getElementById("prevBtn");
    nextBtn = document.getElementById("nextBtn");
    questionNumber = document.getElementById("questionNumber");
    successModal = document.getElementById("successModal");
    createFloatingHearts();
    if (container && prevBtn && nextBtn) {
        renderQuestion();
        updateNavigation();
    }
});

function renderQuestion() {
    if (!container) return;
    const q = allQuestions[currentQuestionIndex];
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "question-header animate-in";
    header.innerHTML = "<h2>" + q.question + "</h2>";
    if (q.subtitle) header.innerHTML += "<p class='question-subtitle'>" + q.subtitle + "</p>";
    container.appendChild(header);
    
    switch(q.type) {
        case "select": renderSelect(q); break;
        case "number": renderNumber(q); break;
        case "slider": renderSlider(q); break;
        case "multi-slider": renderMultiSlider(q); break;
        case "grid": renderGrid(q); break;
        case "binary": renderBinary(q); break;
        case "color": renderColor(q); break;
        case "ice-cream": renderIceCream(q); break;
        case "clock": renderClock(q); break;
        case "battery": renderBattery(q); break;
        case "season": renderSeason(q); break;
        case "rank": renderRank(q); break;
        case "map": renderMap(q); break;
    }
    updateProgress();
}

function renderSelect(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "options-grid";
    q.options.forEach(function(opt, idx) {
        const btn = document.createElement("div");
        btn.className = "option-btn animate-in";
        btn.style.animationDelay = (idx * 0.1) + "s";
        if (answers[q.id] === opt) btn.classList.add("selected");
        btn.innerHTML = "<span class='option-icon'>" + q.icons[idx] + "</span><span class='option-label'>" + opt + "</span>";
        btn.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt;
            wrapper.querySelectorAll(".option-btn").forEach(function(c) { c.classList.remove("selected"); });
            btn.classList.add("selected");
        });
        wrapper.appendChild(btn);
    });
    container.appendChild(wrapper);
}

function renderNumber(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "grade-picker-wrapper animate-in";
    const picker = document.createElement("div");
    picker.className = "grade-picker";
    let val = answers[q.id] || q.min;
    
    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "grade-arrow";
    downBtn.textContent = "−";
    
    const display = document.createElement("div");
    display.className = "grade-display";
    display.textContent = val;
    
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "grade-arrow";
    upBtn.textContent = "+";
    
    downBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (val > q.min) { val--; display.textContent = val; answers[q.id] = val; }
    });
    upBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (val < q.max) { val++; display.textContent = val; answers[q.id] = val; }
    });
    
    picker.appendChild(downBtn);
    picker.appendChild(display);
    picker.appendChild(upBtn);
    wrapper.appendChild(picker);
    container.appendChild(wrapper);
    answers[q.id] = val;
}

function renderSlider(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "slider-wrapper animate-in";
    const labels = document.createElement("div");
    labels.className = "slider-labels";
    labels.innerHTML = "<span>" + q.minLabel + "</span><span>" + q.maxLabel + "</span>";
    
    const sliderRow = document.createElement("div");
    sliderRow.className = "slider-container";
    
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = answers[q.id] !== undefined ? answers[q.id] : "50";
    
    const valueDisplay = document.createElement("span");
    valueDisplay.className = "slider-value";
    valueDisplay.textContent = slider.value + "%";
    
    slider.addEventListener("input", function(e) {
        const v = parseInt(e.target.value);
        answers[q.id] = v;
        valueDisplay.textContent = v + "%";
    });
    answers[q.id] = parseInt(slider.value);
    
    sliderRow.appendChild(slider);
    sliderRow.appendChild(valueDisplay);
    wrapper.appendChild(labels);
    wrapper.appendChild(sliderRow);
    container.appendChild(wrapper);
}

function renderMultiSlider(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "multi-slider-container animate-in";
    
    if (!answers[q.id]) {
        answers[q.id] = {};
        q.items.forEach(function(item) { answers[q.id][item.name] = 20; });
    }
    
    const totalDisplay = document.createElement("div");
    totalDisplay.className = "slider-value-display";
    totalDisplay.style.cssText = "text-align:center;margin-bottom:20px;font-size:1.2rem;font-weight:600;";
    
    const sliders = [];
    
    function updateTotal() {
        const total = Object.values(answers[q.id]).reduce(function(a,b) { return a+b; }, 0);
        const isValid = total === 100;
        totalDisplay.innerHTML = "Total: <span style='color:" + (isValid ? "#4caf50" : "#ff4d6d") + ";font-weight:700;'>" + total + "/100</span>";
        if (!isValid) {
            totalDisplay.innerHTML += "<br><small style='color:#999;'>Adjust sliders to total exactly 100</small>";
        }
    }
    
    wrapper.appendChild(totalDisplay);
    
    q.items.forEach(function(item, idx) {
        const row = document.createElement("div");
        row.className = "slider-container";
        row.style.animationDelay = (idx * 0.08) + "s";
        
        const label = document.createElement("label");
        label.innerHTML = item.icon + " " + item.name;
        label.style.cssText = "min-width:120px;font-weight:500;";
        
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.value = answers[q.id][item.name];
        slider.dataset.name = item.name;
        sliders.push(slider);
        
        const valueDisp = document.createElement("span");
        valueDisp.className = "slider-value";
        valueDisp.textContent = slider.value;
        valueDisp.style.minWidth = "35px";
        
        slider.addEventListener("input", function(e) {
            const newVal = parseInt(e.target.value);
            const currentTotal = Object.values(answers[q.id]).reduce(function(a,b) { return a+b; }, 0);
            const diff = newVal - answers[q.id][item.name];
            
            // If going over 100, cap it
            if (currentTotal + diff > 100) {
                const maxAllowed = 100 - (currentTotal - answers[q.id][item.name]);
                slider.value = maxAllowed;
                answers[q.id][item.name] = maxAllowed;
                valueDisp.textContent = maxAllowed;
            } else {
                answers[q.id][item.name] = newVal;
                valueDisp.textContent = newVal;
            }
            updateTotal();
        });
        
        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueDisp);
        wrapper.appendChild(row);
    });
    
    container.appendChild(wrapper);
    updateTotal();
}

function renderGrid(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "grid-options";
    q.options.forEach(function(opt, idx) {
        const item = document.createElement("div");
        item.className = "grid-item animate-in";
        item.style.animationDelay = (idx * 0.05) + "s";
        if (answers[q.id] === opt.name) item.classList.add("selected");
        item.innerHTML = "<span class='grid-icon'>" + opt.icon + "</span><span>" + opt.name + "</span>";
        item.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".grid-item").forEach(function(c) { c.classList.remove("selected"); });
            item.classList.add("selected");
        });
        wrapper.appendChild(item);
    });
    container.appendChild(wrapper);
}

function renderBinary(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "binary-container";
    wrapper.style.cssText = "display:flex;gap:30px;justify-content:center;flex-wrap:wrap;";
    
    q.options.forEach(function(opt, idx) {
        const card = document.createElement("div");
        card.className = "binary-option animate-in";
        card.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 40px;border-radius:20px;background:white;border:3px solid #eee;cursor:pointer;transition:all 0.3s ease;min-width:140px;";
        card.style.animationDelay = (idx * 0.15) + "s";
        
        if (answers[q.id] === opt.name) {
            card.style.borderColor = "#ff4d6d";
            card.style.background = "linear-gradient(135deg, #fff5f7 0%, #ffe0e6 100%)";
            card.style.transform = "scale(1.05)";
        }
        
        const icon = document.createElement("span");
        icon.style.cssText = "font-size:3rem;margin-bottom:10px;";
        icon.textContent = opt.icon;
        
        const text = document.createElement("span");
        text.style.cssText = "font-weight:600;font-size:1.1rem;color:#333;";
        text.textContent = opt.name;
        
        card.appendChild(icon);
        card.appendChild(text);
        
        card.addEventListener("mouseenter", function() {
            if (answers[q.id] !== opt.name) {
                card.style.borderColor = "#ffb3c1";
                card.style.transform = "scale(1.02)";
            }
        });
        card.addEventListener("mouseleave", function() {
            if (answers[q.id] !== opt.name) {
                card.style.borderColor = "#eee";
                card.style.transform = "scale(1)";
            }
        });
        
        card.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".binary-option").forEach(function(c) {
                c.style.borderColor = "#eee";
                c.style.background = "white";
                c.style.transform = "scale(1)";
            });
            card.style.borderColor = "#ff4d6d";
            card.style.background = "linear-gradient(135deg, #fff5f7 0%, #ffe0e6 100%)";
            card.style.transform = "scale(1.05)";
        });
        
        wrapper.appendChild(card);
    });
    container.appendChild(wrapper);
}

function renderColor(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "color-picker-wrapper animate-in";
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;";
    
    const heartContainer = document.createElement("div");
    heartContainer.style.cssText = "position:relative;width:150px;height:150px;cursor:pointer;";
    
    const input = document.createElement("input");
    input.type = "color";
    input.value = answers[q.id] || "#ff4d6d";
    input.style.cssText = "position:absolute;width:100%;height:100%;opacity:0;cursor:pointer;";
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.style.cssText = "width:100%;height:100%;filter:drop-shadow(0 4px 15px rgba(255,77,109,0.4));";
    svg.innerHTML = '<path fill="' + (answers[q.id] || "#ff4d6d") + '" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
    
    const preview = document.createElement("div");
    preview.style.cssText = "text-align:center;margin-top:20px;font-size:1.3rem;font-weight:600;color:#333;";
    preview.textContent = answers[q.id] || "#ff4d6d";
    
    input.addEventListener("input", function(e) {
        answers[q.id] = e.target.value;
        preview.textContent = e.target.value;
        svg.querySelector("path").setAttribute("fill", e.target.value);
    });
    
    heartContainer.appendChild(input);
    heartContainer.appendChild(svg);
    wrapper.appendChild(heartContainer);
    wrapper.appendChild(preview);
    container.appendChild(wrapper);
}

function renderIceCream(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "ice-cream-container";
    q.options.forEach(function(opt, idx) {
        const cone = document.createElement("div");
        cone.className = "ice-cream-cone animate-in";
        cone.style.animationDelay = (idx * 0.1) + "s";
        if (answers[q.id] === opt.name) cone.classList.add("selected");
        
        const scoopContainer = document.createElement("div");
        scoopContainer.className = "scoop-container";
        for (let i = 1; i <= 3; i++) {
            const scoop = document.createElement("div");
            scoop.className = "scoop scoop-" + i;
            scoop.style.backgroundColor = opt.color;
            scoopContainer.appendChild(scoop);
        }
        
        const coneShape = document.createElement("div");
        coneShape.className = "cone";
        const label = document.createElement("span");
        label.className = "ice-cream-label";
        label.textContent = opt.name;
        
        cone.appendChild(scoopContainer);
        cone.appendChild(coneShape);
        cone.appendChild(label);
        
        cone.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".ice-cream-cone").forEach(function(c) { c.classList.remove("selected"); });
            cone.classList.add("selected");
        });
        wrapper.appendChild(cone);
    });
    container.appendChild(wrapper);
}

function renderClock(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "clock-wrapper animate-in";
    
    const clockFace = document.createElement("div");
    clockFace.className = "analog-clock";
    clockFace.style.cssText = "position:relative;width:200px;height:200px;border-radius:50%;background:white;border:4px solid #ff4d6d;margin:0 auto;box-shadow:0 8px 30px rgba(255,77,109,0.2);";
    
    // Add hour markers
    for (let i = 0; i < 12; i++) {
        const tick = document.createElement("div");
        tick.className = "clock-tick" + (i % 3 === 0 ? " major" : "");
        tick.style.transform = "rotate(" + (i * 30) + "deg)";
        clockFace.appendChild(tick);
    }
    
    const centerDot = document.createElement("div");
    centerDot.className = "clock-center";
    centerDot.style.cssText = "position:absolute;top:50%;left:50%;width:16px;height:16px;background:#ff4d6d;border-radius:50%;transform:translate(-50%,-50%);z-index:20;";
    clockFace.appendChild(centerDot);
    
    const hourHand = document.createElement("div");
    hourHand.style.cssText = "position:absolute;bottom:50%;left:50%;width:8px;height:50px;background:linear-gradient(to top,#ff4d6d,#ff8fa3);border-radius:4px;transform-origin:bottom center;transform:translateX(-50%);cursor:grab;z-index:10;";
    clockFace.appendChild(hourHand);
    
    const minuteHand = document.createElement("div");
    minuteHand.style.cssText = "position:absolute;bottom:50%;left:50%;width:4px;height:70px;background:linear-gradient(to top,#333,#666);border-radius:2px;transform-origin:bottom center;transform:translateX(-50%);cursor:grab;z-index:11;";
    clockFace.appendChild(minuteHand);
    
    const display = document.createElement("div");
    display.className = "clock-display";
    display.style.cssText = "text-align:center;margin-top:20px;font-size:2rem;font-weight:700;color:#333;";
    
    let hours = 22, minutes = 0;
    if (answers[q.id]) {
        const parts = answers[q.id].split(":");
        hours = parseInt(parts[0]);
        minutes = parseInt(parts[1]);
    }
    let dragging = null;
    
    function updateClock() {
        const hourDeg = (hours % 12) * 30 + minutes * 0.5;
        const minDeg = minutes * 6;
        hourHand.style.transform = "translateX(-50%) rotate(" + hourDeg + "deg)";
        minuteHand.style.transform = "translateX(-50%) rotate(" + minDeg + "deg)";
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        display.textContent = h12 + ":" + minutes.toString().padStart(2, "0") + " " + ampm;
        answers[q.id] = hours.toString().padStart(2, "0") + ":" + minutes.toString().padStart(2, "0");
    }
    
    function getAngle(e, rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let angle = Math.atan2(clientX - cx, -(clientY - cy)) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        return angle;
    }
    
    // Make the whole clock face clickable for easier interaction
    clockFace.addEventListener("click", function(e) {
        const rect = clockFace.getBoundingClientRect();
        const angle = getAngle(e, rect);
        // Determine if click is closer to edge (minutes) or center (hours)
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const clientX = e.clientX;
        const clientY = e.clientY;
        const dist = Math.sqrt(Math.pow(clientX - cx, 2) + Math.pow(clientY - cy, 2));
        const radius = rect.width / 2;
        
        if (dist > radius * 0.5) {
            // Outer area - set minutes
            minutes = Math.round(angle / 6) % 60;
        } else {
            // Inner area - set hours
            const newHour = Math.round(angle / 30) % 12;
            hours = hours >= 12 ? newHour + 12 : newHour;
            if (hours === 24) hours = 12;
            if (hours === 0 && hours >= 12) hours = 12;
        }
        updateClock();
    });
    
    function handleDrag(e) {
        if (!dragging) return;
        e.preventDefault();
        const rect = clockFace.getBoundingClientRect();
        const angle = getAngle(e, rect);
        if (dragging === "hour") {
            const newHour = Math.round(angle / 30) % 12;
            hours = hours >= 12 ? newHour + 12 : newHour;
            if (hours === 24) hours = 12;
        } else {
            minutes = Math.round(angle / 6) % 60;
        }
        updateClock();
    }
    
    hourHand.addEventListener("mousedown", function(e) { e.stopPropagation(); dragging = "hour"; hourHand.style.cursor = "grabbing"; });
    hourHand.addEventListener("touchstart", function(e) { e.stopPropagation(); dragging = "hour"; }, { passive: true });
    minuteHand.addEventListener("mousedown", function(e) { e.stopPropagation(); dragging = "minute"; minuteHand.style.cursor = "grabbing"; });
    minuteHand.addEventListener("touchstart", function(e) { e.stopPropagation(); dragging = "minute"; }, { passive: true });
    
    document.addEventListener("mouseup", function() { dragging = null; hourHand.style.cursor = "grab"; minuteHand.style.cursor = "grab"; });
    document.addEventListener("touchend", function() { dragging = null; });
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("touchmove", handleDrag, { passive: false });
    
    const ampmToggle = document.createElement("div");
    ampmToggle.style.cssText = "display:flex;gap:10px;justify-content:center;margin-top:15px;";
    
    const amBtn = document.createElement("button");
    amBtn.type = "button";
    amBtn.textContent = "AM";
    amBtn.style.cssText = "padding:10px 25px;border:2px solid #ff4d6d;border-radius:25px;font-weight:600;cursor:pointer;transition:all 0.2s;";
    amBtn.style.background = hours < 12 ? "#ff4d6d" : "white";
    amBtn.style.color = hours < 12 ? "white" : "#ff4d6d";
    
    const pmBtn = document.createElement("button");
    pmBtn.type = "button";
    pmBtn.textContent = "PM";
    pmBtn.style.cssText = "padding:10px 25px;border:2px solid #ff4d6d;border-radius:25px;font-weight:600;cursor:pointer;transition:all 0.2s;";
    pmBtn.style.background = hours >= 12 ? "#ff4d6d" : "white";
    pmBtn.style.color = hours >= 12 ? "white" : "#ff4d6d";
    
    amBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (hours >= 12) hours -= 12;
        amBtn.style.background = "#ff4d6d"; amBtn.style.color = "white";
        pmBtn.style.background = "white"; pmBtn.style.color = "#ff4d6d";
        updateClock();
    });
    pmBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (hours < 12) hours += 12;
        pmBtn.style.background = "#ff4d6d"; pmBtn.style.color = "white";
        amBtn.style.background = "white"; amBtn.style.color = "#ff4d6d";
        updateClock();
    });
    
    ampmToggle.appendChild(amBtn);
    ampmToggle.appendChild(pmBtn);
    
    const hint = document.createElement("div");
    hint.style.cssText = "text-align:center;margin-top:10px;color:#999;font-size:0.9rem;";
    hint.textContent = "Click anywhere on the clock to set time";
    
    updateClock();
    wrapper.appendChild(clockFace);
    wrapper.appendChild(display);
    wrapper.appendChild(ampmToggle);
    wrapper.appendChild(hint);
    container.appendChild(wrapper);
}

function renderBattery(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "battery-wrapper vertical animate-in";
    
    const outer = document.createElement("div");
    outer.className = "battery-outer-vertical";
    const batteryContainer = document.createElement("div");
    batteryContainer.className = "battery-container-vertical";
    
    let level = answers[q.id] !== undefined ? answers[q.id] : 2;
    const display = document.createElement("div");
    display.className = "battery-label";
    
    function updateDisplay() {
        const labels = ["Empty 😴", "Low 😕", "Medium 😊", "High 😄", "Full 🤩"];
        display.textContent = labels[level];
    }
    
    for (let i = 4; i >= 0; i--) {
        const segment = document.createElement("div");
        segment.className = "battery-segment-vertical";
        segment.setAttribute("data-level", i);
        if (i <= level) segment.classList.add("active");
        segment.addEventListener("click", function(e) {
            e.stopPropagation();
            level = i;
            answers[q.id] = level;
            batteryContainer.querySelectorAll(".battery-segment-vertical").forEach(function(s) {
                if (parseInt(s.getAttribute("data-level")) <= level) s.classList.add("active");
                else s.classList.remove("active");
            });
            updateDisplay();
        });
        batteryContainer.appendChild(segment);
    }
    
    outer.appendChild(batteryContainer);
    wrapper.appendChild(outer);
    wrapper.appendChild(display);
    container.appendChild(wrapper);
    updateDisplay();
    answers[q.id] = level;
}

function renderSeason(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "season-container";
    q.options.forEach(function(opt, idx) {
        const item = document.createElement("div");
        item.className = "season-item animate-in " + opt.name.toLowerCase();
        item.style.animationDelay = (idx * 0.1) + "s";
        if (answers[q.id] === opt.name) item.classList.add("selected");
        item.innerHTML = "<span class='season-icon'>" + opt.icon + "</span><span class='season-name'>" + opt.name + "</span>";
        item.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".season-item").forEach(function(c) { c.classList.remove("selected"); });
            item.classList.add("selected");
        });
        wrapper.appendChild(item);
    });
    container.appendChild(wrapper);
}

function renderRank(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "rank-container animate-in";
    
    const instruction = document.createElement("div");
    instruction.className = "rank-instruction";
    instruction.textContent = "Drag to reorder (1 = most preferred)";
    wrapper.appendChild(instruction);
    
    if (!answers[q.id]) answers[q.id] = q.options.slice();
    
    const list = document.createElement("ul");
    list.className = "rank-list";
    list.style.cssText = "list-style:none;padding:0;margin:0;";
    
    function renderItems() {
        list.innerHTML = "";
        answers[q.id].forEach(function(item, idx) {
            const row = document.createElement("li");
            row.className = "rank-item";
            row.innerHTML = "<span class='rank-number'>" + (idx + 1) + "</span><span class='rank-text'>" + item + "</span><span class='rank-handle'>☰</span>";
            list.appendChild(row);
        });
        if (typeof Sortable !== "undefined") {
            new Sortable(list, {
                animation: 150,
                ghostClass: "rank-ghost",
                chosenClass: "rank-chosen",
                onEnd: function() {
                    const newOrder = [];
                    list.querySelectorAll(".rank-text").forEach(function(t) { newOrder.push(t.textContent); });
                    answers[q.id] = newOrder;
                    list.querySelectorAll(".rank-number").forEach(function(n, i) { n.textContent = i + 1; });
                }
            });
        }
    }
    renderItems();
    wrapper.appendChild(list);
    container.appendChild(wrapper);
}

function renderMap(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "map-wrapper animate-in";
    
    const mapContainer = document.createElement("div");
    mapContainer.id = "mapContainer";
    mapContainer.style.cssText = "width:100%;height:300px;border-radius:12px;overflow:hidden;border:2px solid #eee;";
    
    const locDisplay = document.createElement("div");
    locDisplay.style.cssText = "text-align:center;margin-top:15px;font-size:1.1rem;color:#666;";
    locDisplay.textContent = answers[q.id] ? "📍 " + answers[q.id].name : "Click on the map to select a location";
    
    wrapper.appendChild(mapContainer);
    wrapper.appendChild(locDisplay);
    container.appendChild(wrapper);
    
    setTimeout(function() {
        if (typeof L === "undefined") {
            locDisplay.textContent = "Map failed to load. Please refresh.";
            return;
        }
        if (mapInstance) { mapInstance.remove(); mapInstance = null; }
        
        const defaultLat = answers[q.id] ? answers[q.id].lat : 20;
        const defaultLng = answers[q.id] ? answers[q.id].lng : 0;
        
        mapInstance = L.map("mapContainer").setView([defaultLat, defaultLng], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(mapInstance);
        
        let marker = null;
        if (answers[q.id]) marker = L.marker([answers[q.id].lat, answers[q.id].lng]).addTo(mapInstance);
        
        mapInstance.on("click", function(e) {
            const lat = e.latlng.lat, lng = e.latlng.lng;
            if (marker) marker.remove();
            marker = L.marker([lat, lng]).addTo(mapInstance);
            locDisplay.textContent = "Loading...";
            
            fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    const name = (data.address && data.address.country) || data.display_name.split(",").pop().trim();
                    answers[q.id] = { lat: lat, lng: lng, name: name };
                    locDisplay.textContent = "📍 " + name;
                })
                .catch(function() {
                    answers[q.id] = { lat: lat, lng: lng, name: "Selected Location" };
                    locDisplay.textContent = "📍 Selected Location";
                });
        });
        setTimeout(function() { mapInstance.invalidateSize(); }, 100);
    }, 200);
}

function updateProgress() {
    if (!progressBar || !questionNumber) return;
    const progress = ((currentQuestionIndex + 1) / allQuestions.length) * 100;
    progressBar.style.width = progress + "%";
    questionNumber.textContent = "Question " + (currentQuestionIndex + 1) + " of " + allQuestions.length;
}

function updateNavigation() {
    if (!prevBtn || !nextBtn) return;
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.innerHTML = currentQuestionIndex === allQuestions.length - 1 ? "Submit 💕" : "Next →";
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
        updateNavigation();
    }
}

function nextQuestion() {
    if (currentQuestionIndex === allQuestions.length - 1) {
        submitData();
    } else {
        currentQuestionIndex++;
        renderQuestion();
        updateNavigation();
    }
}

function createHeartsFlood() {
    // Remove existing flood if any
    const existing = document.querySelector(".hearts-flood");
    if (existing) existing.remove();
    
    const flood = document.createElement("div");
    flood.className = "hearts-flood";
    flood.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden";
    
    const hearts = ["💕", "❤️", "💗", "💖", "💝", "💘", "🩷", "🤍", "💓", "💞"];
    const numHearts = 50;
    
    for (let i = 0; i < numHearts; i++) {
        const heart = document.createElement("span");
        const size = 20 + Math.random() * 40;
        const xPos = Math.random() * 100;
        const duration = 2 + Math.random() * 3;
        const delay = Math.random() * 2;
        
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.cssText = 
            "position:absolute;" +
            "bottom:-60px;" +
            "left:" + xPos + "%;" +
            "font-size:" + size + "px;" +
            "opacity:0.8;" +
            "animation:heartBubble " + duration + "s ease-out " + delay + "s forwards";
        flood.appendChild(heart);
    }
    
    // Add keyframes if not already present
    if (!document.querySelector("#heartBubbleStyle")) {
        const style = document.createElement("style");
        style.id = "heartBubbleStyle";
        style.textContent = 
            "@keyframes heartBubble {" +
            "  0% { transform: translateY(0) rotate(0deg) scale(0.5); opacity: 0; }" +
            "  10% { opacity: 0.9; }" +
            "  100% { transform: translateY(-120vh) rotate(" + (Math.random() > 0.5 ? "" : "-") + "360deg) scale(1.2); opacity: 0; }" +
            "}";
        document.head.appendChild(style);
    }
    
    document.body.appendChild(flood);
    return flood;
}

function submitData() {
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = "💕 Submitting...";
    }
    
    console.log("Submitting answers:", answers);
    
    // Start the hearts flood animation
    const heartsFlood = createHeartsFlood();
    
    fetch("/sites/valentin/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
        credentials: "same-origin"
    })
    .then(function(resp) {
        console.log("Response status:", resp.status);
        return resp.json();
    })
    .then(function(data) {
        console.log("Response data:", data);
        if (data.status === "success") {
            // Keep hearts going, show success modal
            if (successModal) successModal.classList.add("show");
        } else {
            heartsFlood.remove();
            alert("Error: " + (data.message || "Something went wrong"));
            if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = "Submit 💕"; }
        }
    })
    .catch(function(err) {
        console.error("Submit error:", err);
        heartsFlood.remove();
        alert("Failed to submit: " + err.message);
        if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = "Submit 💕"; }
    });
}

document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") nextQuestion();
    else if (e.key === "ArrowLeft") prevQuestion();
});
