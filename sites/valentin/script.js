// Question definitions with icons
const fixedQuestions = [
    { id: "gender", type: "select", question: "What is your gender?", options: ["Male", "Female", "Prefer not to say"], icons: ["👨", "👩", "🤐"] },
    { id: "gender_pref", type: "select", question: "Who are you interested in?", options: ["Male", "Female", "No Preference"], icons: ["👨", "👩", "💕"] },
    { id: "grade", type: "number", question: "What grade are you in?", min: 9, max: 12 },
    { id: "age", type: "number", question: "How old are you?", min: 13, max: 19 }
];

const randomQuestions = [
    { id: "location", type: "map", question: "Where do you dream of living someday?" },
    { id: "extrovert_introvert", type: "slider", question: "How social are you?", minLabel: "🤫 Introverted", maxLabel: "Extroverted 🎉" },
    { id: "qualities_prefer", type: "multi-slider", question: "What qualities do you look for in a partner?", items: [
        { name: "Intelligence", icon: "🧠" }, { name: "Strength", icon: "💪" }, { name: "Confidence", icon: "😎" }, { name: "Humor", icon: "😂" }, { name: "Kindness", icon: "💝" }
    ]},
    { id: "qualities_have", type: "multi-slider", question: "How would you rate your own qualities?", items: [
        { name: "Intelligence", icon: "🧠" }, { name: "Strength", icon: "💪" }, { name: "Confidence", icon: "😎" }, { name: "Humor", icon: "😂" }, { name: "Kindness", icon: "💝" }
    ]},
    { id: "fav_subject", type: "grid", question: "What's your favorite subject?", options: [
        { name: "Math", icon: "📐" }, { name: "Science", icon: "🔬" }, { name: "Art", icon: "🎨" }, { name: "History", icon: "📜" },
        { name: "English", icon: "📚" }, { name: "PE", icon: "⚽" }, { name: "Music", icon: "🎵" }, { name: "CS", icon: "💻" }
    ]},
    { id: "music_genre", type: "grid", question: "What music do you vibe to?", options: [
        { name: "Pop", icon: "🎤" }, { name: "Rock", icon: "🎸" }, { name: "Hip Hop", icon: "🎧" }, { name: "R&B", icon: "🎵" },
        { name: "Classical", icon: "🎻" }, { name: "Latin", icon: "💃" }, { name: "EDM", icon: "🎹" }, { name: "Indie", icon: "🌟" }
    ]},
    { id: "text_call", type: "binary", question: "Text or Call?", options: [{ name: "Text", icon: "💬" }, { name: "Call", icon: "📞" }] },
    { id: "fav_color", type: "color", question: "What's your favorite color?", subtitle: "👆 Click the heart below to pick your color!" },
    { id: "ice_cream", type: "ice-cream", question: "Pick your favorite ice cream flavor!", options: [
        { name: "Vanilla", color: "#FFF8DC" }, { name: "Chocolate", color: "#8B4513" },
        { name: "Strawberry", color: "#FFB6C1" }, { name: "Mint", color: "#98FF98" }, { name: "Cookie Dough", color: "#D2B48C" }
    ]},
    { id: "sleep_time", type: "clock", question: "What time do you usually go to sleep?" },
    { id: "social_battery", type: "battery", question: "How's your social battery usually?", subtitle: "Tap a level to select" },
    { id: "fav_season", type: "season", question: "What's your favorite season?", options: [
        { name: "Spring", icon: "🌸" }, { name: "Summer", icon: "☀️" }, { name: "Autumn", icon: "🍂" }, { name: "Winter", icon: "❄️" }
    ]},
    { id: "date_ideas", type: "rank", question: "Rank these date ideas (best to worst)", options: ["🎬 Movie", "🍽️ Dinner", "🌳 Park", "🎮 Arcade", "🏛️ Museum"] },
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

// Parse Google OAuth token from sessionStorage (set by inline script)
function parseOAuthToken(callback) {
    console.log("parseOAuthToken called");
    
    // Try to get token from sessionStorage (set by inline script in HTML)
    let accessToken = null;
    try {
        accessToken = sessionStorage.getItem('oauth_token');
        if (accessToken) {
            console.log("Access token found in sessionStorage");
            // Clear it after reading
            sessionStorage.removeItem('oauth_token');
        }
    } catch(e) {
        console.warn("sessionStorage access failed:", e);
    }
    
    // Fallback: check URL hash (shouldn't happen if inline script worked)
    if (!accessToken) {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const params = new URLSearchParams(hash);
            accessToken = params.get('access_token');
            if (accessToken) {
                console.log("Access token found in URL hash (fallback)");
                window.history.replaceState(null, null, window.location.pathname);
            }
        }
    }
    
    if (accessToken) {
        console.log("Fetching user info from Google...");
        // Fetch user info from Google
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        })
        .then(response => {
            console.log("Google API response status:", response.status);
            return response.json();
        })
        .then(data => {
            console.log("User data received:", data);
            if (data.email && data.email.toLowerCase().endsWith('@asf.edu.mx')) {
                answers.email = data.email;
                console.log('Logged in as:', data.email);
                callback(true);
            } else {
                console.log("Invalid email domain:", data.email);
                alert('Please use an @asf.edu.mx email address');
                window.location.href = './';
            }
        })
        .catch(error => {
            console.error('Error fetching user info:', error);
            alert('Failed to verify your Google account');
            window.location.href = './';
        });
    } else {
        console.log("No access token in URL");
        // No token, redirect to login
        alert('Please login with Google first');
        window.location.href = './';
    }
}

// Check if results are visible (forms are closed)
async function checkResultsStatus() {
    try {
        const resp = await fetch('/sites/valentin/api/status');
        if (resp.ok) {
            const data = await resp.json();
            return data;
        }
    } catch (e) {
        console.log('Could not check results status:', e);
    }
    return { resultsVisible: false, formsClosed: false };
}

