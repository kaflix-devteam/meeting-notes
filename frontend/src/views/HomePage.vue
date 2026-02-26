<script setup lang="ts">
import MetroTile from '../components/MetroTile.vue'
</script>

<template>
  <div class="home-page">
    <h1 class="home-page__title">Meeting Agent</h1>
    <p class="home-page__subtitle">Select a task to get started</p>
    <div class="home-page__tiles">
      <MetroTile
        title="Meetings"
        icon="&#128203;"
        color="#0078D4"
        to="/meetings"
      />
      <MetroTile
        title="New Report"
        icon="&#9997;"
        color="#107C10"
        to="/reports/new"
      />
      <MetroTile
        title="My Reports"
        icon="&#128196;"
        color="#D83B01"
        to="/my-reports"
      />
    </div>
  </div>
</template>

<style scoped>
.home-page {
  text-align: center;
  padding-top: 48px;
}

.home-page__title {
  font-size: 36px;
  font-weight: 300;
  margin-bottom: 8px;
}

.home-page__subtitle {
  font-size: 16px;
  color: var(--metro-text-light);
  margin-bottom: 48px;
}

.home-page__tiles {
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
}
</style>
