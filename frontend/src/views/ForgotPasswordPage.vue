<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'

const router = useRouter()

const email = ref('')
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  const value = email.value.trim()
  if (!value) {
    errorMsg.value = '이메일을 입력해주세요.'
    return
  }

  submitting.value = true
  try {
    const res = await api.requestPasswordReset(value)
    successMsg.value = res.data.message || '입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다.'
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '메일 발송에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="forgot-page">
    <div class="forgot-card metro-card">
      <h1 class="forgot-card__title">비밀번호 찾기</h1>
      <p class="forgot-card__subtitle">가입 시 등록한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.</p>

      <form @submit.prevent="handleSubmit">
        <div class="forgot-card__field">
          <label class="metro-label" for="email">이메일</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="metro-input"
            placeholder="email@example.com"
            autocomplete="email"
            :disabled="!!successMsg"
          />
        </div>

        <div v-if="errorMsg" class="forgot-card__error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="forgot-card__success">{{ successMsg }}</div>

        <button
          type="submit"
          class="metro-btn metro-btn--blue forgot-card__btn"
          :disabled="submitting || !!successMsg"
        >
          {{ submitting ? '발송 중...' : '재설정 링크 받기' }}
        </button>
      </form>

      <div class="forgot-card__footer">
        <a href="#" class="forgot-card__link" @click.prevent="router.push('/login')">로그인으로 돌아가기</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 120px);
}

.forgot-card {
  width: 100%;
  max-width: 420px;
  padding: 40px 32px;
}

.forgot-card__title {
  font-size: 24px;
  font-weight: 300;
  margin-bottom: 8px;
  text-align: center;
  color: var(--metro-blue);
}

.forgot-card__subtitle {
  font-size: 13px;
  color: var(--metro-text-light);
  margin-bottom: 28px;
  text-align: center;
  line-height: 1.5;
}

.forgot-card__field {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.forgot-card__error {
  color: var(--metro-red);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #fde7e9;
  border-left: 3px solid var(--metro-red);
  margin-bottom: 16px;
}

.forgot-card__success {
  color: var(--metro-green);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #e6f4e6;
  border-left: 3px solid var(--metro-green);
  margin-bottom: 16px;
}

.forgot-card__btn {
  width: 100%;
  margin-top: 8px;
}

.forgot-card__footer {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
}

.forgot-card__link {
  color: var(--metro-blue);
  text-decoration: none;
  font-weight: 600;
}

.forgot-card__link:hover {
  text-decoration: underline;
}
</style>
