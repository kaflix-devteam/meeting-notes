<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { getFinalReport, deleteFinalReport } from '../api'
import type { FinalReport } from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const report = ref<FinalReport | null>(null)
const loading = ref(true)
const deleting = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  const id = Number(route.params.id)
  try {
    const res = await getFinalReport(id)
    report.value = res.data
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

    <div v-else-if="errorMsg" class="metro-empty">{{ errorMsg }}</div>

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

      <div class="meeting-detail__body" v-html="report.content_html"></div>
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
  margin-bottom: 24px;
}

.meeting-detail__body {
  background: var(--metro-white);
  border: 1px solid var(--metro-border);
  padding: 32px;
  font-size: 14px;
  line-height: 1.7;
}

.meeting-detail__body :deep(h2) {
  font-size: 20px;
  margin: 24px 0 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--metro-blue);
}

.meeting-detail__body :deep(h3) {
  font-size: 16px;
  margin: 16px 0 8px;
}

.meeting-detail__body :deep(ul),
.meeting-detail__body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.meeting-detail__body :deep(blockquote) {
  border-left: 3px solid var(--metro-blue);
  padding-left: 16px;
  color: var(--metro-text-light);
}
</style>
