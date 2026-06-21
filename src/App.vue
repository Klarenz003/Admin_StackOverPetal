<script setup lang="ts">
import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <RouterView />
  <div class="toast" v-if="admin.toast">{{ admin.toast }}</div>
</template>
