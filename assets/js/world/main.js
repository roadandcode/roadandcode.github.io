// The 3D world behind the home page. Scrolling moves a camera down the road
// from the idea to the console; each stop on the page is a keyframe in
// layout.js. Without WebGL2 the page keeps its CSS background and works as-is.

import { THREE, COLORS, shared, pointScale, damp, lerp } from './kit.js';
import { Bloom } from './post.js';
import { createTerrain } from './terrain.js';
import { createAmbient } from './ambient.js';
import { KEYS, STATIONS, KEY_ROAD_Z } from './layout.js';
import { createSpark } from './stations/spark.js';
import { createPrototype } from './stations/prototype.js';
import { createSystems } from './stations/systems.js';
import { createOnline } from './stations/online.js';
import { createShip } from './stations/ship.js';
import { createConsole } from './stations/console.js';
import { scroll, travel } from '../scroll.js';
import { loadData, isLive } from '../data.js';

const canvas = document.getElementById('world');
const root = document.documentElement;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickTier() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 720;
    const cores = navigator.hardwareConcurrency ?? 8;
    return coarse || small || cores <= 4 ? 'low' : 'high';
}

async function fontsReady() {
    if (!document.fonts) return;
    const faces = [
        '700 48px "Bricolage Grotesque"', '800 48px "Bricolage Grotesque"', '600 48px "Bricolage Grotesque"',
        '400 24px "JetBrains Mono"', '600 24px "JetBrains Mono"', '700 24px "JetBrains Mono"',
        'italic 400 48px "Instrument Serif"',
    ];
    await Promise.race([
        Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {}),
        new Promise((r) => setTimeout(r, 2500)),
    ]);
}

async function featuredProject() {
    try {
        const data = await loadData();
        return data.projects.find((p) => isLive(p) && p.media?.preview) ?? null;
    } catch {
        return null;
    }
}

