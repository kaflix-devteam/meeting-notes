<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { getTags, createTagApi, deleteTagApi } from '../api'

interface Tag {
  id: number
  name: string
  team_id: number
  department_id: number
}

const props = defineProps<{
  modelValue: Tag[]
  departmentId: number | null
  teamId: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Tag[]]
}>()

const inputText = ref('')
const showDropdown = ref(false)
const availableTags = ref<Tag[]>([])

const filteredTags = computed(() => {
  const selectedIds = new Set(props.modelValue.map(t => t.id))
  const q = inputText.value.trim().toLowerCase()
  return availableTags.value
    .filter(t => !selectedIds.has(t.id))
    .filter(t => !q || t.name.toLowerCase().includes(q))
})

async function fetchTags() {
  if (!props.departmentId || !props.teamId) {
    availableTags.value = []
    return
  }
  try {
    const res = await getTags(props.departmentId, props.teamId)
    availableTags.value = res.data
  } catch {
    availableTags.value = []
  }
}

let initialized = false
watch(() => [props.departmentId, props.teamId], () => {
  fetchTags()
  // 초기 로드 시에는 리셋하지 않음 (편집 페이지에서 기존 태그 유지)
  if (initialized) {
    emit('update:modelValue', [])
  }
  initialized = true
}, { immediate: true })

function addTag(tag: Tag) {
  if (!props.modelValue.find(t => t.id === tag.id)) {
    emit('update:modelValue', [...props.modelValue, tag])
  }
  inputText.value = ''
  showDropdown.value = false
}

function removeTag(tag: Tag) {
  emit('update:modelValue', props.modelValue.filter(t => t.id !== tag.id))
}

async function handleEnter() {
  const name = inputText.value.trim()
  if (!name || !props.departmentId || !props.teamId) return

  // 기존 태그에서 찾기
  const existing = availableTags.value.find(t => t.name === name)
  if (existing) {
    addTag(existing)
    return
  }

  // 새 태그 생성
  try {
    const res = await createTagApi(name, props.teamId, props.departmentId)
    availableTags.value.push(res.data)
    addTag(res.data)
  } catch { /* ignore */ }
}

async function handleDeleteTag(tag: Tag, e: Event) {
  e.stopPropagation()
  if (!confirm(`"${tag.name}" 태그를 삭제하시겠습니까?`)) return
  try {
    await deleteTagApi(tag.id)
    availableTags.value = availableTags.value.filter(t => t.id !== tag.id)
    emit('update:modelValue', props.modelValue.filter(t => t.id !== tag.id))
  } catch { /* ignore */ }
}

function handleFocus() {
  showDropdown.value = true
}

function handleBlur() {
  // 약간의 지연을 줘서 클릭 이벤트가 먼저 처리되도록
  setTimeout(() => { showDropdown.value = false }, 200)
}
</script>

<template>
  <div class="tag-input">
    <span v-for="tag in modelValue" :key="tag.id" class="tag-input__badge">
      {{ tag.name }}
      <button class="tag-input__badge-x" @click="removeTag(tag)">&times;</button>
    </span>
    <div class="tag-input__field">
      <input
        v-model="inputText"
        class="tag-input__input"
        placeholder="태그 추가..."
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter.prevent="handleEnter"
      />
      <div v-if="showDropdown && (filteredTags.length > 0 || inputText.trim())" class="tag-input__dropdown">
        <div
          v-for="tag in filteredTags"
          :key="tag.id"
          class="tag-input__dropdown-item"
          @mousedown.prevent="addTag(tag)"
        >
          <span>{{ tag.name }}</span>
          <button class="tag-input__dropdown-delete" @mousedown.prevent.stop="handleDeleteTag(tag, $event)">&times;</button>
        </div>
        <div
          v-if="inputText.trim() && !filteredTags.find(t => t.name === inputText.trim())"
          class="tag-input__dropdown-item tag-input__dropdown-item--new"
          @mousedown.prevent="handleEnter"
        >
          + "{{ inputText.trim() }}" 태그 만들기
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-input {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-input__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #0078D4;
  color: #fff;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 2px;
}

.tag-input__badge-x {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.7;
}

.tag-input__badge-x:hover {
  opacity: 1;
}

.tag-input__field {
  position: relative;
}

.tag-input__input {
  border: 1px solid var(--metro-border);
  padding: 3px 8px;
  font-size: 12px;
  width: 120px;
  outline: none;
}

.tag-input__input:focus {
  border-color: var(--metro-blue);
}

.tag-input__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 2px;
  background: #fff;
  border: 1px solid var(--metro-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
  min-width: 180px;
  max-height: 200px;
  overflow-y: auto;
}

.tag-input__dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.tag-input__dropdown-item:hover {
  background: var(--metro-hover);
}

.tag-input__dropdown-item--new {
  color: var(--metro-blue);
  font-weight: 600;
}

.tag-input__dropdown-delete {
  background: none;
  border: none;
  color: var(--metro-red, #e81123);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  opacity: 0.5;
}

.tag-input__dropdown-delete:hover {
  opacity: 1;
}
</style>
