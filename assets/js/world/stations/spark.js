// Stops 0-1. The idea: a glowing core inside a wireframe shell, and the sticky
// notes it throws off once you start the concept stage. Click it for a burst.

import {
    THREE, COLORS, shared, lit, lineMat, pointMat, glow, canvasTexture, cardMat, roundRect, FONT,
    smooth, clamp01, easeOutBack, damp, withT,
} from '../kit.js';

const CORE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform float uBurst;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
    vec3 p = position;
    float wob = sin(p.x * 3.1 + uTime * 1.7) * sin(p.y * 2.7 - uTime * 1.3) * sin(p.z * 3.3 + uTime);
    p += normal * wob * (0.07 + uBurst * 0.25);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const CORE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uBurst;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    float f = pow(1.0 - max(dot(n, v), 0.0), 2.0);
    vec3 col = mix(uHot, uColor, f) * (1.0 + uBurst * 1.5);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

const NOTES = [
    { text: 'core loop?', bg: '#f3ead7', ink: '#1a1410', at: [-3.6, 1.6, 0.6], rot: -0.12 },
    { text: 'co-op!', bg: '#ff8a56', ink: '#1a0a02', at: [3.4, 2.1, -0.4], rot: 0.1 },
    { text: '60 fps', bg: '#9cc2ff', ink: '#0a1220', at: [-3.1, -1.5, 1.2], rot: 0.08 },
    { text: 'one more run', bg: '#f3ead7', ink: '#1a1410', at: [3.8, -1.2, 1.0], rot: -0.06 },
    { text: 'juice it', bg: '#3ddc97', ink: '#04140c', at: [0.4, 3.5, -1.2], rot: 0.14 },
    { text: 'boss fight?', bg: '#9cc2ff', ink: '#0a1220', at: [-0.6, -3.2, 0.4], rot: -0.1 },
];

function noteTexture({ text, bg, ink }) {
    return canvasTexture(320, 320, (ctx, w, h) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        roundRect(ctx, 22, 18, w - 44, h - 44, 10);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(22, 18, w - 44, 34);
        ctx.fillStyle = ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const size = text.length > 9 ? 54 : 66;
        ctx.font = `italic 400 ${size}px ${FONT.serif}`;
        const words = text.split(' ');
        const lines = text.length > 9 && words.length > 1
            ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
            : [text];
        lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + 6 + (i - (lines.length - 1) / 2) * size * 1.05));
        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.3, h * 0.78);
        ctx.quadraticCurveTo(w * 0.5, h * 0.74, w * 0.7, h * 0.79);
        ctx.stroke();
    });
}

