<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '../stores/reportStore'

const store = useReportStore()
const router = useRouter()

onMounted(() => {
  store.fetchFinalReports()
})

function goToDetail(id: number) {
  router.push(`/meetings/${id}`)
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
        class="metro-card metro-card--clickable"
        @click="goToDetail(report.id)"
      >
        <div class="meeting-list__date">{{ report.report_date }}</div>
        <div class="meeting-list__teams">
          <span
            v-for="team in report.teams"
            :key="team"
            class="metro-badge metro-badge--blue"
          >
            {{ team }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.meeting-list__cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meeting-list__date {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.meeting-list__teams {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
