<script setup lang="ts">
import { onMounted } from 'vue'
import { useReportStore } from '../stores/reportStore'

const model = defineModel<number>({ required: true })
const store = useReportStore()

onMounted(() => {
  if (store.teams.length === 0) {
    store.fetchTeams()
  }
})
</script>

<template>
  <div class="team-selector">
    <label class="metro-label">Team</label>
    <select v-model="model" class="metro-select">
      <option :value="0" disabled>-- Select Team --</option>
      <option v-for="team in store.teams" :key="team.id" :value="team.id">
        {{ team.name }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.team-selector {
  max-width: 320px;
}
</style>
