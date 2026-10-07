// Stops 2-3. A greybox level drops in block by block (prototype), then an art
// pass sweeps across it: colour, trees, coins and a face for the player (polish).
// Click anywhere on it to make the player jump.

import {
    THREE, COLORS, lit, lineMat, withT, smooth, clamp01, easeOutBack, lerp,
} from '../kit.js';

// [x, z, width, height, depth, paint, options]
const BLOCKS = [
    [-3.6, 2.8, 2.0, 0.5, 2.0, '#3ddc97'],
    [-1.5, 1.8, 1.4, 1.1, 1.4, '#5b9dff'],
    [0.4, 2.8, 1.4, 1.8, 1.4, '#ffc94d'],
    [2.6, 1.6, 1.6, 2.6, 1.6, '#ff6a2b'],
    [2.6, -0.6, 0.5, 2.4, 0.5, '#6b7690'],
    [2.6, -0.6, 0.9, 0.22, 2.7, '#c9a27a', { y: 2.38 }],
    [2.4, -3.0, 2.2, 3.4, 2.2, '#8b7cf6'],
    [-2.8, -2.6, 3.2, 2.2, 0.5, '#c3cad8'],
    [-3.3, -0.1, 2.6, 0.3, 1.5, '#ff8a56', { y: 0.45, rz: 0.35 }],
    [0.2, -1.2, 0.8, 1.4, 0.8, '#5b9dff'],
    [-0.5, -3.4, 0.8, 0.8, 0.8, '#c9874a'],
    [-0.5, -3.4, 0.7, 0.7, 0.7, '#b8763c', { y: 0.8, ry: 0.5 }],
    [4.4, 3.4, 1.0, 0.9, 1.0, '#3ddc97'],
];

// Where the player's feet land, in order.
const ROUTE = [[-3.6, 0.5, 2.8], [-1.5, 1.1, 1.8], [0.4, 1.8, 2.8], [2.6, 2.6, 1.6], [2.6, 2.6, -0.6], [2.4, 3.4, -3.0]];
const COINS = [[-1.5, 1.9, 1.8], [0.4, 2.6, 2.8], [2.6, 3.4, 1.6], [2.6, 3.3, -0.6], [-0.5, 2.2, -3.4], [4.4, 1.6, 3.4]];
const TREES = [[-4.5, -4.5, 1.1], [4.7, -1.4, 0.9], [-0.9, 4.6, 0.8], [4.6, -4.6, 1.2]];

const HOP = 0.62;
const REST = 0.12;
const CYCLE = ROUTE.length * (HOP + REST) + 1.4;

