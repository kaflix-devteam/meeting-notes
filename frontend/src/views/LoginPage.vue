<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''

  if (!username.value.trim()) {
    errorMsg.value = '아이디를 입력해주세요.'
    return
  }
  if (!password.value) {
    errorMsg.value = '패스워드를 입력해주세요.'
    return
  }

  submitting.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    router.push('/meetings')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '로그인에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card metro-card">
      <h1 class="login-card__title">Meeting Agent</h1>
      <p class="login-card__subtitle">로그인하여 시작하세요</p>

      <form @submit.prevent="handleLogin">
        <div class="login-card__field">
          <label class="metro-label" for="username">아이디</label>
          <input
            id="username"
            v-model="username"
            type="text"
            class="metro-input"
            placeholder="아이디를 입력하세요"
            autocomplete="username"
          />
        </div>

        <div class="login-card__field">
          <label class="metro-label" for="password">패스워드</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="metro-input"
            placeholder="패스워드를 입력하세요"
            autocomplete="current-password"
          />
        </div>

        <div v-if="errorMsg" class="login-card__error">{{ errorMsg }}</div>

        <button
          type="submit"
          class="metro-btn metro-btn--blue login-card__btn"
          :disabled="submitting"
        >
          {{ submitting ? '로그인 중...' : '로그인' }}
        </button>
      </form>

      <div class="login-card__footer">
        <span>계정이 없으신가요?</span>
        <router-link to="/signup" class="login-card__link">회원가입</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 120px);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px 32px;
}

.login-card__title {
  font-size: 28px;
  font-weight: 300;
  margin-bottom: 4px;
  text-align: center;
  color: var(--metro-blue);
}

.login-card__subtitle {
  font-size: 14px;
  color: var(--metro-text-light);
  margin-bottom: 32px;
  text-align: center;
}

.login-card__field {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.login-card__error {
  color: var(--metro-red);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #fde7e9;
  border-left: 3px solid var(--metro-red);
  margin-bottom: 16px;
}

.login-card__btn {
  width: 100%;
  margin-top: 8px;
}

.login-card__footer {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--metro-text-light);
}

.login-card__link {
  color: var(--metro-blue);
  text-decoration: none;
  font-weight: 600;
  margin-left: 8px;
}

.login-card__link:hover {
  text-decoration: underline;
}
</style>
