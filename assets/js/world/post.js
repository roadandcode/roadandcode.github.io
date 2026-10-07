// Bloom: the scene renders into an HDR target, anything brighter than 1.0 is
// blurred down a mip chain (dual filter) and added back on top. Cheap enough for
// laptops; the world skips it on phones and when the frame rate drops.

import { THREE } from './kit.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const PREFILTER = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
    vec3 c = texture2D(tMap, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(0.5, -0.5)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(0.5, 0.5)).rgb;
    c *= 0.25;
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    gl_FragColor = vec4(min(c * w, vec3(16.0)), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
    vec3 s = texture2D(tMap, vUv).rgb * 4.0;
    s += texture2D(tMap, vUv - uTexel).rgb;
    s += texture2D(tMap, vUv + uTexel).rgb;
    s += texture2D(tMap, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
    s += texture2D(tMap, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
    gl_FragColor = vec4(s / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
    vec2 h = uTexel;
    vec3 s = texture2D(tMap, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
    s += texture2D(tMap, vUv + vec2(-h.x, h.y)).rgb * 2.0;
    s += texture2D(tMap, vUv + vec2(0.0, h.y * 2.0)).rgb;
    s += texture2D(tMap, vUv + vec2(h.x, h.y)).rgb * 2.0;
    s += texture2D(tMap, vUv + vec2(h.x * 2.0, 0.0)).rgb;
    s += texture2D(tMap, vUv + vec2(h.x, -h.y)).rgb * 2.0;
    s += texture2D(tMap, vUv + vec2(0.0, -h.y * 2.0)).rgb;
    s += texture2D(tMap, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
    gl_FragColor = vec4(s / 12.0, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uStrength;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
    vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uStrength;
    gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}`;

function pass(fragmentShader, uniforms, blending = THREE.NoBlending) {
    return new THREE.ShaderMaterial({
        uniforms, vertexShader: VERT, fragmentShader, blending,
        depthTest: false, depthWrite: false,
    });
}

export class Bloom {
    constructor(renderer, { levels = 5, samples = 4, strength = 0.9, threshold = 1.0 } = {}) {
        this.renderer = renderer;
        this.levels = levels;
        const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
        this.scene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
        this.mips = Array.from({ length: levels }, () => new THREE.WebGLRenderTarget(1, 1, hdr));

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
        this.quad = new THREE.Mesh(geo);
        this.quad.frustumCulled = false;
        this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.prefilter = pass(PREFILTER, {
            tMap: { value: null }, uTexel: { value: new THREE.Vector2() },
            uThreshold: { value: threshold }, uKnee: { value: 0.35 },
        });
        this.down = pass(DOWN, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
        this.up = pass(UP, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } }, THREE.AdditiveBlending);
        this.composite = pass(COMPOSITE, {
            tScene: { value: this.scene.texture }, tBloom: { value: this.mips[0].texture }, uStrength: { value: strength },
        });
    }

    setSize(w, h) {
        this.scene.setSize(w, h);
        let mw = w;
        let mh = h;
        for (const m of this.mips) {
            mw = Math.max(1, mw >> 1);
            mh = Math.max(1, mh >> 1);
            m.setSize(mw, mh);
        }
    }

    draw(material, target) {
        this.quad.material = material;
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.quad, this.cam);
    }

    render(scene, camera) {
        const r = this.renderer;
        r.setRenderTarget(this.scene);
        r.render(scene, camera);

        const { prefilter, down, up, mips } = this;
        prefilter.uniforms.tMap.value = this.scene.texture;
        prefilter.uniforms.uTexel.value.set(1 / this.scene.width, 1 / this.scene.height);
        this.draw(prefilter, mips[0]);

        for (let i = 1; i < mips.length; i++) {
            down.uniforms.tMap.value = mips[i - 1].texture;
            down.uniforms.uTexel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height);
            this.draw(down, mips[i]);
        }

        // Each level gets the blurred level below it added on top, smallest first.
        r.autoClear = false;
        for (let i = mips.length - 1; i > 0; i--) {
            up.uniforms.tMap.value = mips[i].texture;
            up.uniforms.uTexel.value.set(0.5 / mips[i].width, 0.5 / mips[i].height);
            this.draw(up, mips[i - 1]);
        }
        r.autoClear = true;

        this.draw(this.composite, null);
    }

    dispose() {
        this.scene.dispose();
        this.mips.forEach((m) => m.dispose());
    }
}
