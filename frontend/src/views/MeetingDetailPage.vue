<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import RichEditor from '../components/RichEditor.vue'
import { getFinalReport, deleteFinalReport, getPreviousFinalReport, analyzeWeeklyComparison, getDepartments, getTeams, generateShareLink, sendShareEmail, getSharedReport, getTags, saveMeetingNotes } from '../api'
import type { FinalReport, Department, Team } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const report = ref<FinalReport | null>(null)
const previousReport = ref<FinalReport | null>(null)
const loading = ref(true)
const loadingPrevious = ref(false)
const deleting = ref(false)
const analyzing = ref(false)
const analysisHtml = ref('')
const errorMsg = ref('')
const shareUrl = ref('')
const sharing = ref(false)
const showEmailModal = ref(false)
const emailRecipients = ref('')
const sendingEmail = ref(false)
const emailMsg = ref('')
const isSharedView = ref(false)
const meetingNotes = ref('')
const savingNotes = ref(false)
const notesSaveMsg = ref('')

// 팀/사업부/태그 이름 매핑
const teamMap = ref<Map<number, Team>>(new Map())
const deptMap = ref<Map<number, Department>>(new Map())
const tagNameMap = ref<Map<number, string>>(new Map())

function getTeamName(id: number): string {
  return teamMap.value.get(id)?.name || String(id)
}

function getDeptName(id: number): string {
  return deptMap.value.get(id)?.name || String(id)
}

// team_summary에서 팀 배지 목록 생성
function getTeamBadges(summary: Record<string, any> | null): { name: string; color: string }[] {
  if (!summary) return []
  return Object.values(summary).map((entry: any) => {
    const team = entry.teamId ? teamMap.value.get(entry.teamId) : null
    return {
      name: team?.name || entry.teamName || '?',
      color: (team as any)?.color || '#0078D4',
    }
  })
}

function getTagNames(report: any): string[] {
  const sig = report?.tag_signature
  if (!sig) return []
  return sig.split(',').map((id: string) => tagNameMap.value.get(parseInt(id, 10)) || '').filter(Boolean)
}

// content_html 내 data 속성의 ID를 현재 팀/사업부 이름으로 치환
function resolveHtmlNames(html: string): string {
  if (!html) return html
  let resolved = html

  // data-team-id="N">...</h3> → 현재 팀 이름
  resolved = resolved.replace(
    /(<h3\s+data-team-id="(\d+)">)[^<]*(<\/h3>)/g,
    (_m, before, id, after) => `${before}${getTeamName(Number(id))}${after}`
  )

  // data-dept-id="N">...</td> → 현재 사업부 이름
  resolved = resolved.replace(
    /(<td\s+data-dept-id="(\d+)">)[^<]*(<\/td>)/g,
    (_m, before, id, after) => `${before}${getDeptName(Number(id))}${after}`
  )

  // data-teams-meta="id1,id2">...</td> → 팀 이름 목록
  resolved = resolved.replace(
    /(data-teams-meta="([^"]+)">)[^<]*(<\/td>)/g,
    (_m, before, ids, after) => {
      const names = (ids as string).split(',').map((id: string) => getTeamName(Number(id)))
      return `${before}${names.join(', ')}${after}`
    }
  )

  return resolved
}

onMounted(async () => {
  const id = Number(route.params.id)
  const token = route.query.token as string | undefined
  isSharedView.value = !!token

  try {
    // 팀/사업부 목록과 보고서를 병렬 로드 (토큰이 있으면 공유 API 사용)
    const reportPromise = token ? getSharedReport(token) : getFinalReport(id)
    const [reportRes, deptRes, teamRes] = await Promise.all([
      reportPromise,
      getDepartments(),
      getTeams(),
    ])

    // 매핑 테이블 구축
    for (const d of deptRes.data) deptMap.value.set(d.id, d)
    for (const t of teamRes.data) teamMap.value.set(t.id, t)

    report.value = reportRes.data

    // 태그 이름 로드
    const tagSig = (reportRes.data as any).tag_signature
    if (tagSig) {
      const deptId = (reportRes.data as any).department_id
      const summary = reportRes.data.team_summary
      const firstTeamId = summary ? Object.values(summary).map((e: any) => e.teamId).find(Boolean) : null
      if (deptId && firstTeamId) {
        try {
          const tagRes = await getTags(deptId, firstTeamId)
          for (const t of tagRes.data) tagNameMap.value.set(t.id, t.name)
        } catch { /* ignore */ }
      }
    }

    // 이전 회의록이 있으면 로드
    if ((reportRes.data as any).meeting_notes) {
      meetingNotes.value = (reportRes.data as any).meeting_notes
    }

    // 이전 AI 분석 결과가 있으면 자동 표시
    if ((reportRes.data as any).analysis_html) {
      analysisHtml.value = (reportRes.data as any).analysis_html
    }

    // 이전 주 최종보고서 조회
    if (report.value?.report_date && (report.value as any).department_id) {
      loadingPrevious.value = true
      try {
        const prevRes = await getPreviousFinalReport(
          report.value.report_date,
          (report.value as any).department_id,
          (report.value as any).tag_signature || ''
        )
        previousReport.value = prevRes.data
      } catch {
        previousReport.value = null
      } finally {
        loadingPrevious.value = false
      }
    }
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || 'Failed to load report.'
  } finally {
    loading.value = false
  }
})

