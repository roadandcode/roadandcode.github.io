// Where everything sits. The road runs from the idea at z = 0 down to the
// console at z = -244; each stop on the page has a camera keyframe here.
//
// `side` is where the subject should sit on screen on wide viewports:
// +1 right (text card on the left), -1 left, 0 centred. On portrait screens the
// subject moves up instead, by `lift` of the viewport height (default 0.17).

import { THREE } from './kit.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const ROAD = [
    v(-2, 0, 46), v(0, 0, 14), v(0, 0, -6), v(5, 0, -28), v(8, 0, -46), v(4, 0, -72),
    v(-5, 0, -96), v(-2, 0, -122), v(5, 0, -144), v(2, 0, -168), v(-5, 0, -190),
    v(-2, 0, -214), v(0, 0, -238), v(0, 0, -262),
];

export const STATIONS = {
    spark: v(0.5, 3.4, -7),
    proto: v(17, 0, -50),
    systems: v(-7, 0, -104),
    online: v(7, 6.2, -152),
    ship: v(-15, 0, -196),
    console: v(0, 4.6, -248),
};

/** Flat ground around stations that stand on the terrain. */
export const PLATEAUS = [
    { x: STATIONS.proto.x, z: STATIONS.proto.z, r: 13 },
    { x: STATIONS.systems.x, z: STATIONS.systems.z, r: 11 },
    { x: STATIONS.ship.x, z: STATIONS.ship.z, r: 15 },
    { x: 0, z: -248, r: 12 },
];

export const KEYS = [
    // 0 hero: establishing shot down the valley, the idea floating ahead.
    { eye: v(-5.5, 7.6, 12.5), focus: v(0.5, 3.0, -7), side: 1, lift: 0.3, fog: [18, 100] },
    // 1 concept
    { eye: v(-4.2, 4.2, 3.6), focus: v(0.5, 3.4, -7), side: 1, fog: [12, 70] },
    // 2 prototype: greybox from the road
    { eye: v(5.5, 8.6, -39), focus: v(17, 1.4, -50.5), side: -1, fog: [14, 70] },
    // 3 polish: swing round to the other side as it gets painted
    { eye: v(9, 6.4, -62.5), focus: v(17, 1.8, -49.5), side: 1, fog: [14, 70] },
    // 4 systems: behaviour tree over the arena
    { eye: v(3.2, 6.8, -87.2), focus: v(-7, 4.4, -104), side: -1, fog: [16, 74] },
    // 5 online
    { eye: v(-2.8, 6.8, -138), focus: v(7, 5.8, -152), side: 1, fog: [14, 70] },
    // 6 ship
    { eye: v(-4.5, 14.5, -183.5), focus: v(-15.5, 0.4, -197), side: -1, fog: [16, 80] },
    // 7 console
    { eye: v(-2.6, 5.9, -230.5), focus: v(0, 4.6, -248), side: 1, fog: [14, 70] },
    // 8 overview: the whole route from above
    { eye: v(58, 150, 30), focus: v(0, 0, -112), side: 0, fog: [150, 420] },
];

/** Distance along the road (world units) that counts as "reached" for each keyframe. */
export const KEY_ROAD_Z = [6, -7, -46, -52, -100, -148, -192, -244, -262];
