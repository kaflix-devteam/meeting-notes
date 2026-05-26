<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Department, Team } from '../types'
import * as api from '../api'

const router = useRouter()

const username = ref('')
const password = ref('')
const displayName = ref('')
const email = ref('')
const selectedDepartmentId = ref<number>(0)
const selectedTeamId = ref<number>(0)

const departments = ref<Department[]>([])
const teams = ref<Team[]>([])
const teamsLoading = ref(false)
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

onMounted(async () => {
  try {
    const res = await api.getDepartments()
    departments.value = res.data
  } catch {
    errorMsg.value = '소속 목록을 불러오는데 실패했습니다.'
  }
})

watch(selectedDepartmentId, async (newVal) => {
  selectedTeamId.value = 0
  teams.value = []
  if (newVal && newVal > 0) {
    teamsLoading.value = true
    try {
      const res = await api.getTeams(newVal)
      teams.value = res.data
    } catch {
      errorMsg.value = '팀 목록을 불러오는데 실패했습니다.'
    } finally {
      teamsLoading.value = false
    }
  }
})

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!username.value.trim()) {
    errorMsg.value = '아이디를 입력해주세요.'
    return
  }
  if (!password.value) {
    errorMsg.value = '패스워드를 입력해주세요.'
    return
  }
  if (!displayName.value.trim()) {
    errorMsg.value = '이름을 입력해주세요.'
    return
  }
  if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    errorMsg.value = '올바른 이메일 형식이 아닙니다.'
    return
  }
  if (!selectedDepartmentId.value) {
    errorMsg.value = '소속을 선택해주세요.'
    return
  }
  if (!selectedTeamId.value) {
    errorMsg.value = '팀을 선택해주세요.'
    return
  }

  submitting.value = true
  try {
    await api.signup({
      username: username.value.trim(),
      password: password.value,
      display_name: displayName.value.trim(),
      team_id: selectedTeamId.value,
      ...(email.value.trim() ? { email: email.value.trim() } : {}),
    })
    successMsg.value = '회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.'
    setTimeout(() => router.push('/login'), 1500)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '회원가입에 실패했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="signup-page">
    <h1 class="signup-page__title">회원가입</h1>
    <p class="signup-page__subtitle">새로운 계정을 만들어 시작하세요</p>

    <form class="signup-form metro-card" @submit.prevent="handleSubmit">
      <div class="signup-form__field">
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

      <div class="signup-form__field">
        <label class="metro-label" for="password">패스워드</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="metro-input"
          placeholder="패스워드를 입력하세요"
          autocomplete="new-password"
        />
      </div>

      <div class="signup-form__field">
        <label class="metro-label" for="displayName">이름</label>
        <input
          id="displayName"
          v-model="displayName"
          type="text"
          class="metro-input"
          placeholder="이름을 입력하세요"
        />
      </div>

      <div class="signup-form__field">
        <label class="metro-label" for="email">이메일 <span class="signup-form__hint">(비밀번호 찾기에 사용)</span></label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="metro-input"
          placeholder="email@example.com"
          autocomplete="email"
        />
      </div>

      <div class="signup-form__field">
        <label class="metro-label" for="department">소속</label>
        <select
          id="department"
          v-model="selectedDepartmentId"
          class="metro-select"
        >
          <option :value="0" disabled>-- 소속 선택 --</option>
          <option
            v-for="dept in departments"
            :key="dept.id"
            :value="dept.id"
          >
            {{ dept.name }}
          </option>
        </select>
      </div>

      <div class="signup-form__field">
        <label class="metro-label" for="team">팀</label>
        <select
          id="team"
          v-model="selectedTeamId"
          class="metro-select"
          :disabled="!selectedDepartmentId || selectedDepartmentId === 0"
        >
          <option :value="0" disabled>
            {{ !selectedDepartmentId || selectedDepartmentId === 0 ? '-- 소속을 먼저 선택하세요 --' : '-- 팀 선택 --' }}
          </option>
          <option
            v-for="team in teams"
            :key="team.id"
            :value="team.id"
          >
            {{ team.name }}
          </option>
        </select>
        <span v-if="teamsLoading" class="signup-form__loading">불러오는 중...</span>
      </div>

      <div v-if="errorMsg" class="signup-form__error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="signup-form__success">{{ successMsg }}</div>

      <div class="signup-form__actions">
        <button
          type="submit"
          class="metro-btn metro-btn--blue"
          :disabled="submitting"
        >
          {{ submitting ? '가입 중...' : '회원가입' }}
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--outline"
          @click="router.push('/login')"
        >
          취소
        </button>
      </div>

      <div class="signup-form__footer">
        <span>이미 계정이 있으신가요?</span>
        <router-link to="/login" class="signup-form__link">로그인</router-link>
      </div>
    </form>
  </div>
</template>

<style scoped>
.signup-page {
  max-width: 480px;
  margin: 0 auto;
  padding-top: 32px;
}

.signup-page__title {
  font-size: 28px;
  font-weight: 300;
  margin-bottom: 4px;
}

.signup-page__subtitle {
  font-size: 14px;
  color: var(--metro-text-light);
  margin-bottom: 32px;
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.signup-form__field {
  display: flex;
  flex-direction: column;
}

.signup-form__loading {
  font-size: 12px;
  color: var(--metro-text-light);
  margin-top: 4px;
}

.signup-form__hint {
  font-weight: 400;
  font-size: 12px;
  color: var(--metro-text-light);
  margin-left: 4px;
}

.signup-form__error {
  color: var(--metro-red);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #fde7e9;
  border-left: 3px solid var(--metro-red);
}

.signup-form__success {
  color: var(--metro-green);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #e6f4e6;
  border-left: 3px solid var(--metro-green);
}

.signup-form__actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.metro-select:disabled {
  background-color: #f0f0f0;
  color: #999;
  cursor: not-allowed;
}

.signup-form__footer {
  text-align: center;
  font-size: 14px;
  color: var(--metro-text-light);
}

.signup-form__link {
  color: var(--metro-blue);
  text-decoration: none;
  font-weight: 600;
  margin-left: 8px;
}

.signup-form__link:hover {
  text-decoration: underline;
}
</style>
