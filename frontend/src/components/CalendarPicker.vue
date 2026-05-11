<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const dateValue = ref(props.modelValue)

watch(dateValue, (val) => {
  emit('update:modelValue', val)
})

watch(
  () => props.modelValue,
  (val) => {
    dateValue.value = val
  }
)
</script>

<template>
  <div class="calendar-picker">
    <label class="metro-label">보고할 날짜 <span class="calendar-picker__hint">( 오늘이 아니라 업무보고하는 날입니다 )</span></label>
    <input
      v-model="dateValue"
      type="date"
      class="metro-input"
    />
  </div>
</template>

<style scoped>
.calendar-picker {
  max-width: 400px;
}

.calendar-picker__hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--metro-text-light);
}
</style>