async function handleDelete() {
  if (!report.value) return
  if (!confirm('정말 이 최종보고서를 삭제하시겠습니까?')) return

  deleting.value = true
  try {
    await deleteFinalReport(report.value.id)
    router.push('/meetings')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '삭제에 실패했습니다.'
  } finally {
    deleting.value = false
  }
}

async function handleSaveNotes() {
  if (!report.value) return
  savingNotes.value = true
  notesSaveMsg.value = ''
  try {
    await saveMeetingNotes(report.value.id, meetingNotes.value)
    notesSaveMsg.value = '회의록이 저장되었습니다.'
    setTimeout(() => { notesSaveMsg.value = '' }, 3000)
  } catch (e: any) {
    notesSaveMsg.value = e.response?.data?.error || '회의록 저장에 실패했습니다.'
  } finally {
    savingNotes.value = false
  }
}

async function handleAnalyze() {
  if (!report.value || !previousReport.value) return

  analyzing.value = true
  analysisHtml.value = ''
  errorMsg.value = ''

  try {
    const res = await analyzeWeeklyComparison(
      report.value.content_html,
      previousReport.value.content_html,
      report.value.report_date,
      previousReport.value.report_date,
      report.value.id
    )
    analysisHtml.value = res.data.analysis_html
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || 'AI 분석에 실패했습니다.'
  } finally {
    analyzing.value = false
  }
}


async function handleShare() {
  if (!report.value) return
  sharing.value = true
  try {
    const res = await generateShareLink(report.value.id)
    const fullUrl = window.location.origin + res.data.share_url
    shareUrl.value = fullUrl
    await navigator.clipboard.writeText(fullUrl)
    alert('공유 링크가 클립보드에 복사되었습니다.')
  } catch (e: any) {
    alert(e.response?.data?.error || '공유 링크 생성에 실패했습니다.')
  } finally {
    sharing.value = false
  }
}

