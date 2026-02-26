#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Meeting Agent 서버 정지 ==="

# Backend 정지 (포트 3000)
BACKEND_PIDS=$(lsof -ti :3000 2>/dev/null)
if [ -n "$BACKEND_PIDS" ]; then
  echo "[Backend] 프로세스 종료 중... (PID: $BACKEND_PIDS)"
  echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null
  echo "[Backend] 종료 완료"
else
  echo "[Backend] 실행 중인 프로세스 없음"
fi

# Frontend 정지 (포트 5173, 5174) - dev 모드 전용
FRONTEND_PIDS=$(lsof -ti :5173 -ti :5174 2>/dev/null | sort -u)
if [ -n "$FRONTEND_PIDS" ]; then
  echo "[Frontend] 프로세스 종료 중... (PID: $FRONTEND_PIDS)"
  echo "$FRONTEND_PIDS" | xargs kill -9 2>/dev/null
  echo "[Frontend] 종료 완료"
else
  echo "[Frontend] 실행 중인 프로세스 없음 (production 모드에서는 정상)"
fi

echo "=== 서버 정지 완료 ==="
