#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Meeting Agent 서버 재시작 ==="

# 기존 서버 정지
echo "--- 기존 서버 정지 ---"
"$SCRIPT_DIR/stop.sh"
echo ""

MODE="${1:-dev}"

if [ "$MODE" = "prod" ]; then
  echo "--- Production 빌드 ---"
  cd "$SCRIPT_DIR/backend"
  npm run build:all
  echo ""

  echo "--- Production 서버 시작 (포트 3000) ---"
  npm run start > "$SCRIPT_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "[Server] 시작됨 (PID: $BACKEND_PID)"
  echo "[Server] 로그: $SCRIPT_DIR/backend.log"
  echo ""
  echo "=== Production 서버 시작 완료 ==="
  echo "URL: http://localhost:3000"
else
  # Backend 시작
  echo "--- Backend 시작 (포트 3000) ---"
  cd "$SCRIPT_DIR/backend"
  npm run dev > "$SCRIPT_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "[Backend] 시작됨 (PID: $BACKEND_PID)"
  echo "[Backend] 로그: $SCRIPT_DIR/backend.log"

  # Frontend 시작 (Vite + Proxy)
  echo "--- Frontend 시작 (Vite + Proxy) ---"
  cd "$SCRIPT_DIR/frontend"
  npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "[Frontend] 시작됨 (PID: $FRONTEND_PID)"
  echo "[Frontend] 로그: $SCRIPT_DIR/frontend.log"
  echo ""
  echo "=== Dev 서버 시작 완료 ==="
  echo "Frontend: http://localhost:5173  (API proxy -> :3000)"
  echo "Backend:  http://localhost:3000"
fi
echo ""
echo "로그 확인: tail -f $SCRIPT_DIR/backend.log $SCRIPT_DIR/frontend.log"
