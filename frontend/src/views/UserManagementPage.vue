<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { User, Department, Team } from '../types'
import { useAuthStore } from '../stores/authStore'
import * as api from '../api'

const auth = useAuthStore()

const users = ref<User[]>([])
const departments = ref<Department[]>([])
const teamsMap = ref<Record<number, Team[]>>({})
const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')

// 각 유저별 편집 상태
const editingUserId = ref<number | null>(null)
const editDeptId = ref<number>(0)
const editTeamId = ref<number>(0)
const editTeamsLoading = ref(false)
const editTeams = ref<Team[]>([])
const editDisplayName = ref('')
const editUsername = ref('')
const deletingUserId = ref<number | null>(null)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

onMounted(async () => {
  try {
    const [usersRes, deptsRes] = await Promise.all([
      api.getUsers(),
      api.getDepartments(),
    ])
    users.value = usersRes.data
    departments.value = deptsRes.data
  } catch {
    errorMsg.value = '데이터를 불러오는데 실패했습니다.'
  } finally {
    loading.value = false
  }
})

function startEdit(user: User) {
  editingUserId.value = user.id
  editDisplayName.value = user.display_name || ''
  editUsername.value = user.username || ''
  editDeptId.value = user.department_id || 0
  editTeamId.value = user.team_id
  // 소속에 해당하는 팀 목록 로드
  if (editDeptId.value) {
    loadTeamsForDept(editDeptId.value)
  }
}

function cancelEdit() {
  editingUserId.value = null
  editDisplayName.value = ''
  editUsername.value = ''
  editDeptId.value = 0
  editTeamId.value = 0
  editTeams.value = []
}

async function loadTeamsForDept(deptId: number) {
  editTeamsLoading.value = true
  try {
    const res = await api.getTeams(deptId)
    editTeams.value = res.data
  } catch {
    editTeams.value = []
  } finally {
    editTeamsLoading.value = false
  }
}

watch(editDeptId, (newVal) => {
  editTeamId.value = 0
  editTeams.value = []
  if (newVal && newVal > 0) {
    loadTeamsForDept(newVal)
  }
})

async function saveEdit(user: User) {
  if (!editTeamId.value) {
    errorMsg.value = '팀을 선택해주세요.'
    return
  }
  // 수퍼어드민은 로그인 ID(username)도 변경 가능 — 이메일 형식 필수
  const newUsername = editUsername.value.trim()
  if (auth.isAdmin && newUsername && !EMAIL_RE.test(newUsername)) {
    errorMsg.value = '아이디는 이메일 형식이어야 합니다.'
    return
  }
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const res = await api.updateUserTeam(
      user.id,
      editTeamId.value || undefined,
      editDisplayName.value || undefined,
      auth.isAdmin && newUsername && newUsername !== user.username ? newUsername : undefined,
    )
    // 목록 갱신
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx >= 0) {
      users.value[idx] = res.data
    }
    successMsg.value = `${user.display_name}의 소속이 변경되었습니다.`
    editingUserId.value = null
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '변경에 실패했습니다.'
  }
}

async function handleDeleteUser(user: User) {
  if (!confirm(`${user.display_name} (${user.username}) 유저를 삭제하시겠습니까?\n해당 유저의 보고서도 함께 삭제됩니다.`)) return

  deletingUserId.value = user.id
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await api.deleteUser(user.id)
    users.value = users.value.filter(u => u.id !== user.id)
    successMsg.value = `${user.display_name} 유저가 삭제되었습니다.`
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '유저 삭제에 실패했습니다.'
  } finally {
    deletingUserId.value = null
  }
}
</script>

<template>
  <div class="user-mgmt">
    <h2 class="metro-section__title">유저 그룹관리</h2>

    <div v-if="loading" class="metro-loading">Loading...</div>

    <template v-else>
      <div v-if="errorMsg" class="user-mgmt__error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="user-mgmt__success">{{ successMsg }}</div>

      <table class="user-mgmt__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>아이디</th>
            <th>이름</th>
            <th>소속</th>
            <th>팀</th>
            <th v-if="auth.isAdmin">관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td v-if="!auth.isAdmin || editingUserId !== user.id">{{ user.username }}</td>
            <td v-else>
              <input v-model="editUsername" class="metro-input user-mgmt__name-input" placeholder="아이디(이메일)" />
            </td>
            <td v-if="!auth.isAdmin || editingUserId !== user.id">
              {{ user.display_name }}
              <span v-if="user.is_admin" class="user-mgmt__admin-badge">ADMIN</span>
            </td>
            <td v-else>
              <input v-model="editDisplayName" class="metro-input user-mgmt__name-input" placeholder="이름" />
              <span v-if="user.is_admin" class="user-mgmt__admin-badge">ADMIN</span>
            </td>

            <!-- 편집모드가 아닌 경우 -->
            <template v-if="!auth.isAdmin || editingUserId !== user.id">
              <td>{{ user.department_name }}</td>
              <td>{{ user.team_name }}</td>
              <td v-if="auth.isAdmin" class="user-mgmt__actions">
                <button class="metro-btn metro-btn--blue user-mgmt__btn" @click="startEdit(user)">
                  변경
                </button>
                <button
                  v-if="!user.is_admin"
                  class="metro-btn metro-btn--red user-mgmt__btn"
                  :disabled="deletingUserId === user.id"
                  @click="handleDeleteUser(user)"
                >
                  {{ deletingUserId === user.id ? '삭제 중...' : '삭제' }}
                </button>
              </td>
            </template>

            <!-- 편집모드 (admin만) -->
            <template v-else>
              <td>
                <select v-model="editDeptId" class="metro-select user-mgmt__select">
                  <option :value="0" disabled>-- 소속 --</option>
                  <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </td>
              <td>
                <select
                  v-model="editTeamId"
                  class="metro-select user-mgmt__select"
                  :disabled="!editDeptId || editTeamsLoading"
                >
                  <option :value="0" disabled>{{ editTeamsLoading ? '로딩...' : '-- 팀 --' }}</option>
                  <option v-for="t in editTeams" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </td>
              <td class="user-mgmt__actions">
                <button class="metro-btn metro-btn--green user-mgmt__btn" @click="saveEdit(user)">저장</button>
                <button class="metro-btn metro-btn--outline user-mgmt__btn" @click="cancelEdit">취소</button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.user-mgmt__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--metro-white);
  border: 1px solid var(--metro-border);
}

.user-mgmt__table th,
.user-mgmt__table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--metro-border);
  font-size: 14px;
}

.user-mgmt__table th {
  background: #f5f5f5;
  font-weight: 600;
}

.user-mgmt__select {
  width: 140px;
  padding: 6px 8px;
  font-size: 13px;
}

.user-mgmt__btn {
  padding: 5px 12px;
  font-size: 12px;
  min-height: 30px;
}

.user-mgmt__actions {
  display: flex;
  gap: 6px;
}

.user-mgmt__name-input {
  width: 100px;
  padding: 4px 8px;
  font-size: 13px;
}

.user-mgmt__admin-badge {
  display: inline-block;
  background: var(--metro-red);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  margin-left: 6px;
  vertical-align: middle;
}

.user-mgmt__error {
  color: var(--metro-red);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #fde7e9;
  border-left: 3px solid var(--metro-red);
  margin-bottom: 16px;
}

.user-mgmt__success {
  color: var(--metro-green);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #e6f4e6;
  border-left: 3px solid var(--metro-green);
  margin-bottom: 16px;
}
</style>
