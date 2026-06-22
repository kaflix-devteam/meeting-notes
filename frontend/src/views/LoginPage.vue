<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const ssoLoading = ref(false)
const errorMsg = ref('')
const infoMsg = ref('')

onMounted(async () => {
  const ssoToken = route.query.sso_token as string
  const ssoError = route.query.sso_error as string
  const loggedOut = route.query.loggedout

  // 로그아웃 직후 착지: 자동 SSO 송출 없이 선택 화면을 보여준다 (재로그인 루프 방지)
  if (loggedOut) {
    infoMsg.value = '로그아웃되었습니다.'
    router.replace({ query: {} })
    return
  }

  if (ssoError) {
    const messages: Record<string, string> = {
      invalid_state: 'SSO 인증 상태가 유효하지 않습니다.',
      expired_state: 'SSO 인증이 만료되었습니다. 다시 시도해주세요.',
      callback_failed: 'SSO 인증에 실패했습니다.',
    }
    errorMsg.value = messages[ssoError] || 'SSO 로그인에 실패했습니다.'
    router.replace({ query: {} })
    return
  }

  if (ssoToken) {
    ssoLoading.value = true
    try {
      await auth.loginWithSsoToken(ssoToken)
      router.replace('/meetings')
    } catch {
      errorMsg.value = 'SSO 인증 확인에 실패했습니다. 다시 시도해주세요.'
      router.replace({ query: {} })
    } finally {
      ssoLoading.value = false
    }
  }
})

function handleSsoLogin() {
  window.location.href = '/api/auth/sso/login'
}

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

      <div v-if="ssoLoading" class="login-card__sso-loading">SSO 인증 처리 중...</div>

      <template v-else>
        <div v-if="infoMsg" class="login-card__info">{{ infoMsg }}</div>

        <button
          type="button"
          class="metro-btn login-card__sso-btn"
          @click="handleSsoLogin"
        >
          kaflix SSO 로그인
        </button>

        <div class="login-card__divider">
          <span>또는</span>
        </div>

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

      <div class="login-card__footer login-card__footer--secondary">
        <router-link to="/forgot-password" class="login-card__link login-card__link--muted">
          비밀번호를 잊으셨나요?
        </router-link>
      </div>
      </template>
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

.login-card__footer--secondary {
  margin-top: 12px;
}

.login-card__link--muted {
  margin-left: 0;
  font-weight: 400;
  color: var(--metro-text-light);
}

.login-card__sso-btn {
  width: 100%;
  padding: 12px;
  background: #1a73e8;
  color: #fff;
  border: none;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.login-card__sso-btn:hover {
  background: #1557b0;
}

.login-card__divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: var(--metro-text-light);
  font-size: 13px;
}

.login-card__divider::before,
.login-card__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--metro-border, #ddd);
}

.login-card__divider span {
  padding: 0 12px;
}

.login-card__sso-loading {
  text-align: center;
  padding: 40px 0;
  color: var(--metro-text-light);
  font-size: 15px;
}

.login-card__info {
  color: var(--metro-blue);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #eff6fc;
  border-left: 3px solid var(--metro-blue);
  margin-bottom: 16px;
}
</style>
