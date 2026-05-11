<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RichEditor from '../components/RichEditor.vue'
import CalendarPicker from '../components/CalendarPicker.vue'
import TagInput from '../components/TagInput.vue'
import { useAuthStore } from '../stores/authStore'
import { getMeetingNoteById, updateMeetingNote, deleteMeetingNote, getDepartments, getTeams, generateNoteShareLink, sendNoteShareEmail, getSharedMeetingNote } from '../api'
import { hasPendingUploads, waitForUploads } from '../extensions/clipboardImagePaste'
import type { Department, Team } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const noteId = ref(0)
const content = ref('')
const reportDate = ref('')
const saving = ref(false)
const deleting = ref(false)
const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')
const isSharedView = ref(false)

const departments = ref<Department[]>([])
const allTeams = ref<Team[]>([])
const selectedDeptId = ref<number | null>(null)
const selectedTeamId = ref<number | null>(null)
const showDeptDropdown = ref(false)
const showTeamDropdown = ref(false)
const selectedTags = ref<any[]>([])

// 공유/메일
const sharing = ref(false)
const showEmailModal = ref(false)
const emailRecipients = ref('')
const sendingEmail = ref(false)
const emailMsg = ref('')

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
  noteId.value = Number(route.params.id)
  const token = route.query.token as string | undefined
  isSharedView.value = !!token

  try {
    const notePromise = token ? getSharedMeetingNote(token) : getMeetingNoteById(noteId.value)
    const [noteRes, deptRes, teamRes] = await Promise.all([
      notePromise,
      getDepartments(),
      getTeams(),
    ])

    content.value = noteRes.data.content_html
    reportDate.value = noteRes.data.report_date
    noteId.value = noteRes.data.id
    departments.value = deptRes.data
    allTeams.value = teamRes.data

    selectedDeptId.value = noteRes.data.department_id || null
    selectedTeamId.value = noteRes.data.team_id || null

    // 태그 로드
    if (noteRes.data.tag_signature && selectedDeptId.value && selectedTeamId.value) {
      const tagIds = noteRes.data.tag_signature.split(',').map(Number)
      const { getTags } = await import('../api')
      const tagRes = await getTags(selectedDeptId.value, selectedTeamId.value)
      await nextTick()
      selectedTags.value = tagRes.data.filter((t: any) => tagIds.includes(t.id))
    }
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || 'Failed to load meeting note.'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
})

async function handleSave() {
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = '회의록 내용을 작성해주세요.'
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

    await updateMeetingNote(noteId.value, {
      content_html: content.value,
      report_date: reportDate.value,
      team_id: selectedTeamId.value || undefined,
      department_id: selectedDeptId.value || undefined,
      tag_signature: tagSig || undefined,
    })

    successMsg.value = '회의록이 저장되었습니다.'
    setTimeout(() => { successMsg.value = '' }, 3000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '회의록 저장에 실패했습니다.'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirm('이 회의록을 삭제하시겠습니까?')) return
  deleting.value = true
  try {
    await deleteMeetingNote(noteId.value)
    router.push('/notes')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '삭제에 실패했습니다.'
  } finally {
    deleting.value = false
  }
}

async function handleShare() {
  sharing.value = true
  try {
    const res = await generateNoteShareLink(noteId.value)
    const fullUrl = window.location.origin + res.data.share_url
    await navigator.clipboard.writeText(fullUrl)
    alert('공유 링크가 클립보드에 복사되었습니다.')
  } catch (e: any) {
    alert(e.response?.data?.error || '공유 링크 생성에 실패했습니다.')
  } finally {
    sharing.value = false
  }
}

async function handleSendEmail() {
  if (!emailRecipients.value.trim()) return
  sendingEmail.value = true
  emailMsg.value = ''
  try {
    const recipients = emailRecipients.value.split(',').map(e => e.trim()).filter(Boolean)
    await sendNoteShareEmail(noteId.value, recipients)
    emailMsg.value = '메일이 발송되었습니다.'
    setTimeout(() => { showEmailModal.value = false; emailMsg.value = '' }, 2000)
  } catch (e: any) {
    emailMsg.value = e.response?.data?.error || '메일 발송에 실패했습니다.'
  } finally {
    sendingEmail.value = false
  }
}
</script>

