// Shared colours, shader materials and small helpers for the world.
// Every material is a ShaderMaterial so lighting, fog and glow behave the same
// everywhere. Colours above 1.0 are deliberate: the bloom pass picks those up.

import * as THREE from '../../vendor/three.module.min.js';

export { THREE };

export const COLORS = {
    bg: new THREE.Color('#090b11'),
    surface: new THREE.Color('#121622'),
    line: new THREE.Color('#262e42'),
    text: new THREE.Color('#e9edf5'),
    muted: new THREE.Color('#8e98ad'),
    accent: new THREE.Color('#ff6a2b'),
    accentHi: new THREE.Color('#ff8a56'),
    blue: new THREE.Color('#5b9dff'),
    ok: new THREE.Color('#3ddc97'),
    gold: new THREE.Color('#ffc94d'),
};

export const shared = {
    uTime: { value: 0 },
};

const LIGHT = new THREE.Vector3(0.55, 0.8, 0.4).normalize();

const fog = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
const color = (c) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c));

/* Lit surfaces: half-lambert key light, sky fill, rim. Optional paint wipe for the prototype. */

const LIT_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vTint;
void main() {
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
        local = instanceMatrix * local;
        n = mat3(instanceMatrix) * n;
    #endif
    #ifdef USE_INSTANCING_COLOR
        vTint = instanceColor;
    #else
        vTint = vec3(1.0);
    #endif
    vec4 world = modelMatrix * local;
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * n);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const LIT_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform vec3 uRim;
uniform float uRimPower;
uniform vec3 uEmissive;
uniform vec3 uLight;
#ifdef USE_PAINT
uniform vec3 uPaint;
uniform float uWipe;
uniform vec3 uScan;
#endif
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vTint;
void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 base = uColor * vTint;
    #ifdef USE_PAINT
        float front = vWorld.x + vWorld.y * 0.35 - uWipe;
        base = mix(base, uPaint, 1.0 - smoothstep(-0.04, 0.04, front));
    #endif
    float key = dot(n, uLight) * 0.5 + 0.5;
    float sky = n.y * 0.5 + 0.5;
    vec3 col = base * (0.22 + 0.7 * key * key + 0.16 * sky);
    col += uRim * pow(1.0 - max(dot(n, v), 0.0), uRimPower);
    col += uEmissive;
    #ifdef USE_PAINT
        col += uScan * (1.0 - smoothstep(0.0, 0.14, abs(front)));
    #endif
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

export function lit({
    color: c = '#8a93a8', rim = COLORS.blue, rimStrength = 0.35, rimPower = 2.6, emissive = 0x000000, paint = null,
} = {}) {
    const uniforms = {
        ...fog(),
        uColor: { value: color(c) },
        uRim: { value: color(rim).multiplyScalar(rimStrength) },
        uRimPower: { value: rimPower },
        uEmissive: { value: color(emissive) },
        uLight: { value: LIGHT },
    };
    const defines = {};
    if (paint) {
        defines.USE_PAINT = '';
        uniforms.uPaint = { value: color(paint.color) };
        uniforms.uWipe = paint.wipe;
        uniforms.uScan = paint.scan;
    }
    return new THREE.ShaderMaterial({ uniforms, defines, vertexShader: LIT_VERT, fragmentShader: LIT_FRAG, fog: true });
}

/* Lines. `aT` runs 0..1 along a line and carries travelling pulses. */

