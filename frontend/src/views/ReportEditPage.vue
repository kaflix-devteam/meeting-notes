<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RichEditor from '../components/RichEditor.vue'
import TagInput from '../components/TagInput.vue'
import CalendarPicker from '../components/CalendarPicker.vue'
import FileUploader from '../components/FileUploader.vue'
import ReportPreview from '../components/ReportPreview.vue'
import PolishOverlay from '../components/PolishOverlay.vue'
import { useAuthStore } from '../stores/authStore'
import { getReport, updateReport, uploadAttachment, deleteReport, polishReport, mergeFinalReport, getPreviousWeekReport, getDepartments, getTeams, getReportTags, setReportTags } from '../api'
import { hasPendingUploads, waitForUploads } from '../extensions/clipboardImagePaste'
import type { Department, Team } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const reportId = ref(0)
const reportUserId = ref<number | null>(null)
const content = ref('')
const reportDate = ref('')
const showPreview = ref(false)
const saving = ref(false)
const deleting = ref(false)
const polishing = ref(false)
const merging = ref(false)
const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')
const fileUploaderRef = ref<InstanceType<typeof FileUploader> | null>(null)
const existingAttachments = ref<any[]>([])

function onAttachmentDeleted(id: number) {
  existingAttachments.value = existingAttachments.value.filter(a => a.id !== id)
}

const previousReport = ref<any>(null)
const loadingPrevious = ref(false)

// 사업부/팀 선택
const departments = ref<Department[]>([])
const allTeams = ref<Team[]>([])
const selectedDeptId = ref<number | null>(null)
const selectedTeamId = ref<number | null>(null)
const showDeptDropdown = ref(false)
const showTeamDropdown = ref(false)
const selectedTags = ref<any[]>([])

const filteredTeams = computed(() => {
  if (!selectedDeptId.value) return allTeams.value
  return allTeams.value.filter(t => t.department_id === selectedDeptId.value)
})

const selectedDept = computed(() => departments.value.find(d => d.id === selectedDeptId.value))
const selectedTeam = computed(() => allTeams.value.find(t => t.id === selectedTeamId.value))

const selectedDeptColor = computed(() => (selectedDept.value as any)?.color || auth.user?.department_color || '#5c2d91')
const selectedTeamColor = computed(() => (selectedTeam.value as any)?.color || auth.user?.team_color || '#107c10')

function selectDept(dept: Department) {
  selectedDeptId.value = dept.id
  showDeptDropdown.value = false
  const teams = allTeams.value.filter(t => t.department_id === dept.id)
  const first = teams[0]
  if (first) {
    selectedTeamId.value = first.id
  } else {
    selectedTeamId.value = null
  }
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

async function fetchPreviousReport() {
  const uid = reportUserId.value || auth.user?.id
  if (!uid || !reportDate.value) return
  loadingPrevious.value = true
  try {
    const res = await getPreviousWeekReport(uid, reportDate.value, selectedTeamId.value || undefined)
    previousReport.value = res.data
  } catch {
    previousReport.value = null
  } finally {
    loadingPrevious.value = false
  }
}

// 날짜 변경 시 이전 주 리포트 자동 조회
watch(reportDate, () => { fetchPreviousReport() })

onMounted(async () => {
  document.addEventListener('click', closeDropdowns)
  reportId.value = Number(route.params.id)
  try {
    const [reportRes, deptRes, teamRes] = await Promise.all([
      getReport(reportId.value),
      getDepartments(),
      getTeams(),
    ])
    content.value = reportRes.data.content_html
    reportDate.value = reportRes.data.report_date
    reportUserId.value = reportRes.data.user_id
    existingAttachments.value = (reportRes.data as any).attachments || []
    departments.value = deptRes.data
    allTeams.value = teamRes.data

    // 보고서의 현재 team_id로 초기값 설정
    const teamId = reportRes.data.team_id
    if (teamId) {
      selectedTeamId.value = teamId
      const team = teamRes.data.find((t: Team) => t.id === teamId)
      if (team) selectedDeptId.value = team.department_id
    } else {
      selectedDeptId.value = auth.user?.department_id || null
      selectedTeamId.value = auth.user?.team_id || null
    }

    fetchPreviousReport()

    // 보고서 태그 로드 (TagInput 초기화 후 실행되도록 nextTick 사용)
    const tagRes = await getReportTags(reportId.value)
    await nextTick()
    selectedTags.value = tagRes.data
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || 'Failed to load report.'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
})

async function handleDelete() {
  if (!confirm('정말 이 보고서를 삭제하시겠습니까?')) return

  deleting.value = true
  errorMsg.value = ''

  try {
    await deleteReport(reportId.value)
    router.push('/my-reports')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || 'Failed to delete report.'
  } finally {
    deleting.value = false
  }
}

async function handlePolish() {
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = '다듬을 내용을 먼저 작성해주세요.'
    return
  }

  polishing.value = true
  errorMsg.value = ''

  try {
    const res = await polishReport(content.value, previousReport.value?.content_html)
    content.value = res.data.content_html
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || 'AI 다듬기에 실패했습니다.'
  } finally {
    polishing.value = false
  }
}

async function handleMerge() {
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = '보고서 내용을 먼저 작성해주세요.'
    return
  }
  if (!reportDate.value) {
    errorMsg.value = '보고서 날짜가 필요합니다.'
    return
  }

  merging.value = true
  errorMsg.value = ''

  try {
    if (hasPendingUploads()) await waitForUploads()

    // 보고서 저장 먼저
    await updateReport(reportId.value, {
      content_html: content.value,
      report_date: reportDate.value,
      team_id: selectedTeamId.value || undefined,
    })

    if (fileUploaderRef.value && fileUploaderRef.value.files.length > 0) {
      for (const file of fileUploaderRef.value.files) {
        await uploadAttachment(reportId.value, file)
      }
    }

    // 병합 (날짜 기준으로 해당 소속 자동 판별)
    await mergeFinalReport(reportDate.value)
    alert('보고서가 저장되고 최종보고서에 병합되었습니다.')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '최종보고서 병합에 실패했습니다.'
  } finally {
    merging.value = false
  }
}

