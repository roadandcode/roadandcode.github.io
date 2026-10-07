// The ground: a contour map (the old hero shader, now in 3D) with a valley
// carved along the road, and the road itself, which lights up behind you.

import { THREE, COLORS, shared, fbm2, smooth } from './kit.js';
import { ROAD, PLATEAUS } from './layout.js';

const TERRAIN_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normal;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const TERRAIN_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uFocus;
uniform vec3 uBase;
uniform vec3 uInk;
uniform vec3 uMajor;
uniform vec3 uGrid;
uniform vec3 uPing;
varying vec3 vWorld;
varying vec3 vNormal;

float isoline(float v, float width) {
    float fw = max(fwidth(v), 1e-4);
    float d = abs(fract(v - 0.5) - 0.5);
    float line = 1.0 - smoothstep(fw * (width - 0.5), fw * (width + 0.5), d);
    return line * (1.0 - smoothstep(0.06, 0.24, fw));
}

void main() {
    float h = vWorld.y;
    float v = h / 0.8 + 0.5;
    float minor = isoline(v, 0.85);
    float major = isoline(v / 4.0, 1.2);

    vec2 g = vWorld.xz / 8.0;
    vec2 gw = max(fwidth(g), vec2(1e-4));
    vec2 gd = abs(fract(g - 0.5) - 0.5);
    float grid = max(1.0 - smoothstep(gw.x * 0.4, gw.x * 1.4, gd.x), 1.0 - smoothstep(gw.y * 0.4, gw.y * 1.4, gd.y));
    grid *= 1.0 - smoothstep(0.08, 0.3, max(gw.x, gw.y));

    float slope = 1.0 - normalize(vNormal).y;
    vec3 col = uBase * (0.75 + 0.5 * smoothstep(0.0, 12.0, h)) * (1.0 - slope * 0.6);
    col = mix(col, uGrid, grid * 0.55);
    col = mix(col, uInk, minor * 0.75);
    col = mix(col, uMajor, major * 0.9);

    // A radar ping rolls out from wherever the camera is looking.
    float r = length(vWorld.xz - uFocus.xz);
    float ring = fract(r / 46.0 - uTime * 0.16);
    float ping = smoothstep(0.92, 1.0, ring) * (1.0 - smoothstep(8.0, 34.0, r));
    col += uPing * ping * (minor * 0.6 + major + grid * 0.5);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

const ROAD_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aS;
varying vec2 vUv;
varying float vS;
void main() {
    vUv = uv;
    vS = aS;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const ROAD_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uTravel;
uniform vec3 uAhead;
uniform vec3 uBehind;
varying vec2 vUv;
varying float vS;
void main() {
    float across = abs(vUv.x - 0.5) * 2.0;
    float done = 1.0 - smoothstep(uTravel - 1.5, uTravel + 1.5, vS);
    vec3 ink = mix(uAhead, uBehind, done);

    float edge = smoothstep(0.82, 0.88, across) * (1.0 - smoothstep(0.94, 1.0, across));
    float dash = step(0.55, fract(vS / 3.2 - uTime * 0.35)) * (1.0 - smoothstep(0.07, 0.12, across));
    float head = exp(-abs(vS - uTravel) * 0.35) * (1.0 - across);

    vec3 col = vec3(0.022, 0.03, 0.055);
    col += ink * edge * (1.0 + done * 0.8);
    col += ink * dash * (1.1 + done * 1.6);
    col += uBehind * head * 1.4;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

export function createTerrain({ detail = 1 } = {}) {
    const road = new THREE.CatmullRomCurve3(ROAD, false, 'centripetal');
    const samples = road.getSpacedPoints(900);
    const roadLength = road.getLength();

    // The road only ever heads down -z, so the nearest sample can be found by z.
    function roadDistance(x, z) {
        let lo = 0;
        let hi = samples.length - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (samples[mid].z > z) lo = mid;
            else hi = mid;
        }
        let best = Infinity;
        for (let i = Math.max(0, lo - 12); i < Math.min(samples.length, lo + 12); i++) {
            const dx = samples[i].x - x;
            const dz = samples[i].z - z;
            best = Math.min(best, dx * dx + dz * dz);
        }
        return Math.sqrt(best);
    }

    function heightAt(x, z) {
        const d = roadDistance(x, z);
        let h = (fbm2(x * 0.032 + 3.1, z * 0.032 - 7.4) - 0.32) * 22;
        h = Math.max(h, -1.5) * smooth(6, 30, d) + smooth(18, 80, d) * 14;
        // Gentle swell on the valley floor so the map has rings right up to the road.
        h += (fbm2(x * 0.09 - 2.3, z * 0.09 + 5.2, 3) - 0.45) * 2.4 * smooth(2.6, 9, d);
        for (const p of PLATEAUS) {
            const f = smooth(p.r, p.r + 12, Math.hypot(x - p.x, z - p.z));
            h = h * f - 0.35 * (1 - f);
        }
        return h;
    }

    const width = 260;
    const depth = 380;
    const geo = new THREE.PlaneGeometry(width, depth, Math.round(150 * detail), Math.round(220 * detail));
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -110);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();

    const terrainMat = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uTime: shared.uTime,
            uFocus: { value: new THREE.Vector3() },
            uBase: { value: new THREE.Color('#0b0f1a') },
            uInk: { value: new THREE.Color('#263a63') },
            uMajor: { value: new THREE.Color('#4470b8') },
            uGrid: { value: new THREE.Color('#121a2b') },
            uPing: { value: COLORS.accent.clone().multiplyScalar(0.55) },
        },
        vertexShader: TERRAIN_VERT,
        fragmentShader: TERRAIN_FRAG,
        fog: true,
    });
    const terrain = new THREE.Mesh(geo, terrainMat);

    // Road ribbon
    const n = samples.length;
    const rPos = new Float32Array(n * 2 * 3);
    const rUv = new Float32Array(n * 2 * 2);
    const rS = new Float32Array(n * 2);
    const idx = [];
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3();
    const half = 1.25;
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const p = samples[i];
        road.getTangentAt(t, side).cross(up).normalize();
        const s = t * roadLength;
        for (let k = 0; k < 2; k++) {
            const sign = k === 0 ? -1 : 1;
            const j = i * 2 + k;
            rPos.set([p.x + side.x * half * sign, 0.05, p.z + side.z * half * sign], j * 3);
            rUv.set([k, t], j * 2);
            rS[j] = s;
        }
        if (i < n - 1) {
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    roadGeo.setAttribute('uv', new THREE.BufferAttribute(rUv, 2));
    roadGeo.setAttribute('aS', new THREE.BufferAttribute(rS, 1));
    roadGeo.setIndex(idx);
    const roadMat = new THREE.ShaderMaterial({
        uniforms: {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            uTime: shared.uTime,
            uTravel: { value: 0 },
            uAhead: { value: COLORS.blue.clone().multiplyScalar(0.9) },
            uBehind: { value: COLORS.accent.clone().multiplyScalar(1.6) },
        },
        vertexShader: ROAD_VERT,
        fragmentShader: ROAD_FRAG,
        fog: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.renderOrder = 1;

    /** Distance along the road of the sample nearest to world z. */
    function roadS(z) {
        let best = 0;
        let bestD = Infinity;
        samples.forEach((p, i) => {
            const d = Math.abs(p.z - z);
            if (d < bestD) { bestD = d; best = i; }
        });
        return (best / (n - 1)) * roadLength;
    }

    /** Point on the road nearest to world z. */
    function roadAt(z) {
        return samples.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a)).clone();
    }

    const group = new THREE.Group();
    group.add(terrain, roadMesh);

    return {
        group,
        terrain,
        road,
        roadLength,
        roadS,
        roadAt,
        heightAt,
        setTravel(s) { roadMat.uniforms.uTravel.value = s; },
        setFocus(p) { terrainMat.uniforms.uFocus.value.copy(p); },
    };
}