// Show results directly on the questionnaire page
async function showResultsPage() {
    const container = document.querySelector('.container');
    if (!container) return;
    
    // Hide navigation and progress
    const nav = document.querySelector('.navigation');
    if (nav) nav.style.display = 'none';
    const progressContainer = document.querySelector('.progress-bar-container');
    if (progressContainer) progressContainer.style.display = 'none';
    
    container.innerHTML = `
        <div class="question-card" style="text-align:center;padding:40px;">
            <div style="font-size:3rem;margin-bottom:15px;">💕</div>
            <h2 style="color:#ff4d6d;margin-bottom:10px;">Loading Your Results...</h2>
            <div class="loading-spinner" style="margin:20px auto;width:40px;height:40px;border:4px solid #ffe0e6;border-top-color:#ff4d6d;border-radius:50%;animation:spin 1s linear infinite;"></div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    
    try {
        // Get user email from cookie, answers object, or URL
        let userEmail = '';
        
        // First check if we have email in answers (from OAuth)
        if (answers && answers.email) {
            userEmail = answers.email;
        }
        
        // Fallback to cookie
        if (!userEmail) {
            const emailCookie = document.cookie.split(';').find(c => c.trim().startsWith('valentin_email='));
            if (emailCookie) {
                userEmail = decodeURIComponent(emailCookie.split('=')[1]);
            }
        }
        
        console.log('Fetching results for email:', userEmail);
        
        // Fetch results with user's email
        const url = userEmail 
            ? `/sites/valentin/api/results?email=${encodeURIComponent(userEmail)}`
            : '/sites/valentin/api/results';
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            let icon = '💔';
            let title = data.error;
            let message = data.message || 'Please try again later';
            
            if (data.error === 'no_match' || data.error === 'No Match Found') {
                icon = '😔';
                title = 'No Match Found';
                message = `Sorry, we couldn't find a match for your account.<br><br>
                    <strong>Possible reasons:</strong><br>
                    • You may not have submitted the forms on time<br>
                    • There wasn't a compatible match available<br><br>
                    <span style="color:#999;font-size:0.9rem;">Don't worry - there's always next year! 💕</span>`;
            } else if (data.error === 'results_not_ready') {
                icon = '⏳';
                title = 'Results Not Ready Yet';
                message = 'The matchmaking process hasn\'t been completed yet.<br><br>Please check back later!';
            } else if (data.error === 'not_submitted') {
                icon = '📝';
                title = 'No Submission Found';
                message = `We couldn't find a questionnaire submission for your account.<br><br>
                    Make sure you're logged in with the same account you used to fill out the form.`;
            }
            
            container.innerHTML = `
                <div class="question-card" style="text-align:center;padding:60px 40px;">
                    <div style="font-size:5rem;margin-bottom:20px;">${icon}</div>
                    <h2 style="color:#ff4d6d;margin-bottom:20px;font-size:2rem;">${title}</h2>
                    <p style="color:#666;font-size:1.1rem;line-height:1.6;max-width:400px;margin:0 auto 30px;">${message}</p>
                    <a href="./" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#ff4d6d,#c9184a);color:white;text-decoration:none;border-radius:50px;font-weight:600;box-shadow:0 6px 20px rgba(255,77,109,0.3);">
                        ← Back to Home
                    </a>
                </div>
            `;
            return;
        }
        
        const { stats, match } = data;
        
        // Show individual match result
        if (match) {
            const scoreColor = match.compatibility >= 70 ? '#28a745' : match.compatibility >= 40 ? '#ffc107' : '#dc3545';
            
            container.innerHTML = `
                <div class="question-card" style="padding:40px;text-align:center;">
                    <div style="font-size:4rem;margin-bottom:10px;">💘</div>
                    <h1 style="color:#ff4d6d;font-size:2.2rem;margin-bottom:5px;">Your Match!</h1>
                    <p style="color:#888;margin-bottom:30px;">Happy Valentine's Day! 💕</p>
                    
                    <div style="background:linear-gradient(135deg,#fff5f7,#ffe0e6);border-radius:24px;padding:30px;margin-bottom:30px;border:3px solid #ff4d6d;">
                        <div style="font-size:1.8rem;font-weight:700;color:#333;margin-bottom:10px;">
                            ${match.name || match.email?.split('@')[0] || 'Your Match'}
                        </div>
                        <div style="font-size:1rem;color:#ff4d6d;margin-bottom:15px;">
                            📧 ${match.email || 'Email not available'}
                        </div>
                        <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;color:#666;font-size:0.95rem;">
                            ${match.gender ? `<span>👤 ${match.gender}</span>` : ''}
                            ${match.grade ? `<span>📚 Grade ${match.grade}</span>` : ''}
                            ${match.age ? `<span>🎂 Age ${match.age}</span>` : ''}
                        </div>
                        
                        <div style="margin-top:25px;padding-top:25px;border-top:2px dashed #ffb3c1;">
                            <div style="font-size:3rem;font-weight:700;color:${scoreColor};">${match.compatibility}%</div>
                            <div style="color:#888;font-size:0.9rem;">Compatibility Score</div>
                        </div>
                    </div>
                    
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:30px;">
                        <div style="padding:15px;background:#fff5f7;border-radius:12px;">
                            <div style="font-size:1.5rem;font-weight:700;color:#ff4d6d;">${stats?.totalParticipants || 0}</div>
                            <div style="color:#888;font-size:0.75rem;">Participants</div>
                        </div>
                        <div style="padding:15px;background:#fff5f7;border-radius:12px;">
                            <div style="font-size:1.5rem;font-weight:700;color:#ff4d6d;">${stats?.matchCount || 0}</div>
                            <div style="color:#888;font-size:0.75rem;">Matches Made</div>
                        </div>
                        <div style="padding:15px;background:#fff5f7;border-radius:12px;">
                            <div style="font-size:1.5rem;font-weight:700;color:#ff4d6d;">${stats?.avgCompatibility || 0}%</div>
                            <div style="color:#888;font-size:0.75rem;">Avg Score</div>
                        </div>
                    </div>
                    
                    <p style="color:#999;font-size:0.85rem;margin-bottom:20px;">
                        💡 Reach out and say hi! You might have more in common than you think.
                    </p>
                    
                    <a href="./" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#ff4d6d,#c9184a);color:white;text-decoration:none;border-radius:50px;font-weight:600;box-shadow:0 6px 20px rgba(255,77,109,0.3);">
                        ← Back to Home
                    </a>
                </div>
            `;
        } else {
            // No match found (shouldn't happen if API works correctly)
            container.innerHTML = `
                <div class="question-card" style="text-align:center;padding:60px 40px;">
                    <div style="font-size:5rem;margin-bottom:20px;">😔</div>
                    <h2 style="color:#ff4d6d;margin-bottom:20px;">No Match Found</h2>
                    <p style="color:#666;margin-bottom:30px;">We couldn't find a match for you this time.</p>
                    <a href="./" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#ff4d6d,#c9184a);color:white;text-decoration:none;border-radius:50px;font-weight:600;box-shadow:0 6px 20px rgba(255,77,109,0.3);">
                        ← Back to Home
                    </a>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = `
            <div class="question-card" style="text-align:center;padding:60px 40px;">
                <div style="font-size:5rem;margin-bottom:20px;">❌</div>
                <h2 style="color:#ff4d6d;margin-bottom:20px;">Error Loading Results</h2>
                <p style="color:#666;margin-bottom:30px;">${error.message}</p>
                <button onclick="location.reload()" style="padding:15px 40px;background:linear-gradient(135deg,#ff4d6d,#c9184a);color:white;border:none;border-radius:50px;font-weight:600;cursor:pointer;">
                    🔄 Try Again
                </button>
            </div>
        `;
    }
}

// Show message that form is closed or already submitted
function showFormClosedMessage(reason, email) {
    // If results are visible, show the actual results instead
    if (reason === 'results_visible') {
        showResultsPage();
        return;
    }
    
    const container = document.querySelector('.container');
    if (!container) return;
    
    let title, message, icon;
    
    if (reason === 'already_submitted') {
        icon = '💕';
        title = 'Already Submitted!';
        message = `You've already completed the questionnaire${email ? ' with ' + email : ''}.<br><br>
            <strong>Come back on February 14th</strong> to see your match results! 🎉<br><br>
            <span style="font-size:0.9rem;color:#999;">Can't wait to show you who you matched with! 💘</span>`;
    } else {
        icon = '⏰';
        title = 'Come Back Later';
        message = 'The questionnaire is currently not available. Please check back soon!';
    }
    
    container.innerHTML = `
        <div class="question-card" style="text-align:center;padding:60px 40px;">
            <div style="font-size:5rem;margin-bottom:20px;">${icon}</div>
            <h2 style="color:#ff4d6d;margin-bottom:20px;font-size:2rem;">${title}</h2>
            <p style="color:#666;font-size:1.1rem;line-height:1.6;max-width:400px;margin:0 auto 30px;">${message}</p>
            <a href="./" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#ff4d6d,#c9184a);color:white;text-decoration:none;border-radius:50px;font-weight:600;box-shadow:0 6px 20px rgba(255,77,109,0.3);">
                ← Back to Home
            </a>
        </div>
    `;
    
    // Hide navigation
    const nav = document.querySelector('.navigation');
    if (nav) nav.style.display = 'none';
    
    // Hide progress bar
    const progressContainer = document.querySelector('.progress-bar-container');
    if (progressContainer) progressContainer.style.display = 'none';
}

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
    console.log("DOMContentLoaded fired");
    container = document.getElementById("questionContainer");
    progressBar = document.getElementById("progressBar");
    prevBtn = document.getElementById("prevBtn");
    nextBtn = document.getElementById("nextBtn");
    questionNumber = document.getElementById("questionNumber");
    successModal = document.getElementById("successModal");
    
    console.log("Elements found:", { container: !!container, prevBtn: !!prevBtn, nextBtn: !!nextBtn });
    console.log("All questions count:", allQuestions.length);
    console.log("First question:", allQuestions[0]);
    
    createFloatingHearts();
    
    // Parse OAuth token and get user email, then check status and render questions
    console.log("Calling parseOAuthToken");
    parseOAuthToken(async function(success) {
        console.log("parseOAuthToken callback, success:", success);
        if (success && container && prevBtn && nextBtn) {
            // Check if results are visible (forms closed)
            const status = await checkResultsStatus();
            if (status.formsClosed || status.resultsVisible) {
                showFormClosedMessage('results_visible');
                return;
            }
            
            // Check if user already submitted
            const submittedCookie = document.cookie.split(';').find(c => c.trim().startsWith('valentin_submitted='));
            const emailCookie = document.cookie.split(';').find(c => c.trim().startsWith('valentin_email='));
            if (submittedCookie && submittedCookie.includes('true')) {
                const email = emailCookie ? decodeURIComponent(emailCookie.split('=')[1]) : '';
                showFormClosedMessage('already_submitted', email);
                return;
            }
            
            console.log("About to render first question");
            console.log("Current question index:", currentQuestionIndex);
            renderQuestion();
            updateNavigation();
            updateProgress();
        } else {
            console.log("Not rendering - success:", success, "container:", !!container, "prevBtn:", !!prevBtn, "nextBtn:", !!nextBtn);
        }
    });
});

