<script setup lang="ts">
import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <div class="section-card">
    <div class="filter-row">
      <input
        class="search-input"
        v-model="admin.orderSearch"
        placeholder="Search by name, ID, email…"
      />
      <select class="filter-select" v-model="admin.orderPayFilter">
        <option value="">All Payment Status</option>
        <option>Pending</option>
        <option>Verified</option>
        <option>Rejected</option>
      </select>
      <select class="filter-select" v-model="admin.orderDelFilter">
        <option value="">All Delivery Status</option>
        <option>Processing</option>
        <option>Packed</option>
        <option>Shipped</option>
        <option>Delivered</option>
        <option>Cancelled</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th>
            <th>Via</th><th>Proof</th><th>Payment</th><th>Delivery</th><th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in admin.filteredOrders" :key="o.id">
            <td class="id-link" @click="admin.openOrder(o)">
              <code class="id-code">{{ o.id }}</code>
            </td>
            <td>
              <div class="name-primary">{{ o.customer.name }}</div>
              <div class="name-secondary">{{ o.customer.email }}</div>
            </td>
            <td class="items-cell">{{ o.items.map(i => i.name).join(', ') }}</td>
            <td class="total-cell">{{ o.total }}</td>
            <td>{{ o.paymentMethod }}</td>
            <td>
              <img
                v-if="o.proofImage"
                :src="o.proofImage"
                class="proof-thumb"
                @click="admin.viewProof(o.proofImage)"
                alt="Proof"
              />
              <span v-else class="no-proof">—</span>
            </td>
            <td>
              <span :class="admin.paymentBadgeClass(o.paymentStatus)">
                {{ o.paymentStatus }}
              </span>
            </td>
            <td>
              <span :class="admin.deliveryBadgeClass(o.deliveryStatus)">
                {{ o.deliveryStatus }}
              </span>
            </td>
            <td class="date-cell">{{ admin.formatDate(o.createdAt) }}</td>
          </tr>
          <tr v-if="admin.filteredOrders.length === 0">
            <td colspan="9">
              <div class="empty-state">
                <div class="emoji">📦</div>
                <p>No orders found.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
