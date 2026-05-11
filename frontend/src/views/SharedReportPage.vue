<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getSharedReport, getDepartments, getTeams } from '../api'
import type { FinalReport, Department, Team } from '../types'

const route = useRoute()
const report = ref<FinalReport | null>(null)
const loading = ref(true)
const errorMsg = ref('')

const teamMap = ref<Map<number, Team>>(new Map())
const deptMap = ref<Map<number, Department>>(new Map())

function getTeamName(id: number): string {
  return teamMap.value.get(id)?.name || String(id)
}

function getDeptName(id: number): string {
  return deptMap.value.get(id)?.name || String(id)
}

function resolveHtmlNames(html: string): string {
  if (!html) return html
  let resolved = html
  resolved = resolved.replace(
    /(<h3\s+data-team-id="(\d+)">)[^<]*(<\/h3>)/g,
    (_m, before, id, after) => `${before}${getTeamName(Number(id))}${after}`
  )
  resolved = resolved.replace(
    /(<td\s+data-dept-id="(\d+)">)[^<]*(<\/td>)/g,
    (_m, before, id, after) => `${before}${getDeptName(Number(id))}${after}`
  )
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
  const token = route.params.token as string
  try {
    const [reportRes, deptRes, teamRes] = await Promise.all([
      getSharedReport(token),
      getDepartments(),
      getTeams(),
    ])
    for (const d of deptRes.data) deptMap.value.set(d.id, d)
    for (const t of teamRes.data) teamMap.value.set(t.id, t)
    report.value = reportRes.data
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '보고서를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="shared-report">
    <div class="shared-report__header">
      <h1 class="shared-report__title">보고또보고서</h1>
    </div>

    <div v-if="loading" class="metro-loading">Loading...</div>
    <div v-else-if="errorMsg" class="metro-empty">{{ errorMsg }}</div>

    <div v-else-if="report" class="shared-report__content">
      <h2>Meeting Report - {{ report.report_date }}</h2>
      <div class="shared-report__body" v-html="resolveHtmlNames(report.content_html)"></div>

      <div v-if="(report as any).meeting_notes" class="shared-report__notes">
        <h3>회의록</h3>
        <div v-html="(report as any).meeting_notes"></div>
      </div>

      <div v-if="(report as any).analysis_html" class="shared-report__analysis">
        <div v-html="(report as any).analysis_html"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shared-report {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.shared-report__header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 3px solid #0078D4;
}

.shared-report__title {
  font-size: 24px;
  color: #0078D4;
  font-weight: 300;
}

.shared-report__body {
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 24px;
}

.shared-report__body :deep(img) { max-width: 100%; height: auto; }
.shared-report__body :deep(.fr-header) { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #333; }
.shared-report__body :deep(.fr-header h1) { font-size: 20px; text-align: center; letter-spacing: 2px; margin: 0 0 12px; }
.shared-report__body :deep(.fr-meta) { width: 100%; border-collapse: collapse; font-size: 13px; }
.shared-report__body :deep(.fr-meta th) { background: #f5f5f5; border: 1px solid #ddd; padding: 6px 12px; text-align: left; width: 100px; font-weight: 600; }
.shared-report__body :deep(.fr-meta td) { border: 1px solid #ddd; padding: 6px 12px; }
.shared-report__body :deep(.fr-team) { margin-bottom: 20px; }
.shared-report__body :deep(.fr-team__header) { display: flex; align-items: center; gap: 8px; background: #0078D4; color: #fff; padding: 8px 14px; }
.shared-report__body :deep(.fr-team__header h3) { margin: 0; font-size: 15px; color: #fff; }
.shared-report__body :deep(.fr-team__count) { font-size: 12px; opacity: 0.8; }
.shared-report__body :deep(.fr-team__members) { border: 1px solid #ddd; border-top: none; }
.shared-report__body :deep(.fr-member) { display: flex; border-bottom: 1px solid #eee; }
.shared-report__body :deep(.fr-member:last-child) { border-bottom: none; }
.shared-report__body :deep(.fr-member__name) { min-width: 80px; max-width: 80px; padding: 10px 12px; font-weight: 600; font-size: 13px; background: #fafafa; border-right: 1px solid #eee; }
.shared-report__body :deep(.fr-member__content) { flex: 1; padding: 10px 14px; font-size: 13px; line-height: 1.7; }
.shared-report__body :deep(ul), .shared-report__body :deep(ol) { padding-left: 24px; margin: 8px 0; }

.shared-report__notes {
  margin-bottom: 24px;
  border: 1px solid #ddd;
  padding: 16px;
}
.shared-report__notes h3 { font-size: 16px; margin: 0 0 12px; color: #107c10; }

.shared-report__analysis {
  border: 2px solid #5c2d91;
  padding: 24px;
  font-size: 14px;
  line-height: 1.7;
}
.shared-report__analysis :deep(h3) { font-size: 18px; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #5c2d91; color: #5c2d91; }
</style>
