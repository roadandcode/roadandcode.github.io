import { loadData, isLive, esc, ICON } from './data.js';

const rootEl = document.getElementById('project-root');
const lightbox = document.getElementById('lightbox');

function notice(kicker, title, body) {
    rootEl.innerHTML = `
        <div class="notice">
            <p class="hud">${kicker}</p>
            <h1 class="proj__title">${title}</h1>
            <p class="proj__tagline">${body}</p>
            <a class="btn btn--primary" href="index.html#work">Back to the work</a>
        </div>`;
}

function actions(p) {
    const l = p.links ?? {};
    const out = [];
    if (l.play && l.embed !== false) {
        out.push(`<button class="btn btn--primary" type="button" data-launch>${ICON.play}Play in browser</button>`);
    } else if (l.play) {
        out.push(`<a class="btn btn--primary" href="${esc(l.play)}" target="_blank" rel="noopener">${ICON.play}${esc(l.playLabel ?? 'Play in browser')}</a>`);
    }
    for (const d of p.downloads ?? []) {
        out.push(`<a class="btn" href="${esc(d.url)}">${ICON.down}${esc(d.label)}${d.size ? `<small>${esc(d.size)}</small>` : ''}</a>`);
    }
    const extra = [['source', 'Source'], ['backend', 'Backend source'], ['api', 'API docs']];
    for (const [key, label] of extra) {
        if (l[key]) out.push(`<a class="btn" href="${esc(l[key])}" target="_blank" rel="noopener">${label}${ICON.out}</a>`);
    }
    return out.join('');
}

function trailerMarkup(t) {
    if (t.youtube) {
        const id = encodeURIComponent(t.youtube);
        return `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="Trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>`;
    }
    return `<video src="${esc(t.src)}" controls autoplay playsinline></video>`;
}

function stage(p) {
    const media = p.media ?? {};
    const l = p.links ?? {};
    const embeddable = Boolean(l.play) && l.embed !== false;
    const views = [];
    if (media.trailer) views.push(['trailer', 'Trailer']);
    if (embeddable) views.push(['play', 'Play']);
    if (media.preview || media.cover) views.push(['preview', media.preview ? 'Clip' : 'Cover']);
    if (!views.length) return '';

    const tabs = views.length > 1
        ? `<div class="tabs" role="tablist">${views.map(([id, label], i) =>
            `<button class="tab" type="button" role="tab" data-view="${id}" aria-selected="${i === 0}">${label}</button>`).join('')}</div>`
        : `<span class="hud">${esc(views[0][1])}</span>`;

    return `
        <section class="stage" id="stage" data-first="${views[0][0]}">
            <div class="stage__view" id="stage-view"></div>
            <div class="stage__bar">
                ${tabs}
                <button class="btn btn--sm" type="button" data-fullscreen>${ICON.full}Fullscreen</button>
            </div>
        </section>`;
}

