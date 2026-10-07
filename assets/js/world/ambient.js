// Things that belong to the whole world rather than one stop: drifting dust for
// depth, light beams marking each stop on the road, and the labels that show
// up when the camera pulls back to the map.

import { THREE, COLORS, pointMat, label, rng, smooth, lerp } from './kit.js';

const BEAM_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying float vY;
varying float vDist;
void main() {
    vY = uv.y;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDist = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const BEAM_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uIntensity;
uniform float uNear;
varying float vY;
varying float vDist;
void main() {
    float a = pow(1.0 - vY, 2.2) * uIntensity * smoothstep(uNear, uNear * 2.4, vDist);
    gl_FragColor = vec4(uColor * a, 1.0);
    #ifdef USE_FOG
        gl_FragColor.rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth) * 0.85;
    #endif
    #include <colorspace_fragment>
}`;

export function createAmbient({ stops, roadS, tier }) {
    const group = new THREE.Group();
    const random = rng(3);

    // Dust
    const dust = (count, c, size) => {
        const pos = new Float32Array(count * 3);
        const seed = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (random() - 0.5) * 90;
            pos[i * 3 + 1] = 0.5 + random() ** 1.6 * 28;
            pos[i * 3 + 2] = 40 - random() * 320;
            seed[i] = random();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        const pts = new THREE.Points(g, pointMat({ color: c, size }));
        pts.frustumCulled = false;
        group.add(pts);
        return pts;
    };
    const lowCount = tier === 'low' ? 0.5 : 1;
    const motes = [
        dust(Math.round(1400 * lowCount), COLORS.blue.clone().multiplyScalar(0.9), 0.13),
        dust(Math.round(260 * lowCount), COLORS.accent.clone().multiplyScalar(1.1), 0.16),
    ];

    // A beam of light where the road meets each stop, blue ahead and orange once passed.
    const beamGeo = new THREE.CylinderGeometry(0.22, 0.22, 36, 12, 1, true).translate(0, 18, 0);
    const beams = stops.map((s) => {
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
                uColor: { value: COLORS.blue.clone() },
                uIntensity: { value: 0.5 },
                uNear: { value: 28 },
            },
            vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, fog: true,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const beam = new THREE.Mesh(beamGeo, mat);
        beam.position.copy(s.at);
        group.add(beam);

        const tag = label(s.name, 4.2, { color: '#e9edf5', bg: 'rgba(9,11,17,.82)', border: '#ff6a2b', size: 52, pad: 28 });
        tag.position.set(s.at.x, 24, s.at.z);
        tag.material.uniforms.uOpacity.value = 0;
        tag.visible = false;
        group.add(tag);
        return { beam, tag, s: roadS(s.at.z) };
    });

    const passed = COLORS.accent.clone().multiplyScalar(1.4);
    const ahead = COLORS.blue.clone().multiplyScalar(0.8);

    function update(t, u, travel, camera) {
        motes.forEach((m, i) => { m.position.y = Math.sin(t * 0.12 + i * 2) * 0.6; });
        const map = smooth(7.45, 7.95, u);
        for (const b of beams) {
            const done = smooth(-2, 2, travel - b.s);
            b.beam.material.uniforms.uColor.value.copy(ahead).lerp(passed, done);
            b.beam.material.uniforms.uIntensity.value = lerp(0.24, 0.65, map);
            b.beam.material.uniforms.uNear.value = lerp(40, 60, map);
            b.beam.scale.set(1 + map * 2.5, 1 + map * 1.5, 1 + map * 2.5);
            b.tag.visible = map > 0.01;
            b.tag.material.uniforms.uOpacity.value = map;
            if (b.tag.visible) b.tag.quaternion.copy(camera.quaternion);
        }
    }

    return { group, update };
}
