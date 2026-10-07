const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Nav */

const nav = document.getElementById('nav');
const toggle = document.getElementById('nav-toggle');

function onScroll() {
    nav.classList.toggle('is-stuck', scrollY > 24);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
}

toggle?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (e) => {
    if (e.target.closest('.nav__links a')) setMenu(false);
});
addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
});

const sectionLinks = new Map(
    [...document.querySelectorAll('.nav__links a[href^="#"]')].map((a) => [a.hash.slice(1), a]),
);
if (sectionLinks.size) {
    // Watches every section, linked or not, so the highlight clears over the hero.
    const spy = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            sectionLinks.forEach((a, id) => {
                if (id === entry.target.id) a.setAttribute('aria-current', 'true');
                else a.removeAttribute('aria-current');
            });
        }
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((section) => spy.observe(section));
}

/* Scroll reveal. Exported so pages can register nodes they render later. */

const revealer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        revealer.unobserve(entry.target);
    }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

export function reveal(scope = document) {
    scope.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => revealer.observe(el));
}
reveal();

/* Pointer spotlight on cards */

addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

/* Frame meter: feeds the hero readout and the debug panel, and only runs while one of them is visible. */

const fpsEl = document.getElementById('fps');
const samples = new Array(60).fill(16.7);
let meterOn = false;
let heroVisible = false;
let debugPanel = null;
let last = 0;
let shown = 0;
let cursor = 0;

function tick(now) {
    if (!meterOn) return;
    if (last) {
        samples[cursor] = Math.min(now - last, 100);
        cursor = (cursor + 1) % samples.length;
    }
    last = now;
    if (now - shown > 400) {
        shown = now;
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const fps = Math.round(1000 / avg);
        if (fpsEl) fpsEl.textContent = String(fps);
        if (debugPanel) drawDebug(avg, fps);
    }
    requestAnimationFrame(tick);
}

function syncMeter() {
    const want = !document.hidden && ((heroVisible && !reduceMotion) || debugPanel !== null);
    if (want && !meterOn) {
        meterOn = true;
        last = 0;
        requestAnimationFrame(tick);
    } else if (!want) {
        meterOn = false;
    }
}

const hero = document.getElementById('top');
if (hero && fpsEl) {
    new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        syncMeter();
    }).observe(hero);
}
document.addEventListener('visibilitychange', syncMeter);

/* Debug draw */

function drawDebug(avg, fps) {
    const canvas = debugPanel.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ff6a2b';
    const bar = w / samples.length;
    for (let i = 0; i < samples.length; i++) {
        const ms = samples[(cursor + i) % samples.length];
        const bh = Math.min(h, (ms / 33.3) * h);
        ctx.fillRect(i * bar, h - bh, Math.max(1, bar - 1), bh);
    }
    debugPanel.querySelector('[data-out]').innerHTML =
        `${fps} fps &middot; ${avg.toFixed(1)} ms<br>` +
        `${document.getElementsByTagName('*').length} nodes<br>` +
        `${innerWidth}&times;${innerHeight} @${devicePixelRatio.toFixed(2)}x`;
}

function toggleDebug() {
    if (debugPanel) {
        debugPanel.remove();
        debugPanel = null;
    } else {
        debugPanel = document.createElement('div');
        debugPanel.className = 'debug-panel hud';
        debugPanel.innerHTML = '<canvas width="240" height="60"></canvas><div data-out>measuring</div>';
        document.body.append(debugPanel);
    }
    root.classList.toggle('debug', debugPanel !== null);
    syncMeter();
}

addEventListener('keydown', (e) => {
    if (e.key !== '`' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    toggleDebug();
});

/* Misc */

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

const mail = document.getElementById('mail');
const mailHint = document.getElementById('mail-hint');
mail?.addEventListener('click', async (e) => {
    if (!navigator.clipboard) return;
    e.preventDefault();
    try {
        await navigator.clipboard.writeText(mail.textContent.trim());
        mailHint.textContent = 'Copied to clipboard';
    } catch {
        location.href = mail.href;
        return;
    }
    setTimeout(() => { mailHint.textContent = 'Click to copy'; }, 2200);
});
