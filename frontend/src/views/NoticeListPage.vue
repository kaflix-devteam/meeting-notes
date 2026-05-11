<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { getNotices, markNoticeAsRead, markAllNoticesAsRead, createNotice, deleteNotice } from '../api'

const auth = useAuthStore()
const notices = ref<any[]>([])
const loading = ref(true)
const expandedId = ref<number | null>(null)

// 공지 작성 (관리자)
const showCreate = ref(false)
const newTitle = ref('')
const newContent = ref('')
const creating = ref(false)

async function loadNotices() {
  loading.value = true
  try {
    const res = await getNotices(auth.user?.id)
    notices.value = res.data
  } catch { /* ignore */ }
  finally { loading.value = false }
}

onMounted(() => { loadNotices() })

async function handleExpand(notice: any) {
  if (expandedId.value === notice.id) {
    expandedId.value = null
    return
  }
  expandedId.value = notice.id
  if (!notice.is_read && auth.user) {
    try {
      await markNoticeAsRead(notice.id, auth.user.id)
      notice.is_read = true
    } catch { /* ignore */ }
  }
}

async function handleMarkAllRead() {
  if (!auth.user) return
  try {
    await markAllNoticesAsRead(auth.user.id)
    notices.value.forEach(n => { n.is_read = true })
  } catch { /* ignore */ }
}

async function handleCreate() {
  if (!newTitle.value.trim() || !newContent.value.trim()) return
  creating.value = true
  try {
    await createNotice({ title: newTitle.value, content: newContent.value })
    newTitle.value = ''
    newContent.value = ''
    showCreate.value = false
    await loadNotices()
  } catch { /* ignore */ }
  finally { creating.value = false }
}

async function handleDelete(id: number, e: Event) {
  e.stopPropagation()
  if (!confirm('이 공지를 삭제하시겠습니까?')) return
  try {
    await deleteNotice(id)
    await loadNotices()
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="notice-list">
    <div class="notice-list__header">
      <h2 class="metro-section__title">공지사항</h2>
      <div class="notice-list__actions">
        <button v-if="auth.isAdmin" class="metro-btn metro-btn--green" @click="showCreate = !showCreate">
          {{ showCreate ? '닫기' : '새 공지 작성' }}
        </button>
        <button class="metro-btn metro-btn--outline" @click="handleMarkAllRead">전체 읽음 처리</button>
      </div>
    </div>

    <div v-if="showCreate" class="notice-list__form">
      <input v-model="newTitle" class="metro-input" placeholder="제목" />
      <textarea v-model="newContent" class="metro-input notice-list__textarea" placeholder="내용 (줄바꿈 지원)"></textarea>
      <button class="metro-btn metro-btn--green" :disabled="creating" @click="handleCreate">
        {{ creating ? '등록 중...' : '등록' }}
      </button>
    </div>

    <div v-if="loading" class="metro-loading">Loading...</div>
    <div v-else-if="notices.length === 0" class="metro-empty">공지가 없습니다.</div>

    <div v-else class="notice-list__items">
      <div
        v-for="notice in notices"
        :key="notice.id"
        class="notice-list__item"
        :class="{ 'notice-list__item--unread': !notice.is_read }"
        @click="handleExpand(notice)"
      >
        <div class="notice-list__row">
          <span v-if="!notice.is_read" class="notice-list__dot"></span>
          <span class="notice-list__title">{{ notice.title }}</span>
          <span class="notice-list__date">{{ new Date(notice.created_at).toLocaleString('ko-KR') }}</span>
          <button v-if="auth.isAdmin" class="notice-list__delete" @click="handleDelete(notice.id, $event)">삭제</button>
        </div>
        <div v-if="expandedId === notice.id" class="notice-list__content">{{ notice.content }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-list__header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.notice-list__header .metro-section__title { margin-bottom: 0; }
.notice-list__actions { display: flex; gap: 8px; }

.notice-list__form {
  display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;
  padding: 16px; border: 1px solid var(--metro-border); background: #fafafa;
}
.notice-list__form .metro-input { width: 100%; }
.notice-list__textarea { min-height: 120px; resize: vertical; font-family: inherit; }

.notice-list__items { display: flex; flex-direction: column; gap: 6px; }

.notice-list__item {
  border: 1px solid var(--metro-border);
  background: var(--metro-white);
  cursor: pointer;
  transition: background 0.1s;
}
.notice-list__item:hover { background: #f8f8f8; }
.notice-list__item--unread { border-left: 3px solid var(--metro-blue); }

.notice-list__row {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
}
.notice-list__dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--metro-red, #e81123);
}
.notice-list__title { font-size: 15px; font-weight: 600; flex: 1; }
.notice-list__date { font-size: 12px; color: var(--metro-text-light); }
.notice-list__delete {
  background: transparent; border: none; color: var(--metro-red, #e81123);
  cursor: pointer; font-size: 12px;
}
.notice-list__delete:hover { text-decoration: underline; }

.notice-list__content {
  padding: 12px 20px; background: #f5f5f5; font-size: 14px; line-height: 1.6;
  white-space: pre-wrap; border-top: 1px solid var(--metro-border);
}
</style>