async function handleSave() {
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = '보고서 내용을 작성해주세요.'
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

    await updateReport(reportId.value, {
      content_html: content.value,
      report_date: reportDate.value,
      team_id: selectedTeamId.value || undefined,
    })

    if (fileUploaderRef.value && fileUploaderRef.value.files.length > 0) {
      for (const file of fileUploaderRef.value.files) {
        await uploadAttachment(reportId.value, file)
      }
    }

    // 태그 저장
    await setReportTags(reportId.value, selectedTags.value.map((t: any) => t.id))

    successMsg.value = '저장되었습니다.'
    setTimeout(() => { successMsg.value = '' }, 3000)
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || e.message || 'Failed to update report.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="report-edit">
    <h2 class="metro-section__title">Edit Report</h2>

    <div v-if="loading" class="metro-loading">Loading...</div>

    <div v-else class="report-edit__form">
      <div class="report-edit__info">
        <div class="badge-select" @click.stop="showDeptDropdown = !showDeptDropdown; showTeamDropdown = false">
          <span class="report-edit__badge report-edit__badge--clickable" :style="{ backgroundColor: selectedDeptColor }">
            {{ selectedDept?.name || auth.user?.department_name || '사업부' }} &#9662;
          </span>
          <div v-if="showDeptDropdown" class="badge-select__dropdown">
            <div
              v-for="dept in departments"
              :key="dept.id"
              class="badge-select__item"
              :class="{ 'badge-select__item--active': dept.id === selectedDeptId }"
              @click.stop="selectDept(dept)"
            >
              <span class="badge-select__dot" :style="{ backgroundColor: (dept as any).color || '#5c2d91' }"></span>
              {{ dept.name }}
            </div>
          </div>
        </div>

        <div class="badge-select" @click.stop="showTeamDropdown = !showTeamDropdown; showDeptDropdown = false">
          <span class="report-edit__badge report-edit__badge--clickable" :style="{ backgroundColor: selectedTeamColor }">
            {{ selectedTeam?.name || auth.user?.team_name || '팀' }} &#9662;
          </span>
          <div v-if="showTeamDropdown" class="badge-select__dropdown">
            <div
              v-for="team in filteredTeams"
              :key="team.id"
              class="badge-select__item"
              :class="{ 'badge-select__item--active': team.id === selectedTeamId }"
              @click.stop="selectTeam(team)"
            >
              <span class="badge-select__dot" :style="{ backgroundColor: (team as any).color || '#107c10' }"></span>
              {{ team.name }}
            </div>
          </div>
        </div>

        <TagInput v-model="selectedTags" :department-id="selectedDeptId" :team-id="selectedTeamId" />
        <span class="report-edit__user">{{ auth.user?.display_name }}</span>
      </div>

      <div class="report-edit__top">
        <CalendarPicker v-model="reportDate" />
      </div>

      <div class="report-edit__diff">
        <!-- 왼쪽: 이전 주 리포트 -->
        <div class="diff-pane diff-pane--previous">
          <div class="diff-pane__header diff-pane__header--previous">
            지난 주 — {{ previousReport?.report_date || '(없음)' }}
          </div>
          <div class="diff-pane__body">
            <div v-if="loadingPrevious" class="diff-pane__loading">Loading...</div>
            <div v-else-if="!previousReport" class="diff-pane__empty">
              이전 주 보고서가 없습니다.
            </div>
            <div v-else class="diff-pane__content" v-html="previousReport.content_html"></div>
          </div>
        </div>

        <!-- 오른쪽: 현재 편집 영역 -->
        <div class="diff-pane diff-pane--current">
          <div class="diff-pane__header diff-pane__header--current">
            금주 — {{ reportDate }}
          </div>
          <div class="diff-pane__body">
            <div class="report-edit__editor">
              <RichEditor v-model="content" :editable="!polishing" />
            </div>

            <FileUploader ref="fileUploaderRef" :report-id="reportId" :existing="existingAttachments" @deleted="onAttachmentDeleted" />
          </div>
        </div>
      </div>

      <div v-if="errorMsg" class="report-edit__error">{{ errorMsg }}</div>
      <div v-if="successMsg" class="report-edit__success">{{ successMsg }}</div>

      <div class="metro-btn-group">
        <button
          type="button"
          class="metro-btn metro-btn--outline"
          @click="showPreview = true"
        >
          Preview
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--green"
          :disabled="saving || polishing"
          @click="handleSave"
        >
          {{ saving ? '저장 중...' : '1. Save' }}
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--blue"
          :disabled="polishing || saving"
          @click="handlePolish"
        >
          {{ polishing ? 'AI 다듬는 중...' : '2. AI 다듬기' }}
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--purple"
          :disabled="merging || saving || polishing"
          @click="handleMerge"
        >
          {{ merging ? '병합 중...' : '3. 최종보고서에 병합' }}
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--blue"
          @click="router.push('/my-reports')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--red"
          :disabled="deleting"
          @click="handleDelete"
        >
          {{ deleting ? 'Deleting...' : 'Delete' }}
        </button>
      </div>
    </div>

    <ReportPreview
      :content="content"
      :visible="showPreview"
      @close="showPreview = false"
    />

    <PolishOverlay :visible="polishing || merging" :mode="merging ? 'merge' : 'polish'" />
  </div>
</template>

<style scoped>
.report-edit__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-edit__info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-select {
  position: relative;
  display: inline-block;
}

.report-edit__badge {
  display: inline-block;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.report-edit__badge--clickable {
  cursor: pointer;
  user-select: none;
  transition: opacity 0.15s;
}

.report-edit__badge--clickable:hover {
  opacity: 0.85;
}

.badge-select__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--metro-white);
  border: 1px solid var(--metro-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 160px;
  max-height: 240px;
  overflow-y: auto;
}

.badge-select__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}