<template>
  <div class="note-edit">
    <div class="note-edit__top-actions">
      <button v-if="!isSharedView" class="metro-btn metro-btn--outline" @click="router.push('/notes')">목록으로</button>
      <span v-else></span>
      <div v-if="!isSharedView" class="note-edit__top-right">
        <button class="metro-btn metro-btn--blue" :disabled="sharing" @click="handleShare">
          {{ sharing ? '생성 중...' : '공유 링크' }}
        </button>
        <button class="metro-btn metro-btn--green" @click="showEmailModal = true">메일 공유</button>
        <button class="metro-btn metro-btn--red" :disabled="deleting" @click="handleDelete">
          {{ deleting ? '삭제 중...' : '삭제' }}
        </button>
      </div>
    </div>

    <!-- 메일 공유 모달 -->
    <div v-if="showEmailModal" class="email-modal__backdrop" @click.self="showEmailModal = false">
      <div class="email-modal">
        <h3 class="email-modal__title">메일 공유</h3>
        <p class="email-modal__desc">수신자 이메일을 입력하세요. 여러 명은 콤마(,)로 구분합니다.</p>
        <input v-model="emailRecipients" type="text" class="metro-input" placeholder="example@company.com" />
        <div class="email-modal__actions">
          <button class="metro-btn metro-btn--green" :disabled="sendingEmail || !emailRecipients.trim()" @click="handleSendEmail">
            {{ sendingEmail ? '발송 중...' : '발송' }}
          </button>
          <button class="metro-btn metro-btn--outline" @click="showEmailModal = false">취소</button>
        </div>
        <div v-if="emailMsg" class="email-modal__msg">{{ emailMsg }}</div>
      </div>
    </div>

    <h2 class="metro-section__title">회의록 편집</h2>

    <div v-if="loading" class="metro-loading">Loading...</div>

    <template v-else>
      <div v-if="!isSharedView" class="note-edit__info">
        <div class="badge-select" @click.stop="showDeptDropdown = !showDeptDropdown; showTeamDropdown = false">
          <span class="note-edit__badge" :style="{ backgroundColor: selectedDeptColor }">
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
          <span class="note-edit__badge" :style="{ backgroundColor: selectedTeamColor }">
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
      </div>

      <div v-if="!isSharedView" class="note-edit__top">
        <CalendarPicker v-model="reportDate" />
      </div>

      <div class="note-edit__editor">
        <RichEditor v-model="content" :editable="!isSharedView" />
      </div>

      <div v-if="errorMsg" class="note-edit__error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="note-edit__success">{{ successMsg }}</div>

      <div v-if="!isSharedView" class="metro-btn-group">
        <button type="button" class="metro-btn metro-btn--green" :disabled="saving" @click="handleSave">
          {{ saving ? '저장 중...' : '저장' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.note-edit__top-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.note-edit__top-right { display: flex; gap: 8px; }
.note-edit__info { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.badge-select { position: relative; display: inline-block; }
.note-edit__badge { display: inline-block; padding: 4px 12px; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; user-select: none; }
.note-edit__badge:hover { opacity: 0.85; }
.badge-select__dropdown { position: absolute; top: 100%; left: 0; margin-top: 4px; background: var(--metro-white); border: 1px solid var(--metro-border); box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; min-width: 160px; max-height: 240px; overflow-y: auto; }
.badge-select__item { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
.badge-select__item:hover { background: var(--metro-hover); }
.badge-select__item--active { background: #e8f0fe; font-weight: 600; }
.badge-select__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.note-edit__top { margin-bottom: 16px; }
.note-edit__editor { margin-bottom: 16px; }
.note-edit__error { color: var(--metro-orange); font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.note-edit__success { color: var(--metro-green); font-size: 14px; font-weight: 600; margin-bottom: 8px; }

.email-modal__backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.email-modal { background: #fff; padding: 32px; min-width: 440px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.email-modal__title { font-size: 18px; margin-bottom: 8px; }
.email-modal__desc { font-size: 13px; color: var(--metro-text-light); margin-bottom: 16px; }
.email-modal .metro-input { width: 100%; margin-bottom: 16px; }
.email-modal__actions { display: flex; gap: 8px; }
.email-modal__msg { margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--metro-green); }
</style>
