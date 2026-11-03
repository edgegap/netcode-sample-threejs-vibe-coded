// Orb Herders: menu, HUD and the solo match against bots.

import { createRenderer } from "./render.js";
import { createInput } from "./input.js";
import { sfx, unlockAudio } from "./audio.js";
import * as A from "./arena.js";

const $ = (id) => document.getElementById(id);
const ui = {
  menu: $("menu"),
  hud: $("hud"),
  name: $("name"),
  solo: $("solo"),
  status: $("status"),
  board: $("board"),
  banner: $("banner"),
  big: $("big"),
  quit: $("quit"),
  bots: [...document.querySelectorAll("[data-bots]")],
};

const renderer = createRenderer();
const input = createInput();
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
const BOT_NAMES = ["Bolt", "Pixel", "Nova", "Rusty", "Zed", "Mochi", "Turbo", "Echo"];
const COUNTDOWN = 3;
const RESULTS = 5;

ui.name.value = localStorage.getItem("orb-name") || `Pilot${Math.floor(Math.random() * 900 + 100)}`;
let botCount = Number(localStorage.getItem("orb-bots") || 3);
const showBots = () => ui.bots.forEach((b) => b.classList.toggle("on", Number(b.dataset.bots) === botCount));
ui.bots.forEach((b) => (b.onclick = () => ((botCount = Number(b.dataset.bots)), localStorage.setItem("orb-bots", botCount), showBots())));
showBots();

// ---- HUD (shared shape: {phase, timer, players:[{id, name, score, slot}], result}) ------------

function renderHud(state, myId) {
  const players = [...state.players].sort((a, b) => b.score - a.score);
  ui.board.replaceChildren(
    ...players.map((p) => {
      const li = document.createElement("li");
      li.className = p.id === myId ? "me" : "";
      li.style.setProperty("--c", hex(A.SLOT_COLORS[p.slot] ?? 0xffffff));
      li.innerHTML = `<span></span><b></b>`;
      li.firstChild.textContent = p.name;
      li.lastChild.textContent = p.score;
      return li;
    })
  );
  const t = state.timer;
  const mmss = t == null ? "" : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  if (state.phase === "waiting") {
    ui.banner.textContent = state.waitingFor > 0 ? `Waiting for ${state.waitingFor} more player(s)...` : "Waiting for players...";
    ui.big.textContent = "";
  } else if (state.phase === "countdown") {
    ui.banner.textContent = "Get ready";
    ui.big.textContent = t > 0 ? t : "GO!";
  } else if (state.phase === "playing") {
    ui.banner.textContent = `${mmss}  ·  first to ${A.SCORE_TO_WIN}`;
    ui.big.textContent = "";
  } else if (state.phase === "over") {
    ui.banner.textContent = t != null ? `Back to menu in ${t}s` : "";
    ui.big.textContent = state.result?.winner ?? "Match over";
  }
}

let beepKey = null;
function countdownBeep(state) {
  const key = state.phase === "countdown" ? `c${state.timer}` : state.phase;
  if (key === beepKey) return;
  beepKey = key;
  if (state.phase === "countdown" && state.timer > 0) sfx.beep(false);
  else if (state.phase === "playing") sfx.beep(true);
}

/** Effects for simulation events (goal, bump, dash), solo or online. */
function playEvents(events, mySlot, myId) {
  for (const e of events) {
    if (e.t === "goal") {
      const g = A.GOALS[e.slot];
      renderer.burst(g.x, g.z, A.SLOT_COLORS[e.slot], e.gold ? 60 : 30, e.gold ? 14 : 10);
      renderer.shake(e.slot === mySlot ? 0.8 : 0.3);
      sfx.goal(e.slot === mySlot);
    } else if (e.t === "bump" && e.strong) {
      renderer.burst(e.x, e.z, 0xffffff, 10, 6);
      renderer.shake(0.4);
      sfx.bump(true);
    } else if (e.t === "dash" && e.id === myId) sfx.dash();
  }
}

