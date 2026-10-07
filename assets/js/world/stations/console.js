// Stop 7. The destination: a handheld that powers on as you arrive and plays
// footage from a real build. The sticks follow your pointer; press any button
// (or the screen) to start, which takes you to the work.

import {
    THREE, COLORS, lit, lineMat, canvasTexture, roundRect, FONT, withT, damp, smooth,
} from '../kit.js';

const SCREEN_W = 5.6;
const SCREEN_H = 3.15;

const SCREEN_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D tVideo;
uniform sampler2D tUI;
uniform sampler2D tPrompt;
uniform float uHasVideo;
uniform float uPower;
uniform float uBlink;
uniform float uFlash;
varying vec2 vUv;
void main() {
    vec2 c = vUv - 0.5;
    float openY = smoothstep(0.15, 0.75, uPower);
    float openX = smoothstep(0.0, 0.2, uPower);
    float inside = step(abs(c.y), 0.5 * openY + 0.003) * step(abs(c.x), 0.5 * openX);
    vec2 uv = vec2(c.x, c.y / max(openY, 0.006)) + 0.5;

    vec3 col = mix(vec3(0.03, 0.04, 0.08), vec3(0.1, 0.05, 0.08), uv.y);
    col = mix(col, texture2D(tVideo, uv).rgb * 0.82, uHasVideo);
    vec4 ui = texture2D(tUI, uv);
    col = mix(col, ui.rgb, ui.a);
    vec4 pr = texture2D(tPrompt, uv);
    col = mix(col, pr.rgb * 1.6, pr.a * uBlink);
    col *= 0.9 + 0.1 * sin(uv.y * 820.0);
    col *= 1.0 - 0.7 * dot(c, c);
    col += uFlash;
    col *= inside;
    float line = (1.0 - smoothstep(0.0, 0.012, abs(c.y))) * step(abs(c.x), 0.5 * openX);
    col += vec3(2.0, 1.6, 1.4) * line * step(0.001, uPower) * (1.0 - smoothstep(0.5, 0.8, uPower));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

function bodyShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
}

function uiTexture(project) {
    return canvasTexture(1024, 576, (ctx, w, h) => {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 4;
        const b = 34;
        const L = 46;
        for (const [x, y, dx, dy] of [[b, b, 1, 1], [w - b, b, -1, 1], [b, h - b, 1, -1], [w - b, h - b, -1, -1]]) {
            ctx.beginPath();
            ctx.moveTo(x, y + dy * L);
            ctx.lineTo(x, y);
            ctx.lineTo(x + dx * L, y);
            ctx.stroke();
        }
        if (project) {
            ctx.fillStyle = 'rgba(9,11,17,.62)';
            roundRect(ctx, 58, 56, 520, 96, 16);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 54px ${FONT.sans}`;
            ctx.fillText(project.title.toUpperCase(), 84, 124);
            ctx.font = `600 22px ${FONT.mono}`;
            ctx.fillStyle = '#3ddc97';
            const chip = 'PLAYABLE';
            const cw = ctx.measureText(chip).width + 54;
            ctx.fillStyle = 'rgba(9,11,17,.7)';
            roundRect(ctx, w - 58 - cw, 64, cw, 44, 10);
            ctx.fill();
            ctx.fillStyle = '#3ddc97';
            ctx.beginPath();
            ctx.arc(w - 58 - cw + 22, 86, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText(chip, w - 58 - cw + 38, 94);
        } else {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 96px ${FONT.sans}`;
            ctx.fillText('CONCEPT', w / 2, h / 2 - 30);
            ctx.font = `italic 400 64px ${FONT.serif}`;
            ctx.fillStyle = '#ff6a2b';
            ctx.fillText('to console', w / 2, h / 2 + 46);
        }
    });
}

