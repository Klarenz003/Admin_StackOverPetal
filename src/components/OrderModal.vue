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
          <p><code style="font-size:12px">{{ admin.orderReference(admin.activeOrder.id) }}</code></p>
        </div>
        <div class="detail-item">
          <label>Order Type</label>
          <p>
            <span :class="admin.orderTypeBadgeClass(admin.activeOrder)">
              {{ admin.isPreorder(admin.activeOrder) ? 'Pre-order' : 'Standard' }}
            </span>
          </p>
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
          <input class="detail-input" v-model="admin.activeOrder.customer.date" type="date" />
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
          <img
            :src="item.image"
            :alt="item.name"
            @error="($event.target as HTMLImageElement).src = admin.normalizeOrderItemImage()"
          />
          <span class="name">{{ item.name }}</span>
          <span class="qty preorder-item-pill" v-if="item.preOrder">Pre-order</span>
          <span class="qty" v-if="item.preOrder">{{ item.prepDays ?? 5 }}d prep</span>
          <span class="qty" v-if="item.quantity && item.quantity > 1">x{{ item.quantity }}</span>
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
        @click="admin.viewProof(admin.activeOrder.proofImage)"
      />
      <div class="payment-review-actions">
        <button class="mini-action-btn" @click="admin.approvePayment()">Approve Payment</button>
        <button class="mini-action-btn" @click="admin.requestClearerProof()">Needs Clearer Proof</button>
        <button class="mini-action-btn danger" @click="admin.rejectPayment()">Reject Payment</button>
      </div>

      <div class="detail-item full internal-note-box">
        <label>Internal Admin Note</label>
        <textarea
          v-model="admin.activeOrder.adminNote"
          class="detail-input"
          rows="3"
          placeholder="Private note for your team. Customers cannot see this."
        ></textarea>
      </div>

      <div class="detail-section-link" v-if="admin.activeOrder.letterId">
        <div>
          <label>Letter Link</label>
          <p>{{ admin.activeOrder.letterPublished ? 'Published' : 'Draft' }} letter attached to this order.</p>
        </div>
        <button class="mini-action-btn" @click="admin.copyText(admin.letterUrl(admin.activeOrder), 'Letter link copied')">
          Copy Link
        </button>
        <a class="mini-action-btn" :href="admin.letterUrl(admin.activeOrder)" target="_blank" rel="noopener noreferrer">
          Open
        </a>
      </div>

      <div class="detail-section-link email-template-card">
        <div>
          <label>Manual Customer Email</label>
          <p>
            To: {{ admin.activeOrder.customer.email }}<br>
            Subject: {{ admin.orderEmailSubject(admin.activeOrder) }}
          </p>
          <small class="email-helper-note">Copy this into Gmail while automatic email sending is not ready yet.</small>
        </div>
        <div class="email-template-actions">
          <button
            class="mini-action-btn"
            @click="admin.copyText(admin.orderEmailSubject(admin.activeOrder), 'Email subject copied')"
          >
            Copy Subject
          </button>
          <button
            class="mini-action-btn"
            @click="admin.copyText(admin.orderEmailBody(admin.activeOrder), 'Email template copied')"
          >
            Copy Email
          </button>
        </div>
      </div>

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

      <div v-if="admin.activeOrder.statusHistory?.length" class="admin-history">
        <h3 class="section-mini-label">Order Timeline</h3>
        <div v-for="item in admin.activeOrder.statusHistory" :key="item.id" class="admin-history-item">
          <span></span>
          <div>
            <strong>{{ item.label }}</strong>
            <p v-if="item.note">{{ item.note }}</p>
            <small>{{ item.createdAt ? admin.formatDate(item.createdAt) : '' }}</small>
          </div>
        </div>
      </div>

      <button class="save-btn" style="margin-top:18px" @click="admin.saveFromModal()">
        Save Changes
      </button>
    </div>
  </div>
</template>
