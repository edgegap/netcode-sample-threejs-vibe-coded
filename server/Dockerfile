# Orb Herders game server image (linux/amd64). Build from the repo root:
#   docker build --platform linux/amd64 -f server/Dockerfile -t registry.edgegap.com/<project>/orb-herders:<tag> .
#   docker run --rm -p 7777:7777 registry.edgegap.com/<project>/orb-herders:<tag>
# From the edgegap-threejs skill (assets/server/Dockerfile), plus client/arena.js: the server runs
# the same rules file as the browser's solo mode.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=7777
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Only the server and the shared rules go into the image: the browser client is served elsewhere.
COPY server ./server
COPY client/arena.js ./client/arena.js
# Internal port. The Edgegap app version maps it as "gameport", protocol WS, TLS Upgrade on.
EXPOSE 7777/tcp
USER node
# Node is PID 1, so it receives Edgegap's SIGTERM directly (no shell wrapper).
CMD ["node", "server/main.js"]
