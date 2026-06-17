import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '../types'
import * as api from '../api'

const STORAGE_KEY = 'meeting_user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(loadUser())
  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => !!user.value?.is_admin)

  function loadUser(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function saveUser(u: User) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }

  async function login(username: string, password: string): Promise<void> {
    const res = await api.login(username, password)
    user.value = res.data
    saveUser(res.data)
  }

  async function loginWithSsoToken(token: string): Promise<void> {
    const res = await api.verifySsoToken(token)
    user.value = res.data
    saveUser(res.data)
  }

  function logout() {
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    user,
    isLoggedIn,
    isAdmin,
    login,
    loginWithSsoToken,
    logout,
  }
})
