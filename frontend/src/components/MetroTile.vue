<script setup lang="ts">
defineProps<{
  title: string
  icon: string
  color: string
  to: string
}>()
</script>

<template>
  <router-link :to="to" class="metro-tile" :style="{ backgroundColor: color }">
    <span class="metro-tile__icon">{{ icon }}</span>
    <span class="metro-tile__title">{{ title }}</span>
  </router-link>
</template>

<style scoped>
.metro-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 220px;
  height: 220px;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.15s, transform 0.15s;
  cursor: pointer;
}

.metro-tile:hover {
  opacity: 0.92;
  transform: scale(1.02);
}

.metro-tile:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.metro-tile__icon {
  font-size: 56px;
  line-height: 1;
}

.metro-tile__title {
  font-size: 16px;
  text-align: center;
  padding: 0 16px;
}
</style>
