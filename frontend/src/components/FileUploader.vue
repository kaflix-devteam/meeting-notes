<script setup lang="ts">
import { ref } from 'vue'
import { uploadAttachment } from '../api'

interface ExistingAttachment {
  id: number
  original_name: string
  stored_name: string
  file_type: string
}

const props = defineProps<{
  reportId?: number
  existing?: ExistingAttachment[]
}>()

function isImage(fileType: string): boolean {
  return !!fileType && fileType.startsWith('image/')
}

const files = ref<File[]>([])
const uploading = ref(false)
const uploadedFiles = ref<string[]>([])
const errorMsg = ref('')

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
]

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  const selected = Array.from(input.files)
  const invalid = selected.filter((f) => !ACCEPTED_TYPES.includes(f.type))

  if (invalid.length > 0) {
    errorMsg.value = `Unsupported file type: ${invalid.map((f) => f.name).join(', ')}`
    return
  }

  errorMsg.value = ''
  files.value.push(...selected)
  input.value = ''
}

function removeFile(index: number) {
  files.value.splice(index, 1)
}

async function uploadAll() {
  if (!props.reportId || files.value.length === 0) return
  uploading.value = true
  errorMsg.value = ''

  try {
    for (const file of files.value) {
      await uploadAttachment(props.reportId, file)
      uploadedFiles.value.push(file.name)
    }
    files.value = []
  } catch (e: any) {
    errorMsg.value = e.message || 'Upload failed'
  } finally {
    uploading.value = false
  }
}

defineExpose({ files, uploadAll })
</script>

<template>
  <div class="file-uploader">
    <label class="metro-label">Attachments</label>

    <!-- 기존에 업로드된 첨부 (보고서 다시 열었을 때 표시) -->
    <div v-if="existing && existing.length > 0" class="file-uploader__existing">
      <div v-for="att in existing" :key="att.id" class="file-uploader__existing-item">
        <a
          v-if="isImage(att.file_type)"
          :href="`/uploads/${att.stored_name}`"
          target="_blank"
          rel="noopener"
          class="file-uploader__thumb-link"
        >
          <img :src="`/uploads/${att.stored_name}`" :alt="att.original_name" class="file-uploader__thumb" />
        </a>
        <a
          :href="`/api/attachments/${att.id}/download`"
          class="file-uploader__existing-name"
          :title="att.original_name"
        >
          {{ att.original_name }}
        </a>
      </div>
    </div>

    <div class="file-uploader__zone">
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.txt"
        multiple
        @change="onFileChange"
        class="file-uploader__input"
        id="file-input"
      />
      <label for="file-input" class="file-uploader__label">
        Click to select files (PDF, JPG, PNG, TXT)
      </label>
    </div>

    <div v-if="errorMsg" class="file-uploader__error">{{ errorMsg }}</div>

    <ul v-if="files.length > 0" class="file-uploader__list">
      <li v-for="(file, i) in files" :key="i" class="file-uploader__item">
        <span>{{ file.name }} ({{ (file.size / 1024).toFixed(1) }}KB)</span>
        <button type="button" class="file-uploader__remove" @click="removeFile(i)">X</button>
      </li>
    </ul>

    <ul v-if="uploadedFiles.length > 0" class="file-uploader__uploaded">
      <li v-for="name in uploadedFiles" :key="name">Uploaded: {{ name }}</li>
    </ul>
  </div>
</template>

<style scoped>
.file-uploader__existing {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.file-uploader__existing-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: 120px;
}

.file-uploader__thumb {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border: 1px solid var(--metro-border);
  display: block;
}

.file-uploader__existing-name {
  font-size: 12px;
  color: var(--metro-blue);
  text-decoration: none;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-uploader__existing-name:hover {
  text-decoration: underline;
}

.file-uploader__zone {
  border: 2px dashed var(--metro-border);
  padding: 24px;
  text-align: center;
  background: var(--metro-white);
  position: relative;
}

.file-uploader__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.file-uploader__label {
  color: var(--metro-text-light);
  font-size: 14px;
  cursor: pointer;
}

.file-uploader__error {
  color: var(--metro-orange);
  font-size: 13px;
  margin-top: 8px;
}

.file-uploader__list {
  list-style: none;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-uploader__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--metro-white);
  border: 1px solid var(--metro-border);
  font-size: 13px;
}

.file-uploader__remove {
  background: none;
  border: none;
  color: var(--metro-orange);
  font-weight: 600;
  cursor: pointer;
  font-size: 13px;
}

.file-uploader__uploaded {
  list-style: none;
  margin-top: 8px;
}

.file-uploader__uploaded li {
  font-size: 13px;
  color: var(--metro-green);
  padding: 4px 0;
}
</style>
