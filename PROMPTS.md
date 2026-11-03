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
