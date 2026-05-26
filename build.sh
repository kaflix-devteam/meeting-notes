#!/bin/bash

set -e

IMAGE_NAME="meeting-notes"
CLUSTER_NAME="dev-cluster"
VERSION=$(date +%Y%m%d%H%M%S)
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
K8S_FILE="$SCRIPT_DIR/k8s/meeting-notes.yaml"

echo "=== Agent Meeting K8s Build Script ==="

# 이전 로컬 이미지 정리 (최근 3개 유지)
echo "이전 로컬 이미지 정리 중..."
docker images $IMAGE_NAME --format "{{.Tag}}" | tail -n +4 | xargs -r -I {} docker rmi $IMAGE_NAME:{} 2>/dev/null || true

# 새 이미지 빌드
echo "새 이미지 빌드 중..."
docker build --no-cache -t $IMAGE_NAME:$VERSION .

# k3d 클러스터로 이미지 import
echo "k3d 클러스터로 이미지 import 중..."
k3d image import $IMAGE_NAME:$VERSION -c $CLUSTER_NAME

# 기존 deployment 존재 여부 확인
if kubectl get deployment/$IMAGE_NAME >/dev/null 2>&1; then
    echo "쿠버네티스 deployment 업데이트 중..."
    kubectl set image deployment/$IMAGE_NAME $IMAGE_NAME=$IMAGE_NAME:$VERSION
else
    echo "최초 배포: k8s 매니페스트 적용 중..."
    kubectl apply -f "$K8S_FILE"
    kubectl set image deployment/$IMAGE_NAME $IMAGE_NAME=$IMAGE_NAME:$VERSION
fi

# Pod 상태 확인
echo "Pod 재시작 대기 중..."
kubectl rollout status deployment/$IMAGE_NAME

echo "=== 완료! ==="
kubectl get pods -l app=$IMAGE_NAME

echo ""
echo "내부 접속: curl -H 'Host: meeting-notes.localhost' http://localhost:8080"
echo "외부 접속: https://meeting.kaflix.com"
