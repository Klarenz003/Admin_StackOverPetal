<script setup lang="ts">
import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <div>
    <!-- Stat Cards -->
    <div class="stats-row">
      <div class="stat-card green">
        <div class="label">Total Orders</div>
        <div class="value">{{ admin.orders.length }}</div>
        <div class="sub">all time</div>
      </div>
      <div class="stat-card pink">
        <div class="label">Revenue</div>
        <div class="value">₱{{ admin.totalRevenue }}</div>
        <div class="sub">verified payments</div>
      </div>
      <div class="stat-card gold">
        <div class="label">Pending Payment</div>
        <div class="value">{{ admin.pendingOrders }}</div>
        <div class="sub">awaiting verification</div>
      </div>
      <div class="stat-card blue">
        <div class="label">Messages</div>
        <div class="value">{{ admin.messages.length }}</div>
        <div class="sub">{{ admin.unreadMessages }} unread</div>
      </div>
    </div>

    <!-- Recent Orders -->
    <div class="section-card">
      <div class="section-header">
        <h3>Recent Orders</h3>
        <small>Last 5</small>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order ID</th><th>Customer</th><th>Total</th>
              <th>Payment</th><th>Delivery</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="o in admin.orders.slice(0, 5)"
              :key="o.id"
              class="clickable-row"
              @click="admin.openOrder(o)"
            >
              <td><code class="id-code">{{ o.id }}</code></td>
              <td><strong>{{ o.customer.name }}</strong></td>
              <td>{{ o.total }}</td>
              <td><span :class="admin.paymentBadgeClass(o.paymentStatus)">{{ o.paymentStatus }}</span></td>
              <td><span :class="admin.deliveryBadgeClass(o.deliveryStatus)">{{ o.deliveryStatus }}</span></td>
              <td class="date-cell">{{ admin.formatDate(o.createdAt) }}</td>
            </tr>
            <tr v-if="admin.orders.length === 0">
              <td colspan="6" class="empty-cell">No orders yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Messages -->
    <div class="section-card">
      <div class="section-header">
        <h3>Recent Messages</h3>
        <small>Last 5</small>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Subject</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="m in admin.messages.slice(0, 5)"
              :key="m.id"
              class="clickable-row"
              @click="admin.openMessage(m)"
            >
              <td><strong>{{ m.name }}</strong></td>
              <td>{{ m.email }}</td>
              <td>{{ m.subject || '(no subject)' }}</td>
              <td>
                <span :class="m.read ? 'badge badge-read' : 'badge badge-unread'">
                  {{ m.read ? 'Read' : 'Unread' }}
                </span>
              </td>
              <td class="date-cell">{{ admin.formatDate(m.createdAt) }}</td>
            </tr>
            <tr v-if="admin.messages.length === 0">
              <td colspan="5" class="empty-cell">No messages yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
