// Stop 5. A dotted globe with players connected across it, and the backend
// rack on the ground feeding it. Click the globe to fire a round of packets.

import {
    THREE, COLORS, lit, lineMat, pointMat, glow, withT, fbm2, rng, damp, smooth,
} from '../kit.js';

const R = 3.6;

function landAt(v) {
    const n = fbm2(v.x * 2.1 + v.z * 0.9 + 4.1, v.y * 2.1 - 1.7, 4) * 0.5 + fbm2(v.z * 2.1 - v.x * 0.7 - 3.3, v.y * 2.1 + 8.2, 4) * 0.5;
    return n > 0.47;
}

const LED_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
    float cell = floor(vUv.x * 8.0);
    vec2 f = vec2(fract(vUv.x * 8.0), vUv.y) - 0.5;
    float dot = 1.0 - smoothstep(0.18, 0.28, length(f * vec2(1.0, 0.6)));
    float on = step(0.45, hash(cell * 7.1 + uSeed + floor(uTime * (2.0 + hash(cell + uSeed) * 6.0))));
    vec3 col = mix(vec3(0.24, 0.86, 0.59), vec3(1.0, 0.42, 0.17), step(0.85, hash(cell + uSeed * 3.0)));
    gl_FragColor = vec4(col * dot * (0.25 + on * 2.2), 1.0);
}`;

export function createOnline({ position, still }) {
    const group = new THREE.Group();
    group.position.copy(position);
    const globe = new THREE.Group();
    group.add(globe);
    const random = rng(42);

    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 48, 32), lit({ color: '#0b1120', rim: COLORS.blue, rimStrength: 0.9, rimPower: 3 })));
    group.add(glow({ color: COLORS.blue, size: R * 3.4, intensity: 0.32, falloff: 2.4 }));

    // Land as a dot lattice
    const land = [];
    const N = 5200;
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const a = i * 2.399963;
        v.set(Math.cos(a) * r, y, Math.sin(a) * r);
        if (landAt(v)) land.push(v.clone());
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(land.flatMap((p) => [p.x * R, p.y * R, p.z * R]), 3));
    dotGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(land.map(() => random()), 1));
    globe.add(new THREE.Points(dotGeo, pointMat({ color: COLORS.blue.clone().multiplyScalar(1.5), size: 0.13 })));

    // Graticule
    const grat = [];
    const ring = (fn) => {
        for (let i = 0; i < 72; i++) {
            const a = fn(i / 72);
            const b = fn((i + 1) / 72);
            grat.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
    };
    const Rg = R * 1.004;
    for (let lat = -60; lat <= 60; lat += 30) {
        const phi = (lat * Math.PI) / 180;
        ring((t) => new THREE.Vector3(Math.cos(t * Math.PI * 2) * Math.cos(phi) * Rg, Math.sin(phi) * Rg, Math.sin(t * Math.PI * 2) * Math.cos(phi) * Rg));
    }
    for (let lon = 0; lon < 180; lon += 30) {
        const th = (lon * Math.PI) / 180;
        ring((t) => {
            const a = t * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a) * Math.cos(th) * Rg, Math.sin(a) * Rg, Math.cos(a) * Math.sin(th) * Rg);
        });
    }
    const gratGeo = new THREE.BufferGeometry();
    gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(grat, 3));
    withT(gratGeo, 2);
    globe.add(new THREE.LineSegments(gratGeo, lineMat({ color: COLORS.blue.clone().multiplyScalar(0.28), opacity: 0.7, additive: true })));

    // Connections between players
    const arcs = [];
    const ends = [];
    for (let i = 0; i < 10; i++) {
        const a = land[Math.floor(random() * land.length)];
        let b = land[Math.floor(random() * land.length)];
        for (let tries = 0; tries < 20 && a.angleTo(b) < 0.7; tries++) b = land[Math.floor(random() * land.length)];
        const mid = a.clone().add(b).normalize().multiplyScalar(R * (1.12 + a.angleTo(b) * 0.28));
        const curve = new THREE.QuadraticBezierCurve3(a.clone().multiplyScalar(R), mid, b.clone().multiplyScalar(R));
        const geo = withT(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)));
        const mat = lineMat({
            color: COLORS.accent.clone().multiplyScalar(0.35), opacity: 1,
            pulse: COLORS.accentHi.clone().multiplyScalar(2.6), pulseFreq: 1, pulseSpeed: 0.25 + random() * 0.35, additive: true,
        });
        globe.add(new THREE.Line(geo, mat));
        arcs.push(mat);
        for (const p of [a, b]) {
            const dot = glow({ color: COLORS.accent, size: 0.55, intensity: 1.4, falloff: 2 });
            dot.position.copy(p).multiplyScalar(R * 1.01);
            globe.add(dot);
            ends.push(dot);
        }
    }

    // Orbit with two satellites
    const orbit = new THREE.Group();
    orbit.rotation.set(0.5, 0, -0.35);
    group.add(orbit);
    const orbitPts = [];
    for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        orbitPts.push(new THREE.Vector3(Math.cos(a) * R * 1.55, 0, Math.sin(a) * R * 1.55));
    }
    orbit.add(new THREE.Line(withT(new THREE.BufferGeometry().setFromPoints(orbitPts)), lineMat({ color: COLORS.blue.clone().multiplyScalar(0.4), opacity: 0.8, additive: true })));
    const sats = [0, Math.PI].map((phase) => {
        const sat = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), lit({ color: '#c3cad8' }));
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.32), lit({ color: '#2a4f8f', emissive: COLORS.blue.clone().multiplyScalar(0.3) }));
        sat.add(body, panel);
        sat.userData.phase = phase;
        orbit.add(sat);
        return sat;
    });

    // Backend rack on the ground, streaming up to the globe
    const rack = new THREE.Group();
    rack.position.set(-5.2, -position.y, 1.8);
    group.add(rack);
    const slabMat = lit({ color: '#1a2132', rimStrength: 0.3 });
    const leds = [];
    for (let i = 0; i < 4; i++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.46, 1.2), slabMat);
        slab.position.y = 0.23 + i * 0.54;
        rack.add(slab);
        rack.add(new THREE.LineSegments(withT(new THREE.EdgesGeometry(slab.geometry), 2), lineMat({ color: COLORS.blue.clone().multiplyScalar(0.5), opacity: 0.8 })).translateY(slab.position.y));
        const led = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16), new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uSeed: { value: i * 13.7 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: LED_FRAG,
        }));
        led.position.set(0, slab.position.y, 0.61);
        rack.add(led);
        leds.push(led.material);
    }
    const uplink = new THREE.Line(withT(new THREE.BufferGeometry().setFromPoints(
        new THREE.QuadraticBezierCurve3(new THREE.Vector3(-5.2, -position.y + 2.2, 1.8), new THREE.Vector3(-4.6, -1, 1.2), new THREE.Vector3(-1.6, -R * 0.75, 0.6)).getPoints(48),
    )), lineMat({ color: COLORS.ok.clone().multiplyScalar(0.3), opacity: 1, pulse: COLORS.ok.clone().multiplyScalar(2.2), pulseFreq: 3, pulseSpeed: 0.6, additive: true }));
    group.add(uplink);

    const hit = new THREE.Mesh(new THREE.SphereGeometry(R * 1.2, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    group.add(hit);

    let boost = 0;
    let spinX = 0;
    let spinY = 0;

    function update(t, dt, u, ctx) {
        boost = damp(boost, 0, 1.5, dt);
        spinY = damp(spinY, ctx.pointer.x * 0.5, 2, dt);
        spinX = damp(spinX, -ctx.pointer.y * 0.25, 2, dt);
        globe.rotation.set(0.35 + spinX, (still ? 0 : t * 0.09) + spinY + boost * 0.6, 0.12);
        for (const m of arcs) m.uniforms.uPulseFreq.value = 1 + boost * 3;
        ends.forEach((e, i) => { e.material.uniforms.uIntensity.value = 1.1 + Math.sin(t * 3 + i) * 0.4 + boost * 2; });
        sats.forEach((s) => {
            const a = t * 0.35 + s.userData.phase;
            s.position.set(Math.cos(a) * R * 1.55, 0, Math.sin(a) * R * 1.55);
            s.rotation.y = -a;
        });
        for (const m of leds) m.uniforms.uTime.value = still ? 0 : t;
        group.position.y = position.y + (still ? 0 : Math.sin(t * 0.6) * 0.15);
        rack.position.y = -group.position.y;
        globe.scale.setScalar(0.85 + 0.15 * smooth(4.3, 5, u));
        orbit.scale.copy(globe.scale);
    }

    return { group, update, hit: [hit], index: [5, 5], onClick() { boost = 1; } };
}