async function handleSendEmail() {
  if (!report.value || !emailRecipients.value.trim()) return
  sendingEmail.value = true
  emailMsg.value = ''
  try {
    const recipients = emailRecipients.value.split(',').map(e => e.trim()).filter(Boolean)
    await sendShareEmail(report.value.id, recipients)
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
  <div class="meeting-detail">
    <div class="meeting-detail__top-actions">
      <button v-if="!isSharedView" class="metro-btn metro-btn--outline" @click="router.push('/meetings')">
        &larr; Back to List
      </button>
      <span v-else></span>
      <div v-if="!isSharedView" class="meeting-detail__top-right">
        <button
          v-if="report"
          class="metro-btn metro-btn--blue"
          :disabled="sharing"
          @click="handleShare"
        >
          {{ sharing ? '생성 중...' : '공유 링크' }}
        </button>
        <button
          v-if="report"
          class="metro-btn metro-btn--green"
          @click="showEmailModal = true"
        >
          메일 공유
        </button>
        <button
          v-if="auth.isAdmin && report"
          class="metro-btn metro-btn--red"
          :disabled="deleting"
          @click="handleDelete"
        >
          {{ deleting ? '삭제 중...' : '삭제' }}
        </button>
      </div>
    </div>

    <!-- 메일 공유 모달 -->
    <div v-if="showEmailModal" class="email-modal__backdrop" @click.self="showEmailModal = false">
      <div class="email-modal">
        <h3 class="email-modal__title">메일 공유</h3>
        <p class="email-modal__desc">수신자 이메일을 입력하세요. 여러 명은 콤마(,)로 구분합니다.</p>
        <input
          v-model="emailRecipients"
          type="text"
          class="metro-input"
          placeholder="example@company.com, other@company.com"
        />
        <div class="email-modal__actions">
          <button
            class="metro-btn metro-btn--green"
            :disabled="sendingEmail || !emailRecipients.trim()"
            @click="handleSendEmail"
          >
            {{ sendingEmail ? '발송 중...' : '발송' }}
          </button>
          <button class="metro-btn metro-btn--outline" @click="showEmailModal = false">취소</button>
        </div>
        <div v-if="emailMsg" class="email-modal__msg">{{ emailMsg }}</div>
      </div>
    </div>

    <div v-if="loading" class="metro-loading">Loading...</div>

    <div v-else-if="errorMsg && !report" class="metro-empty">{{ errorMsg }}</div>

    <div v-else-if="report" class="meeting-detail__content">
      <h2 class="metro-section__title">
        Meeting Report - {{ report.report_date }}
      </h2>

      <div class="meeting-detail__teams">
        <!-- 사업부 -->
        <span
          v-if="(report as any).department_id && deptMap.get((report as any).department_id)"
          class="metro-badge"
          :style="{ backgroundColor: (deptMap.get((report as any).department_id) as any)?.color || '#5c2d91' }"
        >
          {{ deptMap.get((report as any).department_id)?.name }}
        </span>
        <!-- 팀 -->
        <span
          v-for="badge in getTeamBadges(report.team_summary)"
          :key="badge.name"
          class="metro-badge"
          :style="{ backgroundColor: badge.color }"
        >
          {{ badge.name }}
        </span>
        <!-- 태그 -->
        <span
          v-for="tag in getTagNames(report)"
          :key="tag"
          class="metro-badge metro-badge--tag"
        >
          {{ tag }}
        </span>
      </div>

      <!-- 4컬럼 레이아웃: 지난주보고서 | 지난주회의록 | 금주보고서 | 금주회의록 -->
      <div class="meeting-detail__columns">
        <!-- 1. 지난 주 보고서 -->
        <div class="col-pane col-pane--previous">
          <div class="col-pane__header col-pane__header--previous">
            지난 주 보고서 — {{ previousReport?.report_date || '(없음)' }}
          </div>
          <div class="col-pane__body">
            <div v-if="loadingPrevious" class="col-pane__loading">Loading...</div>
            <div v-else-if="!previousReport" class="col-pane__empty">
              이전 주 최종보고서가 없습니다.
            </div>
            <div v-else v-html="resolveHtmlNames(previousReport.content_html)"></div>
          </div>
        </div>

        <!-- 2. 지난 주 회의록 -->
        <div class="col-pane col-pane--prev-notes">
          <div class="col-pane__header col-pane__header--prev-notes">
            지난 주 회의록
          </div>
          <div class="col-pane__body">
            <div v-if="loadingPrevious" class="col-pane__loading">Loading...</div>
            <div v-else-if="!previousReport || !(previousReport as any).meeting_notes" class="col-pane__empty">
              이전 주 회의록이 없습니다.
            </div>
            <div v-else v-html="(previousReport as any).meeting_notes"></div>
          </div>
        </div>

        <!-- 3. 금주 보고서 -->
        <div class="col-pane col-pane--current">
          <div class="col-pane__header col-pane__header--current">
            금주 보고서 — {{ report.report_date }}
          </div>
          <div class="col-pane__body" v-html="resolveHtmlNames(report.content_html)"></div>
        </div>

        <!-- 4. 금주 회의록 -->
        <div class="col-pane col-pane--notes">
          <div class="col-pane__header col-pane__header--notes">
            금주 회의록
          </div>
          <div class="col-pane__body col-pane__body--notes">
            <RichEditor v-model="meetingNotes" :editable="!isSharedView" />
          </div>
          <div v-if="!isSharedView" class="col-pane__footer">
            <button
              class="metro-btn metro-btn--green metro-btn--sm"
              :disabled="savingNotes"
              @click="handleSaveNotes"
            >
              {{ savingNotes ? '저장 중...' : '회의록 저장' }}
            </button>
            <span v-if="notesSaveMsg" class="col-pane__msg">{{ notesSaveMsg }}</span>
          </div>
        </div>
      </div>

      <!-- AI 분석 버튼 -->
      <div v-if="!isSharedView" class="meeting-detail__analyze">
        <button
          class="metro-btn metro-btn--purple"
          :disabled="analyzing || !previousReport"
          @click="handleAnalyze"
        >
          {{ analyzing ? 'AI 분석 중...' : 'AI 분석' }}
        </button>
        <span v-if="!previousReport" class="meeting-detail__analyze-hint">
          이전 주 보고서가 있어야 비교 분석이 가능합니다.
        </span>
      </div>

      <div v-if="errorMsg" class="meeting-detail__error">{{ errorMsg }}</div>

      <!-- AI 분석 결과 -->
      <div v-if="analysisHtml" class="meeting-detail__analysis">
        <div class="meeting-detail__analysis-body" v-html="analysisHtml"></div>
      </div>

      <!-- 분석 중 오버레이 -->
      <div v-if="analyzing" class="meeting-detail__analyzing">
        <div class="meeting-detail__analyzing-spinner"></div>
        <p>AI가 주간 보고서를 비교 분석하고 있습니다...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.meeting-detail__top-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.meeting-detail__top-right {
  display: flex;
  gap: 8px;
}

/* 메일 모달 */
.email-modal__backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.email-modal {
  background: #fff;
  padding: 32px;
  min-width: 440px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.email-modal__title {
  font-size: 18px;
  margin-bottom: 8px;
  color: var(--metro-text);
}

.email-modal__desc {
  font-size: 13px;
  color: var(--metro-text-light);
  margin-bottom: 16px;
}

.email-modal .metro-input {
  width: 100%;
  margin-bottom: 16px;
}

.email-modal__actions {
  display: flex;
  gap: 8px;
}

.email-modal__msg {
  margin-top: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--metro-green);
}

.meeting-detail__teams {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.metro-badge--tag {
  background: #0078D4 !important;
  color: #fff !important;
  font-size: 11px;
  padding: 2px 6px;
}

/* 3컬럼 레이아웃 */
.meeting-detail__columns {
  display: flex;
  gap: 0;
  border: 1px solid var(--metro-border);
  min-height: 400px;
  margin-bottom: 16px;
}

.col-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--metro-border);
}

.col-pane:last-child {
  border-right: none;
}

.col-pane__header {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--metro-border);
  flex-shrink: 0;
}