async function start() {
    const tier = pickTier();
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas, antialias: tier === 'low', alpha: false, stencil: false, powerPreference: 'high-performance',
        });
    } catch (err) {
        console.warn('world disabled:', err);
        root.classList.add('no-world');
        return;
    }
    renderer.setClearColor(COLORS.bg, 1);
    root.classList.add(`world-${tier}`);

    const [project] = await Promise.all([featuredProject(), fontsReady()]);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.bg, 16, 90);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);

    const world = createTerrain({ detail: tier === 'low' ? 0.7 : 1 });
    scene.add(world.group);

    const ctx = { camera, pointer: new THREE.Vector2(), tier };
    const stations = [
        createSpark({ position: STATIONS.spark, still }),
        createPrototype({ position: STATIONS.proto, still }),
        createSystems({ position: STATIONS.systems, eye: KEYS[4].eye, still }),
        createOnline({ position: STATIONS.online, still }),
        createShip({ position: STATIONS.ship, eye: KEYS[6].eye, still }),
        createConsole({ position: STATIONS.console, eye: KEYS[7].eye, project, still }),
    ];
    for (const s of stations) scene.add(s.group);

    const ambient = createAmbient({
        tier,
        roadS: world.roadS,
        stops: [
            ['01 Concept', STATIONS.spark.z + 9],
            ['02 Prototype · 03 Polish', STATIONS.proto.z],
            ['04 Systems', STATIONS.systems.z],
            ['05 Online', STATIONS.online.z],
            ['06 Ship', STATIONS.ship.z],
            ['07 Console', STATIONS.console.z - 10],
        ].map(([name, z]) => ({ name: name.toUpperCase(), at: world.roadAt(z) })),
    });
    scene.add(ambient.group);

    const keyRoad = KEY_ROAD_Z.map((z) => world.roadS(z));

    /* Camera rig */

    const eye = new THREE.Vector3();
    const focus = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let eyeCurve;
    let focusCurve;
    let portrait = false;

    function buildRig() {
        const pull = portrait ? 1.45 : 1;
        const eyes = KEYS.map((k, i) => (i < KEYS.length - 1 ? k.focus.clone().lerp(k.eye, pull) : k.eye.clone()));
        eyeCurve = new THREE.CatmullRomCurve3(eyes, false, 'centripetal');
        focusCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.focus.clone()), false, 'centripetal');
    }

    /* Rendering */

    let bloom = tier === 'high' ? new Bloom(renderer, { samples: 4, strength: 0.85 }) : null;
    let quality = 1;
    const maxDpr = tier === 'high' ? 1.75 : 1.5;
    let width = 0;
    let height = 0;

    function resize(force = false) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!force && w === width && h === height) return;
        width = w;
        height = h;
        const dpr = Math.min(devicePixelRatio || 1, maxDpr) * quality;
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        bloom?.setSize(Math.round(w * dpr), Math.round(h * dpr));
        camera.aspect = w / h;
        const wasPortrait = portrait;
        portrait = w / h < 0.85;
        camera.fov = portrait ? 60 : 42;
        if (!eyeCurve || wasPortrait !== portrait) buildRig();
        pointScale.value = h * dpr * 0.5;
    }

    /* Pointer and picking */

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2();
    let hovered = null;
    let lastPick = null;

    const passesThrough = (el) => el === document.body || el === root || el.classList?.contains('world-pass');

    function pick(x, y) {
        ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        let best = null;
        for (const s of stations) {
            if (!s.group.visible || Math.abs(u - (s.index[0] + s.index[1]) / 2) > 1.2) continue;
            const hits = raycaster.intersectObjects(s.hit, false);
            if (hits.length && (!best || hits[0].distance < best.distance)) best = { station: s, distance: hits[0].distance };
        }
        return best?.station ?? null;
    }

    addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'touch') pointerTarget.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        lastPick = passesThrough(e.target) ? [e.clientX, e.clientY] : null;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pointerTarget.set(0, 0); lastPick = null; });

    addEventListener('click', (e) => {
        if (!passesThrough(e.target)) return;
        pick(e.clientX, e.clientY)?.onClick?.(time);
    });

    /* Loop */

    let G = scroll.target;
    let u = travel(G);
    let time = 0;
    let prev = 0;
    let raf = 0;
    let intro = still ? 1 : 0;
    let fovKick = 0;
    let frameNo = 0;
    let slow = 0;
    let sampleT = 0;
    let sampleN = 0;
    let warm = 0;

    function setCamera() {
        const n = KEYS.length;
        eyeCurve.getPoint(u / (n - 1), eye);
        focusCurve.getPoint(u / (n - 1), focus);
        const i0 = Math.min(Math.floor(u), n - 1);
        const i1 = Math.min(i0 + 1, n - 1);
        const f = u - i0;
        const side = lerp(KEYS[i0].side, KEYS[i1].side, f);
        scene.fog.near = lerp(KEYS[i0].fog[0], KEYS[i1].fog[0], f);
        scene.fog.far = lerp(KEYS[i0].fog[1], KEYS[i1].fog[1], f);

        offset.subVectors(eye, focus);
        if (!still) {
            // Drift slowly round the subject while the text is on screen.
            const stop = Math.round(G - 0.5);
            const du = G - (stop + 0.5);
            const w = 1 - Math.min(1, Math.max(0, (Math.abs(du) - 0.15) / 0.35));
            offset.applyAxisAngle(up, du * 0.5 * w);
            // Intro: fly in from further up the valley.
            const k = 1 - intro;
            offset.multiplyScalar(1 + k * k * 1.6);
            offset.y += k * k * 6;
        }
        const dist = offset.length();
        eye.addVectors(focus, offset);

        if (!still) {
            right.crossVectors(offset, up).normalize();
            eye.addScaledVector(right, -ctx.pointer.x * dist * 0.045);
            eye.y += ctx.pointer.y * dist * 0.03;
            eye.y += Math.sin(time * 0.5) * 0.08;
        }
        camera.position.copy(eye);
        camera.lookAt(focus);

        const base = portrait ? 60 : 42;
        camera.fov = base + fovKick;
        camera.updateProjectionMatrix();
        const lift = lerp(KEYS[i0].lift ?? 0.17, KEYS[i1].lift ?? 0.17, f);
        if (portrait) camera.setViewOffset(width, height, 0, height * lift * Math.abs(side), width, height);
        else camera.setViewOffset(width, height, -side * width * 0.18, 0, width, height);
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = prev ? Math.min((now - prev) / 1000, 0.1) : 1 / 60;
        prev = now;
        frameNo++;
        resize();

        if (!still) time += dt;
        shared.uTime.value = time;
        intro = Math.min(1, intro + dt / 2.4);

        const lastG = G;
        G = still ? scroll.target : damp(G, scroll.target, 4.5, dt);
        u = travel(G);
        if (still) u = Math.round(u);
        const speed = Math.abs(G - lastG) / Math.max(dt, 1e-3);
        fovKick = still ? 0 : damp(fovKick, Math.min(speed * 3.5, 7), 6, dt);

        ctx.pointer.x = damp(ctx.pointer.x, still ? 0 : pointerTarget.x, 3, dt);
        ctx.pointer.y = damp(ctx.pointer.y, still ? 0 : pointerTarget.y, 3, dt);

        setCamera();

        const i0 = Math.min(Math.floor(u), keyRoad.length - 1);
        const i1 = Math.min(i0 + 1, keyRoad.length - 1);
        const traveled = lerp(keyRoad[i0], keyRoad[i1], u - i0);
        world.setTravel(traveled);
        world.setFocus(focus);
        ambient.update(time, u, traveled, camera);

        const overview = u > 7.6;
        for (const s of stations) {
            const centre = (s.index[0] + s.index[1]) / 2;
            const near = Math.abs(u - centre) < 2.2;
            s.group.visible = near || overview;
            if (near || (overview && frameNo % 3 === 0)) s.update(time, dt, u, ctx);
        }

        if (frameNo % 3 === 0) {
            const h = lastPick ? pick(...lastPick) : null;
            if (h !== hovered) {
                hovered = h;
                root.classList.toggle('world-hover', Boolean(h));
            }
        }

        // Settled on the map behind the later sections: half rate is plenty.
        if (u > 7.98 && speed < 0.01 && frameNo % 2) return;

        if (bloom) bloom.render(scene, camera);
        else renderer.render(scene, camera);

        if (!canvas.classList.contains('is-ready')) {
            canvas.classList.add('is-ready');
            root.classList.add('world-on');
        }

        adapt(dt);
    }

    // If this GPU can't hold ~45 fps, render fewer pixels, then drop bloom.
    function adapt(dt) {
        warm += dt;
        if (warm < 3) return;
        sampleT += dt;
        sampleN++;
        if (sampleT < 1.5) return;
        const avg = sampleT / sampleN;
        sampleT = 0;
        sampleN = 0;
        slow = avg > 1 / 45 ? slow + 1 : 0;
        if (slow < 2) return;
        slow = 0;
        if (quality > 0.72) {
            quality = Math.max(0.7, quality * 0.85);
        } else if (bloom) {
            bloom.dispose();
            bloom = null;
            quality = 1;
        } else if (quality > 0.5) {
            quality *= 0.85;
        } else {
            return;
        }
        resize(true);
    }

    function wake() {
        if (document.hidden) {
            cancelAnimationFrame(raf);
            raf = 0;
        } else if (!raf) {
            prev = 0;
            raf = requestAnimationFrame(frame);
        }
    }

    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        cancelAnimationFrame(raf);
        raf = 0;
        root.classList.remove('world-on');
        root.classList.add('no-world');
    });
    document.addEventListener('visibilitychange', wake);

    resize(true);
    setCamera();

    // Compile every shader up front so nothing hitches when a stop first appears.
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try {
        await renderer.compileAsync(scene, camera);
    } catch {
        renderer.compile(scene, camera);
    }
    hidden.forEach((o) => { o.visible = false; });

    wake();
}

if (canvas) {
    start().catch((err) => {
        console.warn('world disabled:', err);
        root.classList.add('no-world');
    });
}
