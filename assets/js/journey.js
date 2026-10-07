// Scroll and pointer effects on the home page's HTML: the journey cards, the
// concept-to-console progress bar, the sideways experience road, and the small
// stuff (scrambled headings, tilting cards, magnetic buttons, marquee skew).
// The 3D side lives in world/main.js; both read the same scroll state.

import { scroll, scrollToStop } from './scroll.js';

const root = document.documentElement;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};

// Write a custom property only when it changes, so idle frames cost nothing.
const cache = new WeakMap();
function setVar(el, name, value) {
    let vars = cache.get(el);
    if (!vars) cache.set(el, (vars = {}));
    if (vars[name] === value) return;
    vars[name] = value;
    el.style.setProperty(name, value);
}

/* Journey chapters */

const chapters = [...document.querySelectorAll('.chapter')];
const stopIndex = new Map(scroll.stops.map((el, i) => [el, i]));

function chapterProgress(el) {
    const m = scroll.metrics[stopIndex.get(el)];
    if (!m) return 0;
    return (scrollY + scroll.vh * 0.5 - m.top) / m.span;
}

function updateChapters() {
    for (const ch of chapters) {
        const p = chapterProgress(ch);
        if (p < -0.2 || p > 1.2) continue;
        const card = ch.querySelector('.chapter__card');
        const num = ch.querySelector('.chapter__num');
        const o = smooth(0.06, 0.26, p) * (1 - smooth(0.74, 0.94, p));
        setVar(card, '--o', o.toFixed(3));
        setVar(num, '--o', o.toFixed(3));
        if (!still) {
            const y = (1 - smooth(0.06, 0.3, p)) * 48 - smooth(0.7, 0.94, p) * 48;
            setVar(card, '--y', `${y.toFixed(1)}px`);
            setVar(num, '--ny', `${((0.5 - p) * 180).toFixed(1)}px`);
        }
    }
}

/* Concept-to-console progress bar */

const jhud = document.getElementById('jhud');
const jTrack = jhud?.querySelector('.jhud__track');
const jLinks = jhud ? [...jhud.querySelectorAll('a[data-stage]')] : [];
const jPct = document.getElementById('jhud-pct');
const lastStage = jLinks.length;

function updateHud() {
    if (!jhud) return;
    const g = scroll.target;
    jhud.classList.toggle('is-on', g > 0.95 && g < lastStage + 1.05);
    const fill = clamp01((g - 1.5) / (lastStage - 1));
    setVar(jTrack, '--fill', fill.toFixed(4));
    const pct = String(Math.round(fill * 100));
    if (jPct.textContent !== pct) jPct.textContent = pct;
    const current = Math.min(lastStage, Math.max(1, Math.round(g - 0.5)));
    jLinks.forEach((a, i) => {
        const stage = i + 1;
        a.classList.toggle('is-done', g >= stage + 0.35);
        a.classList.toggle('is-current', stage === current);
        if (stage === current) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
    });
}

// Links to a chapter land where the camera rests, not at the top edge.
document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#ch-"]');
    if (!a) return;
    const el = document.querySelector(a.getAttribute('href'));
    if (!el || !stopIndex.has(el)) return;
    e.preventDefault();
    scrollToStop(stopIndex.get(el), still ? 'auto' : 'smooth');
    history.replaceState(null, '', a.getAttribute('href'));
});

addEventListener('world:start', () => {
    document.getElementById('work')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
});

/* Hero */

const hero = document.getElementById('top');
const heroTitle = document.getElementById('hero-title');

function updateHero() {
    if (!hero || still) return;
    setVar(hero, '--hp', clamp01(scrollY / (scroll.vh * 0.9)).toFixed(3));
}

/* Experience road: sideways on wide screens */

const road = document.getElementById('experience');
const track = document.getElementById('road-track');
const fillEl = document.getElementById('road-fill');
const wide = matchMedia('(min-width: 901px)');
const lvls = track ? [...track.children] : [];
let roadTop = 0;
let roadDist = 0;

function measureRoad() {
    if (!road || !track) return;
    road.classList.toggle('is-horizontal', wide.matches);
    if (!wide.matches) {
        road.style.removeProperty('--road-h');
        return;
    }
    roadDist = Math.max(0, track.scrollWidth - innerWidth);
    setVar(road, '--road-h', `${Math.round(roadDist + innerHeight)}px`);
    roadTop = road.getBoundingClientRect().top + scrollY;
    updateRoad();
}