function list(items) {
    return `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

function paragraphs(value) {
    return [].concat(value ?? []).map((x) => `<p>${esc(x)}</p>`).join('');
}

function body(p) {
    const parts = [];
    if (p.summary) parts.push(`<section><h2>Overview</h2>${paragraphs(p.summary)}</section>`);
    if (p.highlights?.length) parts.push(`<section><h2>What's in it</h2>${list(p.highlights)}</section>`);
    if (p.metrics?.length) {
        parts.push(`<section><h2>Measured</h2><dl class="metrics">${p.metrics.map((m) =>
            `<div><dt class="hud">${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl></section>`);
    }
    if (p.architecture) parts.push(`<section><h2>How it's built</h2>${paragraphs(p.architecture)}</section>`);
    if (p.backend) parts.push(`<section><h2>Backend</h2>${paragraphs(p.backend)}</section>`);
    if (p.media?.shots?.length) {
        parts.push(`<section><h2>Screenshots</h2><div class="shots">${p.media.shots.map((src) =>
            `<button type="button" data-shot="${esc(src)}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div></section>`);
    }
    if (p.learned) parts.push(`<section><h2>What I learned</h2>${paragraphs(p.learned)}</section>`);
    return parts.join('');
}

function spec(p, data) {
    const rows = [];
    const tags = (ids, map) => `<ul class="tags">${ids.map((id) => `<li class="tag">${esc(map?.[id] ?? id)}</li>`).join('')}</ul>`;
    if (p.role) rows.push(['Role', esc(p.role)]);
    if (p.year) rows.push(['Year', esc(p.year)]);
    if (p.platforms?.length) rows.push(['Platforms', tags(p.platforms, data.platforms)]);
    if (p.skills?.length) rows.push(['Proves', tags(p.skills, data.skills)]);
    if (p.stack?.length) rows.push(['Stack', tags(p.stack)]);
    return `<aside class="spec"><dl>${rows.map(([k, v]) => `<div><dt class="hud">${k}</dt><dd>${v}</dd></div>`).join('')}</dl></aside>`;
}

function render(p, data) {
    document.title = `${p.title} | Ravi Chaudhary`;
    const live = data.projects.filter(isLive);
    const next = live[(live.indexOf(p) + 1) % live.length];
    const plats = (p.platforms ?? []).map((id) => data.platforms[id] ?? id).join(' / ');

    rootEl.innerHTML = `
        <a class="back hud" href="index.html#work">&larr; All work</a>
        <header class="proj__head">
            <div class="proj__meta">
                <span class="status is-live">Live</span>
                <span class="hud">${esc(plats)}</span>
            </div>
            <h1 class="proj__title">${esc(p.title)}</h1>
            <p class="proj__tagline">${esc(p.tagline)}</p>
            <div class="proj__actions">${actions(p)}</div>
        </header>
        ${stage(p)}
        <div class="proj__cols">
            <article class="prose">${body(p)}</article>
            ${spec(p, data)}
        </div>
        ${next && next !== p ? `
            <a class="next" href="project.html?id=${encodeURIComponent(next.id)}">
                <span><span class="hud">Next project</span><strong>${esc(next.title)}</strong></span>
                <span aria-hidden="true">&#8599;</span>
            </a>` : ''}`;

    wireStage(p);
}

function wireStage(p) {
    const stageEl = document.getElementById('stage');
    if (!stageEl) return;
    const view = document.getElementById('stage-view');
    const media = p.media ?? {};
    const l = p.links ?? {};

    const poster = media.cover ? `<img src="${esc(media.cover)}" alt="">` : '';
    const launcher = (label, attr) => `
        ${poster}
        <button class="stage__launch" type="button" ${attr}>
            <span>${ICON.play}</span>
            <strong>${label}</strong>
        </button>`;

    // Builds and trailers only load after a click, so opening the page stays light.
    const show = {
        preview: () => {
            view.innerHTML = media.preview
                ? `<video src="${esc(media.preview)}" ${media.cover ? `poster="${esc(media.cover)}"` : ''} muted loop autoplay playsinline></video>`
                : poster;
        },
        trailer: () => { view.innerHTML = launcher('Watch the trailer', 'data-start="trailer"'); },
        play: () => { view.innerHTML = launcher('Launch the build', 'data-start="play"'); },
    };
    const start = {
        trailer: () => { view.innerHTML = trailerMarkup(media.trailer); },
        play: () => {
            view.innerHTML = `<iframe src="${esc(l.play)}" title="${esc(p.title)}" allow="fullscreen; gamepad; autoplay; xr-spatial-tracking"></iframe>`;
            view.querySelector('iframe').focus();
        },
    };

    function select(id) {
        stageEl.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === id)));
        show[id]();
    }

    stageEl.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab) return select(tab.dataset.view);
        const go = e.target.closest('[data-start]');
        if (go) return start[go.dataset.start]();
        if (e.target.closest('[data-fullscreen]')) {
            if (document.fullscreenElement) document.exitFullscreen();
            else stageEl.requestFullscreen?.();
        }
    });

    select(stageEl.dataset.first);

    rootEl.querySelector('[data-launch]')?.addEventListener('click', () => {
        select('play');
        start.play();
        stageEl.scrollIntoView({ block: 'center' });
    });
}

rootEl.addEventListener('click', (e) => {
    const shot = e.target.closest('[data-shot]');
    if (!shot) return;
    lightbox.querySelector('img').src = shot.dataset.shot;
    lightbox.showModal();
});
lightbox.addEventListener('click', () => lightbox.close());

try {
    const data = await loadData();
    const id = new URLSearchParams(location.search).get('id');
    const project = data.projects.find((p) => p.id === id);

    if (!project) {
        notice('404', 'Level not found.', 'There\'s no project at this address.');
    } else if (!isLive(project)) {
        notice('On the bench', esc(project.title), `${esc(project.tagline)} It isn't playable yet.`);
    } else {
        render(project, data);
    }
} catch (err) {
    console.error(err);
    notice('Error', 'Something broke.', 'The project data didn\'t load. Try a refresh.');
}