.badge-select__item:hover {
  background: var(--metro-hover);
}

.badge-select__item--active {
  background: #e8f0fe;
  font-weight: 600;
}

.badge-select__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.report-edit__user {
  font-size: 14px;
  color: var(--metro-text);
  font-weight: 600;
  margin-left: 4px;
}

.report-edit__top {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.report-edit__error {
  color: var(--metro-orange);
  font-size: 14px;
  font-weight: 600;
}

.report-edit__success {
  color: var(--metro-green);
  font-size: 14px;
  font-weight: 600;
}

/* Diff layout */
.report-edit__diff {
  display: flex;
  gap: 0;
  border: 1px solid var(--metro-border);
  min-height: 400px;
}

.diff-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.diff-pane--current {
  border-right: 2px solid var(--metro-border);
}

.diff-pane__header {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--metro-border);
}

.diff-pane__header--current {
  background: #e6f4e6;
  color: var(--metro-green);
}

.diff-pane__header--previous {
  background: #fff3e0;
  color: #d83b01;
}

.diff-pane__body {
  flex: 1;
  overflow-y: auto;
  background: var(--metro-white);
}

.diff-pane--current .diff-pane__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.diff-pane__loading {
  padding: 32px;
  text-align: center;
  color: var(--metro-text-light);
}

.diff-pane__empty {
  padding: 32px;
  text-align: center;
  color: var(--metro-text-light);
  font-size: 14px;
}

.diff-pane__content {
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
}

.diff-pane__content :deep(h2) {
  font-size: 18px;
  margin: 16px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--metro-border);
}

.diff-pane__content :deep(h3) {
  font-size: 15px;
  margin: 12px 0 6px;
}

.diff-pane__content :deep(ul),
.diff-pane__content :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.diff-pane__content :deep(blockquote) {
  border-left: 3px solid var(--metro-border);
  padding-left: 16px;
  color: var(--metro-text-light);
}

.report-edit__editor {
  flex: 1;
}

@media (max-width: 900px) {
  .report-edit__diff {
    flex-direction: column;
  }
  .diff-pane--current {
    border-right: none;
    border-bottom: 2px solid var(--metro-border);
  }
}
</style>
