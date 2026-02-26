<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import TeamSelector from '../components/TeamSelector.vue'
import RichEditor from '../components/RichEditor.vue'
import CalendarPicker from '../components/CalendarPicker.vue'
import FileUploader from '../components/FileUploader.vue'
import ReportPreview from '../components/ReportPreview.vue'
import { createReport, uploadAttachment } from '../api'

const router = useRouter()

const teamId = ref(0)
const content = ref('')
const reportDate = ref(new Date().toISOString().slice(0, 10))
const showPreview = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const fileUploaderRef = ref<InstanceType<typeof FileUploader> | null>(null)

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
    const res = await createReport({
      team_id: teamId.value,
      content_html: content.value,
      report_date: reportDate.value,
      user_id: 1,
    })

    const reportId = res.data.id

    if (fileUploaderRef.value && fileUploaderRef.value.files.length > 0) {
      for (const file of fileUploaderRef.value.files) {
        await uploadAttachment(reportId, file)
      }
    }

    router.push('/my-reports')
  } catch (e: any) {
    errorMsg.value = e.response?.data?.message || e.message || 'Failed to save report.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="report-create">
    <h2 class="metro-section__title">New Report</h2>

    <div class="report-create__form">
      <div class="report-create__top">
        <TeamSelector v-model="teamId" />
        <CalendarPicker v-model="reportDate" />
      </div>

      <div class="report-create__editor">
        <label class="metro-label">Content</label>
        <RichEditor v-model="content" />
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
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <ReportPreview
      :content="content"
      :visible="showPreview"
      @close="showPreview = false"
    />
  </div>
</template>

<style scoped>
.report-create__form {
  display: flex;
  flex-direction: column;
  gap: 24px;
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