function renderQuestion() {
    console.log("renderQuestion called, currentQuestionIndex:", currentQuestionIndex);
    if (!container) {
        console.log("No container found!");
        return;
    }
    const q = allQuestions[currentQuestionIndex];
    console.log("Current question:", q);
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "question-header animate-in";
    header.innerHTML = "<h2>" + q.question + "</h2>";
    if (q.subtitle) header.innerHTML += "<p class='question-subtitle'>" + q.subtitle + "</p>";
    container.appendChild(header);
    console.log("Header appended, calling render function for type:", q.type);
    
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
        default: console.log("Unknown question type:", q.type);
    }
    console.log("Finished rendering question content");
    updateProgress();
}

function renderEmail(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "animate-in";
    wrapper.style.cssText = "max-width:500px;margin:40px auto;";
    
    const input = document.createElement("input");
    input.type = "email";
    input.placeholder = "your.name@asf.edu.mx";
    input.value = answers[q.id] || "";
    input.required = true;
    
    const helpText = document.createElement("div");
    helpText.style.cssText = "text-align:center;margin-top:10px;color:#888;font-size:0.9rem;";
    helpText.textContent = "Only @asf.edu.mx emails are accepted";
    
    input.addEventListener("input", function(e) {
        answers[q.id] = e.target.value;
        // Visual feedback for valid email
        if (e.target.value.toLowerCase().endsWith('@asf.edu.mx')) {
            input.style.borderColor = '#4caf50';
        } else if (e.target.value.includes('@')) {
            input.style.borderColor = '#ff4d6d';
        } else {
            input.style.borderColor = '#eee';
        }
    });
    
    wrapper.appendChild(input);
    wrapper.appendChild(helpText);
    container.appendChild(wrapper);
    
    if (answers[q.id]) {
        input.value = answers[q.id];
    }
}

