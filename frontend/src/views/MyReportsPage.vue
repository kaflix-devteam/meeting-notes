<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '../stores/reportStore'
import { useAuthStore } from '../stores/authStore'
import { deleteReport } from '../api'

const store = useReportStore()
const auth = useAuthStore()
const router = useRouter()
const deleting = ref<number | null>(null)

onMounted(() => {
  if (auth.isAdmin) {
    store.fetchAllReports()
  } else {
    store.fetchMyReports(auth.user?.id)
  }
})

function goToEdit(id: number) {
  router.push(`/reports/${id}/edit`)
}

function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || '').slice(0, 120)
}

async function handleDelete(e: Event, id: number) {
  e.stopPropagation()
  if (!confirm('정말 이 보고서를 삭제하시겠습니까?')) return

  deleting.value = id
  try {
    await deleteReport(id)
    store.myReports = store.myReports.filter(r => r.id !== id)
  } catch (err: any) {
    alert(err.response?.data?.error || '삭제에 실패했습니다.')
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <div class="my-reports">
    <h2 class="metro-section__title">{{ auth.isAdmin ? 'All Reports' : 'My Reports' }}</h2>

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
          <span v-if="(report as any).department_name" class="metro-badge" :style="{ backgroundColor: (report as any).department_color || '#5c2d91' }">
            {{ (report as any).department_name }}
          </span>
          <span v-if="report.team_name" class="metro-badge" :style="{ backgroundColor: (report as any).team_color || '#107c10' }">
            {{ report.team_name }}
          </span>
          <span v-if="(report as any).user_display_name" class="metro-badge metro-badge--blue">
            {{ (report as any).user_display_name }}
          </span>
          <button
            v-if="auth.isAdmin"
            class="metro-btn metro-btn--red metro-btn--small"
            :disabled="deleting === report.id"
            @click="handleDelete($event, report.id)"
          >
            {{ deleting === report.id ? '삭제 중...' : '삭제' }}
          </button>
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

.metro-btn--small {
  padding: 2px 10px;
  font-size: 12px;
  margin-left: auto;
}
</style>
