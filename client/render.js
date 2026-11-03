// Three.js scene for Orb Herders: arena, drones, orbs and effects, all built in code.
// The renderer only draws a "view" ({drones, orbs}); it never decides anything about the game.

import * as THREE from "three";
import { HALF, GOAL_HALF, GOALS, CORNER_R, POST_R, ORB_R, SLOT_COLORS } from "./arena.js";

const glowTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  s.scale.set(size, size, 1);
  return s;
}

function label(text, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.font = "bold 30px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 6;
  g.strokeStyle = "rgba(0,0,0,.75)";
  g.strokeText(text, 128, 32);
  g.fillStyle = color;
  g.fillText(text, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(4, 1, 1);
  s.renderOrder = 10;
  return s;
}

const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;

function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 8, HALF * 2 + 8),
    new THREE.MeshStandardMaterial({ color: 0x0c1020, roughness: 0.9, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(HALF * 2, 18, 0x23305a, 0x172040);
  grid.position.y = 0.01;
  scene.add(grid);

  // Walls with gaps for the four goals.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2440, roughness: 0.6, metalness: 0.3 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x5d7bff });
  const segLen = HALF - GOAL_HALF;
  for (const g of GOALS) {
    const along = Math.abs(g.nz) > 0 ? "x" : "z";
    for (const sign of [-1, 1]) {
      const mid = sign * (GOAL_HALF + segLen / 2);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(along === "x" ? segLen : 0.6, 1.2, along === "x" ? 0.6 : segLen), wallMat);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(along === "x" ? segLen : 0.62, 0.08, along === "x" ? 0.62 : segLen), edgeMat);
      const x = along === "x" ? mid : g.x + g.nx * 0.3;
      const z = along === "x" ? g.z + g.nz * 0.3 : mid;
      wall.position.set(x, 0.6, z);
      edge.position.set(x, 1.22, z);
      scene.add(wall, edge);
    }
  }
  // Corner bumpers.
  for (const [x, z] of [
    [HALF, HALF],
    [HALF, -HALF],
    [-HALF, HALF],
    [-HALF, -HALF],
  ]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(CORNER_R, CORNER_R, 1.4, 32), wallMat);
    c.position.set(x, 0.7, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(CORNER_R, 0.06, 6, 48), edgeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 1.42, z);
    scene.add(c, ring);
  }
  // Goals: glowing posts, a coloured mouth and a pad behind the line.
  GOALS.forEach((g, slot) => {
    const color = SLOT_COLORS[slot];
    const tx = Math.abs(g.nz);
    const tz = Math.abs(g.nx);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(POST_R, POST_R, 2, 16),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 })
      );
      post.position.set(g.x + tx * GOAL_HALF * s, 1, g.z + tz * GOAL_HALF * s);
      scene.add(post);
    }
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(tx ? GOAL_HALF * 2 : 3, tz ? GOAL_HALF * 2 : 3),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(g.x + g.nx * 1.5, 0.02, g.z + g.nz * 1.5);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(tx ? GOAL_HALF * 2 : 0.2, tz ? GOAL_HALF * 2 : 0.2), new THREE.MeshBasicMaterial({ color }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(g.x, 0.03, g.z);
    const halo = glow(color, 12, 0.35);
    halo.position.set(g.x + g.nx * 1.5, 0.5, g.z + g.nz * 1.5);
    scene.add(pad, line, halo);
  });
}

function makeDrone(slot, name) {
  const color = SLOT_COLORS[slot];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(1.3);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.9, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a3150, metalness: 0.6, roughness: 0.35 })
  );
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 })
  );
  dome.position.y = 0.17;
  // A small nose so you can see which way the drone faces.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 0.95);
  body.add(shell, dome, nose);
  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.8), shell.material);
    arm.position.set(Math.sin(ang) * 0.75, 0.05, Math.cos(ang) * 0.75);
    arm.rotation.y = ang;
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.03, 20),
      new THREE.MeshBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 0.35 })
    );
    rotor.position.set(Math.sin(ang) * 1.05, 0.18, Math.cos(ang) * 1.05);
    body.add(arm, rotor);
    rotors.push(rotor);
  }
  const under = glow(color, 4.2, 0.8);
  under.position.y = -0.55;
  root.add(under);
  const tag = label(name, hex(color));
  tag.position.y = 2.1;
  root.add(tag);
  root.userData = { body, rotors, under, phase: Math.random() * 10 };
  return root;
}

