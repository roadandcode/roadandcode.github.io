// Stop 6. The release line: a tag goes in at the back, raw builds ride the belt
// through the build gate, come out finished and fly off to every platform.
// Click it to push a hotfix through at triple speed.

import {
    THREE, COLORS, lit, lineMat, glow, label, withT, damp, smooth,
} from '../kit.js';

const PADS = [
    ['WEB', -6, 2.6],
    ['ANDROID', -3, 4.1],
    ['iOS', 0, 4.7],
    ['WINDOWS', 3, 4.1],
    ['XR', 6, 2.6],
];
const COUNT = 20;
const GATE_Z = -1.4;

const BELT_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uSpeed;
varying vec2 vUv;
void main() {
    float x = abs(vUv.x - 0.5);
    float chev = fract(vUv.y * 9.0 - x * 1.6 - uTime * uSpeed);
    float stripe = smoothstep(0.0, 0.08, chev) * (1.0 - smoothstep(0.22, 0.3, chev)) * step(x, 0.36);
    float rail = smoothstep(0.42, 0.46, x);
    vec3 col = vec3(0.03, 0.04, 0.07) + vec3(0.36, 0.62, 1.0) * stripe * 0.55 + vec3(0.36, 0.62, 1.0) * rail * 0.5;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

export function createShip({ position, eye, still }) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = Math.atan2(eye.x - position.x, eye.z - position.z);

    // Floor
    const floorGeo = new THREE.BoxGeometry(17, 0.5, 14.5).translate(0, -0.2, -0.6);
    group.add(new THREE.Mesh(floorGeo, lit({ color: '#121827', rimStrength: 0.15 })));
    group.add(new THREE.LineSegments(withT(new THREE.EdgesGeometry(floorGeo), 2), lineMat({ color: COLORS.blue.clone().multiplyScalar(0.7), opacity: 0.8 })));

    // Source: the tag that kicks it all off
    const source = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.6).translate(0, 0.55, 0), lit({ color: '#1d2436', emissive: COLORS.accent.clone().multiplyScalar(0.05) }));
    source.position.set(0, 0, -7.2);
    group.add(source);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.08), lit({ color: '#000', emissive: COLORS.accent.clone().multiplyScalar(2.4) }));
    slot.position.set(0, 0.75, -6.39);
    group.add(slot);
    const tag = label('git tag v1.0.0', 0.5, { color: '#ff8a56', bg: 'rgba(12,15,24,.9)', border: '#3a2a22', size: 44 });
    tag.position.set(0, 1.75, -7.2);
    group.add(tag);

    // Belt
    const beltLen = Math.abs(-6.3 - GATE_Z);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(1.1, beltLen).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uSpeed: { value: 0.8 } },
        vertexShader: '#include <common>\n#include <fog_pars_vertex>\nvarying vec2 vUv; void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
        fragmentShader: BELT_FRAG, fog: true,
    }));
    belt.position.set(0, 0.02, (-6.3 + GATE_Z) / 2);
    group.add(belt);

    // Build gate
    const gateMat = lit({ color: '#2a3550', emissive: new THREE.Color(0, 0, 0), rimStrength: 0.6 });
    const gate = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.11, 16, 64), gateMat);
    gate.position.set(0, 1.35, GATE_Z);
    group.add(gate);
    const gateGlow = glow({ color: COLORS.accent, size: 4.5, intensity: 0, falloff: 2.5 });
    gateGlow.position.copy(gate.position);
    group.add(gateGlow);

    // Branches out to each platform
    const curves = PADS.map(([, x, z]) => new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.45, GATE_Z + 0.4),
        new THREE.Vector3(x * 0.25, 0.9, GATE_Z + 2.0),
        new THREE.Vector3(x * 0.8, 0.9, z - 1.2),
        new THREE.Vector3(x, 0.45, z),
    ]));
    for (const c of curves) {
        const pts = c.getPoints(48).map((p) => new THREE.Vector3(p.x, 0.03, p.z));
        group.add(new THREE.Line(withT(new THREE.BufferGeometry().setFromPoints(pts)), lineMat({
            color: COLORS.blue.clone().multiplyScalar(0.35), opacity: 0.9,
            pulse: COLORS.accent.clone().multiplyScalar(1.2), pulseFreq: 2, pulseSpeed: 0.5, additive: true,
        })));
    }

    const padGeo = new THREE.CylinderGeometry(0.9, 0.95, 0.2, 40).translate(0, 0.1, 0);
    const pads = PADS.map(([name, x, z]) => {
        const pad = new THREE.Mesh(padGeo, lit({ color: '#1a2132', rimStrength: 0.35 }));
        pad.position.set(x, 0, z);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: COLORS.accent.clone().multiplyScalar(2), transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring.position.y = 0.21;
        pad.add(ring);
        const name3d = label(name, 0.46, { color: '#e9edf5', bg: 'rgba(12,15,24,.88)', border: '#262e42', size: 44 });
        name3d.position.set(0, 1.55, 0);
        pad.add(name3d);
        group.add(pad);
        return { pad, ring, flash: 0 };
    });

    // Builds in flight
    const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), lit({ color: '#ffffff', rimStrength: 0.25 }), COUNT);
    cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cubes.setColorAt(0, new THREE.Color());
    cubes.frustumCulled = false;
    group.add(cubes);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(17, 4, 14).translate(0, 2, -0.6), new THREE.MeshBasicMaterial({ visible: false }));
    group.add(hit);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const raw = new THREE.Color('#5d677c');
    const built = COLORS.accent.clone().multiplyScalar(1.9);
    const tmp = new THREE.Color();
    let clock = 0;
    let rush = 0;

    function update(t, dt) {
        rush = damp(rush, 0, 0.8, dt);
        const speed = 1 + rush * 2;
        clock += still ? 0 : dt * speed;
        belt.material.uniforms.uTime.value = clock;

        let gateHeat = 0;
        for (let i = 0; i < COUNT; i++) {
            const k = (clock * 0.075 + i / COUNT) % 1;
            const lane = i % PADS.length;
            let scale = 1;
            if (k < 0.45) {
                const b = k / 0.45;
                p.set(0, 0.36, -6.3 + (GATE_Z + 6.3) * b);
                e.set(0, b * 1.5, 0);
                scale = 0.85 * smooth(0, 0.06, b);
                tmp.copy(raw);
            } else {
                const b = (k - 0.45) / 0.55;
                curves[lane].getPoint(b, p);
                p.y += Math.sin(Math.PI * b) * 0.9;
                e.set(b * 4, b * 6, 0);
                scale = 1 - smooth(0.88, 1, b);
                tmp.copy(raw).lerp(built, smooth(0, 0.08, b));
                if (b > 0.9) pads[lane].flash = 1;
            }
            gateHeat = Math.max(gateHeat, 1 - Math.min(1, Math.abs(k - 0.45) / 0.04));
            q.setFromEuler(e);
            s.setScalar(Math.max(scale, 0.001));
            m.compose(p, q, s);
            cubes.setMatrixAt(i, m);
            cubes.setColorAt(i, tmp);
        }
        cubes.instanceMatrix.needsUpdate = true;
        cubes.instanceColor.needsUpdate = true;

        gateMat.uniforms.uEmissive.value.copy(COLORS.blue).multiplyScalar(0.35).lerp(COLORS.accent.clone().multiplyScalar(2.2), gateHeat);
        gateGlow.material.uniforms.uIntensity.value = gateHeat * 0.9;
        gate.rotation.z = clock * 0.4;

        for (const pd of pads) {
            pd.flash = damp(pd.flash, 0, 4, dt);
            pd.ring.material.opacity = 0.15 + pd.flash * 0.85;
        }
        slot.material.uniforms.uEmissive.value.copy(COLORS.accent).multiplyScalar(1.2 + Math.sin(clock * 6) * 0.8);
    }

    return { group, update, hit: [hit], index: [6, 6], onClick() { rush = 1; } };
}
