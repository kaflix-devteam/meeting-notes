<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { getUnreadNotices, markNoticeAsRead, markAllNoticesAsRead } from '../api'

const auth = useAuthStore()
const notices = ref<any[]>([])
const currentIndex = ref(0)
const visible = ref(false)

onMounted(async () => {
  if (!auth.user) return
  try {
    const res = await getUnreadNotices(auth.user.id)
    if (res.data && res.data.length > 0) {
      notices.value = res.data
      visible.value = true
    }
  } catch { /* ignore */ }
})

async function handleNext() {
  const current = notices.value[currentIndex.value]
  if (current && auth.user) {
    try { await markNoticeAsRead(current.id, auth.user.id) } catch { /* ignore */ }
  }
  if (currentIndex.value < notices.value.length - 1) {
    currentIndex.value++
  } else {
    visible.value = false
  }
}

async function handleSkipAll() {
  if (!auth.user) return
  try { await markAllNoticesAsRead(auth.user.id) } catch { /* ignore */ }
  visible.value = false
}
</script>

<template>
  <div v-if="visible && notices.length > 0" class="notice-popup__backdrop">
    <div class="notice-popup">
      <div class="notice-popup__header">
        <h3 class="notice-popup__title">공지사항</h3>
        <span class="notice-popup__count">{{ currentIndex + 1 }} / {{ notices.length }}</span>
      </div>
      <div class="notice-popup__body">
        <h4 class="notice-popup__notice-title">{{ notices[currentIndex].title }}</h4>
        <div class="notice-popup__date">{{ new Date(notices[currentIndex].created_at).toLocaleString('ko-KR') }}</div>
        <div class="notice-popup__content">{{ notices[currentIndex].content }}</div>
      </div>
      <div class="notice-popup__footer">
        <button class="metro-btn metro-btn--outline" @click="handleSkipAll">모두 읽음 처리</button>
        <button class="metro-btn metro-btn--blue" @click="handleNext">
          {{ currentIndex < notices.length - 1 ? '다음' : '닫기' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-popup__backdrop {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
  z-index: 10000;
}

.notice-popup {
  background: #fff; width: 600px; max-width: 90vw; max-height: 80vh;
  display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.notice-popup__header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px; background: var(--metro-blue); color: #fff;
}
.notice-popup__title { font-size: 16px; margin: 0; }
.notice-popup__count { font-size: 13px; opacity: 0.9; }

.notice-popup__body {
  flex: 1; overflow-y: auto; padding: 20px 24px;
}

.notice-popup__notice-title {
  font-size: 18px; font-weight: 600; margin: 0 0 6px;
}
.notice-popup__date {
  font-size: 12px; color: var(--metro-text-light); margin-bottom: 16px;
}
.notice-popup__content {
  font-size: 14px; line-height: 1.7; white-space: pre-wrap;
}

.notice-popup__footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 24px; border-top: 1px solid var(--metro-border);
}
</style>
