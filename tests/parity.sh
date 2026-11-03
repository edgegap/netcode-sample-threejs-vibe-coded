#!/usr/bin/env bash
# Local parity test from the edgegap-local-testing skill: run the server image the way Edgegap
# does before spending money on a deployment.
#   1. boots on linux/amd64 with Edgegap-style env vars, time to READY
#   2. random external port: players connect to 31504, the container listens on 7777
#   3. a full match with two headless players
#   4. two servers on one host
#   5. no secrets in the logs
#   6. SIGTERM drain: exits before docker's SIGKILL
#   7. self-stop path: "on Edgegap" without a delete URL, nobody joins -> the process exits
# Usage: bash tests/parity.sh [image]   (default: builds orb-herders:dev)
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${1:-orb-herders:dev}"
if [ -z "${1:-}" ]; then docker build --quiet --platform linux/amd64 -f server/Dockerfile -t "$IMAGE" . >/dev/null; fi
fail() { echo "FAIL: $*"; docker rm -f orb-a orb-b orb-c >/dev/null 2>&1 || true; exit 1; }
docker rm -f orb-a orb-b orb-c >/dev/null 2>&1 || true

timers=(-e WAIT_SECONDS=2 -e COUNTDOWN_SECONDS=1 -e RESULTS_SECONDS=2 -e MATCH_SECONDS=30)
edgegap_ports=(-e ARBITRIUM_PORT_GAMEPORT_INTERNAL=7777 -e ARBITRIUM_PORT_GAMEPORT_EXTERNAL=31504 -e ARBITRIUM_PORT_GAMEPORT_PROTOCOL=WS)

echo "1. boot"
t0=$(date +%s%N)
docker run -d --rm --name orb-a --platform linux/amd64 "${edgegap_ports[@]}" "${timers[@]}" -p 31504:7777/tcp "$IMAGE" >/dev/null
for _ in $(seq 1 100); do docker logs orb-a 2>&1 | grep -q "listening on :7777" && break; sleep 0.1; done
docker logs orb-a 2>&1 | grep -q "listening on :7777" || fail "no READY line"
echo "   READY after $(( ($(date +%s%N) - t0) / 1000000 )) ms"

echo "2+3. full match through the random external port (31504 -> 7777)"
SERVER_URL=ws://127.0.0.1:31504 node tests/local-match.mjs || fail "match on the mapped port"

echo "4. a second server on the same host"
docker run -d --rm --name orb-b --platform linux/amd64 -p 31505:7777/tcp "$IMAGE" >/dev/null
sleep 2
curl -sf http://127.0.0.1:31504/ >/dev/null || fail "server A stopped answering"
curl -sf http://127.0.0.1:31505/ >/dev/null || fail "server B does not answer"
echo "   both answer"
docker stats --no-stream --format "   {{.Name}}: CPU {{.CPUPerc}}, memory {{.MemUsage}}" orb-a orb-b

echo "5. logs"
if docker logs orb-a 2>&1 | grep -iE "token|secret|password|ARBITRIUM_DELETE"; then fail "secret-looking line in the logs"; fi
echo "   nothing secret"

echo "6. SIGTERM drain"
docker stop --time 5 orb-b >/dev/null &
docker logs -f orb-a >/tmp/orb-a.log 2>&1 &
s0=$(date +%s)
docker stop --time 5 orb-a >/dev/null
took=$(( $(date +%s) - s0 ))
grep -q "SIGTERM: closing" /tmp/orb-a.log || fail "SIGTERM handler did not run"
[ "$took" -lt 5 ] || fail "took ${took}s: killed instead of exiting"
echo "   exited ${took}s after SIGTERM"
wait

echo "7. self-stop when nobody joins (simulated Edgegap, no delete URL)"
docker run -d --name orb-c --platform linux/amd64 -e ARBITRIUM_REQUEST_ID=local-parity -e FIRST_JOIN_TIMEOUT_S=4 "$IMAGE" >/dev/null
code=$(timeout 30 docker wait orb-c) || fail "server did not stop itself"
docker logs orb-c 2>&1 | grep -q "self-stop: nobody joined" || fail "no self-stop line"
docker rm orb-c >/dev/null
echo "   stopped itself, exit code $code"

echo "PASS"
