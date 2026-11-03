# Prompts

Everything in this repo was written by an AI agent (Claude Code, model Claude Opus 5.5) with the Edgegap MCP server connected. This file lists the prompts in order.

There are two kinds of entries:

- **Given**: what the developer actually typed.
- **Recommended**: the short prompt a vibe coder would type to get the same step. The work happened in the same session, driven by the brief, and the agent wrote down the prompt that matches each change so you can replay it on your own game.

## Phase 1: the single-player game (tag `before`)

### 1. Given: the brief

The developer pasted a one-page brief: build an original, mobile-friendly Three.js arena game against bots as a vibe coder would, tag it `before`, then make it online multiplayer on Edgegap by following the `edgegap-threejs` skill, tag that `after`. Default concept from the brief: "top-down hover-drone arena, where players push glowing orbs into their own goal while bumping opponents away."

### 2. Recommended: start the game

> Make a small 3D browser game with Three.js, plain HTML and JS, no build step, Three.js from a CDN. Top-down arena with hover drones. Glowing orbs spawn in the middle and you push them into your own goal to score. You can dash into other drones to knock them away. Me against 3 bots. It has to work on my phone and on desktop. Make all the 3D models in code.

### 3. Recommended: tune the bots and the match length

> The bots dash way too much and they're a bit too good. Calm them down. Make a match first to 15 points, or whoever has the most after 3 minutes. Gold orbs should be rare and worth 3.

### 4. Recommended: phone fixes

> On my phone the arena is really dark and the drones are tiny. Fix that, and add a thumb-stick on the left and a big DASH button on the right.

### 5. Recommended: pick the number of bots

> Let me pick 1, 2 or 3 bots before the match.

## Phase 2: online multiplayer on Edgegap (tag `after`)

### 6. Recommended: the one prompt that starts the multiplayer work

> Make this game online multiplayer on Edgegap. Use the Edgegap MCP and its edgegap-threejs skill. Keep the solo mode, add a Find Match button, 2 to 4 players per match, bots fill empty seats. Ask me before you create anything in my Edgegap account.

What the agent did with it, in order:

1. Loaded the skills through the MCP: `edgegap_list_skills`, then `edgegap_get_skill` for `edgegap-threejs`, `edgegap-server-design` and `edgegap-local-testing`, and the templates and references as each step needed them.
2. Copied the skill's server templates (`main.js`, `room.js`, `edgegap.js`, `util.js`, Dockerfile) and wrote `server/game.js` on top of the same `client/arena.js` rules the solo mode runs.
3. Added Find Match to the page with the Edgegap JS SDK (`client/online.js`, `client/net.js` from the skill).
4. Tested without Edgegap: `tests/local-match.mjs` (two headless players, full match) and `tests/parity.sh` (the container with Edgegap-style env vars, random external port, SIGTERM, self-stop).
5. Asked before touching the account, then pushed the image, created the app and version, ran one tagged direct deployment and watched it stop itself.

### 7. Given: approvals and account steps

> Yes, go ahead

The developer then added the registry login to the app version in the dashboard, set the two registry secrets on the GitHub repo, created the matchmaker from `matchmaker/arena.json` and pasted its API URL and Auth Token. Those are the only steps the agent could not do: the Edgegap API does not hand registry credentials to an API token, and matchmakers are created in the dashboard.

### 8. Recommended: prove it

> Run the end-to-end test through the matchmaker, then try Find Match from two browser tabs. Make sure nothing is left running.

### 9. Recommended: ship it

> Put the client on GitHub Pages, build and push the server image from GitHub Actions on every push to main, and write a short README for someone who vibe-coded their own game.
