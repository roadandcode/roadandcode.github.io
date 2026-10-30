// The player's Fullscreen button. It uses the browser's fullscreen where there is one. iPhone Safari
// only has that for a video, so there the stage fills the window instead, which the same button undoes.

const page = document.documentElement;
const NATIVE_ANSWER_MS = 1000;

const nativeElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

function requestNative(el) {
    const ask = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (!ask) return Promise.reject(new Error('no fullscreen here'));
    return Promise.resolve(ask.call(el));
}

function exitNative() {
    return (document.exitFullscreen ?? document.webkitExitFullscreen).call(document);
}

// A browser that refuses (a desktop, iOS, a setting) just leaves the screen as it is. The rotate
// prompt in the CSS covers a phone that ends up the wrong way round.
async function lockOrientation(orientation) {
    if (orientation !== 'landscape' && orientation !== 'portrait') return;
    try {
        await screen.orientation.lock(orientation);
    } catch {
        // Nothing to do: see above.
    }
}

function unlockOrientation() {
    try {
        screen.orientation.unlock();
    } catch {
        // It was never locked.
    }
}

export function wireFullscreen(stage) {
    const button = stage.querySelector('[data-fullscreen]');
    const label = button.querySelector('span');
    let full = false;

    function set(on) {
        full = on;
        stage.classList.toggle('is-full', on);
        page.classList.toggle('has-full-stage', on);
        label.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
        if (on) {
            lockOrientation(stage.dataset.orientation);
            stage.querySelector('iframe')?.focus();
        } else {
            stage.classList.remove('is-rotate-dismissed');
            unlockOrientation();
        }
    }

    // Granted, refused or never answered, the button does something: the stage fills the window
    // straight away if the browser's fullscreen does not arrive.
    async function enter() {
        await Promise.race([
            requestNative(stage).catch(() => {}),
            new Promise((resolve) => { setTimeout(resolve, NATIVE_ANSWER_MS); }),
        ]);
        set(true);
    }

    function leave() {
        if (nativeElement()) exitNative();
        else set(false);
    }

    // The player can also leave by themselves: Esc, or the browser's own gesture.
    function onNativeChange() {
        if (nativeElement()) lockOrientation(stage.dataset.orientation);
        else if (full) set(false);
    }
    document.addEventListener('fullscreenchange', onNativeChange);
    document.addEventListener('webkitfullscreenchange', onNativeChange);
    // Older iPad Safari reports a refusal here; the prefixed call returns nothing to catch.
    document.addEventListener('webkitfullscreenerror', () => set(true));

    stage.addEventListener('click', (e) => {
        if (e.target.closest('[data-fullscreen]')) {
            if (full) leave();
            else enter();
        } else if (e.target.closest('[data-rotate-dismiss]')) {
            stage.classList.add('is-rotate-dismissed');
        }
    });
}
