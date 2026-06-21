<script setup lang="ts">
import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <div
    class="lightbox-overlay"
    v-if="admin.lightboxSrc"
    @click="admin.lightboxSrc = null"
  >
    <button class="lightbox-close" @click="admin.lightboxSrc = null">✕</button>
    <img :src="admin.lightboxSrc" alt="Payment Proof" />
  </div>
</template>