const LINE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aT;
varying float vT;
varying vec3 vWorld;
void main() {
    vT = aT;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const LINE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
uniform vec3 uPulse;
uniform float uPulseFreq;
uniform float uPulseSpeed;
uniform float uTime;
#ifdef USE_PAINT
uniform float uWipe;
#endif
varying float vT;
varying vec3 vWorld;
void main() {
    float p = smoothstep(0.82, 1.0, fract(vT * uPulseFreq - uTime * uPulseSpeed));
    vec3 col = uColor + uPulse * p;
    float a = uOpacity;
    #ifdef USE_PAINT
        float front = vWorld.x + vWorld.y * 0.35 - uWipe;
        a *= smoothstep(-0.04, 0.3, front);
    #endif
    gl_FragColor = vec4(col, a);
    #ifdef ADDITIVE
        #ifdef USE_FOG
            gl_FragColor.rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        #include <colorspace_fragment>
    #else
        #include <colorspace_fragment>
        #include <fog_fragment>
    #endif
}`;

export function lineMat({
    color: c = COLORS.blue, opacity = 1, pulse = 0x000000, pulseFreq = 1, pulseSpeed = 0.5, additive = false, wipe = null,
} = {}) {
    const defines = {};
    if (additive) defines.ADDITIVE = '';
    const uniforms = {
        ...fog(),
        uColor: { value: color(c) },
        uOpacity: { value: opacity },
        uPulse: { value: color(pulse) },
        uPulseFreq: { value: pulseFreq },
        uPulseSpeed: { value: pulseSpeed },
        uTime: shared.uTime,
    };
    if (wipe) {
        defines.USE_PAINT = '';
        uniforms.uWipe = wipe;
    }
    return new THREE.ShaderMaterial({
        uniforms, defines, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, fog: true,
        transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
}

/** Adds an `aT` attribute (0..1 per line) to a geometry built from consecutive points. */
export function withT(geometry, perLine) {
    const n = geometry.attributes.position.count;
    const t = new Float32Array(n);
    for (let i = 0; i < n; i++) t[i] = perLine ? (i % perLine) / (perLine - 1) : i / Math.max(1, n - 1);
    geometry.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    return geometry;
}

/** A smooth polyline through the given points, as line segments with `aT`. */
export function curveLine(points, material, segments = 48) {
    const curve = points.length > 2 ? new THREE.CatmullRomCurve3(points) : new THREE.LineCurve3(points[0], points[1]);
    const pts = curve.getPoints(segments);
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    withT(g);
    return new THREE.Line(g, material);
}

/* Points: soft round dots with size attenuation. */

const POINT_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uSize;
uniform float uScale;
attribute float aSeed;
varying float vSeed;
void main() {
    vSeed = aSeed;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uScale / max(0.1, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const POINT_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying float vSeed;
void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.2, d) * uOpacity;
    a *= 0.75 + 0.25 * sin(uTime * 2.0 + vSeed * 40.0);
    gl_FragColor = vec4(uColor * a, 1.0);
    #ifdef USE_FOG
        gl_FragColor.rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    #include <colorspace_fragment>
}`;

export const pointScale = { value: 600 };

export function pointMat({ color: c = COLORS.blue, size = 0.2, opacity = 1 } = {}) {
    return new THREE.ShaderMaterial({
        uniforms: {
            ...fog(),
            uColor: { value: color(c) },
            uSize: { value: size },
            uScale: pointScale,
            uOpacity: { value: opacity },
            uTime: shared.uTime,
        },
        vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, fog: true,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
}

/* Billboard glow: a soft additive disc that always faces the camera. */

const GLOW_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    mvPosition.xy += position.xy * s;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const GLOW_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFalloff;
varying vec2 vUv;
void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), uFalloff);
    gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
    #ifdef USE_FOG
        gl_FragColor.rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    #include <colorspace_fragment>
}`;

const quad = new THREE.PlaneGeometry(1, 1);

export function glow({ color: c = COLORS.accent, size = 2, intensity = 1, falloff = 2.2 } = {}) {
    const mesh = new THREE.Mesh(quad, new THREE.ShaderMaterial({
        uniforms: {
            ...fog(),
            uColor: { value: color(c) },
            uIntensity: { value: intensity },
            uFalloff: { value: falloff },
        },
        vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, fog: true,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    mesh.scale.setScalar(size);
    mesh.renderOrder = 2;
    return mesh;
}

/* Textured cards (labels, code panels, sticky notes). */

const CARD_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const CARD_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D tMap;
uniform float uOpacity;
uniform float uBoost;
uniform float uReveal;
varying vec2 vUv;
void main() {
    vec4 t = texture2D(tMap, vUv);
    float shown = step(1.0 - vUv.y, uReveal);
    gl_FragColor = vec4(t.rgb * uBoost, t.a * uOpacity * shown);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`;

export function cardMat(texture, { opacity = 1, boost = 1, side = THREE.FrontSide } = {}) {
    return new THREE.ShaderMaterial({
        uniforms: {
            ...fog(),
            tMap: { value: texture },
            uOpacity: { value: opacity },
            uBoost: { value: boost },
            uReveal: { value: 1 },
        },
        vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, fog: true,
        transparent: true, depthWrite: false, side,
    });
}

/* Canvas textures */

export function canvasTexture(w, h, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export const FONT = {
    sans: '"Bricolage Grotesque", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    serif: '"Instrument Serif", Georgia, serif',
};

/** A flat label: mono caps text on a transparent background. */
export function labelTexture(text, { color: c = '#e9edf5', size = 64, weight = 600, font = FONT.mono, pad = 24, bg = null, border = null, tracking = 0.14 } = {}) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `${weight} ${size}px ${font}`;
    if ('letterSpacing' in probe) probe.letterSpacing = `${size * tracking}px`;
    const w = Math.ceil(probe.measureText(text).width + pad * 2);
    const h = Math.ceil(size * 1.5 + pad);
    const tex = canvasTexture(w, h, (ctx) => {
        if (bg || border) {
            roundRect(ctx, 2, 2, w - 4, h - 4, Math.min(18, h / 4));
            if (bg) { ctx.fillStyle = bg; ctx.fill(); }
            if (border) { ctx.strokeStyle = border; ctx.lineWidth = 3; ctx.stroke(); }
        }
        ctx.font = `${weight} ${size}px ${font}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * tracking}px`;
        ctx.fillStyle = c;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2 + size * tracking * 0.5, h / 2 + 2);
    });
    return { tex, aspect: w / h };
}

/** A plane showing a label, `height` world units tall. */
export function label(text, height, opts = {}) {
    const { tex, aspect } = labelTexture(text, opts);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), cardMat(tex, { boost: opts.boost ?? 1 }));
    mesh.renderOrder = 3;
    return mesh;
}

/* Maths */

export const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};
export const easeOutBack = (t) => {
    const c = 1.7;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/** Damped approach of `current` to `target`, frame-rate independent. */
export const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

/* Value noise, for the terrain and the globe's continents. */

function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm2(x, y, octaves = 5) {
    let v = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
        v += a * noise2(x * f + i * 17.3, y * f - i * 9.1);
        f *= 2.03;
        a *= 0.5;
    }
    return v;
}

/** Deterministic random numbers, so the world is the same on every visit. */
export function rng(seed = 1) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
