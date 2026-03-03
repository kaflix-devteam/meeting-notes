<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeamSelector from '../components/TeamSelector.vue'
import RichEditor from '../components/RichEditor.vue'
import CalendarPicker from '../components/CalendarPicker.vue'
import FileUploader from '../components/FileUploader.vue'
import ReportPreview from '../components/ReportPreview.vue'
import PolishOverlay from '../components/PolishOverlay.vue'
import { getReport, updateReport, uploadAttachment, deleteReport, polishReport, mergeFinalReport } from '../api'

const route = useRoute()
const router = useRouter()

const reportId = ref(0)
const teamId = ref(0)
const content = ref('')
const reportDate = ref('')
const showPreview = ref(false)
const saving = ref(false)
const deleting = ref(false)
const polishing = ref(false)
const merging = ref(false)
const loading = ref(true)
const errorMsg = ref('')
const fileUploaderRef = ref<InstanceType<typeof FileUploader> | null>(null)

onMounted(async () => {
  reportId.value = Number(route.params.id)
  try {
    const res = await getReport(reportId.value)
    teamId.value = res.data.team_id
    content.value = res.data.content_html
    reportDate.value = res.data.report_date
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || 'Failed to load report.'
  } finally {
    loading.value = false
  }
})

async function handleDelete() {
  if (!confirm('정말 이 보고서를 삭제하시겠습니까?')) return

  deleting.value = true
  errorMsg.value = ''

  try {
    await deleteReport(reportId.value)
    router.push('/my-reports')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || 'Failed to delete report.'
  } finally {
    deleting.value = false
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

async function handleMerge() {
  if (!reportDate.value) {
    errorMsg.value = '보고서 날짜가 필요합니다.'
    return
  }

  merging.value = true
  errorMsg.value = ''

  try {
    await mergeFinalReport(reportDate.value)
    alert('최종보고서에 병합되었습니다.')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '최종보고서 병합에 실패했습니다.'
  } finally {
    merging.value = false
  }
}

async function handleSave() {
  if (!teamId.value) {
    errorMsg.value = 'Please select a team.'
    return
  }
  if (!content.value || content.value === '<p></p>') {
    errorMsg.value = 'Please write report content.'
    return
  }

  saving.value = true
  errorMsg.value = ''

  try {
    await updateReport(reportId.value, {
      team_id: teamId.value,
      content_html: content.value,
      report_date: reportDate.value,
    })

    if (fileUploaderRef.value && fileUploaderRef.value.files.length > 0) {
      for (const file of fileUploaderRef.value.files) {
        await uploadAttachment(reportId.value, file)
      }
    }

    router.push('/my-reports')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || e.message || 'Failed to update report.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="report-edit">
    <h2 class="metro-section__title">Edit Report</h2>

    <div v-if="loading" class="metro-loading">Loading...</div>

    <div v-else class="report-edit__form">
      <div class="report-edit__top">
        <TeamSelector v-model="teamId" />
        <CalendarPicker v-model="reportDate" />
      </div>

      <div class="report-edit__editor">
        <label class="metro-label">Content</label>
        <RichEditor v-model="content" :editable="!polishing" />
      </div>

      <FileUploader ref="fileUploaderRef" :report-id="reportId" />

      <div v-if="errorMsg" class="report-edit__error">{{ errorMsg }}</div>

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
        <button
          type="button"
          class="metro-btn metro-btn--blue"
          @click="router.push('/my-reports')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="metro-btn metro-btn--red"
          :disabled="deleting"
          @click="handleDelete"
        >
          {{ deleting ? 'Deleting...' : 'Delete' }}
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
.report-edit__form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.report-edit__top {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.report-edit__error {
  color: var(--metro-orange);
  font-size: 14px;
  font-weight: 600;
}
</style>
