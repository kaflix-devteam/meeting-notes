import static java.util.UUID.randomUUID
def uuid = randomUUID() as String
def myid = uuid.take(8)
def myModuleName = "meeting-notes"
def profile = "prod"

pipeline {
  environment {
    APP_VER = "v1.0.${BUILD_ID}"
    REGISTRY = "172.10.65.80:5000"
    IMAGE_APP = "${REGISTRY}/kaflix/meeting-notes"
    IMAGE_TAG = "v1.0.${BUILD_ID}-${profile}"
    K8S_NAMESPACE = "ai-platform"
    APP_NAME = "meeting-notes"
  }

  agent {
    kubernetes {
      label "${myModuleName}-${myid}"
      instanceCap 1
      defaultContainer 'jnlp'
      yaml """
        apiVersion: v1
        kind: Pod
        metadata:
          name: build-env
        spec:
          nodeSelector:
            jenkins: "true"
          serviceAccountName: default
          imagePullSecrets:
            - name: config-json
          containers:
          - name: kubectl
            image: bitnami/kubectl:latest
            command:
              - "/bin/sh"
              - "-c"
              - "sleep 99d"
            tty: true
            securityContext:
              runAsUser: 0
          - name: node
            image: node:20-alpine
            command:
            - cat
            tty: true
          - name: kaniko
            image: gcr.io/kaniko-project/executor:debug
            imagePullPolicy: Always
            command:
            - sleep
            args:
            - 99d
            volumeMounts:
              - name: docker-config
                mountPath: /kaniko/.docker
          - name: busybox
            image: busybox:latest
            command: ['sleep']
            args:
              - infinity
          volumes:
            - name: docker-config
              secret:
                secretName: config-json
                items:
                  - key: .dockerconfigjson
                    path: config.json
        """
    }
  }

  stages {
    stage('Prepared') {
      steps {
        script {
          wrap([$class: 'BuildUser']) {
            env.TRIGGERED_USER_ID = env.BUILD_USER_ID ?: 'System'
            env.TRIGGERED_USER_NAME = env.BUILD_USER ?: 'Unknown'
            echo "빌드 시작: ${env.TRIGGERED_USER_NAME} (${env.TRIGGERED_USER_ID})"
          }
        }
        container('node') {
          git branch: 'main',
            credentialsId: 'github-kaflix',
            url: 'git@github.com:kaflix-devteam/meeting-notes.git'
        }
      }
    }

    stage('Build Verification') {
      steps {
        container('node') {
          sh """
            echo "=== Node 빌드 검증 ==="
            node --version
            npm --version
            cd frontend && npm install --no-audit --no-fund && cd ..
            cd backend && npm install --no-audit --no-fund && cd ..
            cd frontend && npm run build && cd ..
            cd backend && npm run build && cd ..
            echo "Build 완료"
          """
        }
      }
    }

    stage('Containerize') {
      steps {
        container('kaniko') {
          sh """
            echo "=== 이미지 빌드: ${IMAGE_APP}:${IMAGE_TAG} ==="
            /kaniko/executor \
              --dockerfile=Dockerfile \
              --context=\$(pwd) \
              --insecure \
              --skip-tls-verify \
              --destination=${IMAGE_APP}:${IMAGE_TAG}
          """
        }
      }
    }

    stage('Deploy Application') {
      steps {
        container('kubectl') {
          sh """
            echo "=== 이미지 태그 업데이트 ==="
            sed -i "s|image: meeting-notes:.*|image: ${IMAGE_APP}:${IMAGE_TAG}|" k8s/meeting-notes.yaml
            sed -i "s|imagePullPolicy: Never|imagePullPolicy: Always|" k8s/meeting-notes.yaml
            cat k8s/meeting-notes.yaml

            echo "=== K8s 매니페스트 배포 ==="
            kubectl apply -n ${K8S_NAMESPACE} -f k8s/meeting-notes.yaml
          """
        }
      }
    }

    stage('Verify Deployment') {
      steps {
        container('kubectl') {
          sh """
            echo "=== 배포 상태 확인 ==="
            kubectl rollout status deployment/${APP_NAME} -n ${K8S_NAMESPACE} --timeout=180s

            echo ""
            echo "=== Pod 상태 ==="
            kubectl get pods -n ${K8S_NAMESPACE} -l app=${APP_NAME} -o wide

            echo ""
            echo "=== Service 상태 ==="
            kubectl get svc -n ${K8S_NAMESPACE} ${APP_NAME}

            echo ""
            echo "=== Ingress 상태 ==="
            kubectl get ingress -n ${K8S_NAMESPACE} ${APP_NAME}-ingress
          """
          sh(script: "kubectl logs -n ${K8S_NAMESPACE} -l app=${APP_NAME} --tail=15 2>&1 || true", returnStatus: true)
        }
      }
    }
  }

  post {
    success {
      echo """
        ========================================
        Agent Meeting 배포 완료
        ----------------------------------------
        Image     : ${IMAGE_APP}:${IMAGE_TAG}
        Namespace : ${K8S_NAMESPACE}
        빌드 유저 : ${env.TRIGGERED_USER_NAME}
        ========================================
      """
    }
    failure {
      echo """
        ========================================
        Agent Meeting 배포 실패
        ----------------------------------------
        빌드 번호 : ${BUILD_ID}
        프로필    : ${profile}
        ========================================
      """
    }
  }
}
