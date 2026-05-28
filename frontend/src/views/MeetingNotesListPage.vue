<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMeetingNotesList } from '../api'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const auth = useAuthStore()
const notes = ref<any[]>([])
const loading = ref(true)

const dayNames = ['일', '월', '화', '수', '목', '금', '토']

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return dayNames[d.getDay()] || ''
}

onMounted(async () => {
  try {
    const res = auth.isAdmin
      ? await getMeetingNotesList({ all: true })
      : await getMeetingNotesList({ userId: auth.user?.id })
    notes.value = res.data
  } catch { /* ignore */ }
  finally { loading.value = false }
})
</script>

<template>
  <div class="notes-list">
    <div class="notes-list__header">
      <h2 class="metro-section__title">회의록</h2>
      <button class="metro-btn metro-btn--green" @click="router.push('/notes/new')">새로 작성하기</button>
    </div>

    <div v-if="loading" class="metro-loading">Loading...</div>

    <div v-else-if="notes.length === 0" class="metro-empty">
      회의록이 없습니다.
    </div>

    <div v-else class="notes-list__cards">
      <div
        v-for="note in notes"
        :key="note.id"
        class="metro-card metro-card--clickable notes-list__row"
        @click="router.push(`/notes/${note.id}/edit`)"
      >
        <span class="notes-list__date">{{ note.report_date }} ({{ getDayName(note.report_date) }})</span>
        <span v-if="note.department_name" class="metro-badge" :style="{ backgroundColor: note.department_color || '#5c2d91' }">
          {{ note.department_name }}
        </span>
        <span v-if="note.team_name" class="metro-badge" :style="{ backgroundColor: note.team_color || '#107c10' }">
          {{ note.team_name }}
        </span>
        <span
          v-for="tag in (note.tag_names || [])"
          :key="tag"
          class="metro-badge metro-badge--tag"
        >
          {{ tag }}
        </span>
        <span class="notes-list__author">{{ note.user_display_name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notes-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.notes-list__header .metro-section__title {
  margin-bottom: 0;
}

.notes-list__cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes-list__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  flex-wrap: wrap;
}

.notes-list__date {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.notes-list__author {
  font-size: 13px;
  color: var(--metro-text-light);
  margin-left: auto;
}

.metro-badge--tag {
  background: #0078D4 !important;
  color: #fff !important;
  font-size: 11px;
  padding: 2px 6px;
}
</style>
