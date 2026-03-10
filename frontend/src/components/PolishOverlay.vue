<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps<{
  visible: boolean
  mode?: 'polish' | 'merge'
}>()

const polishSteps = [
  { label: '교정 전문가가 맞춤법을 검토하고 있습니다...', threshold: 33 },
  { label: '구조화 전문가가 문장 흐름을 다듬고 있습니다...', threshold: 66 },
  { label: '문체 전문가가 최종 검수 중입니다...', threshold: 99 },
]

const mergeSteps = [
  { label: '개별 보고서를 수집하고 있습니다...', threshold: 20 },
  { label: 'AI가 보고서 양식을 통일하고 있습니다...', threshold: 60 },
  { label: '최종보고서를 조립하고 있습니다...', threshold: 99 },
]

const steps = computed(() => props.mode === 'merge' ? mergeSteps : polishSteps)
const title = computed(() => props.mode === 'merge' ? '최종보고서 병합 중' : 'AI 다듬기 진행 중')

const funMessages = [
  '보고서 잘 쓰면 칼퇴 가능!',
  'AI도 야근 중입니다...',
  '커피 한 잔 하면서 기다려주세요',
  '완벽한 보고서를 위한 투자입니다',
  '상사가 감동할 보고서가 곧 완성됩니다',
  '맞춤법 틀리면 신뢰도 -50%',
  'AI가 빨간펜 선생님 모드 가동 중',
  '보고서의 품격을 한 단계 올리는 중',
  '퇴근 전 마지막 스퍼트!',
  '이 보고서, 사장님도 읽으실 수 있습니다',
]

const progress = ref(0)
const currentStep = ref(0)
const funMessage = ref(funMessages[0])

let progressTimer: ReturnType<typeof setInterval> | null = null
let funTimer: ReturnType<typeof setInterval> | null = null
let funIndex = 0

function start() {
  progress.value = 0
  currentStep.value = 0
  funIndex = 0
  funMessage.value = funMessages[0]

  progressTimer = setInterval(() => {
    if (progress.value < 95) {
      const remaining = 95 - progress.value
      const increment = Math.max(0.3, remaining * 0.04)
      progress.value = Math.min(95, progress.value + increment)

      if (progress.value >= 66) currentStep.value = 2
      else if (progress.value >= 33) currentStep.value = 1
      else currentStep.value = 0
    }
  }, 200)

  funTimer = setInterval(() => {
    funIndex = (funIndex + 1) % funMessages.length
    funMessage.value = funMessages[funIndex]
  }, 3000)
}

function stop() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
  if (funTimer) { clearInterval(funTimer); funTimer = null }
}

watch(() => props.visible, (val) => {
  if (val) start()
  else stop()
})

onUnmounted(() => stop())
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="polish-overlay">
      <div class="polish-modal">
        <div class="polish-modal__icon">
          <div class="polish-spinner"></div>
        </div>

        <h3 class="polish-modal__title">{{ title }}</h3>

        <div class="polish-steps">
          <div
            v-for="(step, i) in steps"
            :key="i"
            class="polish-step"
            :class="{ 'polish-step--active': currentStep === i, 'polish-step--done': currentStep > i }"
          >
            <span class="polish-step__num">{{ currentStep > i ? '&#10003;' : i + 1 }}</span>
            <span class="polish-step__label">{{ step.label }}</span>
          </div>
        </div>

        <div class="polish-progress">
          <div class="polish-progress__bar" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="polish-progress__text">{{ Math.round(progress) }}%</div>

        <p class="polish-fun">{{ funMessage }}</p>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.polish-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.polish-modal {
  background: var(--metro-white);
  padding: 40px 48px;
  max-width: 520px;
  width: 90%;
  text-align: center;
}

.polish-modal__icon {
  margin-bottom: 20px;
}

.polish-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--metro-border);
  border-top-color: var(--metro-blue);
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.polish-modal__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--metro-text);
  margin: 0 0 24px;
}

.polish-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
  text-align: left;
}

.polish-step {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--metro-text-light);
  font-size: 13px;
  transition: color 0.3s;
}

.polish-step--active {
  color: var(--metro-blue);
  font-weight: 600;
}

.polish-step--done {
  color: var(--metro-green);
}

.polish-step__num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  border: 2px solid var(--metro-border);
  color: var(--metro-text-light);
  transition: all 0.3s;
}

.polish-step--active .polish-step__num {
  border-color: var(--metro-blue);
  background: var(--metro-blue);
  color: #fff;
}

.polish-step--done .polish-step__num {
  border-color: var(--metro-green);
  background: var(--metro-green);
  color: #fff;
}

.polish-progress {
  height: 6px;
  background: var(--metro-border);
  overflow: hidden;
  margin-bottom: 8px;
}

.polish-progress__bar {
  height: 100%;
  background: var(--metro-blue);
  transition: width 0.4s ease;
}

.polish-progress__text {
  font-size: 13px;
  color: var(--metro-text-light);
  font-weight: 600;
  margin-bottom: 16px;
}

.polish-fun {
  font-size: 14px;
  color: var(--metro-text-light);
  font-style: italic;
  margin: 0;
  min-height: 21px;
  transition: opacity 0.3s;
}
</style>
