<script setup lang="ts">
import { PhX } from '@phosphor-icons/vue'

import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <div
    class="lightbox-overlay"
    v-if="admin.lightboxSrc"
    @click="admin.lightboxSrc = null"
  >
    <button aria-label="Close" class="lightbox-close" @click="admin.lightboxSrc = null"><PhX class="ui-icon" aria-hidden="true" :size="'1em'" /></button>
    <img :src="admin.lightboxSrc" alt="Payment Proof" />
  </div>
</template>
