<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { getMcpTokens, createMcpToken, deleteMcpToken, type McpToken } from '../api'

const auth = useAuthStore()
const userId = computed(() => auth.user?.id)

const tokens = ref<McpToken[]>([])
const loading = ref(false)
const errorMsg = ref('')

const newName = ref('')
const creating = ref(false)
const issuedToken = ref('')        // 방금 발급된 원문 토큰 (1회 표시)
const copied = ref(false)

const mcpEndpoint = 'https://meeting.kaflix.com/mcp'

async function load() {
  if (!userId.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getMcpTokens(userId.value)
    tokens.value = res.data
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '토큰 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  errorMsg.value = ''
  if (!newName.value.trim()) {
    errorMsg.value = '토큰 용도(이름)를 입력해주세요.'
    return
  }
  if (!userId.value) return
  creating.value = true
  try {
    const res = await createMcpToken(userId.value, newName.value.trim())
    issuedToken.value = res.data.token
    copied.value = false
    newName.value = ''
    await load()
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '토큰 발급에 실패했습니다.'
  } finally {
    creating.value = false
  }
}

async function handleRevoke(t: McpToken) {
  if (!userId.value) return
  if (!confirm(`'${t.name}' 토큰을 폐기하시겠습니까? 이 토큰을 쓰는 연동은 즉시 중단됩니다.`)) return
  try {
    await deleteMcpToken(userId.value, t.id)
    await load()
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '토큰 폐기에 실패했습니다.'
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(issuedToken.value)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function dismissIssued() {
  issuedToken.value = ''
}

function fmt(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

onMounted(load)
</script>

<template>
  <div class="token-page">
    <div class="token-head">
      <h2 class="token-head__title">MCP 토큰</h2>
      <p class="token-head__desc">
        Claude 등 외부 도구에서 회의록·주간보고서·공지를 등록할 때 쓰는 개인 토큰입니다.
        용도별로 여러 개 발급할 수 있고, 토큰 원문은 발급 직후 한 번만 표시됩니다.
      </p>
    </div>

    <!-- 발급 폼 -->
    <div class="metro-card token-create">
      <label class="metro-label" for="token-name">새 토큰 발급 — 용도</label>
      <div class="token-create__row">
        <input
          id="token-name"
          v-model="newName"
          class="metro-input"
          placeholder="예: Claude 회의록 등록, 노트북 CLI"
          maxlength="100"
          @keyup.enter="handleCreate"
        />
        <button class="metro-btn metro-btn--blue" :disabled="creating" @click="handleCreate">
          {{ creating ? '발급 중...' : '발급' }}
        </button>
      </div>
      <div v-if="errorMsg" class="token-error">{{ errorMsg }}</div>
    </div>

    <!-- 방금 발급된 토큰 (1회 표시) -->
    <div v-if="issuedToken" class="metro-card token-issued">
      <div class="token-issued__title">⚠️ 이 토큰은 지금만 표시됩니다. 안전한 곳에 복사해두세요.</div>
      <div class="token-issued__value">
        <code>{{ issuedToken }}</code>
        <button class="metro-btn" @click="copyToken">{{ copied ? '복사됨 ✓' : '복사' }}</button>
      </div>
      <div class="token-issued__hint">
        MCP 엔드포인트: <code>{{ mcpEndpoint }}</code><br />
        Authorization 헤더: <code>Bearer {{ issuedToken.slice(0, 12) }}…</code>
      </div>
      <button class="token-issued__dismiss" @click="dismissIssued">확인했습니다</button>
    </div>

    <!-- 토큰 목록 -->
    <div class="metro-card">
      <table class="token-table">
        <thead>
          <tr>
            <th>용도</th>
            <th>토큰</th>
            <th>발급일</th>
            <th>마지막 사용</th>
            <th>상태</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="token-table__empty">불러오는 중...</td>
          </tr>
          <tr v-else-if="tokens.length === 0">
            <td colspan="6" class="token-table__empty">발급된 토큰이 없습니다.</td>
          </tr>
          <tr v-for="t in tokens" :key="t.id" :class="{ 'is-revoked': t.revoked_at }">
            <td>{{ t.name }}</td>
            <td><code>{{ t.token_prefix }}…</code></td>
            <td>{{ fmt(t.created_at) }}</td>
            <td>{{ fmt(t.last_used_at) }}</td>
            <td>
              <span v-if="t.revoked_at" class="token-badge token-badge--revoked">폐기됨</span>
              <span v-else class="token-badge token-badge--active">사용 중</span>
            </td>
            <td>
              <button v-if="!t.revoked_at" class="token-revoke" @click="handleRevoke(t)">폐기</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.token-page {
  max-width: 880px;
}

.token-head__title {
  font-size: 24px;
  font-weight: 300;
  margin: 0 0 8px;
}

.token-head__desc {
  font-size: 14px;
  color: var(--metro-text-light);
  margin: 0 0 24px;
  line-height: 1.6;
}

.metro-card {
  padding: 24px;
  margin-bottom: 20px;
  background: #fff;
  border: 1px solid var(--metro-border, #e1e1e1);
}

.token-create__row {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.token-create__row .metro-input {
  flex: 1;
}

.token-error {
  color: var(--metro-red, #d13438);
  font-size: 13px;
  margin-top: 10px;
}

.token-issued {
  border-left: 4px solid var(--metro-blue, #0078d4);
  background: #f3f9ff;
}

.token-issued__title {
  font-weight: 600;
  color: #b85c00;
  margin-bottom: 12px;
}

.token-issued__value {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.token-issued__value code {
  flex: 1;
  background: #fff;
  border: 1px solid var(--metro-border, #d0d0d0);
  padding: 10px 12px;
  font-size: 13px;
  word-break: break-all;
}

.token-issued__hint {
  font-size: 12px;
  color: var(--metro-text-light);
  line-height: 1.8;
  margin-bottom: 12px;
}

.token-issued__hint code {
  background: #fff;
  padding: 1px 5px;
  border: 1px solid #e0e0e0;
}

.token-issued__dismiss {
  background: none;
  border: 1px solid var(--metro-blue, #0078d4);
  color: var(--metro-blue, #0078d4);
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

.token-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.token-table th {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 2px solid var(--metro-border, #e1e1e1);
  color: var(--metro-text-light);
  font-weight: 600;
}

.token-table td {
  padding: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.token-table__empty {
  text-align: center;
  color: var(--metro-text-light);
  padding: 24px;
}

.token-table tr.is-revoked {
  opacity: 0.5;
}

.token-table code {
  font-size: 12px;
}

.token-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 2px;
}

.token-badge--active {
  background: #dff6dd;
  color: #107c10;
}

.token-badge--revoked {
  background: #f3f3f3;
  color: #888;
}

.token-revoke {
  background: none;
  border: 1px solid var(--metro-red, #d13438);
  color: var(--metro-red, #d13438);
  padding: 3px 12px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.token-revoke:hover {
  background: var(--metro-red, #d13438);
  color: #fff;
}
</style>
