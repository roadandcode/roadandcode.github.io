import { loadData, isListed, esc } from './data.js';
import { reveal } from './site.js';

const grid = document.getElementById('grid');
const filters = document.getElementById('filters');

let data;
let active = 'all';

const marquee = document.getElementById('marquee');
if (marquee) marquee.innerHTML += marquee.innerHTML;

function card(p, index) {
    const media = p.media ?? {};
    const canPlay = Boolean(p.links?.play);
    const initials = p.title.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
    const platforms = (p.platforms ?? []).map((id) => `<li class="tag">${esc(data.platforms[id] ?? id)}</li>`);
    const skills = (p.skills ?? []).map((id) => `<li class="tag tag--skill">${esc(data.skills[id] ?? id)}</li>`);

    return `
        <a class="card spot" href="project.html?id=${encodeURIComponent(p.id)}"
            data-skills="${esc((p.skills ?? []).join(' '))}" data-reveal style="--d:${Math.min(index, 4) * 0.06}s">
            <div class="card__media">
                ${media.cover
                    ? `<img src="${esc(media.cover)}" alt="" loading="lazy" decoding="async">`
                    : `<div class="card__fallback">${esc(initials)}</div>`}
                ${media.preview
                    ? `<video muted loop playsinline preload="none" data-src="${esc(media.preview)}"></video>`
                    : ''}
                ${canPlay ? '<span class="card__badge">Playable</span>' : ''}
            </div>
            <div class="card__body">
                <div class="card__top">
                    <h3>${esc(p.title)}</h3>
                    <span class="card__arrow" aria-hidden="true">&#8599;</span>
                </div>
                <p>${esc(p.tagline)}</p>
                <ul class="tags">${skills.join('')}${platforms.join('')}</ul>
            </div>
        </a>`;
}

function renderGrid() {
    const listed = data.projects.filter(isListed);
    const shown = active === 'all' ? listed : listed.filter((p) => p.skills?.includes(active));

    grid.innerHTML = shown.length
        ? shown.map(card).join('')
        : `<p class="grid__empty">Nothing here under ${esc(data.skills[active] ?? active)} yet.</p>`;
    reveal(grid);
}

function renderFilters() {
    const listed = data.projects.filter(isListed);
    const counts = new Map();
    for (const p of listed) for (const s of p.skills ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);

    // A filter bar over a handful of cards is noise; it shows up once there's enough to filter.
    filters.hidden = listed.length < 4;

    const chip = (id, label, n) =>
        `<button class="chip-btn" type="button" data-filter="${esc(id)}" aria-pressed="${id === active}">${esc(label)}<b>${n}</b></button>`;
    filters.innerHTML = chip('all', 'All', listed.length) +
        Object.entries(data.skills)
            .filter(([id]) => counts.has(id))
            .map(([id, label]) => chip(id, label, counts.get(id)))
            .join('');
}

function setFilter(id) {
    active = id;
    filters.querySelectorAll('.chip-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === id)));
    renderGrid();
}

function renderSkillProof() {
    document.querySelectorAll('.skill[data-skill]').forEach((el) => {
        const id = el.dataset.skill;
        const count = data.projects.filter((p) => isListed(p) && p.skills?.includes(id)).length;
        const btn = el.querySelector('.skill__proof');

        if (count) {
            btn.disabled = false;
            btn.innerHTML = `${count} ${count === 1 ? 'project' : 'projects'} &rarr;`;
            btn.addEventListener('click', () => {
                setFilter(id);
                document.getElementById('work').scrollIntoView();
            });
        } else {
            btn.remove();
        }
    });
}

// Preview clips load on first hover (or first tap-focus), never up front.
function playPreview(cardEl, on) {
    const video = cardEl.querySelector('video');
    if (!video) return;
    if (on) {
        if (!video.src) video.src = video.dataset.src;
        video.play().then(() => cardEl.classList.add('is-playing')).catch(() => {});
    } else {
        cardEl.classList.remove('is-playing');
        video.pause();
    }
}

for (const [type, on] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false]]) {
    grid.addEventListener(type, (e) => {
        const cardEl = e.target.closest?.('.card');
        if (cardEl && e.target === cardEl) playPreview(cardEl, on);
    }, true);
}

filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (btn) setFilter(btn.dataset.filter);
});

try {
    data = await loadData();
    const wanted = new URLSearchParams(location.search).get('skill');
    if (wanted && data.skills[wanted]) active = wanted;
    renderFilters();
    renderGrid();
    renderSkillProof();
} catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="grid__empty">Couldn\'t load the project list. Try a refresh.</p>';
}
