<script setup lang="ts">
import { useAdminStore } from '@/stores/admin'
const admin = useAdminStore()
</script>

<template>
  <div
    class="modal-overlay"
    v-if="admin.activeOrder"
    @click.self="admin.activeOrder = null"
  >
    <div class="modal-box">
      <button class="modal-close" @click="admin.activeOrder = null">✕</button>
      <h2>Order Detail</h2>

      <div class="detail-grid">
        <div class="detail-item">
          <label>Order ID</label>
          <p><code style="font-size:12px">{{ admin.activeOrder.id }}</code></p>
        </div>
        <div class="detail-item">
          <label>Date</label>
          <p>{{ admin.formatDate(admin.activeOrder.createdAt) }}</p>
        </div>
        <div class="detail-item">
          <label>Customer Name</label>
          <p>{{ admin.activeOrder.customer.name }}</p>
        </div>
        <div class="detail-item">
          <label>Email</label>
          <p>{{ admin.activeOrder.customer.email }}</p>
        </div>
        <div class="detail-item">
          <label>Phone</label>
          <p>{{ admin.activeOrder.customer.phone }}</p>
        </div>
        <div class="detail-item">
          <label>Delivery Date</label>
          <p>{{ admin.activeOrder.customer.date }}</p>
        </div>
        <div class="detail-item full">
          <label>Delivery Address</label>
          <p>{{ admin.activeOrder.customer.address }}</p>
        </div>
        <div class="detail-item full" v-if="admin.activeOrder.customer.note">
          <label>Note</label>
          <p>{{ admin.activeOrder.customer.note }}</p>
        </div>
      </div>

      <h3 class="section-mini-label">Items Ordered</h3>
      <div class="order-items-list">
        <div
          class="order-item-row"
          v-for="item in admin.activeOrder.items"
          :key="item.name"
        >
          <img :src="item.image" :alt="item.name" />
          <span class="name">{{ item.name }}</span>
          <span class="price">{{ item.price }}</span>
        </div>
      </div>

      <div class="order-total-line">
        Total: <span class="total-value">{{ admin.activeOrder.total }}</span>
        <span class="payment-via">via {{ admin.activeOrder.paymentMethod }}</span>
      </div>

      <h3 class="section-mini-label">Payment Proof</h3>
      <img
        v-if="admin.activeOrder.proofImage"
        :src="admin.activeOrder.proofImage"
        class="proof-full"
        alt="Proof"
      />

      <div class="status-row">
        <div>
          <label>Payment Status</label>
          <select class="status-select" v-model="admin.activeOrder.paymentStatus">
            <option>Pending</option>
            <option>Verified</option>
            <option>Rejected</option>
          </select>
        </div>
        <div>
          <label>Delivery Status</label>
          <select class="status-select" v-model="admin.activeOrder.deliveryStatus">
            <option>Processing</option>
            <option>Packed</option>
            <option>Shipped</option>
            <option>Delivered</option>
            <option>Cancelled</option>
          </select>
        </div>
      </div>

      <button class="save-btn" style="margin-top:18px" @click="admin.saveFromModal()">
        Save Changes
      </button>
    </div>
  </div>
</template>
