// One number drives the home page: G, the scroll position measured in "stops".
// Stop i is the i-th [data-stop] element. G = i + 0.5 when the middle of the
// viewport sits in the middle of that element, which is where the camera rests.
// A stop marked data-stop="end" only spans one viewport, so the camera finishes
// its last move quickly instead of stretching it over a long section.

const stops = [...document.querySelectorAll('[data-stop]')];

export const scroll = {
    target: 0.5,
    count: stops.length,
    stops,
    metrics: [],
    vh: innerHeight,
};

export function measure() {
    scroll.vh = innerHeight;
    scroll.metrics = stops.map((el) => {
        const r = el.getBoundingClientRect();
        const top = r.top + scrollY;
        return { top, span: el.dataset.stop === 'end' ? innerHeight : r.height };
    });
    update();
}

export function update() {
    const y = scrollY + scroll.vh * 0.5;
    let g = 0.5;
    scroll.metrics.forEach((m, i) => {
        if (y >= m.top) g = i + Math.min(1, (y - m.top) / m.span);
    });
    scroll.target = Math.min(Math.max(g, 0.5), scroll.count - 0.5);
}

/** Scroll so the camera rests at stop i. */
export function scrollToStop(i, behavior = 'smooth') {
    const m = scroll.metrics[i];
    if (!m) return;
    scrollTo({ top: m.top + m.span * 0.5 - scroll.vh * 0.5, behavior });
}

/** Camera position along the keyframes for a given G: rests near each stop, eases between them. */
export function travel(g, count = scroll.count) {
    const x = Math.min(Math.max(g - 0.5, 0), count - 1);
    const k = Math.min(Math.floor(x), count - 2);
    const f = Math.min(Math.max((x - k - 0.2) / 0.6, 0), 1);
    return k + f * f * (3 - 2 * f);
}

if (stops.length) {
    measure();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', measure);
    new ResizeObserver(measure).observe(document.body);
}