function makeOrb(gold) {
  const color = gold ? 0xffd34d : 0xbff6ff;
  const root = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(ORB_R, 24, 16),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.2 })
  );
  root.add(core, glow(color, gold ? 5 : 4, 0.9));
  root.userData = { phase: Math.random() * 10 };
  return root;
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a14);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x1a1030, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(10, 30, 8);
  scene.add(sun);
  buildArena(scene);

  const drones = new Map();
  const orbs = new Map();
  const particles = [];
  let yaw = 0;
  let shake = 0;
  let time = 0;

  function placeCamera() {
    // Fit the whole arena on screen, portrait phones included.
    const aspect = innerWidth / innerHeight;
    const span = HALF + 3;
    const vfov = (camera.fov * Math.PI) / 180;
    const distV = span / Math.tan(vfov / 2);
    const distH = span / (Math.tan(vfov / 2) * aspect);
    const dist = Math.max(distV, distH) * 1.04;
    const tilt = 0.32; // radians away from straight down
    const sx = Math.sin(yaw);
    const sz = Math.cos(yaw);
    camera.position.set(sx * Math.sin(tilt) * dist + (Math.random() - 0.5) * shake, Math.cos(tilt) * dist, sz * Math.sin(tilt) * dist);
    camera.lookAt(0, 0, 0);
  }

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  function syncMap(map, list, make, update) {
    const seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      let obj = map.get(e.id);
      const fresh = !obj;
      if (fresh) {
        obj = make(e);
        map.set(e.id, obj);
        scene.add(obj);
      }
      update(obj, e, fresh);
    }
    for (const [id, obj] of map)
      if (!seen.has(id)) {
        scene.remove(obj);
        map.delete(id);
      }
  }

  return {
    /** Rotate the view so the given slot's goal is at the bottom of the screen. */
    setSlot(slot) {
      const g = GOALS[slot] ?? GOALS[0];
      yaw = Math.atan2(g.nx, g.nz);
    },
    /** Screen axes (right, up) to world (x, z) for the current camera. */
    toWorld(sx, sy) {
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      return { mx: rx * sx + fx * sy, mz: rz * sx + fz * sy };
    },
    /** Draw a view. ease = 0 snaps to it; > 0 eases toward it (network snapshots). */
    sync(view, dt, ease = 0) {
      const k = ease ? 1 - Math.exp(-ease * dt) : 1;
      const move = (obj, e, fresh) => {
        const far = Math.hypot(obj.position.x - e.x, obj.position.z - e.z) > 6;
        if (fresh || far || k === 1) obj.position.set(e.x, obj.position.y, e.z);
        else {
          obj.position.x += (e.x - obj.position.x) * k;
          obj.position.z += (e.z - obj.position.z) * k;
        }
      };
      syncMap(
        drones,
        view.drones,
        (e) => makeDrone(e.slot, e.name ?? ""),
        (obj, e, fresh) => {
          move(obj, e, fresh);
          const u = obj.userData;
          let d = e.a - u.body.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          u.body.rotation.y += d * (fresh ? 1 : Math.min(1, dt * 12));
          u.dash = e.dash;
          u.stun = e.stun;
        }
      );
      syncMap(orbs, view.orbs, (e) => makeOrb(e.gold), move);
    },
    burst(x, z, color, count = 24, speed = 9) {
      for (let i = 0; i < count; i++) {
        const s = glow(color, 0.9, 1);
        const ang = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.8);
        s.position.set(x, 0.6, z);
        s.userData = { vx: Math.cos(ang) * v, vy: 3 + Math.random() * 5, vz: Math.sin(ang) * v, life: 0.7 + Math.random() * 0.4 };
        scene.add(s);
        particles.push(s);
      }
    },
    shake(amount) {
      shake = Math.max(shake, amount);
    },
    clear() {
      for (const o of [...drones.values(), ...orbs.values(), ...particles]) scene.remove(o);
      drones.clear();
      orbs.clear();
      particles.length = 0;
    },
    frame(dt) {
      time += dt;
      for (const obj of drones.values()) {
        const u = obj.userData;
        obj.position.y = 0.9 + Math.sin(time * 3 + u.phase) * 0.12;
        u.body.rotation.z = u.stun ? Math.sin(time * 40) * 0.35 : 0;
        for (const r of u.rotors) r.rotation.y += dt * 30;
        const s = u.dash ? 7 : 4.2;
        u.under.scale.x += (s - u.under.scale.x) * Math.min(1, dt * 10);
        u.under.scale.y = u.under.scale.x;
      }
      for (const obj of orbs.values()) obj.position.y = ORB_R + 0.1 + Math.sin(time * 4 + obj.userData.phase) * 0.08;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const u = p.userData;
        u.life -= dt;
        u.vy -= 14 * dt;
        p.position.x += u.vx * dt;
        p.position.y = Math.max(0.1, p.position.y + u.vy * dt);
        p.position.z += u.vz * dt;
        p.material.opacity = Math.max(0, u.life * 1.4);
        if (u.life <= 0) {
          scene.remove(p);
          particles.splice(i, 1);
        }
      }
      shake = Math.max(0, shake - dt * 2.5);
      placeCamera();
      renderer.render(scene, camera);
    },
  };
}