function updateRoad() {
    if (!road?.classList.contains('is-horizontal')) return;
    const p = roadDist ? clamp01((scrollY - roadTop) / roadDist) : 0;
    setVar(track, '--x', `${(-p * roadDist).toFixed(1)}px`);
    setVar(fillEl, '--fill', p.toFixed(4));
    if (still) return;
    const mid = innerWidth / 2;
    lvls.forEach((el) => {
        // Cards turn towards you as they reach the middle of the screen.
        const w = el.offsetWidth;
        const x = el.offsetLeft - p * roadDist + w / 2;
        const d = Math.max(-1.4, Math.min(1.4, (x - mid) / mid));
        setVar(el, '--ry', `${(-d * 16).toFixed(2)}deg`);
        setVar(el, '--s', (1 - Math.abs(d) * 0.06).toFixed(3));
        setVar(el, '--o', (1 - Math.max(0, Math.abs(d) - 0.9) * 0.9).toFixed(3));
    });
}

if (road) {
    wide.addEventListener('change', measureRoad);
    addEventListener('resize', measureRoad);
    new ResizeObserver(measureRoad).observe(track);
    document.fonts?.ready.then(measureRoad);
    measureRoad();
}

/* Marquee leans with scroll speed */

const marquee = document.querySelector('.marquee');
let skew = 0;
let lastY = scrollY;

function updateMarquee(dt) {
    if (!marquee || still) return;
    const v = (scrollY - lastY) / Math.max(dt, 1 / 240);
    lastY = scrollY;
    const target = Math.max(-10, Math.min(10, v * -0.006));
    skew += (target - skew) * (1 - Math.exp(-dt * 8));
    setVar(marquee, '--skew', `${skew.toFixed(2)}deg`);
}

/* Scrambled headings: letters cycle through glyphs before they settle */

const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEF';

function scramble(el) {
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const nodes = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) nodes.push({ node: walk.currentNode, text: walk.currentNode.nodeValue });
    const total = nodes.reduce((n, x) => n + x.text.length, 0);
    const start = performance.now();
    const dur = 520 + total * 14;

    function tick(now) {
        const k = (now - start) / dur;
        let seen = 0;
        for (const n of nodes) {
            let out = '';
            for (let i = 0; i < n.text.length; i++) {
                const ch = n.text[i];
                const at = (seen + i) / total;
                out += ch === ' ' || k > at * 0.7 + 0.3 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
            seen += n.text.length;
            n.node.nodeValue = out;
        }
        if (k < 1) {
            requestAnimationFrame(tick);
        } else {
            for (const n of nodes) n.node.nodeValue = n.text;
            el.removeAttribute('aria-label');
            delete el.dataset.busy;
        }
    }
    requestAnimationFrame(tick);
}

if (!still) {
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) scramble(e.target);
    }, { threshold: 0.9 });
    document.querySelectorAll('[data-scramble]').forEach((el) => io.observe(el));
}

/* Tilt and magnetic buttons (mouse and pen only) */

if (!still && !coarse) {
    let tilted = null;

    const reset = (el) => {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
    };

    document.addEventListener('pointermove', (e) => {
        const el = e.target.closest?.('.tilt, .card');
        if (tilted && tilted !== el) reset(tilted);
        tilted = el;
        if (el) {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            const amp = el.classList.contains('card--feature') ? 4 : 7;
            el.classList.add('is-tilting');
            el.style.setProperty('--rx', `${(-y * amp).toFixed(2)}deg`);
            el.style.setProperty('--ry', `${(x * amp).toFixed(2)}deg`);
        }

        const m = e.target.closest?.('.magnet');
        document.querySelectorAll('.magnet.is-pulled').forEach((b) => {
            if (b === m) return;
            b.classList.remove('is-pulled');
            b.style.setProperty('--mx', '0px');
            b.style.setProperty('--my', '0px');
        });
        if (m) {
            const r = m.getBoundingClientRect();
            m.classList.add('is-pulled');
            m.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
            m.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
        }

        if (heroTitle) {
            setVar(heroTitle, '--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
        }
    }, { passive: true });

    document.addEventListener('pointerleave', () => { if (tilted) reset(tilted); });
}

if (coarse) {
    document.querySelectorAll('.chapter__key').forEach((k) => { k.textContent = 'Tap'; });
}

/* One loop for all of it */

let prev = performance.now();
function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.1);
    prev = now;
    updateChapters();
    updateHud();
    updateHero();
    updateRoad();
    updateMarquee(dt);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

root.classList.add('journey-ready');
