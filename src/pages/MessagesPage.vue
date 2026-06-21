<script setup lang="ts">
import { useAdminStore } from '@/stores/admin'
import type { Message } from '@/types'
const admin = useAdminStore()
</script>

<template>
  <div class="section-card">
    <div class="filter-row">
      <input
        class="search-input"
        v-model="admin.msgSearch"
        placeholder="Search by name, email, subject…"
      />
      <select class="filter-select" v-model="admin.msgReadFilter">
        <option value="">All</option>
        <option value="unread">Unread</option>
        <option value="read">Read</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Subject</th>
            <th>Preview</th><th>Status</th><th>Date</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in admin.filteredMessages"
            :key="m.id"
            class="clickable-row"
            @click="admin.openMessage(m)"
          >
            <td><strong>{{ m.name }}</strong></td>
            <td>{{ m.email }}</td>
            <td>{{ m.subject || '(no subject)' }}</td>
            <td class="preview-cell">{{ m.message }}</td>
            <td>
              <span :class="m.read ? 'badge badge-read' : 'badge badge-unread'">
                {{ m.read ? 'Read' : 'Unread' }}
              </span>
            </td>
            <td class="date-cell">{{ admin.formatDate(m.createdAt) }}</td>
            <td @click.stop>
              <button class="mark-btn" @click="admin.toggleRead(m)">
                {{ m.read ? 'Mark Unread' : 'Mark Read' }}
              </button>
            </td>
          </tr>
          <tr v-if="admin.filteredMessages.length === 0">
            <td colspan="7">
              <div class="empty-state">
                <div class="emoji">💬</div>
                <p>No messages found.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
