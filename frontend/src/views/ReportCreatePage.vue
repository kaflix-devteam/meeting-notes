<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import RichEditor from '../components/RichEditor.vue'
import CalendarPicker from '../components/CalendarPicker.vue'
import FileUploader from '../components/FileUploader.vue'
import ReportPreview from '../components/ReportPreview.vue'
import PolishOverlay from '../components/PolishOverlay.vue'
import { useAuthStore } from '../stores/authStore'
import { createReport, uploadAttachment, polishReport, mergeFinalReport } from '../api'

const router = useRouter()
const auth = useAuthStore()

const content = ref('')
const reportDate = ref(new Date().toISOString().slice(0, 10))
const showPreview = ref(false)
const saving = ref(false)
const polishing = ref(false)
const merging = ref(false)
const errorMsg = ref('')
const fileUploaderRef = ref<InstanceType<typeof FileUploader> | null>(null)

async function handleMerge() {
  if (!reportDate.value) {
    errorMsg.value = '보고서 날짜가 필요합니다.'
    return
  }

  merging.value = true
  errorMsg.value = ''

  try {
    await mergeFinalReport(reportDate.value, auth.user!.department_id!)
    alert('최종보고서에 병합되었습니다.')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '최종보고서 병합에 실패했습니다.'
  } finally {
    merging.value = false
  }
}

async function handlePolish() {
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = '다듬을 내용을 먼저 작성해주세요.'
    return
  }

  polishing.value = true
  errorMsg.value = ''

  try {
    const res = await polishReport(content.value)
    content.value = res.data.content_html
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || 'AI 다듬기에 실패했습니다.'
  } finally {
    polishing.value = false
  }
}

async function handleSave() {
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = '보고서 내용을 작성해주세요.'
    return
  }

  saving.value = true
  errorMsg.value = ''

  try {
    const res = await createReport({
      content_html: content.value,
      report_date: reportDate.value,
      user_id: auth.user!.id,
    })

    const reportId = res.data.id

    if (fileUploaderRef.value && fileUploaderRef.value.files.length > 0) {
      for (const file of fileUploaderRef.value.files) {
        await uploadAttachment(reportId, file)
      }
    }

    router.push('/my-reports')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || e.message || '보고서 저장에 실패했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="report-create">
    <h2 class="metro-section__title">New Report</h2>

    <div class="report-create__info">
      <span class="report-create__badge">{{ auth.user?.department_name }}</span>
      <span class="report-create__badge">{{ auth.user?.team_name }}</span>
      <span class="report-create__user">{{ auth.user?.display_name }}</span>
    </div>

    <div class="report-create__form">
      <div class="report-create__top">
        <CalendarPicker v-model="reportDate" />
      </div>

      <div class="report-create__editor">
        <label class="metro-label">Content</label>
        <RichEditor v-model="content" :editable="!polishing" />
      </div>

      <FileUploader ref="fileUploaderRef" />

      <div v-if="errorMsg" class="report-create__error">{{ errorMsg }}</div>

      <div class="metro-btn-group">
        <button
          type="button"
          class="metro-btn metro-btn--outline"
          @click="showPreview = true"
        >
          Preview
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--green"
          :disabled="saving || polishing"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--blue"
          :disabled="polishing || saving"
          @click="handlePolish"
        >
          {{ polishing ? 'AI 다듬는 중...' : 'AI 다듬기' }}
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--purple"
          :disabled="merging || saving || polishing"
          @click="handleMerge"
        >
          {{ merging ? '병합 중...' : '최종보고서에 병합' }}
        </button>
      </div>
    </div>

    <ReportPreview
      :content="content"
      :visible="showPreview"
      @close="showPreview = false"
    />

    <PolishOverlay :visible="polishing || merging" />
  </div>
</template>

<style scoped>
.report-create__form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.report-create__info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.report-create__badge {
  display: inline-block;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background-color: var(--metro-blue);
}

.report-create__user {
  font-size: 14px;
  color: var(--metro-text);
  font-weight: 600;
  margin-left: 4px;
}

.report-create__top {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.report-create__error {
  color: var(--metro-orange);
  font-size: 14px;
  font-weight: 600;
}
</style>
