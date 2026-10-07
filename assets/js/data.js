let cache;

export function loadData() {
    cache ??= fetch('data/projects.json', { cache: 'no-cache' }).then((res) => {
        if (!res.ok) throw new Error(`projects.json: ${res.status}`);
        return res.json();
    }).then((data) => {
        // Projects with a `build` entry are served from this site at play/<id>/.
        for (const p of data.projects) {
            if (p.build && !p.links?.play) p.links = { ...p.links, play: `play/${p.id}/` };
        }
        return data;
    });
    return cache;
}

export const isLive = (p) => p.status === 'live';

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

export const ICON = {
    play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
    down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 2v9M4 7.5 8 11.5l4-4M3 14h10"/></svg>',
    out: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>',
    full: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
};
