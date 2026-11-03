// Orb Herders: the game rules. Plain JS with no DOM, so the same file can run anywhere.
//
// Up to four hover-drones share a square arena. Each drone owns the goal in the middle of one
// wall. Glowing orbs spawn in the centre; push one into YOUR goal to score (gold orbs are worth 3).
// Dash into another drone to knock it away and stun it for a moment.

export const HALF = 18; // arena is 36 x 36
export const GOAL_HALF = 4.5; // goal mouth is 9 wide
export const DRONE_R = 1.1;
export const ORB_R = 0.8;
export const ORB_COUNT = 3;
export const MATCH_SECONDS = 180;
export const SCORE_TO_WIN = 15;
export const CORNER_R = 3.5;
export const POST_R = 0.45;

export const SLOT_COLORS = [0x35e0ff, 0xff4fd8, 0x9dff5a, 0xffb340];
export const SLOT_NAMES = ["Cyan", "Magenta", "Lime", "Amber"];

// Slot i owns the goal on one wall. (nx, nz) points out of the arena through that goal.
export const GOALS = [
  { x: 0, z: HALF, nx: 0, nz: 1 },
  { x: 0, z: -HALF, nx: 0, nz: -1 },
  { x: -HALF, z: 0, nx: -1, nz: 0 },
  { x: HALF, z: 0, nx: 1, nz: 0 },
];

const ACCEL = 42;
const DRAG = 3.2;
const DASH_SPEED = 24;
const DASH_TIME = 0.22;
const DASH_COOLDOWN = 1.5;
const STUN_TIME = 0.6;
const KNOCK = 14;
const ORB_DRAG = 1.0;
const ORB_MAX = 28;
const DRONE_MAX = 30;
const RESPAWN_DELAY = 1.2;
const GOLD_CHANCE = 0.12;

const CORNERS = [
  [HALF, HALF],
  [HALF, -HALF],
  [-HALF, HALF],
  [-HALF, -HALF],
];
// Goal posts: the two ends of each goal mouth.
const POSTS = GOALS.flatMap((g) => {
  const tx = Math.abs(g.nz);
  const tz = Math.abs(g.nx);
  return [
    [g.x + tx * GOAL_HALF, g.z + tz * GOAL_HALF],
    [g.x - tx * GOAL_HALF, g.z - tz * GOAL_HALF],
  ];
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createWorld(rng = Math.random) {
  return { time: 0, drones: [], orbs: [], respawns: [], nextOrbId: 1, rng };
}

export function freeSlot(world) {
  for (let s = 0; s < 4; s++) if (!world.drones.some((d) => d.slot === s)) return s;
  return -1;
}

function spawnPoint(slot) {
  const g = GOALS[slot];
  return { x: g.x - g.nx * 5, z: g.z - g.nz * 5, a: Math.atan2(-g.nx, -g.nz) };
}

export function addDrone(world, { id, slot = freeSlot(world), bot = false }) {
  const p = spawnPoint(slot);
  const d = { id, slot, bot, x: p.x, z: p.z, vx: 0, vz: 0, a: p.a, input: { mx: 0, mz: 0, dash: false }, dashCd: 0, dashT: 0, stun: 0, brain: {} };
  world.drones.push(d);
  return d;
}

export function removeDrone(world, id) {
  world.drones = world.drones.filter((d) => d.id !== id);
}

export function getDrone(world, id) {
  return world.drones.find((d) => d.id === id);
}

/** New round: drones back in front of their goals, fresh orbs in the middle. */
export function resetRound(world) {
  for (const d of world.drones) {
    Object.assign(d, spawnPoint(d.slot), { vx: 0, vz: 0, dashCd: 0, dashT: 0, stun: 0 });
  }
  world.orbs = [];
  world.respawns = [];
  for (let i = 0; i < ORB_COUNT; i++) spawnOrb(world);
}

function spawnOrb(world) {
  const r = world.rng;
  const ang = r() * Math.PI * 2;
  const dist = r() * 3;
  world.orbs.push({
    id: world.nextOrbId++,
    x: Math.cos(ang) * dist,
    z: Math.sin(ang) * dist,
    vx: Math.cos(ang) * 2,
    vz: Math.sin(ang) * 2,
    gold: r() < GOLD_CHANCE,
  });
}

/** Advance the simulation by dt seconds. Returns events: goal, bump, dash. */
export function step(world, dt) {
  const events = [];
  world.time += dt;

  for (const d of world.drones) {
    d.dashCd = Math.max(0, d.dashCd - dt);
    d.dashT = Math.max(0, d.dashT - dt);
    d.stun = Math.max(0, d.stun - dt);
    let { mx, mz, dash } = d.input;
    const len = Math.hypot(mx, mz);
    if (len > 1) (mx /= len), (mz /= len);
    if (d.stun <= 0) {
      d.vx += mx * ACCEL * dt;
      d.vz += mz * ACCEL * dt;
      if (dash && d.dashCd <= 0) {
        let dx = mx;
        let dz = mz;
        if (Math.hypot(dx, dz) < 0.2) (dx = Math.sin(d.a)), (dz = Math.cos(d.a));
        const l = Math.hypot(dx, dz) || 1;
        d.vx = (dx / l) * DASH_SPEED;
        d.vz = (dz / l) * DASH_SPEED;
        d.dashT = DASH_TIME;
        d.dashCd = DASH_COOLDOWN;
        events.push({ t: "dash", id: d.id, x: d.x, z: d.z });
      }
    }
    const drag = Math.exp(-(d.dashT > 0 ? 1.2 : d.stun > 0 ? 2 : DRAG) * dt);
    d.vx *= drag;
    d.vz *= drag;
    capSpeed(d, DRONE_MAX);
    d.x += d.vx * dt;
    d.z += d.vz * dt;
    if (Math.hypot(d.vx, d.vz) > 1) d.a = Math.atan2(d.vx, d.vz);
  }

  for (const o of world.orbs) {
    const drag = Math.exp(-ORB_DRAG * dt);
    o.vx *= drag;
    o.vz *= drag;
    capSpeed(o, ORB_MAX);
    o.x += o.vx * dt;
    o.z += o.vz * dt;
  }

  // Drone vs drone: bounce, and a dashing drone knocks the other one away.
  const ds = world.drones;
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i];
      const b = ds[j];
      const hit = collide(a, b, DRONE_R * 2, 1, 1, 0.8);
      if (!hit) continue;
      const strong = a.dashT > 0 || b.dashT > 0;
      if (strong) {
        const [att, vic, s] = a.dashT >= b.dashT ? [a, b, 1] : [b, a, -1];
        vic.vx += hit.nx * s * KNOCK;
        vic.vz += hit.nz * s * KNOCK;
        vic.stun = STUN_TIME;
        att.dashT = 0;
      }
      if (hit.speed > 3 || strong) events.push({ t: "bump", x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, strong });
    }
  }

  // Drone vs orb: drones are heavy, orbs fly off them.
  for (const d of world.drones) for (const o of world.orbs) collide(d, o, DRONE_R + ORB_R, 4, 1, 0.7);
  // Orb vs orb.
  const os = world.orbs;
  for (let i = 0; i < os.length; i++) for (let j = i + 1; j < os.length; j++) collide(os[i], os[j], ORB_R * 2, 1, 1, 0.9);

  for (const d of world.drones) {
    walls(d, DRONE_R, 0.4, false);
    capSpeed(d, DRONE_MAX);
  }
  for (const o of world.orbs) walls(o, ORB_R, 0.8, true);

  // Goals: an orb whose centre crosses a goal line scores for that goal's owner.
  world.orbs = world.orbs.filter((o) => {
    const slot = goalCrossed(o);
    if (slot < 0) return true;
    events.push({ t: "goal", slot, value: o.gold ? 3 : 1, x: o.x, z: o.z, gold: o.gold });
    world.respawns.push(world.time + RESPAWN_DELAY);
    return false;
  });
  world.respawns = world.respawns.filter((at) => {
    if (world.time < at) return true;
    spawnOrb(world);
    return false;
  });

  return events;
}

