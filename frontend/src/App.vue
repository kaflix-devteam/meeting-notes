<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/authStore'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="metro-app">
    <header v-if="auth.isLoggedIn" class="metro-header">
      <h1 class="metro-title" @click="router.push('/')">Meeting Agent</h1>
      <nav class="metro-nav">
        <router-link to="/">Home</router-link>
        <router-link to="/meetings">Meetings</router-link>
        <router-link to="/reports/new">New Report</router-link>
        <router-link to="/my-reports">My Reports</router-link>
        <router-link to="/admin/users">Users</router-link>
        <router-link to="/admin/teams">Teams</router-link>
      </nav>
      <div class="metro-user">
        <span class="metro-user__name">{{ auth.user?.display_name }}</span>
        <button class="metro-user__logout" @click="handleLogout">Logout</button>
      </div>
    </header>
    <main class="metro-main">
      <router-view />
    </main>
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
</style>
