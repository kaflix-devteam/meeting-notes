import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '../types'
import * as api from '../api'

const STORAGE_KEY = 'meeting_user'
const METHOD_KEY = 'meeting_auth_method'

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
    localStorage.setItem(METHOD_KEY, 'local')
  }

  async function loginWithSsoToken(token: string): Promise<void> {
    const res = await api.verifySsoToken(token)
    user.value = res.data
    saveUser(res.data)
    localStorage.setItem(METHOD_KEY, 'sso')
  }

  function logout() {
    const method = localStorage.getItem(METHOD_KEY)
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(METHOD_KEY)

    // SSO 로그인 사용자는 IdP(Keycloak) 세션까지 끊어야 재로그인 루프가 안 생긴다.
    // (로컬 세션만 지우면 IdP 쿠키가 살아 있어 다음 SSO 시도가 조용히 재로그인됨)
    if (method === 'sso') {
      window.location.href = '/api/auth/sso/logout'
    } else {
      window.location.href = '/login?loggedout=1'
    }
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