function renderSelect(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "options-grid";
    wrapper.style.marginTop = "30px";
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
    wrapper.style.cssText = "display:flex;justify-content:center;margin-top:40px;";
    
    const picker = document.createElement("div");
    picker.style.cssText = "display:flex;align-items:center;gap:30px;background:white;padding:25px 50px;border-radius:60px;box-shadow:0 8px 30px rgba(255,77,109,0.15);border:2px solid #ffe0e6;";
    
    let val = answers[q.id] || q.min;
    
    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.textContent = "−";
    downBtn.style.cssText = "width:55px;height:55px;border:none;background:linear-gradient(135deg,#ff4d6d,#ff8fa3);color:white;font-size:2rem;border-radius:50%;cursor:pointer;transition:all 0.3s;font-weight:bold;box-shadow:0 4px 15px rgba(255,77,109,0.3);";
    
    const display = document.createElement("div");
    display.textContent = val;
    display.style.cssText = "min-width:70px;text-align:center;font-size:3rem;font-weight:700;color:#ff4d6d;";
    
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.textContent = "+";
    upBtn.style.cssText = "width:55px;height:55px;border:none;background:linear-gradient(135deg,#ff4d6d,#ff8fa3);color:white;font-size:2rem;border-radius:50%;cursor:pointer;transition:all 0.3s;font-weight:bold;box-shadow:0 4px 15px rgba(255,77,109,0.3);";
    
    downBtn.addEventListener("mouseenter", () => {
        downBtn.style.transform = "scale(1.1)";
        downBtn.style.boxShadow = "0 6px 20px rgba(255,77,109,0.4)";
    });
    downBtn.addEventListener("mouseleave", () => {
        downBtn.style.transform = "scale(1)";
        downBtn.style.boxShadow = "0 4px 15px rgba(255,77,109,0.3)";
    });
    upBtn.addEventListener("mouseenter", () => {
        upBtn.style.transform = "scale(1.1)";
        upBtn.style.boxShadow = "0 6px 20px rgba(255,77,109,0.4)";
    });
    upBtn.addEventListener("mouseleave", () => {
        upBtn.style.transform = "scale(1)";
        upBtn.style.boxShadow = "0 4px 15px rgba(255,77,109,0.3)";
    });
    
    downBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (val > q.min) { 
            val--; 
            display.textContent = val; 
            answers[q.id] = val;
            // Add animation
            display.style.transform = "scale(1.2)";
            setTimeout(() => display.style.transform = "scale(1)", 150);
        }
    });
    upBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (val < q.max) { 
            val++; 
            display.textContent = val; 
            answers[q.id] = val;
            // Add animation
            display.style.transform = "scale(1.2)";
            setTimeout(() => display.style.transform = "scale(1)", 150);
        }
    });
    
    display.style.transition = "transform 0.15s ease";
    
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
    labels.style.cssText = "display:flex;justify-content:space-between;margin-bottom:30px;font-size:1.2rem;color:#666;font-weight:600;";
    labels.innerHTML = "<span>" + q.minLabel + "</span><span>" + q.maxLabel + "</span>";
    
    const valueDisplay = document.createElement("div");
    valueDisplay.style.cssText = "text-align:center;font-size:2.5rem;font-weight:700;color:#ff4d6d;margin-bottom:25px;";
    valueDisplay.textContent = (answers[q.id] !== undefined ? answers[q.id] : 50) + "%";
    
    const sliderContainer = document.createElement("div");
    sliderContainer.style.cssText = "padding:0 10px;";
    
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = answers[q.id] !== undefined ? answers[q.id] : "50";
    slider.style.background = "linear-gradient(to right, #ff4d6d " + slider.value + "%, #e0e0e0 " + slider.value + "%)";
    
    slider.addEventListener("input", function(e) {
        const v = parseInt(e.target.value);
        answers[q.id] = v;
        valueDisplay.textContent = v + "%";
        valueDisplay.style.transform = "scale(1.1)";
        setTimeout(() => valueDisplay.style.transform = "scale(1)", 150);
        slider.style.background = "linear-gradient(to right, #ff4d6d " + v + "%, #e0e0e0 " + v + "%)";
    });
    valueDisplay.style.transition = "transform 0.15s ease";
    answers[q.id] = parseInt(slider.value);
    
    sliderContainer.appendChild(slider);
    wrapper.appendChild(valueDisplay);
    wrapper.appendChild(labels);
    wrapper.appendChild(sliderContainer);
    container.appendChild(wrapper);
}

function renderMultiSlider(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "multi-slider-container animate-in";
    
    if (!answers[q.id]) {
        answers[q.id] = {};
        q.items.forEach(function(item) { answers[q.id][item.name] = 50; });
    }
    
    const instruction = document.createElement("div");
    instruction.style.cssText = "text-align:center;margin-bottom:25px;font-size:1.1rem;color:#666;font-weight:500;";
    instruction.textContent = "Rate each quality (0-100)";
    
    wrapper.appendChild(instruction);
    
    q.items.forEach(function(item, idx) {
        const row = document.createElement("div");
        row.className = "slider-container animate-in";
        row.style.animationDelay = (idx * 0.08) + "s";
        
        const label = document.createElement("label");
        label.innerHTML = item.icon + " " + item.name;
        label.style.cssText = "min-width:140px;font-weight:600;font-size:1.05rem;color:#333;";
        
        const sliderWrapper = document.createElement("div");
        sliderWrapper.style.cssText = "flex:1;position:relative;";
        
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.value = answers[q.id][item.name];
        slider.dataset.name = item.name;
        slider.style.background = "linear-gradient(to right, #ff4d6d " + slider.value + "%, #e0e0e0 " + slider.value + "%)";
        
        const valueDisp = document.createElement("span");
        valueDisp.className = "slider-value";
        valueDisp.textContent = slider.value;
        
        slider.addEventListener("input", function(e) {
            const newVal = parseInt(e.target.value);
            answers[q.id][item.name] = newVal;
            valueDisp.textContent = newVal;
            valueDisp.style.transform = "scale(1.2)";
            setTimeout(() => valueDisp.style.transform = "scale(1)", 150);
            slider.style.background = "linear-gradient(to right, #ff4d6d " + newVal + "%, #e0e0e0 " + newVal + "%)";
        });
        valueDisp.style.transition = "transform 0.15s ease";
        
        sliderWrapper.appendChild(slider);
        row.appendChild(label);
        row.appendChild(sliderWrapper);
        row.appendChild(valueDisp);
        wrapper.appendChild(row);
    });
    
    container.appendChild(wrapper);
}

function renderGrid(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "grid-options";
    q.options.forEach(function(opt, idx) {
        const item = document.createElement("div");
        item.className = "grid-item animate-in";
        item.style.animationDelay = (idx * 0.05) + "s";
        if (answers[q.id] === opt.name) item.classList.add("selected");
        item.innerHTML = "<span class='grid-icon'>" + opt.icon + "</span><span style='font-weight:600;color:#333;'>" + opt.name + "</span>";
        item.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".grid-item").forEach(function(c) { c.classList.remove("selected"); });
            item.classList.add("selected");
            autoAdvance();
        });
        wrapper.appendChild(item);
    });
    container.appendChild(wrapper);
}

