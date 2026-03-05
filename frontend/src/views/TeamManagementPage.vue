<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import * as api from '../api'

interface TeamRow {
  id: number
  name: string
  team_color: string
  department_id: number
  department_name: string
  department_color: string
}

const auth = useAuthStore()
const teams = ref<TeamRow[]>([])
const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')

const newDeptName = ref('')
const newTeamName = ref('')
const newDeptColor = ref('#5c2d91')
const newTeamColor = ref('#107c10')
const adding = ref(false)
const deletingId = ref<number | null>(null)

// 편집 상태
const editingId = ref<number | null>(null)
const editDeptName = ref('')
const editTeamName = ref('')
const editDeptColor = ref('#5c2d91')
const editTeamColor = ref('#107c10')
const saving = ref(false)

onMounted(async () => {
  try {
    const res = await api.getAllTeams()
    teams.value = res.data as TeamRow[]
  } catch {
    errorMsg.value = '팀 목록을 불러오는데 실패했습니다.'
  } finally {
    loading.value = false
  }
})

async function handleAdd() {
  if (!newDeptName.value.trim() || !newTeamName.value.trim()) {
    errorMsg.value = '소속과 팀 이름을 모두 입력해주세요.'
    return
  }
  adding.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const res = await api.createTeam(newDeptName.value.trim(), newTeamName.value.trim(), newDeptColor.value, newTeamColor.value)
    teams.value.push(res.data as TeamRow)
    teams.value.sort((a, b) => a.department_name.localeCompare(b.department_name) || a.name.localeCompare(b.name))
    successMsg.value = '팀이 추가되었습니다.'
    newDeptName.value = ''
    newTeamName.value = ''
    newDeptColor.value = '#5c2d91'
    newTeamColor.value = '#107c10'
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '팀 추가에 실패했습니다.'
  } finally {
    adding.value = false
  }
}

function startEdit(team: TeamRow) {
  editingId.value = team.id
  editDeptName.value = team.department_name
  editTeamName.value = team.name
  editDeptColor.value = team.department_color || '#5c2d91'
  editTeamColor.value = team.team_color || '#107c10'
}

function cancelEdit() {
  editingId.value = null
  editDeptName.value = ''
  editTeamName.value = ''
}

async function saveEdit(team: TeamRow) {
  if (!editDeptName.value.trim() || !editTeamName.value.trim()) {
    errorMsg.value = '소속과 팀 이름을 모두 입력해주세요.'
    return
  }
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const res = await api.updateTeam(team.id, editDeptName.value.trim(), editTeamName.value.trim(), editDeptColor.value, editTeamColor.value)
    const updated = res.data as TeamRow
    const idx = teams.value.findIndex(t => t.id === team.id)
    if (idx >= 0) {
      teams.value[idx] = updated
    }
    teams.value.sort((a, b) => a.department_name.localeCompare(b.department_name) || a.name.localeCompare(b.name))
    successMsg.value = '팀 정보가 변경되었습니다.'
    editingId.value = null
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '팀 수정에 실패했습니다.'
  } finally {
    saving.value = false
  }
}