.col-pane__header--current {
  background: #e6f4e6;
  color: var(--metro-green);
}

.col-pane__header--previous {
  background: #fff3e0;
  color: #d83b01;
}


.col-pane__header--prev-notes {
  background: #fef3e0;
  color: #a85d00;
}

.col-pane__header--notes {
  background: #e8f0fe;
  color: var(--metro-blue);
}

.col-pane__body {
  flex: 1;
  overflow-y: auto;
  background: var(--metro-white);
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
}

.col-pane__body--notes {
  padding: 0;
}

.col-pane__body--notes :deep(.rich-editor) {
  border: none;
  min-height: 100%;
}

.col-pane__body--notes :deep(.rich-editor__content) {
  min-height: 300px;
}

.col-pane__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--metro-border);
  flex-shrink: 0;
}

.col-pane__msg {
  font-size: 12px;
  font-weight: 600;
  color: var(--metro-green);
}

.col-pane__loading {
  padding: 32px;
  text-align: center;
  color: var(--metro-text-light);
}

.col-pane__empty {
  padding: 32px;
  text-align: center;
  color: var(--metro-text-light);
  font-size: 14px;
}

.col-pane__body :deep(h2) {
  font-size: 18px;
  margin: 20px 0 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--metro-blue);
}

.col-pane__body :deep(h3) {
  font-size: 15px;
  margin: 14px 0 6px;
}

.col-pane__body :deep(ul),
.col-pane__body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.col-pane__body :deep(blockquote) {
  border-left: 3px solid var(--metro-blue);
  padding-left: 16px;
  color: var(--metro-text-light);
}

/* 최종보고서 통일 양식 */
.col-pane__body :deep(.fr-header) {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 3px solid #333;
}

.col-pane__body :deep(.fr-header h1) {
  font-size: 18px;
  margin: 0 0 12px;
  text-align: center;
  letter-spacing: 2px;
}

.col-pane__body :deep(.fr-meta) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.col-pane__body :deep(.fr-meta th) {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 4px 8px;
  text-align: left;
  width: 70px;
  font-weight: 600;
  white-space: nowrap;
}