function renderBinary(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "binary-container";
    wrapper.style.cssText = "display:flex;gap:30px;justify-content:center;flex-wrap:wrap;margin-top:30px;";
    
    q.options.forEach(function(opt, idx) {
        const card = document.createElement("div");
        card.className = "binary-option animate-in";
        card.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 50px;border-radius:20px;background:white;border:3px solid #eee;cursor:pointer;transition:all 0.3s ease;min-width:160px;";
        card.style.animationDelay = (idx * 0.15) + "s";
        
        if (answers[q.id] === opt.name) {
            card.style.borderColor = "#ff4d6d";
            card.style.background = "linear-gradient(135deg, #fff5f7 0%, #ffe0e6 100%)";
            card.style.transform = "scale(1.05)";
            card.style.boxShadow = "0 8px 25px rgba(255,77,109,0.3)";
        }
        
        const icon = document.createElement("span");
        icon.style.cssText = "font-size:4rem;margin-bottom:15px;display:block;";
        icon.textContent = opt.icon;
        
        const text = document.createElement("span");
        text.style.cssText = "font-weight:600;font-size:1.2rem;color:#333;";
        text.textContent = opt.name;
        
        card.appendChild(icon);
        card.appendChild(text);
        
        card.addEventListener("mouseenter", function() {
            if (answers[q.id] !== opt.name) {
                card.style.borderColor = "#ffb3c1";
                card.style.transform = "scale(1.03)";
                card.style.boxShadow = "0 6px 20px rgba(255,77,109,0.15)";
            }
        });
        card.addEventListener("mouseleave", function() {
            if (answers[q.id] !== opt.name) {
                card.style.borderColor = "#eee";
                card.style.transform = "scale(1)";
                card.style.boxShadow = "none";
            }
        });
        
        card.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".binary-option").forEach(function(c) {
                c.style.borderColor = "#eee";
                c.style.background = "white";
                c.style.transform = "scale(1)";
                c.style.boxShadow = "none";
            });
            card.style.borderColor = "#ff4d6d";
            card.style.background = "linear-gradient(135deg, #fff5f7 0%, #ffe0e6 100%)";
            card.style.transform = "scale(1.05)";
            card.style.boxShadow = "0 8px 25px rgba(255,77,109,0.3)";
            autoAdvance();
        });
        
        wrapper.appendChild(card);
    });
    container.appendChild(wrapper);
}