function showMenu(message = "") {
  ui.menu.hidden = false;
  ui.hud.hidden = true;
  ui.status.textContent = message;
  input.show(false);
}

function showHud() {
  ui.menu.hidden = true;
  ui.hud.hidden = false;
  input.show(true);
}

// ---- solo match against bots -----------------------------------------------------------------

let solo = null;

function startSolo() {
  unlockAudio();
  localStorage.setItem("orb-name", ui.name.value);
  const world = A.createWorld();
  const names = { 1: ui.name.value.trim().slice(0, 16) || "You" };
  A.addDrone(world, { id: 1, slot: 0 });
  for (let i = 0; i < botCount; i++) {
    A.addDrone(world, { id: i + 2, bot: true });
    names[i + 2] = `${BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0]} (bot)`;
  }
  A.resetRound(world);
  solo = { world, names, scores: {}, phase: "countdown", ends: performance.now() + COUNTDOWN * 1000, acc: 0, result: null };
  for (const d of world.drones) solo.scores[d.id] = 0;
  renderer.clear();
  renderer.setSlot(0);
  showHud();
}

function soloState() {
  const { world, names, scores, phase, ends, result } = solo;
  return {
    phase,
    timer: Math.max(0, Math.ceil((ends - performance.now()) / 1000)),
    players: world.drones.map((d) => ({ id: d.id, name: names[d.id], score: scores[d.id], slot: d.slot })),
    result,
  };
}

function finishSolo() {
  const ranking = solo.world.drones.map((d) => ({ id: d.id, name: solo.names[d.id], score: solo.scores[d.id] })).sort((a, b) => b.score - a.score);
  const tie = ranking[1] && ranking[1].score === ranking[0].score;
  solo.result = { winner: tie ? "Draw!" : ranking[0].id === 1 ? "You win!" : `${ranking[0].name} wins`, ranking };
  solo.phase = "over";
  solo.ends = performance.now() + RESULTS * 1000;
}

function soloFrame(dt) {
  const now = performance.now();
  const { world } = solo;
  if (solo.phase === "countdown" && now >= solo.ends) {
    solo.phase = "playing";
    solo.ends = now + A.MATCH_SECONDS * 1000;
  }
  if (solo.phase === "playing") {
    const STEP = 1 / 60;
    solo.acc += dt;
    while (solo.acc >= STEP) {
      solo.acc -= STEP;
      for (const d of world.drones) {
        if (d.bot) d.input = A.botInput(world, d, d.brain, STEP);
        else {
          const { sx, sy, dash } = input.read();
          d.input = { ...renderer.toWorld(sx, sy), dash };
        }
      }
      const events = A.step(world, STEP);
      for (const e of events) if (e.t === "goal") solo.scores[world.drones.find((d) => d.slot === e.slot).id] += e.value;
      playEvents(events, 0, 1);
    }
    const top = Math.max(...Object.values(solo.scores));
    if (top >= A.SCORE_TO_WIN || now >= solo.ends) finishSolo();
  }
  if (solo.phase === "over" && now >= solo.ends) {
    solo = null;
    renderer.clear();
    showMenu("Play again?");
    return;
  }
  const state = soloState();
  renderHud(state, 1);
  countdownBeep(state);
  renderer.sync(
    {
      drones: world.drones.map((d) => ({ id: d.id, slot: d.slot, x: d.x, z: d.z, a: d.a, dash: d.dashT > 0, stun: d.stun > 0, name: solo.names[d.id] })),
      orbs: world.orbs,
    },
    dt
  );
}

ui.solo.onclick = startSolo;
ui.quit.onclick = () => {
  solo = null;
  renderer.clear();
  showMenu();
};

// ---- main loop -------------------------------------------------------------------------------

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (solo) soloFrame(dt);
  renderer.frame(dt);
  requestAnimationFrame(loop);
}
showMenu();
requestAnimationFrame(loop);
// For browser automation: read the state, or advance frames when the tab is hidden (no requestAnimationFrame).
window.__game = { get phase() { return solo?.phase ?? "menu"; }, get solo() { return solo; }, tick: (dt) => solo && soloFrame(dt) };