.col-pane__body :deep(.fr-meta td) {
  border: 1px solid #ddd;
  padding: 4px 8px;
}

.col-pane__body :deep(.fr-team) {
  margin-bottom: 16px;
}

.col-pane__body :deep(.fr-team__header) {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--metro-blue);
  color: #fff;
  padding: 6px 12px;
  margin: 0;
}

.col-pane__body :deep(.fr-team__header h3) {
  margin: 0;
  font-size: 14px;
  color: #fff;
}

.col-pane__body :deep(.fr-team__count) {
  font-size: 11px;
  opacity: 0.8;
}

.col-pane__body :deep(.fr-team__members) {
  border: 1px solid #ddd;
  border-top: none;
}

.col-pane__body :deep(.fr-member) {
  display: flex;
  border-bottom: 1px solid #eee;
}

.col-pane__body :deep(.fr-member:last-child) {
  border-bottom: none;
}

.col-pane__body :deep(.fr-member__name) {
  min-width: 60px;
  max-width: 60px;
  padding: 8px 8px;
  font-weight: 600;
  font-size: 12px;
  background: #fafafa;
  border-right: 1px solid #eee;
  display: flex;
  align-items: flex-start;
}

.col-pane__body :deep(.fr-member__content) {
  flex: 1;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
}

.col-pane__body :deep(.fr-member__content h2) {
  font-size: 13px;
  margin: 6px 0 3px;
  padding-bottom: 2px;
  border-bottom: 1px solid #eee;
}

.col-pane__body :deep(.fr-member__content h3) {
  font-size: 12px;
  margin: 4px 0 2px;
}

.col-pane__body :deep(.fr-member__content ul),
.col-pane__body :deep(.fr-member__content ol) {
  padding-left: 16px;
  margin: 4px 0;
}

.col-pane__body :deep(.fr-member__content p) {
  margin: 3px 0;
}

.col-pane__body :deep(img) {
  max-width: 100%;
  height: auto;
}

.col-pane__body :deep(.fr-tag-group) {
  margin-bottom: 24px;
  border: 1px solid #e0e0e0;
  border-radius: 2px;
}

.col-pane__body :deep(.fr-tag-group__header) {
  display: flex;
  gap: 6px;
  padding: 6px 12px;
  background: #f0f4f8;
  border-bottom: 1px solid #e0e0e0;
  flex-wrap: wrap;
}

.col-pane__body :deep(.fr-tag) {
  display: inline-block;
  background: #0078D4;
  color: #fff;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 2px;
}

.metro-btn--sm {
  padding: 4px 12px;
  font-size: 12px;
  min-height: 28px;
}

/* AI 분석 */
.meeting-detail__analyze {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.meeting-detail__analyze-hint {
  font-size: 13px;
  color: var(--metro-text-light);
}

.meeting-detail__error {
  color: var(--metro-orange);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.meeting-detail__analysis {
  border: 2px solid var(--metro-purple);
  background: var(--metro-white);
  margin-bottom: 16px;
}

.meeting-detail__analysis-body {
  padding: 24px;
  font-size: 14px;
  line-height: 1.7;
}

.meeting-detail__analysis-body :deep(h3) {
  font-size: 18px;
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--metro-purple);
  color: var(--metro-purple);
}

.meeting-detail__analysis-body :deep(h4) {
  font-size: 15px;
  margin: 16px 0 8px;
  color: var(--metro-text);
}

.meeting-detail__analysis-body :deep(ul),
.meeting-detail__analysis-body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.meeting-detail__analysis-body :deep(strong) {
  color: var(--metro-purple);
}

.meeting-detail__analyzing {
  text-align: center;
  padding: 32px;
  background: rgba(92, 45, 145, 0.05);
  border: 1px solid var(--metro-purple);
  margin-bottom: 16px;
}

.meeting-detail__analyzing p {
  margin-top: 12px;
  color: var(--metro-purple);
  font-weight: 600;
  font-size: 14px;
}

.meeting-detail__analyzing-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--metro-border);
  border-top-color: var(--metro-purple);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1200px) {
  .meeting-detail__columns {
    flex-direction: column;
  }
  .col-pane {
    border-right: none;
    border-bottom: 1px solid var(--metro-border);
  }
  .col-pane:last-child {
    border-bottom: none;
  }
}
</style>