function capSpeed(b, max) {
  const s = Math.hypot(b.vx, b.vz);
  if (s > max) (b.vx *= max / s), (b.vz *= max / s);
}

// Circle vs circle with masses ma, mb and restitution e. Returns the contact or null.
function collide(a, b, minDist, ma, mb, e) {
  let nx = b.x - a.x;
  let nz = b.z - a.z;
  const d = Math.hypot(nx, nz);
  if (d >= minDist) return null;
  if (d < 1e-6) (nx = 1), (nz = 0);
  else (nx /= d), (nz /= d);
  const overlap = minDist - d;
  const wa = mb / (ma + mb);
  const wb = ma / (ma + mb);
  a.x -= nx * overlap * wa;
  a.z -= nz * overlap * wa;
  b.x += nx * overlap * wb;
  b.z += nz * overlap * wb;
  const vrel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (vrel < 0) {
    const j = (-(1 + e) * vrel) / (1 / ma + 1 / mb);
    a.vx -= (j / ma) * nx;
    a.vz -= (j / ma) * nz;
    b.vx += (j / mb) * nx;
    b.vz += (j / mb) * nz;
  }
  return { nx, nz, speed: -vrel };
}

// Static circle (corner bumper or goal post) pushes a body out and reflects its velocity.
function pushOut(b, r, cx, cz, cr, e) {
  let nx = b.x - cx;
  let nz = b.z - cz;
  const d = Math.hypot(nx, nz);
  if (d >= r + cr || d < 1e-6) return;
  nx /= d;
  nz /= d;
  b.x = cx + nx * (r + cr);
  b.z = cz + nz * (r + cr);
  const vn = b.vx * nx + b.vz * nz;
  if (vn < 0) (b.vx -= (1 + e) * vn * nx), (b.vz -= (1 + e) * vn * nz);
}