function promptTexture() {
    return canvasTexture(1024, 576, (ctx, w, h) => {
        ctx.textAlign = 'center';
        ctx.font = `700 40px ${FONT.mono}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
        ctx.shadowColor = '#ff6a2b';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS START', w / 2 + 5, h - 72);
    });
}

export function createConsole({ position, eye, project, still }) {
    const group = new THREE.Group();
    group.position.copy(position);
    const baseYaw = Math.atan2(eye.x - position.x, eye.z - position.z);
    const rig = new THREE.Group();
    group.add(rig);

    const W = 10.6;
    const H = 4.5;
    const depth = 0.5;
    const bevel = 0.18;
    const shape = bodyShape(W, H, 2.0);
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.16, bevelSegments: 5, curveSegments: 40 });
    bodyGeo.translate(0, 0, -depth / 2);
    const front = depth / 2 + bevel;
    rig.add(new THREE.Mesh(bodyGeo, lit({ color: '#1b2131', rim: COLORS.blue, rimStrength: 0.55, rimPower: 2.2 })));

    // Accent trim around the face
    const trimPts = bodyShape(W - 0.5, H - 0.5, 1.78).getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, front + 0.005));
    trimPts.push(trimPts[0].clone());
    rig.add(new THREE.Line(withT(new THREE.BufferGeometry().setFromPoints(trimPts)), lineMat({
        color: COLORS.accent.clone().multiplyScalar(0.7), opacity: 1, pulse: COLORS.accentHi.clone().multiplyScalar(2.4), pulseFreq: 2, pulseSpeed: 0.12, additive: true,
    })));

    // Screen
    const bezel = new THREE.Mesh(new THREE.ShapeGeometry(bodyShape(SCREEN_W + 0.46, SCREEN_H + 0.4, 0.24), 8), lit({ color: '#05070c', rimStrength: 0 }));
    bezel.position.z = front + 0.01;
    rig.add(bezel);

    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blank.needsUpdate = true;
    const screenMat = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            tVideo: { value: blank },
            tUI: { value: uiTexture(project) },
            tPrompt: { value: promptTexture() },
            uHasVideo: { value: 0 },
            uPower: { value: 0 },
            uBlink: { value: 1 },
            uFlash: { value: 0 },
        },
        vertexShader: '#include <common>\n#include <fog_pars_vertex>\nvarying vec2 vUv; void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
        fragmentShader: SCREEN_FRAG,
        fog: true,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
    screen.position.z = front + 0.02;
    rig.add(screen);

    // Controls
    const dark = lit({ color: '#0e121c', rimStrength: 0.3 });
    const capMat = lit({ color: '#2a3247', rim: COLORS.blue, rimStrength: 0.45 });
    const sticks = [];
    function stick(x, y) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 40).rotateX(Math.PI / 2), dark);
        base.position.set(x, y, front + 0.04);
        rig.add(base);
        const pivot = new THREE.Group();
        pivot.position.set(x, y, front + 0.05);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.24, 40).rotateX(Math.PI / 2).translate(0, 0, 0.22), capMat);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 10, 40).translate(0, 0, 0.34), capMat);
        pivot.add(cap, ring);
        rig.add(pivot);
        sticks.push(pivot);
    }
    stick(-3.95, 0.85);
    stick(3.95, -0.95);

    const dpad = new THREE.Group();
    dpad.position.set(-3.95, -0.95, front + 0.08);
    dpad.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.32, 0.14), capMat), new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.0, 0.14), capMat));
    rig.add(dpad);

    const buttons = [];
    for (const [dx, dy, c, glowing] of [[0.48, 0, COLORS.accent, true], [0, -0.48, COLORS.blue, false], [0, 0.48, COLORS.ok, false], [-0.48, 0, COLORS.gold, false]]) {
        const mat = lit({ color: c, rim: '#ffffff', rimStrength: 0.25, emissive: c.clone().multiplyScalar(glowing ? 0.8 : 0.12) });
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.16, 28).rotateX(Math.PI / 2), mat);
        b.position.set(3.95 + dx, 0.85 + dy, front + 0.08);
        b.userData = { z: b.position.z, glowing, base: c.clone(), press: 0 };
        rig.add(b);
        buttons.push(b);
    }

    for (const s of [-1, 1]) {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.34, 0.62), dark);
        shoulder.position.set(s * 3.4, H / 2 + 0.05, -0.05);
        rig.add(shoulder);
    }

    const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color: COLORS.accent.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowRing.position.set(3.95 + 0.48, 0.85, front + 0.17);
    rig.add(glowRing);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, H + 0.4, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
    rig.add(hit);

    // Footage from a real build, loaded when you get close.
    let video = null;
    function loadVideo() {
        if (video || !project?.media?.preview) return;
        video = document.createElement('video');
        video.src = project.media.preview;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.addEventListener('loadeddata', () => {
            const tex = new THREE.VideoTexture(video);
            tex.colorSpace = THREE.SRGBColorSpace;
            screenMat.uniforms.tVideo.value = tex;
            screenMat.uniforms.uHasVideo.value = 1;
        }, { once: true });
        video.load();
    }
    // The cover art shows first (and stays, with reduced motion or if the clip can't play).
    if (project?.media?.cover) {
        new THREE.TextureLoader().load(project.media.cover, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            if (screenMat.uniforms.tVideo.value.isVideoTexture) return;
            screenMat.uniforms.tVideo.value = tex;
            screenMat.uniforms.uHasVideo.value = 1;
        });
    }

    let flash = 0;
    const tilt = new THREE.Vector2();

    function update(t, dt, u, ctx) {
        if (!still && u > 5.4) loadVideo();
        if (video) {
            const want = !still && u > 6.2 && u < 7.9 && !document.hidden;
            if (want && video.paused) video.play().catch(() => {});
            else if (!want && !video.paused) video.pause();
        }

        const arrive = smooth(6.2, 7.0, u);
        screenMat.uniforms.uPower.value = smooth(6.4, 6.95, u);
        screenMat.uniforms.uBlink.value = still ? 1 : (Math.sin(t * 4.2) > -0.2 ? 1 : 0.15);
        flash = damp(flash, 0, 5, dt);
        screenMat.uniforms.uFlash.value = flash * 0.8;

        tilt.x = damp(tilt.x, ctx.pointer.x, 4, dt);
        tilt.y = damp(tilt.y, ctx.pointer.y, 4, dt);
        rig.rotation.set(
            (1 - arrive) * 0.35 - tilt.y * 0.12 + (still ? 0 : Math.sin(t * 0.7) * 0.03),
            baseYaw + (1 - arrive) * -0.7 + tilt.x * 0.2,
            (1 - arrive) * 0.08,
        );
        group.position.y = position.y + (still ? 0 : Math.sin(t * 0.9) * 0.12);
        for (const s of sticks) s.rotation.set(-tilt.y * 0.45, tilt.x * 0.45, 0);

        for (const b of buttons) {
            b.userData.press = damp(b.userData.press, 0, 10, dt);
            b.position.z = b.userData.z - b.userData.press * 0.08;
            if (b.userData.glowing) {
                b.material.uniforms.uEmissive.value.copy(b.userData.base).multiplyScalar(0.6 + (Math.sin(t * 4.2) * 0.5 + 0.5) * 1.6 * arrive);
            }
        }
        glowRing.material.opacity = arrive * (still ? 0.6 : (Math.sin(t * 4.2) * 0.5 + 0.5) * 0.9);
        glowRing.scale.setScalar(1 + (still ? 0 : ((t * 0.8) % 1) * 0.6));
    }

    function press() {
        flash = 1;
        for (const b of buttons) b.userData.press = 1;
        dispatchEvent(new CustomEvent('world:start'));
    }

    return { group, update, hit: [hit], index: [7, 7], onClick: press };
}
