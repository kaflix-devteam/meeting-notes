<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import RichEditor from '../components/RichEditor.vue'
import CalendarPicker from '../components/CalendarPicker.vue'
import TagInput from '../components/TagInput.vue'
import { useAuthStore } from '../stores/authStore'
import { getDepartments, getTeams, createMeetingNote } from '../api'
import { hasPendingUploads, waitForUploads } from '../extensions/clipboardImagePaste'
import type { Department, Team } from '../types'

const router = useRouter()
const auth = useAuthStore()

const content = ref('')
const reportDate = ref('')
const saving = ref(false)
const savedNoteId = ref<number | null>(null)
const errorMsg = ref('')
const successMsg = ref('')

const departments = ref<Department[]>([])
const allTeams = ref<Team[]>([])
const selectedDeptId = ref<number | null>(auth.user?.department_id || null)
const selectedTeamId = ref<number | null>(auth.user?.team_id || null)
const showDeptDropdown = ref(false)
const showTeamDropdown = ref(false)
const selectedTags = ref<any[]>([])

const filteredTeams = computed(() => {
  if (!selectedDeptId.value) return allTeams.value
  return allTeams.value.filter(t => t.department_id === selectedDeptId.value)
})

const selectedDept = computed(() => departments.value.find(d => d.id === selectedDeptId.value))
const selectedTeam = computed(() => allTeams.value.find(t => t.id === selectedTeamId.value))
const selectedDeptColor = computed(() => (selectedDept.value as any)?.color || '#5c2d91')
const selectedTeamColor = computed(() => (selectedTeam.value as any)?.color || '#107c10')

function selectDept(dept: Department) {
  selectedDeptId.value = dept.id
  showDeptDropdown.value = false
  const teams = allTeams.value.filter(t => t.department_id === dept.id)
  const first = teams[0]
  selectedTeamId.value = first ? first.id : null
}

function selectTeam(team: Team) {
  selectedTeamId.value = team.id
  selectedDeptId.value = team.department_id
  showTeamDropdown.value = false
}

function closeDropdowns() {
  showDeptDropdown.value = false
  showTeamDropdown.value = false
}

onMounted(async () => {
  document.addEventListener('click', closeDropdowns)
  try {
    const [deptRes, teamRes] = await Promise.all([getDepartments(), getTeams()])
    departments.value = deptRes.data
    allTeams.value = teamRes.data
  } catch { /* ignore */ }
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
})

async function handleSave() {
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = '회의록 내용을 작성해주세요.'
    return
  }
  if (!reportDate.value) {
    alert('보고 날짜를 지정해 주세요')
    return
  }
  if (!selectedDeptId.value) {
    errorMsg.value = '사업부를 선택해주세요.'
    return
  }

  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    if (hasPendingUploads()) {
      successMsg.value = '이미지 업로드 완료 대기 중...'
      await waitForUploads()
      successMsg.value = ''
    }

    const tagSig = selectedTags.value.map(t => t.id).sort((a: number, b: number) => a - b).join(',')

    if (savedNoteId.value) {
      await import('../api').then(api => api.updateMeetingNote(savedNoteId.value!, {
        content_html: content.value,
        report_date: reportDate.value,
        team_id: selectedTeamId.value || undefined,
        department_id: selectedDeptId.value || undefined,
        tag_signature: tagSig || undefined,
      }))
    } else {
      const res = await createMeetingNote({
        report_date: reportDate.value,
        department_id: selectedDeptId.value,
        team_id: selectedTeamId.value || undefined,
        user_id: auth.user!.id,
        content_html: content.value,
        tag_signature: tagSig || undefined,
      })
      savedNoteId.value = res.data.id
    }

    successMsg.value = '회의록이 저장되었습니다.'
    setTimeout(() => { successMsg.value = '' }, 3000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '회의록 저장에 실패했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="note-create">
    <h2 class="metro-section__title">새 회의록 작성</h2>

    <div class="note-create__info">
      <div class="badge-select" @click.stop="showDeptDropdown = !showDeptDropdown; showTeamDropdown = false">
        <span class="note-create__badge" :style="{ backgroundColor: selectedDeptColor }">
          {{ selectedDept?.name || '사업부' }} &#9662;
        </span>
        <div v-if="showDeptDropdown" class="badge-select__dropdown">
          <div v-for="dept in departments" :key="dept.id"
            class="badge-select__item" :class="{ 'badge-select__item--active': dept.id === selectedDeptId }"
            @click.stop="selectDept(dept)">
            <span class="badge-select__dot" :style="{ backgroundColor: (dept as any).color || '#5c2d91' }"></span>
            {{ dept.name }}
          </div>
        </div>
      </div>

      <div class="badge-select" @click.stop="showTeamDropdown = !showTeamDropdown; showDeptDropdown = false">
        <span class="note-create__badge" :style="{ backgroundColor: selectedTeamColor }">
          {{ selectedTeam?.name || '팀' }} &#9662;
        </span>
        <div v-if="showTeamDropdown" class="badge-select__dropdown">
          <div v-for="team in filteredTeams" :key="team.id"
            class="badge-select__item" :class="{ 'badge-select__item--active': team.id === selectedTeamId }"
            @click.stop="selectTeam(team)">
            <span class="badge-select__dot" :style="{ backgroundColor: (team as any).color || '#107c10' }"></span>
            {{ team.name }}
          </div>
        </div>
      </div>

      <TagInput v-model="selectedTags" :department-id="selectedDeptId" :team-id="selectedTeamId" />
      <span class="note-create__user">{{ auth.user?.display_name }}</span>
    </div>

    <div class="note-create__top">
      <CalendarPicker v-model="reportDate" />
    </div>

    <div class="note-create__editor">
      <RichEditor v-model="content" />
    </div>

    <div v-if="errorMsg" class="note-create__error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="note-create__success">{{ successMsg }}</div>

    <div class="metro-btn-group">
      <button type="button" class="metro-btn metro-btn--outline" @click="router.push('/notes')">취소</button>
      <button type="button" class="metro-btn metro-btn--green" :disabled="saving" @click="handleSave">
        {{ saving ? '저장 중...' : '저장' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.note-create__info { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.badge-select { position: relative; display: inline-block; }
.note-create__badge { display: inline-block; padding: 4px 12px; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; user-select: none; }
.note-create__badge:hover { opacity: 0.85; }
.badge-select__dropdown { position: absolute; top: 100%; left: 0; margin-top: 4px; background: var(--metro-white); border: 1px solid var(--metro-border); box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; min-width: 160px; max-height: 240px; overflow-y: auto; }
.badge-select__item { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
.badge-select__item:hover { background: var(--metro-hover); }
.badge-select__item--active { background: #e8f0fe; font-weight: 600; }
.badge-select__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.note-create__user { font-size: 14px; color: var(--metro-text); font-weight: 600; margin-left: 4px; }
.note-create__top { margin-bottom: 16px; }
.note-create__editor { margin-bottom: 16px; }
.note-create__error { color: var(--metro-orange); font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.note-create__success { color: var(--metro-green); font-size: 14px; font-weight: 600; margin-bottom: 8px; }
</style>
