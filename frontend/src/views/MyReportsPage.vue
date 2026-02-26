<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '../stores/reportStore'

const store = useReportStore()
const router = useRouter()

onMounted(() => {
  store.fetchMyReports()
})

function goToEdit(id: number) {
  router.push(`/reports/${id}/edit`)
}

function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || '').slice(0, 120)
}
</script>

<template>
  <div class="my-reports">
    <h2 class="metro-section__title">My Reports</h2>

    <div v-if="store.loading" class="metro-loading">Loading...</div>

    <div v-else-if="store.myReports.length === 0" class="metro-empty">
      No reports yet. <router-link to="/reports/new">Create one</router-link>
    </div>

    <div v-else class="my-reports__list">
      <div
        v-for="report in store.myReports"
        :key="report.id"
        class="metro-card metro-card--clickable"
        @click="goToEdit(report.id)"
      >
        <div class="my-reports__header">
          <span class="my-reports__date">{{ report.report_date }}</span>
          <span v-if="report.team_name" class="metro-badge metro-badge--green">
            {{ report.team_name }}
          </span>
        </div>
        <p class="my-reports__summary">{{ stripHtml(report.content_html) }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-reports__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.my-reports__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.my-reports__date {
  font-size: 16px;
  font-weight: 600;
}

.my-reports__summary {
  font-size: 13px;
  color: var(--metro-text-light);
  line-height: 1.5;
}
</style>