function renderColor(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "color-picker-wrapper animate-in";
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;";
    
    // Add instruction hint if subtitle exists
    if (q.subtitle) {
        const hint = document.createElement("div");
        hint.style.cssText = "text-align:center;margin-bottom:20px;font-size:1.1rem;color:#666;font-weight:500;background:#fff5f7;padding:12px 20px;border-radius:12px;border:2px dashed #ffb3c1;";
        hint.innerHTML = q.subtitle;
        wrapper.appendChild(hint);
    }
    
    const heartContainer = document.createElement("div");
    heartContainer.style.cssText = "position:relative;width:150px;height:150px;cursor:pointer;transition:transform 0.2s;";
    heartContainer.addEventListener("mouseenter", () => heartContainer.style.transform = "scale(1.05)");
    heartContainer.addEventListener("mouseleave", () => heartContainer.style.transform = "scale(1)");
    
    const input = document.createElement("input");
    input.type = "color";
    input.value = answers[q.id] || "#ff4d6d";
    input.style.cssText = "position:absolute;width:100%;height:100%;opacity:0;cursor:pointer;z-index:10;";
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const currentColor = answers[q.id] || "#ff4d6d";
    svg.style.cssText = "width:100%;height:100%;filter:drop-shadow(0 4px 15px " + currentColor + "66);pointer-events:none;transition:filter 0.3s;";
    svg.innerHTML = '<path fill="' + currentColor + '" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
    
    const preview = document.createElement("div");
    preview.style.cssText = "text-align:center;margin-top:20px;font-size:1.3rem;font-weight:600;color:#333;";
    preview.textContent = currentColor;
    
    input.addEventListener("change", function(e) {
        const newColor = e.target.value;
        answers[q.id] = newColor;
        preview.textContent = newColor;
        svg.querySelector("path").setAttribute("fill", newColor);
        svg.style.filter = "drop-shadow(0 4px 15px " + newColor + "66)";
    });
    
    // Initialize answer
    if (!answers[q.id]) {
        answers[q.id] = "#ff4d6d";
    }
    
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
        cone.className = "ice-cream-option animate-in";
        cone.style.animationDelay = (idx * 0.1) + "s";
        
        const isSelected = answers[q.id] === opt.name;
        if (isSelected) cone.classList.add("selected");
        
        const icon = document.createElement("span");
        icon.className = "ice-cream-icon";
        icon.textContent = opt.icon || "🍦";
        
        const label = document.createElement("span");
        label.className = "ice-cream-label";
        label.textContent = opt.name;
        
        cone.appendChild(icon);
        cone.appendChild(label);
        
        cone.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".ice-cream-option").forEach(function(c) {
                c.classList.remove("selected");
            });
            cone.classList.add("selected");
            autoAdvance();
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
    clockFace.style.cssText = "position:relative;width:180px;height:180px;border-radius:50%;background:white;border:4px solid #ff4d6d;margin:0 auto;box-shadow:0 8px 30px rgba(255,77,109,0.2);cursor:pointer;user-select:none;";
    
    // Add hour markers
    for (let i = 0; i < 12; i++) {
        const tick = document.createElement("div");
        tick.className = "clock-tick" + (i % 3 === 0 ? " major" : "");
        tick.style.cssText = "position:absolute;top:50%;left:50%;width:2px;height:10px;background:#999;transform-origin:center;transform:translate(-50%,-90px) rotate(" + (i * 30) + "deg);";
        if (i % 3 === 0) {
            tick.style.height = "12px";
            tick.style.width = "3px";
            tick.style.background = "#999";
        }
        clockFace.appendChild(tick);
        
        // Add hour numbers
        if (i % 3 === 0) {
            const num = document.createElement("div");
            const hour = i === 0 ? 12 : i;
            num.textContent = hour;
            const angle = i * 30 * Math.PI / 180;
            const x = 65 * Math.sin(angle);
            const y = -65 * Math.cos(angle);
            num.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(calc(-50% + " + x + "px), calc(-50% + " + y + "px));font-weight:600;color:#333;font-size:1rem;pointer-events:none;";
            clockFace.appendChild(num);
        }
    }
    
    const centerDot = document.createElement("div");
    centerDot.className = "clock-center";
    centerDot.style.cssText = "position:absolute;top:50%;left:50%;width:14px;height:14px;background:#ff4d6d;border-radius:50%;transform:translate(-50%,-50%);z-index:20;pointer-events:none;";
    clockFace.appendChild(centerDot);
    
    const hourHand = document.createElement("div");
    hourHand.style.cssText = "position:absolute;bottom:50%;left:50%;width:7px;height:45px;background:linear-gradient(to top,#ff4d6d,#ff8fa3);border-radius:4px;transform-origin:bottom center;transform:translateX(-50%);z-index:10;pointer-events:none;transition:transform 0.2s ease;";
    clockFace.appendChild(hourHand);
    
    let hours = 22;
    if (answers[q.id] !== undefined) {
        hours = parseInt(answers[q.id]);
    }
    
    // Time picker with +/- buttons
    const timePickerRow = document.createElement("div");
    timePickerRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:15px;margin-top:20px;";
    
    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.textContent = "−";
    minusBtn.style.cssText = "width:45px;height:45px;border:none;background:linear-gradient(135deg,#ff4d6d,#ff8fa3);color:white;font-size:1.8rem;border-radius:50%;cursor:pointer;transition:all 0.2s;font-weight:bold;box-shadow:0 4px 15px rgba(255,77,109,0.3);line-height:1;";
    
    const display = document.createElement("div");
    display.className = "clock-display";
    display.style.cssText = "min-width:120px;text-align:center;font-size:2rem;font-weight:700;color:#333;background:#f9f9f9;padding:10px 20px;border-radius:12px;border:2px solid #eee;";
    
    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.textContent = "+";
    plusBtn.style.cssText = "width:45px;height:45px;border:none;background:linear-gradient(135deg,#ff4d6d,#ff8fa3);color:white;font-size:1.8rem;border-radius:50%;cursor:pointer;transition:all 0.2s;font-weight:bold;box-shadow:0 4px 15px rgba(255,77,109,0.3);line-height:1;";
    
    function updateClock() {
        const hourDeg = (hours % 12) * 30;
        hourHand.style.transform = "translateX(-50%) rotate(" + hourDeg + "deg)";
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        display.textContent = h12 + ":00 " + ampm;
        answers[q.id] = hours;
        updateAMPMButtons();
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
    
    // Click on clock face to set hour
    clockFace.addEventListener("click", function(e) {
        e.stopPropagation();
        const rect = clockFace.getBoundingClientRect();
        const angle = getAngle(e, rect);
        const newHour = Math.round(angle / 30) % 12;
        // Preserve AM/PM
        if (hours >= 12) {
            hours = newHour === 0 ? 12 : newHour + 12;
        } else {
            hours = newHour === 0 ? 0 : newHour;
        }
        updateClock();
    });
    
    // +/- buttons to adjust hour
    minusBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        hours = hours <= 0 ? 23 : hours - 1;
        updateClock();
    });
    
    plusBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        hours = hours >= 23 ? 0 : hours + 1;
        updateClock();
    });
    
    // Hover effects for buttons
    [minusBtn, plusBtn].forEach(btn => {
        btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.1)"; btn.style.boxShadow = "0 6px 20px rgba(255,77,109,0.4)"; });
        btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; btn.style.boxShadow = "0 4px 15px rgba(255,77,109,0.3)"; });
    });
    
    timePickerRow.appendChild(minusBtn);
    timePickerRow.appendChild(display);
    timePickerRow.appendChild(plusBtn);
    
    // AM/PM toggle buttons
    const ampmToggle = document.createElement("div");
    ampmToggle.style.cssText = "display:flex;gap:10px;justify-content:center;margin-top:15px;";
    
    const amBtn = document.createElement("button");
    amBtn.type = "button";
    amBtn.textContent = "AM";
    amBtn.style.cssText = "padding:10px 25px;border:2px solid #ff4d6d;border-radius:25px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;";
    
    const pmBtn = document.createElement("button");
    pmBtn.type = "button";
    pmBtn.textContent = "PM";
    pmBtn.style.cssText = "padding:10px 25px;border:2px solid #ff4d6d;border-radius:25px;font-weight:600;cursor:pointer;transition:all 0.2s;font-family:inherit;";
    
    function updateAMPMButtons() {
        if (hours < 12) {
            amBtn.style.background = "#ff4d6d";
            amBtn.style.color = "white";
            pmBtn.style.background = "white";
            pmBtn.style.color = "#ff4d6d";
        } else {
            pmBtn.style.background = "#ff4d6d";
            pmBtn.style.color = "white";
            amBtn.style.background = "white";
            amBtn.style.color = "#ff4d6d";
        }
    }
    
    amBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (hours >= 12) {
            hours -= 12;
        }
        updateClock();
    });
    
    pmBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (hours < 12) {
            hours += 12;
        }
        updateClock();
    });
    
    ampmToggle.appendChild(amBtn);
    ampmToggle.appendChild(pmBtn);
    
    const hint = document.createElement("div");
    hint.style.cssText = "text-align:center;margin-top:12px;color:#999;font-size:0.85rem;";
    hint.textContent = "Use +/− buttons or click clock face to set bedtime";
    
    updateClock();
    wrapper.appendChild(clockFace);
    wrapper.appendChild(timePickerRow);
    wrapper.appendChild(ampmToggle);
    wrapper.appendChild(hint);
    container.appendChild(wrapper);
}

function renderBattery(q) {
    console.log("renderBattery called for question:", q.id);
    const wrapper = document.createElement("div");
    wrapper.className = "battery-wrapper animate-in";
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;margin-top:20px;";
    
    // Add hint if subtitle exists
    if (q.subtitle) {
        const hint = document.createElement("div");
        hint.style.cssText = "text-align:center;margin-bottom:20px;font-size:1rem;color:#666;font-weight:500;";
        hint.textContent = q.subtitle;
        wrapper.appendChild(hint);
    }
    
    const batteryOuter = document.createElement("div");
    batteryOuter.style.cssText = "position:relative;display:flex;flex-direction:column;";
    
    const batteryContainer = document.createElement("div");
    batteryContainer.style.cssText = "width:90px;height:280px;border:5px solid #333;border-radius:12px;padding:10px;background:white;display:flex;flex-direction:column;gap:8px;position:relative;box-shadow:0 4px 20px rgba(0,0,0,0.15);";
    
    // Battery tip
    const tip = document.createElement("div");
    tip.style.cssText = "position:absolute;top:-20px;left:50%;transform:translateX(-50%);width:35px;height:16px;background:#333;border-radius:6px 6px 0 0;";
    batteryContainer.appendChild(tip);
    
    let level = answers[q.id] !== undefined ? answers[q.id] : 2;
    const display = document.createElement("div");
    display.style.cssText = "text-align:center;margin-top:25px;font-size:1.8rem;font-weight:700;color:#333;";
    
    const labels = ["Empty 😴", "Low 😕", "Medium 😊", "High 😄", "Full 🤩"];
    const colors = [
        "linear-gradient(135deg, #f44336, #e57373)",
        "linear-gradient(135deg, #ff9800, #ffb74d)", 
        "linear-gradient(135deg, #ffc107, #ffd54f)",
        "linear-gradient(135deg, #8bc34a, #aed581)",
        "linear-gradient(135deg, #4caf50, #81c784)"
    ];
    
    function updateDisplay() {
        display.textContent = labels[level];
    }
    
    // Create segments from top (4) to bottom (0)
    for (let i = 4; i >= 0; i--) {
        const segment = document.createElement("div");
        segment.className = "battery-segment-vertical";
        segment.setAttribute("data-level", i);
        
        if (i <= level) {
            segment.classList.add("active");
        }
        
        segment.addEventListener("click", function(e) {
            e.stopPropagation();
            level = i;
            answers[q.id] = level;
            batteryContainer.querySelectorAll(".battery-segment-vertical").forEach(function(s) {
                const segLevel = parseInt(s.getAttribute("data-level"));
                if (segLevel <= level) {
                    s.classList.add("active");
                } else {
                    s.classList.remove("active");
                }
            });
            updateDisplay();
        });
        
        batteryContainer.appendChild(segment);
    }
    
    batteryOuter.appendChild(batteryContainer);
    wrapper.appendChild(batteryOuter);
    wrapper.appendChild(display);
    container.appendChild(wrapper);
    updateDisplay();
    answers[q.id] = level;
    console.log("Battery rendered, level:", level);
}

