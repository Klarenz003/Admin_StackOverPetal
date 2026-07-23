<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import ProofLightbox   from '@/components/ProofLightbox.vue'
import OrderModal      from '@/components/OrderModal.vue'
import MessageModal    from '@/components/MessageModal.vue'

const route = useRoute()
const router = useRouter()
const auth   = useAuthStore()
const admin  = useAdminStore()
const pageTitle = computed(() => {
  const labels: Record<string, string> = {
    overview: 'Overview',
    orders: 'Orders',
    messages: 'Messages',
    products: 'Products',
    gallery: 'Gallery',
    'delivery-slots': 'Delivery Slots',
    transactions: 'Transactions',
    letters: 'Letters',
    'investor-access': 'Investor Access',
    'investor-letters': 'Investor Letters',
  }

  return labels[String(route.name || '')] || admin.tabLabel
})

function logout() {
  admin.stopAutoRefresh()
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="admin-layout">

    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <h2>🌸 Stack Petals</h2>
        <p>Admin Panel</p>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/overview" class="nav-item" active-class="active">
          <span class="icon">📊</span> Overview
        </RouterLink>
        <RouterLink to="/orders" class="nav-item" active-class="active">
          <span class="icon">📦</span> Orders
          <span class="nav-badge" v-if="admin.pendingOrders > 0">{{ admin.pendingOrders }}</span>
        </RouterLink>
        <RouterLink to="/messages" class="nav-item" active-class="active">
          <span class="icon">💬</span> Messages
          <span class="nav-badge" v-if="admin.unreadMessages > 0">{{ admin.unreadMessages }}</span>
        </RouterLink>
        <RouterLink to="/products" class="nav-item" active-class="active">
          <span class="icon">🌸</span> Products
        </RouterLink>
        <RouterLink to="/gallery" class="nav-item" active-class="active">
          <span class="icon">📸</span> Gallery
        </RouterLink>
        <RouterLink to="/delivery-slots" class="nav-item" active-class="active">
          <span class="icon">📅</span> Delivery Slots
        </RouterLink>
        <RouterLink to="/transactions" class="nav-item" active-class="active">
          <span class="icon">💳</span> Transactions
        </RouterLink>
        <RouterLink to="/letters" class="nav-item" active-class="active">
          <span class="icon">💌</span> Letters
        </RouterLink>
        <RouterLink to="/investor-access" class="nav-item" active-class="active">
          <span class="icon">ID</span> Investor Access
        </RouterLink>
        <RouterLink to="/investor-letters" class="nav-item" active-class="active">
          <span class="icon">QR</span> Investor Letters
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" @click="logout">Sign Out</button>
      </div>
    </aside>

    <!-- Main -->
    <main class="main">
      <!-- Top Bar -->
      <div class="topbar">
        <h1>{{ pageTitle }}</h1>
        <div class="topbar-actions">
          <span class="last-refresh">Updated {{ admin.lastRefresh }}</span>
          <button class="refresh-btn" @click="admin.loadData()">⟳ Refresh</button>
        </div>
      </div>

      <!-- Page content -->
      <RouterView />
    </main>
  </div>

  <!-- Global modals -->
  <ProofLightbox />
  <OrderModal />
  <MessageModal />
</template>


