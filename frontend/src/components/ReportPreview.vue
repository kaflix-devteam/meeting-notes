<script setup lang="ts">
defineProps<{
  content: string
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="metro-overlay" @click.self="emit('close')">
      <div class="metro-modal">
        <div class="metro-modal__header">
          <h2>Preview</h2>
          <button class="metro-modal__close" @click="emit('close')">&times;</button>
        </div>
        <div class="preview-content" v-html="content"></div>
        <div class="metro-btn-group" style="justify-content: flex-end;">
          <button class="metro-btn metro-btn--blue" @click="emit('close')">Close</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.preview-content {
  border: 1px solid var(--metro-border);
  padding: 24px;
  margin-bottom: 16px;
  min-height: 200px;
  font-size: 14px;
  line-height: 1.6;
}

.preview-content :deep(h2) {
  font-size: 20px;
  margin: 16px 0 8px;
}

.preview-content :deep(h3) {
  font-size: 16px;
  margin: 12px 0 6px;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  padding-left: 24px;
}

.preview-content :deep(blockquote) {
  border-left: 3px solid var(--metro-blue);
  padding-left: 16px;
  color: var(--metro-text-light);
}
</style>
