<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/authStore'
import NoticePopup from './components/NoticePopup.vue'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  // logout() 이 IdP 로그아웃(SSO) 또는 /login?loggedout=1 로 풀페이지 이동을 직접 처리한다.
  auth.logout()
}
</script>

<template>
  <div class="metro-app">
    <header v-if="auth.isLoggedIn" class="metro-header">
      <h1 class="metro-title" @click="router.push('/my-reports')">보고또보고서</h1>
      <nav class="metro-nav">
        <router-link to="/meetings">최종 보고서</router-link>
        <router-link to="/notes">회의록</router-link>
        <router-link to="/my-reports">내 보고서</router-link>
        <router-link to="/notices">공지</router-link>
        <router-link to="/tokens">MCP 토큰</router-link>
        <router-link to="/admin/users">사용자</router-link>
        <router-link to="/admin/teams">팀</router-link>
      </nav>
      <div class="metro-user">
        <span class="metro-user__name">{{ auth.user?.display_name }}</span>
        <button class="metro-user__logout" @click="handleLogout">Logout</button>
      </div>
    </header>
    <main class="metro-main">
      <router-view />
    </main>
    <NoticePopup v-if="auth.isLoggedIn" :key="auth.user?.id" />
  </div>
</template>

<style scoped>
.metro-header {
  background-color: #0078d4;
  color: #fff;
  padding: 0 32px;
  display: flex;
  align-items: center;
  height: 56px;
  gap: 32px;
}

.metro-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  cursor: pointer;
  white-space: nowrap;
}

.metro-nav {
  display: flex;
  gap: 24px;
  flex: 1;
}

.metro-nav a {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 4px 0;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}

.metro-nav a:hover,
.metro-nav a.router-link-active {
  color: #fff;
  border-bottom-color: #fff;
}

.metro-user {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.metro-user__name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.metro-user__logout {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.metro-user__logout:hover {
  background: rgba(255, 255, 255, 0.25);
}

.metro-main {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.metro-main:has(.meeting-detail) {
  max-width: 100%;
  padding: 24px;
}
</style>
