// Orb Herders on the server. The rules are client/arena.js, the same file the browser runs for
// solo play; here the server owns the world and players only send inputs.
// Implements the room.js game contract from the edgegap-threejs skill (assets/server/game.js).

import * as A from "../client/arena.js";
import { axisIn, ffaResult } from "./util.js";

const r2 = (v) => Math.round(v * 100) / 100;

export function createGame() {
  const world = A.createWorld();
  let events = []; // simulation events since the last snapshot, for client effects

  return {
    name: "orb-herders",
    // Bots fill every empty seat, so 1, 2 or 3 humans always play a 4-drone match.
    config: { tickHz: 60, sendHz: 20, maxPlayers: 4, botFill: 4, matchSeconds: A.MATCH_SECONDS },
    info: () => ({ scoreToWin: A.SCORE_TO_WIN }),

    addPlayer(p) {
      A.addDrone(world, { id: p.id, bot: p.bot });
    },
    removePlayer(p) {
      A.removeDrone(world, p.id);
    },
    input(p, msg) {
      const d = A.getDrone(world, p.id);
      if (d) d.input = { mx: axisIn(msg.mx), mz: axisIn(msg.mz), dash: !!msg.dash };
    },
    start() {
      A.resetRound(world);
      events = [];
    },
    reset() {
      A.resetRound(world);
    },

    update(dt, room) {
      for (const d of world.drones) if (d.bot) d.input = A.botInput(world, d, d.brain, dt);
      for (const e of A.step(world, dt)) {
        if (e.t === "goal") {
          const owner = world.drones.find((d) => d.slot === e.slot);
          const p = owner && room.players.get(owner.id);
          if (p) p.score += e.value;
        }
        events.push({ ...e, x: r2(e.x), z: r2(e.z) });
      }
    },

    result(room) {
      return [...room.players.values()].some((p) => p.score >= A.SCORE_TO_WIN) ? ffaResult(room) : null;
    },
    timeUp: (room) => ffaResult(room),

    snapshot() {
      const s = {
        d: world.drones.map((d) => ({ id: d.id, slot: d.slot, x: r2(d.x), z: r2(d.z), a: r2(d.a), dash: d.dashT > 0, stun: d.stun > 0 })),
        o: world.orbs.map((o) => ({ id: o.id, x: r2(o.x), z: r2(o.z), gold: o.gold })),
        ev: events,
      };
      events = [];
      return s;
    },
  };
}