export function createPrototype({ position, still }) {
    const group = new THREE.Group();
    group.position.copy(position);

    const wipe = { value: -1e4 };
    const scan = { value: new THREE.Color(0, 0, 0) };
    const paint = (c) => ({ color: c, wipe, scan });
    const grey = '#7c8599';

    // Base slab and its blueprint grid
    const baseGeo = new THREE.BoxGeometry(11, 0.7, 11).translate(0, -0.35, 0);
    group.add(new THREE.Mesh(baseGeo, lit({ color: '#1a2132', paint: paint('#2a8f66'), rimStrength: 0.2 })));
    group.add(new THREE.LineSegments(withT(new THREE.EdgesGeometry(baseGeo), 2), lineMat({ color: COLORS.blue.clone().multiplyScalar(0.8), opacity: 0.8 })));
    const grid = [];
    for (let i = -5; i <= 5; i++) grid.push(i, 0.01, -5.5, i, 0.01, 5.5, -5.5, 0.01, i, 5.5, 0.01, i);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
    withT(gridGeo, 2);
    group.add(new THREE.LineSegments(gridGeo, lineMat({ color: COLORS.blue.clone().multiplyScalar(0.55), opacity: 0.55, wipe })));

    // Blocks: pivot at the bottom so they can squash when they land.
    const blocks = BLOCKS.map(([x, z, w, h, d, col, o = {}], i) => {
        const geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
        const pivot = new THREE.Group();
        pivot.position.set(x, o.y ?? 0, z);
        pivot.rotation.set(0, o.ry ?? 0, o.rz ?? 0);
        pivot.add(new THREE.Mesh(geo, lit({ color: grey, paint: paint(col) })));
        pivot.add(new THREE.LineSegments(withT(new THREE.EdgesGeometry(geo), 2), lineMat({ color: '#0d1320', opacity: 0.9, wipe })));
        pivot.userData = { y: o.y ?? 0, i };
        group.add(pivot);
        return pivot;
    });

    // Player
    const player = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.44, 6, 16).translate(0, 0.48, 0), lit({ color: '#aab2c4', paint: paint('#ff6a2b') }));
    const face = new THREE.Group();
    const eyeMat = lit({ color: '#ffffff', emissive: '#555555' });
    const pupilMat = lit({ color: '#0b0d14' });
    for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), eyeMat);
        eye.position.set(s * 0.1, 0.66, 0.22);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 6), pupilMat);
        pupil.position.set(s * 0.1, 0.665, 0.285);
        face.add(eye, pupil);
    }
    player.add(body, face);
    group.add(player);
    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 24).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    group.add(shadow);

    // Art pass extras
    const coinMat = lit({ color: COLORS.gold, emissive: COLORS.gold.clone().multiplyScalar(0.45), rim: '#ffffff', rimStrength: 0.4 });
    const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24).rotateX(Math.PI / 2);
    const coins = COINS.map(([x, y, z]) => {
        const m = new THREE.Mesh(coinGeo, coinMat);
        m.position.set(x, y, z);
        group.add(m);
        return m;
    });

    const leafMat = lit({ color: '#2fbf7f', rimStrength: 0.25 });
    const trunkMat = lit({ color: '#8a5a3c' });
    const trees = TREES.map(([x, z, s]) => {
        const tree = new THREE.Group();
        tree.position.set(x, 0, z);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.6, 6).translate(0, 0.3, 0), trunkMat);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.3, 7).translate(0, 1.15, 0), leafMat);
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 7).translate(0, 1.75, 0), leafMat);
        tree.add(trunk, crown, top);
        tree.userData.s = s;
        group.add(tree);
        return tree;
    });

    const flag = new THREE.Group();
    flag.position.set(3.15, 3.4, -3.7);
    flag.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8).translate(0, 0.75, 0), lit({ color: '#c3cad8' })));
    const cloth = new THREE.Shape();
    cloth.moveTo(0, 0);
    cloth.lineTo(0.75, -0.22);
    cloth.lineTo(0, -0.44);
    const clothMesh = new THREE.Mesh(new THREE.ShapeGeometry(cloth), lit({ color: '#9aa3b5', paint: paint('#ff6a2b') }));
    clothMesh.material.side = THREE.DoubleSide;
    clothMesh.position.y = 1.45;
    flag.add(clothMesh);
    group.add(flag);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(11, 5, 11).translate(0, 2.2, 0), new THREE.MeshBasicMaterial({ visible: false }));
    group.add(hit);

    let jumpAt = -10;
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const xMin = position.x - 8;
    const xMax = position.x + 8.5;

    function playerAt(t, out) {
        const c = ((t % CYCLE) + CYCLE) % CYCLE;
        const step = HOP + REST;
        const i = Math.floor(c / step);
        let squash = 0;
        let facing = 0;
        if (i < ROUTE.length - 1) {
            const k = clamp01((c - i * step) / HOP);
            from.fromArray(ROUTE[i]);
            to.fromArray(ROUTE[i + 1]);
            out.lerpVectors(from, to, k);
            const peak = Math.max(from.y, to.y) + 0.85;
            out.y = lerp(from.y, to.y, k) + (peak - Math.max(from.y, to.y) + Math.abs(to.y - from.y) * 0.5) * Math.sin(Math.PI * k);
            squash = k >= 1 ? Math.sin(Math.PI * clamp01((c - i * step - HOP) / REST)) : -0.12 * Math.sin(Math.PI * k);
            facing = Math.atan2(to.x - from.x, to.z - from.z);
        } else {
            // Made it to the flag: a little victory spin, then respawn.
            out.fromArray(ROUTE[ROUTE.length - 1]);
            const k = c - (ROUTE.length - 1) * step;
            out.y += Math.max(0, Math.sin(k * 6)) * 0.35;
            facing = k * 5;
            if (k > 1.6) out.fromArray(ROUTE[0]);
        }
        return { squash, facing };
    }

    function update(t, dt, u) {
        const drop = smooth(1.3, 1.95, u);
        const polish = smooth(2.2, 2.92, u);

        blocks.forEach((b) => {
            const k = clamp01(drop * 1.9 - b.userData.i * 0.07);
            b.visible = k > 0;
            const fall = clamp01(k / 0.75);
            const land = clamp01((k - 0.75) / 0.25);
            b.position.y = b.userData.y + 9 * (1 - fall * fall);
            const sq = Math.sin(Math.PI * land) * 0.22;
            b.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
        });

        wipe.value = lerp(xMin, xMax, polish);
        scan.value.copy(COLORS.accent).multiplyScalar(3 * Math.sin(Math.PI * polish));

        // Player only shows up once the level is in place.
        const ready = clamp01((drop - 0.92) / 0.08);
        player.visible = ready > 0;
        shadow.visible = player.visible;
        const { squash, facing } = playerAt(still ? 0.3 : t, player.position);
        const jk = clamp01((t - jumpAt) / 0.9);
        if (jk < 1) {
            player.position.y += Math.sin(Math.PI * jk) * 2.4;
            player.rotation.y = facing + jk * Math.PI * 2;
        } else {
            player.rotation.y = facing;
        }
        player.scale.set(ready * (1 + squash * 0.25), ready * (1 - squash * 0.3), ready * (1 + squash * 0.25));
        face.scale.setScalar(Math.max(0.001, smooth(0.55, 0.9, polish)));
        shadow.position.set(player.position.x, groundUnder(player.position) + 0.02, player.position.z);

        coins.forEach((c, i) => {
            const s = easeOutBack(clamp01(polish * 2.2 - 0.9 - i * 0.08));
            c.visible = s > 0.01;
            c.scale.setScalar(Math.max(s, 0.001));
            c.rotation.y = t * 2.4 + i;
            c.position.y = COINS[i][1] + (still ? 0 : Math.sin(t * 2 + i) * 0.08);
        });
        trees.forEach((tr, i) => {
            const s = easeOutBack(clamp01(polish * 2.4 - 1.0 - i * 0.12));
            tr.visible = s > 0.01;
            tr.scale.setScalar(Math.max(s, 0.001) * tr.userData.s);
        });
        flag.visible = drop > 0.99;
        clothMesh.rotation.y = still ? 0 : Math.sin(t * 3) * 0.25;
    }

    // Top of whatever block the shadow falls on.
    function groundUnder(p) {
        let y = 0;
        for (const [x, z, w, h, d, , o = {}] of BLOCKS) {
            if (o.rz) continue;
            if (Math.abs(p.x - x) < w / 2 && Math.abs(p.z - z) < d / 2) y = Math.max(y, (o.y ?? 0) + h);
        }
        return Math.min(y, p.y);
    }

    return {
        group, update, hit: [hit], index: [2, 3],
        onClick(t) { if (player.visible) jumpAt = t; },
    };
}