async function handleDelete(team: TeamRow) {
  if (!confirm(`"${team.department_name} - ${team.name}" 팀을 삭제하시겠습니까?`)) return
  deletingId.value = team.id
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await api.deleteTeam(team.id)
    teams.value = teams.value.filter(t => t.id !== team.id)
    successMsg.value = '팀이 삭제되었습니다.'
    setTimeout(() => { successMsg.value = '' }, 2000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '팀 삭제에 실패했습니다.'
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="team-mgmt">
    <h2 class="metro-section__title">팀 관리</h2>

    <div v-if="loading" class="metro-loading">Loading...</div>

    <template v-else>
      <div v-if="errorMsg" class="team-mgmt__error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="team-mgmt__success">{{ successMsg }}</div>

      <!-- 추가 영역 (admin만) -->
      <div v-if="auth.isAdmin" class="team-mgmt__add">
        <div class="team-mgmt__field">
          <input
            v-model="newDeptName"
            type="text"
            class="metro-input team-mgmt__input"
            placeholder="소속"
            @keyup.enter="handleAdd"
          />
          <input
            v-model="newDeptColor"
            type="color"
            class="team-mgmt__color-picker"
            title="소속 색상"
          />
        </div>
        <div class="team-mgmt__field">
          <input
            v-model="newTeamName"
            type="text"
            class="metro-input team-mgmt__input"
            placeholder="팀"
            @keyup.enter="handleAdd"
          />
          <input
            v-model="newTeamColor"
            type="color"
            class="team-mgmt__color-picker"
            title="팀 색상"
          />
        </div>
        <button
          class="metro-btn metro-btn--blue team-mgmt__add-btn"
          :disabled="adding"
          @click="handleAdd"
        >
          {{ adding ? '추가 중...' : '추가' }}
        </button>
      </div>

      <table class="team-mgmt__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>소속</th>
            <th>팀</th>
            <th v-if="auth.isAdmin">관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in teams" :key="team.id">
            <td>{{ team.id }}</td>

            <!-- 보기 모드 -->
            <template v-if="editingId !== team.id">
              <td>
                <span class="metro-badge" :style="{ backgroundColor: team.department_color || '#5c2d91' }">
                  {{ team.department_name }}
                </span>
              </td>
              <td>
                <span class="metro-badge" :style="{ backgroundColor: team.team_color || '#107c10' }">
                  {{ team.name }}
                </span>
              </td>
              <td v-if="auth.isAdmin" class="team-mgmt__actions">
                <button
                  class="metro-btn metro-btn--blue team-mgmt__btn"
                  @click="startEdit(team)"
                >
                  변경
                </button>
                <button
                  class="metro-btn metro-btn--red team-mgmt__btn"
                  :disabled="deletingId === team.id"
                  @click="handleDelete(team)"
                >
                  {{ deletingId === team.id ? '삭제 중...' : '삭제' }}
                </button>
              </td>
            </template>

            <!-- 편집 모드 -->
            <template v-else>
              <td>
                <div class="team-mgmt__edit-field">
                  <input
                    v-model="editDeptName"
                    type="text"
                    class="metro-input team-mgmt__edit-input"
                    @keyup.enter="saveEdit(team)"
                  />
                  <input
                    v-model="editDeptColor"
                    type="color"
                    class="team-mgmt__color-picker"
                    title="소속 색상"
                  />
                </div>
              </td>
              <td>
                <div class="team-mgmt__edit-field">
                  <input
                    v-model="editTeamName"
                    type="text"
                    class="metro-input team-mgmt__edit-input"
                    @keyup.enter="saveEdit(team)"
                  />
                  <input
                    v-model="editTeamColor"
                    type="color"
                    class="team-mgmt__color-picker"
                    title="팀 색상"
                  />
                </div>
              </td>
              <td class="team-mgmt__actions">
                <button
                  class="metro-btn metro-btn--green team-mgmt__btn"
                  :disabled="saving"
                  @click="saveEdit(team)"
                >
                  {{ saving ? '저장 중...' : '저장' }}
                </button>
                <button
                  class="metro-btn metro-btn--outline team-mgmt__btn"
                  @click="cancelEdit"
                >
                  취소
                </button>
              </td>
            </template>
          </tr>
          <tr v-if="teams.length === 0">
            <td :colspan="auth.isAdmin ? 4 : 3" style="text-align:center;color:#888;">
              등록된 팀이 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.team-mgmt__add {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}

.team-mgmt__field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.team-mgmt__edit-field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.team-mgmt__color-picker {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--metro-border);
  cursor: pointer;
  background: none;
  flex-shrink: 0;
}

.team-mgmt__input {
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--metro-border);
  width: 150px;
}

.team-mgmt__edit-input {
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid var(--metro-border);
  width: 120px;
}

.team-mgmt__add-btn {
  padding: 8px 20px;
  font-size: 14px;
  min-height: 36px;
}

.team-mgmt__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--metro-white);
  border: 1px solid var(--metro-border);
}

.team-mgmt__table th,
.team-mgmt__table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--metro-border);
  font-size: 14px;
}

.team-mgmt__table th {
  background: #f5f5f5;
  font-weight: 600;
}

.team-mgmt__btn {
  padding: 5px 12px;
  font-size: 12px;
  min-height: 30px;
}

.team-mgmt__actions {
  display: flex;
  gap: 6px;
}

.team-mgmt__error {
  color: var(--metro-red);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #fde7e9;
  border-left: 3px solid var(--metro-red);
  margin-bottom: 16px;
}

.team-mgmt__success {
  color: var(--metro-green);
  font-size: 14px;
  font-weight: 600;
  padding: 10px;
  background: #e6f4e6;
  border-left: 3px solid var(--metro-green);
  margin-bottom: 16px;
}
</style>
