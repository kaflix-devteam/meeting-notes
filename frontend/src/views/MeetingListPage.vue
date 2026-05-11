<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '../stores/reportStore'
import { getDepartments, getTeams } from '../api'
import type { Department, Team } from '../types'

const store = useReportStore()
const router = useRouter()

const deptMap = ref<Map<number, Department>>(new Map())
const teamMap = ref<Map<number, Team>>(new Map())

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return dayNames[d.getDay()] || ''
}

onMounted(async () => {
  const [deptRes, teamRes] = await Promise.all([getDepartments(), getTeams()])
  for (const d of deptRes.data) deptMap.value.set(d.id, d)
  for (const t of teamRes.data) teamMap.value.set(t.id, t)
  await store.fetchFinalReports()
})

function goToDetail(id: number) {
  router.push(`/meetings/${id}`)
}

function getDeptDisplay(report: any) {
  if (report.department_id && deptMap.value.has(report.department_id)) {
    const d = deptMap.value.get(report.department_id)!
    return { name: d.name, color: (d as any).color || '#5c2d91' }
  }
  if (report.department_name) {
    return { name: report.department_name, color: report.department_color || '#5c2d91' }
  }
  return null
}

function getTeamBadges(report: any): { name: string; color: string }[] {
  const summary = report.team_summary
  if (!summary) return []
  return Object.entries(summary).map(([code, entry]: [string, any]) => {
    const team = entry.teamId ? teamMap.value.get(entry.teamId) : null
    return {
      name: team?.name || code,
      color: (team as any)?.color || '#0078D4',
    }
  })
}
</script>

<template>
  <div class="meeting-list">
    <h2 class="metro-section__title">Meetings</h2>

    <div v-if="store.loading" class="metro-loading">Loading...</div>

    <div v-else-if="store.finalReports.length === 0" class="metro-empty">
      No meeting reports found.
    </div>

    <div v-else class="meeting-list__cards">
      <div
        v-for="report in store.finalReports"
        :key="report.id"
        class="metro-card metro-card--clickable meeting-list__row"
        @click="goToDetail(report.id)"
      >
        <span class="meeting-list__date">{{ report.report_date }} ({{ getDayName(report.report_date) }})</span>
        <span
          v-if="getDeptDisplay(report)"
          class="metro-badge"
          :style="{ backgroundColor: getDeptDisplay(report)!.color }"
        >
          {{ getDeptDisplay(report)!.name }}
        </span>
        <span
          v-for="badge in ((report as any).team_badges || getTeamBadges(report))"
          :key="badge.name"
          class="metro-badge"
          :style="{ backgroundColor: badge.color }"
        >
          {{ badge.name }}
        </span>
        <span
          v-for="tag in ((report as any).tag_names || [])"
          :key="tag"
          class="metro-badge metro-badge--tag"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.meeting-list__cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meeting-list__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  flex-wrap: wrap;
}

.meeting-list__date {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.metro-badge--tag {
  background: #0078D4 !important;
  color: #fff !important;
  font-size: 11px;
  padding: 2px 6px;
}
</style>
