// Stop 4. A behaviour tree that actually runs: the enemy in the arena below
// picks Chase, Investigate or Patrol each frame and the tree lights the branch
// it took. Code panels type themselves in as you arrive. Click to make a noise.

import {
    THREE, COLORS, lit, lineMat, cardMat, curveLine, canvasTexture, roundRect, FONT,
    smooth, damp, rng, withT,
} from '../kit.js';

const W = 1.72;
const H = 0.6;

// id, label, kind, x, y, parent
const NODES = [
    ['root', 'Root', 'root', 0, 8.1, null],
    ['sel', 'Pick behaviour', 'selector', 0, 6.8, 'root'],
    ['seqA', 'Chase branch', 'sequence', -4.25, 5.4, 'sel'],
    ['seqB', 'Investigate branch', 'sequence', -0.05, 5.4, 'sel'],
    ['patrol', 'Patrol', 'action', 3.6, 5.4, 'sel'],
    ['sees', 'Sees player?', 'condition', -5.2, 4.0, 'seqA'],
    ['chase', 'Chase', 'action', -3.3, 4.0, 'seqA'],
    ['heard', 'Heard noise?', 'condition', -1.0, 4.0, 'seqB'],
    ['inv', 'Investigate', 'action', 0.9, 4.0, 'seqB'],
];

const ACTIVE = {
    chase: ['root', 'sel', 'seqA', 'sees', 'chase'],
    investigate: ['root', 'sel', 'seqB', 'heard', 'inv'],
    patrol: ['root', 'sel', 'patrol'],
};

const KIND = {
    root: { tag: 'ROOT', color: '#e9edf5' },
    selector: { tag: 'SELECTOR', color: '#5b9dff' },
    sequence: { tag: 'SEQUENCE', color: '#5b9dff' },
    condition: { tag: 'CONDITION', color: '#ffc94d' },
    action: { tag: 'ACTION', color: '#3ddc97' },
};

const CODE = {
    'Chase.cs': `public class Chase : ActionNode
{
    [SerializeField] float speed = 5.5f;

    protected override Status OnTick(Agent agent)
    {
        if (agent.Target == null)
            return Status.Failure;

        agent.Mover.MoveTowards(agent.Target.position, speed);
        return agent.InReach ? Status.Success : Status.Running;
    }
}`,
    'LevelValidator.cs': `public static class LevelValidator
{
    [MenuItem("Tools/Validate Level")]
    static void Run()
    {
        // Catch it in the editor, not in QA.
        foreach (var s in FindObjectsByType<Spawner>(FindObjectsSortMode.None))
            if (s.Profile == null)
                Debug.LogError($"{s.name} has no profile", s);
    }
}`,
};

const KEYWORDS = /\b(public|private|protected|override|static|class|return|if|var|foreach|in|null|float|void|new)\b/;

function drawIcon(ctx, kind, x, y, s, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (kind === 'root') {
        ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
        ctx.fill();
    } else if (kind === 'selector') {
        ctx.font = `700 ${s * 1.1}px ${FONT.mono}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x, y + 3);
    } else if (kind === 'sequence') {
        ctx.moveTo(x - s * 0.45, y);
        ctx.lineTo(x + s * 0.4, y);
        ctx.moveTo(x + s * 0.1, y - s * 0.3);
        ctx.lineTo(x + s * 0.42, y);
        ctx.lineTo(x + s * 0.1, y + s * 0.3);
        ctx.stroke();
    } else if (kind === 'condition') {
        ctx.moveTo(x, y - s * 0.45);
        ctx.lineTo(x + s * 0.45, y);
        ctx.lineTo(x, y + s * 0.45);
        ctx.lineTo(x - s * 0.45, y);
        ctx.closePath();
        ctx.stroke();
    } else {
        ctx.moveTo(x - s * 0.3, y - s * 0.4);
        ctx.lineTo(x + s * 0.42, y);
        ctx.lineTo(x - s * 0.3, y + s * 0.4);
        ctx.closePath();
        ctx.fill();
    }
}

function nodeTexture(label, kind) {
    const k = KIND[kind];
    return canvasTexture(640, 224, (ctx, w, h) => {
        roundRect(ctx, 4, 4, w - 8, h - 8, 30);
        ctx.fillStyle = 'rgba(16, 20, 32, 0.96)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#2c3650';
        ctx.stroke();
        roundRect(ctx, 30, 52, 120, 120, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
        drawIcon(ctx, kind, 90, 112, 64, k.color);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = k.color;
        ctx.font = `500 26px ${FONT.mono}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
        ctx.fillText(k.tag, 178, 88);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.fillStyle = '#e9edf5';
        ctx.font = `650 ${label.length > 14 ? 44 : 52}px ${FONT.sans}`;
        ctx.fillText(label, 176, 152);
    });
}

