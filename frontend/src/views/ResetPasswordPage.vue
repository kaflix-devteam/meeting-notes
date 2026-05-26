<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api'

const route = useRoute()
const router = useRouter()

const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const checking = ref(true)
const tokenValid = ref(false)
const displayName = ref('')

const newPassword = ref('')
const confirmPassword = ref('')

const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

onMounted(async () => {
  if (!token.value) {
    errorMsg.value = '토큰이 없습니다. 비밀번호 찾기를 다시 진행해 주세요.'
    checking.value = false
    return
  }
  try {
    const res = await api.verifyResetToken(token.value)
    if (res.data.valid) {
      tokenValid.value = true
      displayName.value = res.data.display_name || res.data.username || ''
    } else {
      errorMsg.value = res.data.error || '유효하지 않은 링크입니다.'
    }
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '유효하지 않은 링크입니다.'
  } finally {
    checking.value = false
  }
})

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!newPassword.value || newPassword.value.length < 4) {
    errorMsg.value = '비밀번호는 최소 4자 이상이어야 합니다.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = '비밀번호가 일치하지 않습니다.'
    return
  }

  submitting.value = true
  try {
    const res = await api.resetPassword(token.value, newPassword.value)
    successMsg.value = res.data.message || '비밀번호가 변경되었습니다.'
    setTimeout(() => router.push('/login'), 2000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '비밀번호 변경에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="reset-page">
    <div class="reset-card metro-card">
      <h1 class="reset-card__title">비밀번호 재설정</h1>

      <div v-if="checking" class="reset-card__loading">토큰 확인 중...</div>

      <template v-else-if="tokenValid && !successMsg">
        <p class="reset-card__subtitle">
          <span v-if="displayName">{{ displayName }}님, </span>새 비밀번호를 입력해 주세요.
        </p>

        <form @submit.prevent="handleSubmit">
          <div class="reset-card__field">
            <label class="metro-label" for="newPassword">새 비밀번호</label>
            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              class="metro-input"
              placeholder="새 비밀번호 (4자 이상)"
              autocomplete="new-password"
            />
          </div>

          <div class="reset-card__field">
            <label class="metro-label" for="confirmPassword">비밀번호 확인</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              class="metro-input"
              placeholder="다시 한 번 입력해 주세요"
              autocomplete="new-password"
            />
          </div>

          <div v-if="errorMsg" class="reset-card__error">{{ errorMsg }}</div>

          <button
            type="submit"
            class="metro-btn metro-btn--blue reset-card__btn"
            :disabled="submitting"
          >
            {{ submitting ? '변경 중...' : '비밀번호 변경' }}
          </button>
        </form>
      </template>

      <div v-else-if="successMsg" class="reset-card__success">
        {{ successMsg }}
        <div class="reset-card__hint">잠시 후 로그인 페이지로 이동합니다.</div>
      </div>

      <div v-else class="reset-card__error">
        {{ errorMsg || '유효하지 않은 링크입니다.' }}
        <div class="reset-card__hint">
          <a href="#" class="reset-card__link" @click.prevent="router.push('/forgot-password')">비밀번호 찾기 다시 시도</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 120px);
}

.reset-card {
  width: 100%;
  max-width: 420px;
  padding: 40px 32px;
}

.reset-card__title {
  font-size: 24px;
  font-weight: 300;
  margin-bottom: 8px;
  text-align: center;
  color: var(--metro-blue);
}

.reset-card__subtitle {
  font-size: 13px;
  color: var(--metro-text-light);
  margin-bottom: 24px;
  text-align: center;
}

.reset-card__loading {
  text-align: center;
  padding: 24px 0;
  color: var(--metro-text-light);
  font-size: 14px;
}

.reset-card__field {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.reset-card__error {
  color: var(--metro-red);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #fde7e9;
  border-left: 3px solid var(--metro-red);
  margin-bottom: 16px;
}

.reset-card__success {
  color: var(--metro-green);
  font-size: 14px;
  font-weight: 600;
  padding: 14px;
  background: #e6f4e6;
  border-left: 3px solid var(--metro-green);
}

.reset-card__hint {
  font-weight: 400;
  font-size: 13px;
  color: var(--metro-text-light);
  margin-top: 8px;
}

.reset-card__btn {
  width: 100%;
  margin-top: 8px;
}

.reset-card__link {
  color: var(--metro-blue);
  text-decoration: none;
  font-weight: 600;
}

.reset-card__link:hover {
  text-decoration: underline;
}
</style>
