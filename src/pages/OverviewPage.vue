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

    <div class="stats-row compact-stats">
      <div class="stat-card gold">
        <div class="label">Low Stock</div>
        <div class="value">{{ admin.lowStockProducts.length }}</div>
        <div class="sub">1-3 items left</div>
      </div>
      <div class="stat-card pink">
        <div class="label">Out of Stock</div>
        <div class="value">{{ admin.outOfStockProducts.length }}</div>
        <div class="sub">check pre-order settings</div>
      </div>
      <div class="stat-card blue">
        <div class="label">Pre-orders</div>
        <div class="value">{{ admin.preorderOrders }}</div>
        <div class="sub">active order count</div>
      </div>
      <div class="stat-card green">
        <div class="label">Avg Order</div>
        <div class="value">₱{{ admin.avgOrder }}</div>
        <div class="sub">all orders</div>
      </div>
    </div>

    <div class="section-card" v-if="admin.lowStockProducts.length || admin.outOfStockProducts.length">
      <div class="section-header">
        <h3>Stock Alerts</h3>
        <small>{{ admin.lowStockProducts.length + admin.outOfStockProducts.length }} product{{ admin.lowStockProducts.length + admin.outOfStockProducts.length === 1 ? '' : 's' }}</small>
      </div>
      <div class="alert-list">
        <div v-for="product in [...admin.outOfStockProducts, ...admin.lowStockProducts].slice(0, 6)" :key="product.id" class="alert-row">
          <strong>{{ product.name }}</strong>
          <span :class="['stock-pill', product.stock <= 0 ? 'stock-out' : 'stock-low']">
            {{ product.stock <= 0 ? 'Out of stock' : `${product.stock} left` }}
          </span>
        </div>
      </div>
    </div>

    <div class="section-card" v-if="admin.bestSellingItems.length">
      <div class="section-header">
        <h3>Best-selling Bouquets</h3>
        <small>by ordered quantity</small>
      </div>
      <div class="alert-list">
        <div v-for="item in admin.bestSellingItems" :key="item.name" class="alert-row">
          <strong>{{ item.name }}</strong>
          <span>{{ item.quantity }} sold</span>
        </div>
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