function renderSeason(q) {
    const wrapper = document.createElement("div");
    wrapper.className = "season-container";
    wrapper.style.cssText = "display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:30px;max-width:600px;margin-left:auto;margin-right:auto;";
    
    const seasonColors = {
        'Spring': 'linear-gradient(135deg, #FFE5E5 0%, #FFB3D9 100%)',
        'Summer': 'linear-gradient(135deg, #FFF4CC 0%, #FFEB99 100%)',
        'Autumn': 'linear-gradient(135deg, #FFE0B3 0%, #FFB366 100%)',
        'Winter': 'linear-gradient(135deg, #E6F3FF 0%, #B3D9FF 100%)'
    };
    
    q.options.forEach(function(opt, idx) {
        const item = document.createElement("div");
        item.className = "season-option animate-in";
        item.style.cssText = "background:" + (seasonColors[opt.name] || '#fff') + ";border:3px solid #eee;border-radius:20px;padding:30px;text-align:center;cursor:pointer;transition:all 0.3s ease;box-shadow:0 4px 15px rgba(0,0,0,0.08);";
        item.style.animationDelay = (idx * 0.1) + "s";
        
        if (answers[q.id] === opt.name) {
            item.style.borderColor = "#ff4d6d";
            item.style.transform = "scale(1.05)";
            item.style.boxShadow = "0 8px 25px rgba(255,77,109,0.3)";
        }
        
        const icon = document.createElement("span");
        icon.style.cssText = "font-size:4rem;display:block;margin-bottom:15px;";
        icon.textContent = opt.icon;
        
        const name = document.createElement("span");
        name.style.cssText = "font-weight:600;font-size:1.3rem;color:#333;display:block;";
        name.textContent = opt.name;
        
        item.appendChild(icon);
        item.appendChild(name);
        
        item.addEventListener("mouseenter", function() {
            if (answers[q.id] !== opt.name) {
                item.style.transform = "scale(1.03)";
                item.style.borderColor = "#ffb3c6";
            }
        });
        
        item.addEventListener("mouseleave", function() {
            if (answers[q.id] !== opt.name) {
                item.style.transform = "scale(1)";
                item.style.borderColor = "#eee";
            }
        });
        
        item.addEventListener("click", function(e) {
            e.stopPropagation();
            answers[q.id] = opt.name;
            wrapper.querySelectorAll(".season-option").forEach(function(c) {
                c.style.borderColor = "#eee";
                c.style.transform = "scale(1)";
                c.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
            });
            item.style.borderColor = "#ff4d6d";
            item.style.transform = "scale(1.05)";
            item.style.boxShadow = "0 8px 25px rgba(255,77,109,0.3)";
            autoAdvance();
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
    instruction.innerHTML = "<span style='font-size:1.5rem;'>☰</span> Drag items to reorder (1 = most preferred)";
    wrapper.appendChild(instruction);
    
    if (!answers[q.id]) answers[q.id] = q.options.slice();
    
    const list = document.createElement("ul");
    list.className = "rank-list";
    
    function renderItems() {
        list.innerHTML = "";
        answers[q.id].forEach(function(item, idx) {
            const row = document.createElement("li");
            row.className = "rank-item animate-in";
            row.style.animationDelay = (idx * 0.05) + "s";
            row.innerHTML = "<span class='rank-number'>" + (idx + 1) + "</span><span class='rank-text'>" + item + "</span><span class='rank-handle'>☰</span>";
            list.appendChild(row);
        });
        if (typeof Sortable !== "undefined") {
            new Sortable(list, {
                animation: 250,
                easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                ghostClass: "rank-ghost",
                chosenClass: "rank-chosen",
                dragClass: "rank-drag",
                handle: ".rank-handle",
                forceFallback: true,
                onEnd: function() {
                    const newOrder = [];
                    list.querySelectorAll(".rank-text").forEach(function(t) { newOrder.push(t.textContent); });
                    answers[q.id] = newOrder;
                    list.querySelectorAll(".rank-number").forEach(function(n, i) { n.textContent = i + 1; });
                }
            });
        } else {
            console.warn("Sortable.js not loaded - adding manual reorder buttons");
            instruction.innerHTML = "Use ↑↓ buttons to reorder (1 = most preferred)";
            // Add up/down buttons as fallback
            answers[q.id].forEach(function(item, idx) {
                const row = list.children[idx];
                const btnContainer = document.createElement("span");
                btnContainer.style.cssText = "display:flex;flex-direction:column;gap:5px;";
                
                if (idx > 0) {
                    const upBtn = document.createElement("button");
                    upBtn.innerHTML = "↑";
                    upBtn.type = "button";
                    upBtn.style.cssText = "background:#ff4d6d;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:1.2rem;";
                    upBtn.addEventListener("click", function() {
                        const temp = answers[q.id][idx];
                        answers[q.id][idx] = answers[q.id][idx - 1];
                        answers[q.id][idx - 1] = temp;
                        renderItems();
                    });
                    btnContainer.appendChild(upBtn);
                }
                
                if (idx < answers[q.id].length - 1) {
                    const downBtn = document.createElement("button");
                    downBtn.innerHTML = "↓";
                    downBtn.type = "button";
                    downBtn.style.cssText = "background:#ff4d6d;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:1.2rem;";
                    downBtn.addEventListener("click", function() {
                        const temp = answers[q.id][idx];
                        answers[q.id][idx] = answers[q.id][idx + 1];
                        answers[q.id][idx + 1] = temp;
                        renderItems();
                    });
                    btnContainer.appendChild(downBtn);
                }
                
                row.querySelector(".rank-handle").replaceWith(btnContainer);
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
    mapContainer.style.cssText = "width:100%;height:350px;border-radius:16px;overflow:hidden;border:3px solid #eee;box-shadow:0 4px 20px rgba(0,0,0,0.1);";
    
    const locDisplay = document.createElement("div");
    locDisplay.style.cssText = "text-align:center;margin-top:20px;font-size:1.2rem;color:#666;font-weight:500;padding:15px;background:#f9f9f9;border-radius:12px;";
    locDisplay.textContent = answers[q.id] ? "📍 " + answers[q.id].name : "Click on the map to select a location";
    
    wrapper.appendChild(mapContainer);
    wrapper.appendChild(locDisplay);
    container.appendChild(wrapper);
    
    setTimeout(function() {
        if (typeof L === "undefined") {
            locDisplay.textContent = "⚠️ Map library blocked by browser. Using text input instead.";
            locDisplay.style.color = "#ff4d6d";
            mapContainer.style.display = "none";
            
            // Fallback to text input
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "Enter a city or country (e.g., Mexico City, USA)";
            input.value = answers[q.id] ? answers[q.id].name : "";
            input.style.cssText = "width:100%;padding:15px;border:2px solid #eee;border-radius:12px;font-size:1.1rem;margin-top:15px;";
            input.addEventListener("input", function(e) {
                answers[q.id] = { lat: 0, lng: 0, name: e.target.value };
                locDisplay.textContent = e.target.value ? "📍 " + e.target.value : "Enter a location";
                locDisplay.style.color = "#666";
            });
            wrapper.insertBefore(input, locDisplay);
            return;
        }
        if (mapInstance) { mapInstance.remove(); mapInstance = null; }
        
        // Configure Leaflet icon paths for self-hosted assets
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'assets/images/marker-icon-2x.png',
            iconUrl: 'assets/images/marker-icon.png',
            shadowUrl: 'assets/images/marker-shadow.png'
        });
        
        const defaultLat = answers[q.id] ? answers[q.id].lat : 20;
        const defaultLng = answers[q.id] ? answers[q.id].lng : 0;
        
        mapInstance = L.map("mapContainer", { zoomControl: true }).setView([defaultLat, defaultLng], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
            attribution: "© OpenStreetMap",
            maxZoom: 19
        }).addTo(mapInstance);
        
        let marker = null;
        if (answers[q.id]) {
            marker = L.marker([answers[q.id].lat, answers[q.id].lng]).addTo(mapInstance);
        }
        
        mapInstance.on("click", function(e) {
            const lat = e.latlng.lat, lng = e.latlng.lng;
            if (marker) marker.remove();
            marker = L.marker([lat, lng]).addTo(mapInstance);
            locDisplay.textContent = "Loading location...";
            locDisplay.style.color = "#999";
            
            fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    const name = (data.address && data.address.country) || data.display_name.split(",").pop().trim();
                    answers[q.id] = { lat: lat, lng: lng, name: name };
                    locDisplay.textContent = "📍 " + name;
                    locDisplay.style.color = "#666";
                })
                .catch(function() {
                    answers[q.id] = { lat: lat, lng: lng, name: "Selected Location" };
                    locDisplay.textContent = "📍 Selected Location";
                    locDisplay.style.color = "#666";
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
    // Validate answer exists
    const currentQ = allQuestions[currentQuestionIndex];
    if (!answers[currentQ.id] && answers[currentQ.id] !== 0) {
        alert('Please answer the question before continuing');
        return;
    }
    
    if (currentQuestionIndex === allQuestions.length - 1) {
        submitData();
    } else {
        currentQuestionIndex++;
        renderQuestion();
        updateNavigation();
    }
}

function autoAdvance() {
    setTimeout(() => {
        if (currentQuestionIndex < allQuestions.length - 1) {
            nextQuestion();
        }
    }, 400);
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
    // Validate email was retrieved from OAuth
    if (!answers.email || !answers.email.toLowerCase().endsWith('@asf.edu.mx')) {
        alert("Please login with your @asf.edu.mx Google account first");
        window.location.href = './index.html';
        return;
    }
    
    // Validate all questions are answered
    let unanswered = [];
    allQuestions.forEach(function(q) {
        if (!answers[q.id] && answers[q.id] !== 0) {
            unanswered.push(q.question);
        }
    });
    
    if (unanswered.length > 0) {
        alert('Please answer all questions before submitting.');
        return;
    }
    
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = "💕 Submitting...";
    }
    
    console.log("Submitting answers:", answers);
    
    // Start the hearts flood animation
    const heartsFlood = createHeartsFlood();
    
    // Use relative path for submission
    fetch("/sites/valentin/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers)
    })
    .then(function(resp) {
        console.log("Response status:", resp.status);
        if (!resp.ok) {
            return resp.text().then(function(text) {
                console.error("Error response:", text);
                throw new Error("Server error: " + resp.status + " - " + text);
            });
        }
        return resp.json();
    })
    .then(function(data) {
        console.log("Response data:", data);
        if (data.status === "success" || data.message === "Success") {
            // Set cookie to track submission
            document.cookie = "valentin_submitted=true;path=/;max-age=" + (60*60*24*30);
            document.cookie = "valentin_email=" + encodeURIComponent(answers.email) + ";path=/;max-age=" + (60*60*24*30);
            // Keep hearts going, show success modal
            if (successModal) {
                successModal.classList.add("show");
            } else {
                alert("✅ Submission successful! Thank you!");
                window.location.href = './index.html';
            }
        } else {
            heartsFlood.remove();
            alert("Error: " + (data.message || "Something went wrong"));
            if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = "Submit 💕"; }
        }
    })
    .catch(function(err) {
        console.error("Submit error:", err);
        heartsFlood.remove();
        alert("Failed to submit: " + err.message + "\n\nYour answers have been saved locally. Please try again.");
        // Save to localStorage as backup
        try {
            localStorage.setItem('valentin_answers_backup', JSON.stringify(answers));
            console.log("Answers saved to localStorage");
        } catch(e) {
            console.error("Failed to save to localStorage:", e);
        }
        if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = "Submit 💕"; }
    });
}

document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") nextQuestion();
    else if (e.key === "ArrowLeft") prevQuestion();
});
