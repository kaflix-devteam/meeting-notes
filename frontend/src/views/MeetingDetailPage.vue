<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { getFinalReport, deleteFinalReport, getPreviousFinalReport, analyzeWeeklyComparison } from '../api'
import type { FinalReport } from '../types'

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

onMounted(async () => {
  const id = Number(route.params.id)
  try {
    const res = await getFinalReport(id)
    report.value = res.data

    // 이전 주 최종보고서 조회
    if (report.value?.report_date && (report.value as any).department_id) {
      loadingPrevious.value = true
      try {
        const prevRes = await getPreviousFinalReport(
          report.value.report_date,
          (report.value as any).department_id
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
      previousReport.value.report_date
    )
    analysisHtml.value = res.data.analysis_html
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || 'AI 분석에 실패했습니다.'
  } finally {
    analyzing.value = false
  }
}
</script>

<template>
  <div class="meeting-detail">
    <div class="meeting-detail__top-actions">
      <button class="metro-btn metro-btn--outline" @click="router.push('/meetings')">
        &larr; Back to List
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

    <div v-if="loading" class="metro-loading">Loading...</div>

    <div v-else-if="errorMsg && !report" class="metro-empty">{{ errorMsg }}</div>

    <div v-else-if="report" class="meeting-detail__content">
      <h2 class="metro-section__title">
        Meeting Report - {{ report.report_date }}
      </h2>

      <div v-if="report.team_summary" class="meeting-detail__teams">
        <span
          v-for="(value, key) in report.team_summary"
          :key="key"
          class="metro-badge metro-badge--blue"
        >
          {{ (value as any).teamName || key }}
        </span>
      </div>

      <!-- Diff 레이아웃 -->
      <div class="meeting-detail__diff">
        <!-- 왼쪽: 이번 주 -->
        <div class="diff-pane diff-pane--current">
          <div class="diff-pane__header diff-pane__header--current">
            Current — {{ report.report_date }}
          </div>
          <div class="diff-pane__body" v-html="report.content_html"></div>
        </div>

        <!-- 오른쪽: 이전 주 -->
        <div class="diff-pane diff-pane--previous">
          <div class="diff-pane__header diff-pane__header--previous">
            Previous — {{ previousReport?.report_date || '(없음)' }}
          </div>
          <div class="diff-pane__body">
            <div v-if="loadingPrevious" class="diff-pane__loading">Loading...</div>
            <div v-else-if="!previousReport" class="diff-pane__empty">
              이전 주 최종보고서가 없습니다.
            </div>
            <div v-else v-html="previousReport.content_html"></div>
          </div>
        </div>
      </div>

      <!-- AI 분석 버튼 -->
      <div class="meeting-detail__analyze">
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

.meeting-detail__teams {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

/* Diff layout */
.meeting-detail__diff {
  display: flex;
  gap: 0;
  border: 1px solid var(--metro-border);
  min-height: 300px;
  margin-bottom: 16px;
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
  flex-shrink: 0;
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
  padding: 24px;
  font-size: 14px;
  line-height: 1.7;
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

.diff-pane__body :deep(h2) {
  font-size: 18px;
  margin: 20px 0 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--metro-blue);
}

.diff-pane__body :deep(h3) {
  font-size: 15px;
  margin: 14px 0 6px;
}

.diff-pane__body :deep(ul),
.diff-pane__body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.diff-pane__body :deep(blockquote) {
  border-left: 3px solid var(--metro-blue);
  padding-left: 16px;
  color: var(--metro-text-light);
}

/* 최종보고서 통일 양식 */
.diff-pane__body :deep(.fr-header) {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 3px solid #333;
}

.diff-pane__body :deep(.fr-header h1) {
  font-size: 20px;
  margin: 0 0 12px;
  text-align: center;
  letter-spacing: 2px;
}

.diff-pane__body :deep(.fr-meta) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.diff-pane__body :deep(.fr-meta th) {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 6px 12px;
  text-align: left;
  width: 100px;
  font-weight: 600;
  white-space: nowrap;
}

.diff-pane__body :deep(.fr-meta td) {
  border: 1px solid #ddd;
  padding: 6px 12px;
}

.diff-pane__body :deep(.fr-team) {
  margin-bottom: 20px;
}

.diff-pane__body :deep(.fr-team__header) {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--metro-blue);
  color: #fff;
  padding: 8px 14px;
  margin: 0;
}

.diff-pane__body :deep(.fr-team__header h3) {
  margin: 0;
  font-size: 15px;
  color: #fff;
}

.diff-pane__body :deep(.fr-team__count) {
  font-size: 12px;
  opacity: 0.8;
}

.diff-pane__body :deep(.fr-team__members) {
  border: 1px solid #ddd;
  border-top: none;
}

.diff-pane__body :deep(.fr-member) {
  display: flex;
  border-bottom: 1px solid #eee;
}

.diff-pane__body :deep(.fr-member:last-child) {
  border-bottom: none;
}

.diff-pane__body :deep(.fr-member__name) {
  min-width: 80px;
  max-width: 80px;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 13px;
  background: #fafafa;
  border-right: 1px solid #eee;
  display: flex;
  align-items: flex-start;
}

.diff-pane__body :deep(.fr-member__content) {
  flex: 1;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.7;
}

.diff-pane__body :deep(.fr-member__content h2) {
  font-size: 14px;
  margin: 8px 0 4px;
  padding-bottom: 2px;
  border-bottom: 1px solid #eee;
}

.diff-pane__body :deep(.fr-member__content h3) {
  font-size: 13px;
  margin: 6px 0 2px;
}

.diff-pane__body :deep(.fr-member__content ul),
.diff-pane__body :deep(.fr-member__content ol) {
  padding-left: 20px;
  margin: 4px 0;
}

.diff-pane__body :deep(.fr-member__content p) {
  margin: 4px 0;
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

@media (max-width: 900px) {
  .meeting-detail__diff {
    flex-direction: column;
  }
  .diff-pane--current {
    border-right: none;
    border-bottom: 2px solid var(--metro-border);
  }
}
</style>