function walls(b, r, e, isOrb) {
  const lim = HALF - r;
  // Orbs may pass through a goal mouth; drones never leave the arena.
  const inMouthX = isOrb && Math.abs(b.z) < GOAL_HALF - r * 0.5;
  const inMouthZ = isOrb && Math.abs(b.x) < GOAL_HALF - r * 0.5;
  if (!inMouthX && Math.abs(b.x) > lim) {
    b.x = Math.sign(b.x) * lim;
    if (b.vx * Math.sign(b.x) > 0) b.vx = -b.vx * e;
  }
  if (!inMouthZ && Math.abs(b.z) > lim) {
    b.z = Math.sign(b.z) * lim;
    if (b.vz * Math.sign(b.z) > 0) b.vz = -b.vz * e;
  }
  for (const [cx, cz] of CORNERS) pushOut(b, r, cx, cz, CORNER_R, e);
  for (const [px, pz] of POSTS) pushOut(b, r, px, pz, POST_R, e);
  // Never let anything escape far (fast orbs near a post).
  b.x = clamp(b.x, -HALF - 2, HALF + 2);
  b.z = clamp(b.z, -HALF - 2, HALF + 2);
}

function goalCrossed(o) {
  if (o.z > HALF && Math.abs(o.x) < GOAL_HALF) return 0;
  if (o.z < -HALF && Math.abs(o.x) < GOAL_HALF) return 1;
  if (o.x < -HALF && Math.abs(o.z) < GOAL_HALF) return 2;
  if (o.x > HALF && Math.abs(o.z) < GOAL_HALF) return 3;
  return -1;
}

// ---- bots ----------------------------------------------------------------------------------

/**
 * Bot driver. Works on plain positions ({drones:[{id, slot, x, z}], orbs:[{id, x, z}]}), so it can
 * drive a drone in the simulation or a headless test player from a network snapshot.
 * brain is a per-bot object it keeps its memory in. Returns an input {mx, mz, dash}.
 */
export function botInput(view, me, brain, dt, rng = Math.random) {
  brain.t = (brain.t ?? 0) - dt;
  brain.skill ??= 0.7 + rng() * 0.18;
  let orb = view.orbs.find((o) => o.id === brain.target);
  if (!orb || brain.t <= 0) {
    // Prefer orbs that are close to me and not deep in someone else's half.
    let best = null;
    let bestScore = Infinity;
    for (const o of view.orbs) {
      const s = Math.hypot(o.x - me.x, o.z - me.z) + rng() * 4;
      if (s < bestScore) (bestScore = s), (best = o);
    }
    orb = best;
    brain.target = best?.id;
    brain.t = 0.6 + rng() * 0.9;
    brain.err = (rng() - 0.5) * 0.6; // aim error in radians
  }
  const g = GOALS[me.slot];
  if (!orb) return steer(me, g.x * 0.5, g.z * 0.5, brain.skill * 0.6, false);

  // Direction from the orb to my goal, with the bot's aim error.
  let dx = g.x - orb.x;
  let dz = g.z - orb.z;
  const L = Math.hypot(dx, dz) || 1;
  const c = Math.cos(brain.err);
  const s = Math.sin(brain.err);
  [dx, dz] = [(dx / L) * c - (dz / L) * s, (dx / L) * s + (dz / L) * c];

  const back = DRONE_R + ORB_R + 0.4;
  const rel = (me.x - orb.x) * dx + (me.z - orb.z) * dz; // > 0: I'm between the orb and my goal
  let tx;
  let tz;
  if (rel > -0.6) {
    // Wrong side: go around the orb, not through it.
    const px = -dz;
    const pz = dx;
    const side = Math.sign((me.x - orb.x) * px + (me.z - orb.z) * pz) || 1;
    tx = orb.x - dx * 2.6 + px * side * 2.8;
    tz = orb.z - dz * 2.6 + pz * side * 2.8;
  } else {
    const bx = orb.x - dx * back;
    const bz = orb.z - dz * back;
    if (Math.hypot(me.x - bx, me.z - bz) > 1.3) (tx = bx), (tz = bz);
    else (tx = orb.x + dx * 3), (tz = orb.z + dz * 3);
  }
  tx = clamp(tx, -HALF + 1.4, HALF - 1.4);
  tz = clamp(tz, -HALF + 1.4, HALF - 1.4);

  // Now and then, dash into a rival who is close.
  let dash = false;
  for (const o of view.drones) {
    if (o.id === me.id) continue;
    const dd = Math.hypot(o.x - me.x, o.z - me.z);
    if (dd < 4 && rng() < dt * 0.5) {
      dash = true;
      tx = o.x;
      tz = o.z;
    }
  }
  return steer(me, tx, tz, brain.skill, dash);
}

function steer(me, tx, tz, speed, dash) {
  const dx = tx - me.x;
  const dz = tz - me.z;
  const L = Math.hypot(dx, dz);
  if (L < 0.05) return { mx: 0, mz: 0, dash };
  const k = (Math.min(1, L / 1.5) * speed) / L;
  return { mx: dx * k, mz: dz * k, dash };
}
