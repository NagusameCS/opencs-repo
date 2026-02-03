// LineHook Documentation Scripts

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Theme preview click handler
document.querySelectorAll('.theme-preview').forEach(preview => {
    preview.addEventListener('click', () => {
        const theme = preview.dataset.theme;
        // Could add theme preview functionality here
        console.log(`Theme selected: ${theme}`);
    });
});

// Add typing effect to terminal commands (optional enhancement)
function typeWriter(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Animate cards on scroll
document.querySelectorAll('.card, .mode-card, .command-card, .faq-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
});

// Copy code to clipboard functionality
document.querySelectorAll('.terminal-line .command').forEach(cmd => {
    cmd.style.cursor = 'pointer';
    cmd.title = 'Click to copy';

    cmd.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(cmd.textContent);

            // Visual feedback
            const original = cmd.textContent;
            cmd.textContent = 'Copied!';
            cmd.style.color = '#3fb950';

            setTimeout(() => {
                cmd.textContent = original;
                cmd.style.color = '';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });
});
