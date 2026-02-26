<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const dateValue = ref(props.modelValue || new Date().toISOString().slice(0, 10))

watch(dateValue, (val) => {
  emit('update:modelValue', val)
})

watch(
  () => props.modelValue,
  (val) => {
    if (val) dateValue.value = val
  }
)
</script>

<template>
  <div class="calendar-picker">
    <label class="metro-label">Date</label>
    <input
      v-model="dateValue"
      type="date"
      class="metro-input"
    />
  </div>
</template>

<style scoped>
.calendar-picker {
  max-width: 240px;
}
</style>