export function createSpark({ position, still }) {
    const group = new THREE.Group();
    group.position.copy(position);
    const spin = new THREE.Group();
    group.add(spin);

    const coreMat = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uTime: shared.uTime,
            uBurst: { value: 0 },
            uColor: { value: COLORS.accent.clone().multiplyScalar(2.6) },
            uHot: { value: new THREE.Color(1.0, 0.55, 0.25).multiplyScalar(1.15) },
        },
        vertexShader: CORE_VERT, fragmentShader: CORE_FRAG, fog: true,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 5), coreMat);
    group.add(core);

    const halo = glow({ color: COLORS.accent, size: 7.5, intensity: 0.55, falloff: 2.6 });
    group.add(halo);

    const shellGeo = new THREE.IcosahedronGeometry(2.15, 1);
    const shell = new THREE.LineSegments(
        withT(new THREE.EdgesGeometry(shellGeo), 2),
        lineMat({ color: COLORS.blue.clone().multiplyScalar(0.9), opacity: 0.9 }),
    );
    spin.add(shell);

    // Vertices of the shell as points.
    const seen = new Map();
    const p = shellGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        if (!seen.has(key)) seen.set(key, [p.getX(i), p.getY(i), p.getZ(i)]);
    }
    const vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.Float32BufferAttribute([...seen.values()].flat(), 3));
    vGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute([...seen.values()].map((_, i) => (i * 0.618) % 1), 1));
    spin.add(new THREE.Points(vGeo, pointMat({ color: COLORS.blue.clone().multiplyScalar(2.2), size: 0.32 })));

    // Orbits
    const rings = [];
    for (const [r, tiltX, tiltZ, speed] of [[3.0, 1.2, 0.2, 0.35], [3.5, 0.4, -0.6, -0.22], [2.7, -0.9, 0.9, 0.5]]) {
        const pivot = new THREE.Group();
        pivot.rotation.set(tiltX, 0, tiltZ);
        const pts = [];
        for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        }
        const ringGeo = withT(new THREE.BufferGeometry().setFromPoints(pts));
        pivot.add(new THREE.Line(ringGeo, lineMat({
            color: COLORS.blue.clone().multiplyScalar(0.35), opacity: 0.8,
            pulse: COLORS.accent.clone().multiplyScalar(1.4), pulseFreq: 2, pulseSpeed: speed * 0.5,
        })));
        const moon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), lit({ color: '#ffffff', emissive: COLORS.blue.clone().multiplyScalar(1.6) }));
        moon.position.x = r;
        const orbit = new THREE.Group();
        orbit.add(moon);
        pivot.add(orbit);
        group.add(pivot);
        rings.push({ pivot, orbit, speed });
    }

    // Shockwave for clicks
    const wave = new THREE.Mesh(
        new THREE.RingGeometry(0.96, 1, 96),
        new THREE.MeshBasicMaterial({ color: COLORS.accent.clone().multiplyScalar(2), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    group.add(wave);

    // Sticky notes and the threads tying them to the core
    const notes = NOTES.map((n, i) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), cardMat(noteTexture(n), { side: THREE.DoubleSide }));
        mesh.position.set(...n.at);
        mesh.userData = { home: new THREE.Vector3(...n.at), rot: n.rot, seed: i * 1.37 };
        mesh.renderOrder = 4;
        group.add(mesh);
        return mesh;
    });
    const threadPos = new Float32Array(notes.length * 6);
    const threadGeo = new THREE.BufferGeometry();
    threadGeo.setAttribute('position', new THREE.BufferAttribute(threadPos, 3));
    withT(threadGeo, 2);
    const threadMat = lineMat({ color: COLORS.accent.clone().multiplyScalar(0.8), opacity: 0, pulse: COLORS.accent.clone().multiplyScalar(2), pulseFreq: 1, pulseSpeed: 0.8, additive: true });
    const threads = new THREE.LineSegments(threadGeo, threadMat);
    group.add(threads);

    let burst = 0;
    let waveT = 1;
    const look = new THREE.Vector2();
    const hit = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    group.add(hit);

    function update(t, dt, u, ctx) {
        burst = damp(burst, 0, 2.2, dt);
        coreMat.uniforms.uBurst.value = burst;
        halo.material.uniforms.uIntensity.value = 0.55 + burst * 1.4 + Math.sin(t * 2.1) * 0.05;

        look.x = damp(look.x, ctx.pointer.x, 3, dt);
        look.y = damp(look.y, ctx.pointer.y, 3, dt);
        spin.rotation.y = t * 0.18 + burst * 2 + look.x * 0.5;
        spin.rotation.x = Math.sin(t * 0.3) * 0.15 - look.y * 0.35;
        core.scale.setScalar(1 + burst * 0.35 + Math.sin(t * 2.1) * 0.025);
        group.position.y = position.y + (still ? 0 : Math.sin(t * 0.8) * 0.12);

        for (const r of rings) r.orbit.rotation.y = t * r.speed * 2 + burst * 3;

        waveT = Math.min(1, waveT + dt * 1.1);
        wave.scale.setScalar(1 + waveT * 7);
        wave.material.opacity = (1 - waveT) * 0.9;
        wave.lookAt(ctx.camera.position);

        // Notes fan out over the concept stage and tuck away again after it.
        const show = smooth(0.25, 1, u) * (1 - smooth(1.45, 1.9, u));
        notes.forEach((m, i) => {
            const k = clamp01(show * 1.5 - i * 0.08);
            const s = k > 0 ? easeOutBack(k) : 0;
            const { home, rot, seed } = m.userData;
            m.visible = s > 0.001;
            m.scale.setScalar(Math.max(s, 0.001));
            m.position.copy(home).multiplyScalar(0.35 + 0.65 * k);
            if (!still) m.position.y += Math.sin(t * 0.9 + seed) * 0.12;
            m.lookAt(ctx.camera.position);
            m.rotateZ(rot + (still ? 0 : Math.sin(t * 0.7 + seed) * 0.05));
            threadPos.set([0, 0, 0, m.position.x, m.position.y, m.position.z], i * 6);
        });
        threadGeo.attributes.position.needsUpdate = true;
        threadMat.uniforms.uOpacity.value = show * 0.7;
    }

    function poke() {
        burst = 1;
        waveT = 0;
    }

    return { group, update, hit: [hit], onClick: poke, index: [0, 1] };
}