function codeTexture(file, src) {
    const lines = src.split('\n');
    return canvasTexture(1024, 640, (ctx, w, h) => {
        roundRect(ctx, 3, 3, w - 6, h - 6, 26);
        ctx.fillStyle = 'rgba(11, 14, 22, 0.94)';
        ctx.fill();
        ctx.strokeStyle = '#262e42';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(4, 4, w - 8, 62);
        ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
            ctx.beginPath();
            ctx.arc(40 + i * 30, 35, 9, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill();
        });
        ctx.font = `500 24px ${FONT.mono}`;
        ctx.fillStyle = '#8e98ad';
        ctx.fillText(file, 150, 43);

        const size = 25;
        ctx.font = `400 ${size}px ${FONT.mono}`;
        const cw = ctx.measureText('M').width;
        lines.forEach((line, i) => {
            const y = 108 + i * size * 1.55;
            ctx.fillStyle = '#3d4760';
            ctx.textAlign = 'right';
            ctx.fillText(String(i + 1), 62, y);
            ctx.textAlign = 'left';
            const comment = line.indexOf('//');
            const tokens = line.split(/(\s+|[()[\]{};.,:?$"]|"[^"]*")/).filter(Boolean);
            let x = 88;
            let inString = false;
            for (const tok of tokens) {
                const col = x;
                x += tok.length * cw;
                if (comment >= 0 && col >= 88 + comment * cw) ctx.fillStyle = '#5d677c';
                else if (tok === '"') { inString = !inString; ctx.fillStyle = '#ff8a56'; }
                else if (inString) ctx.fillStyle = '#ff8a56';
                else if (KEYWORDS.test(tok)) ctx.fillStyle = '#5b9dff';
                else if (/^\d/.test(tok)) ctx.fillStyle = '#ffc94d';
                else if (/^[A-Z]/.test(tok)) ctx.fillStyle = '#3ddc97';
                else ctx.fillStyle = '#c3cad8';
                ctx.fillText(tok, col, y);
            }
        });
    });
}

let frameTex;
function frameTexture() {
    frameTex ??= canvasTexture(320, 128, (ctx, w, h) => {
        ctx.filter = 'blur(10px)';
        roundRect(ctx, 26, 26, w - 52, h - 52, 18);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.filter = 'none';
        roundRect(ctx, 26, 26, w - 52, h - 52, 18);
        ctx.lineWidth = 3;
        ctx.stroke();
    });
    return frameTex;
}

function frameMat() {
    return new THREE.ShaderMaterial({
        uniforms: { tMap: { value: frameTexture() }, uColor: { value: new THREE.Color() } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D tMap; uniform vec3 uColor; varying vec2 vUv; void main(){ gl_FragColor = vec4(uColor * texture2D(tMap, vUv).a, 1.0); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
}

export function createSystems({ position, eye, still }) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = Math.atan2(eye.x - position.x, eye.z - position.z);

    const tree = new THREE.Group();
    tree.position.set(0.6, 0, -1.2);
    group.add(tree);

    const nodes = new Map();
    for (const [id, text, kind, x, y] of NODES) {
        const card = new THREE.Mesh(new THREE.PlaneGeometry(W, H * 1.0), cardMat(nodeTexture(text, kind)));
        card.position.set(x, y, 0);
        card.renderOrder = 5;
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.28, H * 1.62), frameMat());
        frame.position.set(x, y, -0.02);
        frame.renderOrder = 4;
        tree.add(frame, card);
        nodes.set(id, { card, frame, x, y, glow: 0 });
    }

    const edges = [];
    for (const [id, , , x, y, parent] of NODES) {
        if (!parent) continue;
        const p = nodes.get(parent);
        const a = new THREE.Vector3(p.x, p.y - H / 2, -0.01);
        const b = new THREE.Vector3(x, y + H / 2, -0.01);
        const mid = (a.y + b.y) / 2;
        const line = curveLine([a, new THREE.Vector3(a.x, mid, -0.01), new THREE.Vector3(b.x, mid, -0.01), b], lineMat({
            color: COLORS.blue.clone().multiplyScalar(0.45), opacity: 0.9,
            pulse: new THREE.Color(0, 0, 0), pulseFreq: 2, pulseSpeed: 1.4, additive: true,
        }), 32);
        tree.add(line);
        edges.push({ id, line, glow: 0 });
    }

    // Code panels at different depths, for parallax on the way in.
    const panels = [
        { file: 'Chase.cs', w: 4.4, at: [-5.6, 8.6, -4.2], ry: 0.32 },
        { file: 'LevelValidator.cs', w: 3.8, at: [6.4, 2.2, 1.0], ry: -0.5 },
    ].map(({ file, w, at, ry }) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.625), cardMat(codeTexture(file, CODE[file])));
        mesh.position.set(...at);
        mesh.rotation.y = ry;
        mesh.renderOrder = 3;
        mesh.userData.y = at[1];
        group.add(mesh);
        return mesh;
    });

    // Arena
    const arena = new THREE.Group();
    group.add(arena);
    const ring = [];
    for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        ring.push(new THREE.Vector3(Math.cos(a) * 4.4, 0.03, Math.sin(a) * 4.4));
    }
    arena.add(new THREE.Line(withT(new THREE.BufferGeometry().setFromPoints(ring)), lineMat({ color: COLORS.blue.clone().multiplyScalar(0.9), opacity: 0.9, pulse: COLORS.blue.clone().multiplyScalar(1.2), pulseFreq: 3, pulseSpeed: 0.15 })));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.4, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0d1220', transparent: true, opacity: 0.85, depthWrite: false }));
    floor.position.y = 0.05;
    arena.add(floor);

    const waypoints = [[-2.6, -1.6], [2.4, -2.2], [0.6, 2.8]];
    const wpMat = lit({ color: '#5d677c', emissive: COLORS.blue.clone().multiplyScalar(0.25) });
    for (const [x, z] of waypoints) {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), wpMat);
        m.position.set(x, 0.18, z);
        arena.add(m);
    }

    const agent = (color, emissive) => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 4, 12).translate(0, 0.36, 0), lit({ color, emissive })));
        arena.add(g);
        return g;
    };
    const player = agent('#9cc2ff', COLORS.blue.clone().multiplyScalar(0.4));
    const enemy = agent('#ff8a56', COLORS.accent.clone().multiplyScalar(0.5));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.06), lit({ color: '#000', emissive: COLORS.accent.clone().multiplyScalar(3) }));
    visor.position.set(0, 0.55, 0.19);
    enemy.add(visor);
    const cone = new THREE.Mesh(
        new THREE.CircleGeometry(2.6, 32, -0.65, 1.3).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: COLORS.accent.clone().multiplyScalar(0.5), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    cone.position.y = 0.12;
    enemy.add(cone);

    const noise = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: COLORS.gold.clone().multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    noise.position.y = 0.14;
    arena.add(noise);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 9).translate(0, 4.5, 0), new THREE.MeshBasicMaterial({ visible: false }));
    group.add(hit);

    // Tiny simulation the tree is driving.
    const random = rng(7);
    const sim = {
        enemy: new THREE.Vector2(2.4, -2.2),
        player: new THREE.Vector2(-1, 1.5),
        heading: 0,
        wp: 0,
        noise: null,
        noiseAge: 0,
        nextNoise: 4,
        branch: 'patrol',
        playerT: 0,
    };
    const tmp = new THREE.Vector2();

    function makeNoise(x, z) {
        sim.noise = new THREE.Vector2(x, z);
        sim.noiseAge = 0;
    }

    function step(dt) {
        sim.playerT += dt * 0.45;
        const a = sim.playerT;
        sim.player.set(Math.sin(a) * 3.0, Math.sin(a * 2) * 1.6);

        const toPlayer = tmp.copy(sim.player).sub(sim.enemy);
        const dist = toPlayer.length();
        const facing = new THREE.Vector2(Math.sin(sim.heading), Math.cos(sim.heading));
        const sees = dist < 2.6 && toPlayer.normalize().dot(facing) > Math.cos(0.65);

        sim.nextNoise -= dt;
        if (sim.nextNoise <= 0) {
            const ang = random() * Math.PI * 2;
            makeNoise(Math.cos(ang) * 3, Math.sin(ang) * 3);
            sim.nextNoise = 6 + random() * 3;
        }
        if (sim.noise) sim.noiseAge += dt;

        let target;
        let speed;
        if (sees) {
            sim.branch = 'chase';
            target = sim.player;
            speed = 1.35;
        } else if (sim.noise) {
            sim.branch = 'investigate';
            target = sim.noise;
            speed = 1.15;
        } else {
            sim.branch = 'patrol';
            const [x, z] = waypoints[sim.wp];
            target = new THREE.Vector2(x, z);
            speed = 0.8;
        }

        const d = new THREE.Vector2().subVectors(target, sim.enemy);
        const len = d.length();
        if (len > 0.05) {
            const want = Math.atan2(d.x, d.y);
            let diff = want - sim.heading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            sim.heading += diff * Math.min(1, dt * 5);
            sim.enemy.addScaledVector(d.normalize(), Math.min(len, speed * dt));
        }
        if (sim.branch === 'investigate' && len < 0.3) sim.noise = null;
        if (sim.branch === 'patrol' && len < 0.3) sim.wp = (sim.wp + 1) % waypoints.length;
        if (sim.branch === 'chase' && dist < 0.45) sim.playerT += Math.PI;
    }

    function update(t, dt, u) {
        if (!still) step(Math.min(dt, 0.05));
        player.position.set(sim.player.x, 0, sim.player.y);
        enemy.position.set(sim.enemy.x, 0, sim.enemy.y);
        enemy.rotation.y = sim.heading;
        player.rotation.y = t * 2;

        if (sim.noise) {
            noise.position.x = sim.noise.x;
            noise.position.z = sim.noise.y;
            const k = (sim.noiseAge * 0.9) % 1;
            noise.scale.setScalar(0.2 + k * 1.2);
            noise.material.opacity = 1 - k;
        } else {
            noise.material.opacity = 0;
        }

        const on = new Set(ACTIVE[sim.branch]);
        for (const [id, n] of nodes) {
            n.glow = damp(n.glow, on.has(id) ? 1 : 0, 8, dt);
            n.frame.material.uniforms.uColor.value.copy(COLORS.blue).multiplyScalar(0.12).lerp(COLORS.accent.clone().multiplyScalar(2.4), n.glow);
            n.card.position.z = n.glow * 0.18;
        }
        for (const e of edges) {
            e.glow = damp(e.glow, on.has(e.id) ? 1 : 0, 8, dt);
            const m = e.line.material.uniforms;
            m.uColor.value.copy(COLORS.blue).multiplyScalar(0.45).lerp(COLORS.accent.clone().multiplyScalar(1.3), e.glow);
            m.uPulse.value.copy(COLORS.accentHi).multiplyScalar(2.5 * e.glow);
        }

        const reveal = smooth(3.35, 3.95, u);
        panels.forEach((p, i) => {
            p.material.uniforms.uReveal.value = smooth(i * 0.25, 0.75 + i * 0.25, reveal);
            p.position.y = p.userData.y + (still ? 0 : Math.sin(t * 0.6 + i * 2) * 0.12);
        });
    }

    return {
        group, update, hit: [hit], index: [4, 4],
        onClick() {
            const ang = Math.random() * Math.PI * 2;
            makeNoise(Math.cos(ang) * 2.8, Math.sin(ang) * 2.8);
        },
    };
}
