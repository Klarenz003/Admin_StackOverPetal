<script setup lang="ts">
import { PhX, PhClipboardText, PhCheck } from '@phosphor-icons/vue'

import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <div
    class="modal-overlay"
    v-if="admin.activeMessage"
    @click.self="admin.activeMessage = null"
  >
    <div class="modal-box">
      <button aria-label="Close" class="modal-close" @click="admin.activeMessage = null"><PhX class="ui-icon" aria-hidden="true" :size="'1em'" /></button>
      <h2>{{ admin.activeMessage.subject || 'Message' }}</h2>

      <div class="detail-grid" style="margin-bottom:16px">
        <div class="detail-item">
          <label>From</label>
          <p>{{ admin.activeMessage.name }}</p>
        </div>
        <div class="detail-item">
          <label>Email</label>
          <p>{{ admin.activeMessage.email }}</p>
        </div>
        <div class="detail-item full">
          <label>Date</label>
          <p>{{ admin.formatDate(admin.activeMessage.createdAt) }}</p>
        </div>
      </div>

      <div class="msg-body">{{ admin.activeMessage.message }}</div>

      <div class="reply-box">
        <h3 class="reply-label">Reply (draft — copy to email)</h3>
        <textarea
          v-model="admin.replyText"
          rows="4"
          placeholder="Type your reply…"
        ></textarea>
        <button class="reply-send-btn" @click="admin.copyReply()"><PhClipboardText class="ui-icon" aria-hidden="true" :size="'1em'" /> Copy Reply</button>
        <p class="reply-sent" v-if="admin.replyCopied"><PhCheck class="ui-icon" aria-hidden="true" :size="'1em'" /> Copied to clipboard!</p>
      </div>
    </div>
  </div>
</template>
