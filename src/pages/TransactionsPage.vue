<script setup lang="ts">
import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <div>
    <div class="stats-row" style="grid-template-columns: repeat(3, 1fr)">
      <div class="stat-card green">
        <div class="label">Total Revenue</div>
        <div class="value">₱{{ admin.totalRevenue }}</div>
        <div class="sub">from verified orders</div>
      </div>
      <div class="stat-card gold">
        <div class="label">Pending</div>
        <div class="value">{{ admin.pendingOrders }}</div>
        <div class="sub">awaiting verification</div>
      </div>
      <div class="stat-card pink">
        <div class="label">Avg Order Value</div>
        <div class="value">₱{{ admin.avgOrder }}</div>
        <div class="sub">across all orders</div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <h3>All Transactions</h3>
        <small>{{ admin.orders.length }} total</small>
      </div>

      <div class="filter-row">
        <input
          class="search-input"
          v-model="admin.txSearch"
          placeholder="Search by name or order ID…"
        />
        <select class="filter-select" v-model="admin.txPayFilter">
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Verified</option>
          <option>Rejected</option>
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order ID</th><th>Customer</th><th>Total</th>
              <th>Method</th><th>Payment Status</th><th>Date</th><th>Proof</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in admin.filteredTx" :key="o.id">
              <td><code class="id-code">{{ o.id }}</code></td>
              <td>
                <div class="name-primary">{{ o.customer.name }}</div>
                <div class="name-secondary">{{ o.customer.email }}</div>
              </td>
              <td class="total-cell">{{ o.total }}</td>
              <td>{{ o.paymentMethod }}</td>
              <td>
                <select
                  class="status-select"
                  v-model="o.paymentStatus"
                  @change="admin.saveOrders(); admin.showToast('Payment status updated')"
                >
                  <option>Pending</option>
                  <option>Verified</option>
                  <option>Rejected</option>
                </select>
              </td>
              <td class="date-cell">{{ admin.formatDate(o.createdAt) }}</td>
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
            </tr>
            <tr v-if="admin.filteredTx.length === 0">
              <td colspan="7">
                <div class="empty-state">
                  <div class="emoji">💳</div>
                  <p>No transactions found.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
