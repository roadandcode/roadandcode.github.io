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
    document.querySelectorAll('main > section[id]').forEach((section) => spy.observe(section));
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

/* Frame meter: feeds the hero readout, and only runs while the hero is visible. */

const fpsEl = document.getElementById('fps');
const samples = new Array(60).fill(16.7);
let meterOn = false;
let heroVisible = false;
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
        fpsEl.textContent = String(fps);
    }
    requestAnimationFrame(tick);
}

function syncMeter() {
    const want = !document.hidden && heroVisible && !reduceMotion;
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
