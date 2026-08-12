<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import ProofLightbox from '@/components/ProofLightbox.vue'
import OrderModal from '@/components/OrderModal.vue'
import MessageModal from '@/components/MessageModal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const admin = useAdminStore()
const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000
let inactivityTimer: ReturnType<typeof window.setTimeout> | null = null
let loggingOutForInactivity = false
const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'pointerdown']

const pageTitle = computed(() => {
  const labels: Record<string, string> = {
    overview: 'Overview',
    orders: 'Orders',
    messages: 'Messages',
    products: 'Products',
    gallery: 'Gallery',
    'delivery-slots': 'Delivery Slots',
    transactions: 'Transactions',
    costing: 'Costing & Profit',
    letters: 'Letters',
    'investor-access': 'Investor Access',
    'investor-letters': 'Investor Letters',
  }

  return labels[String(route.name || '')] || admin.tabLabel
})

const navItems = computed(() => [
  { to: '/costing', icon: 'PHP', label: 'Costing & Profit' },
  { to: '/overview', icon: '📊', label: 'Overview' },
  { to: '/orders', icon: '📦', label: 'Orders', badge: admin.pendingOrders },
  { to: '/messages', icon: '💬', label: 'Messages', badge: admin.unreadMessages },
  { to: '/products', icon: '🌸', label: 'Products' },
  { to: '/gallery', icon: '📸', label: 'Gallery' },
  { to: '/delivery-slots', icon: '📅', label: 'Delivery Slots' },
  { to: '/transactions', icon: '💳', label: 'Transactions' },
  { to: '/letters', icon: '💌', label: 'Letters' },
  { to: '/investor-access', icon: 'ID', label: 'Investor Access' },
  { to: '/investor-letters', icon: 'QR', label: 'Investor Letters' },
])

function logout() {
  admin.stopAutoRefresh()
  auth.logout()
  router.push('/login')
}

async function logoutForInactivity() {
  if (loggingOutForInactivity) return
  loggingOutForInactivity = true
  admin.stopAutoRefresh()
  await auth.logout()
  router.push('/login')
}

function clearInactivityTimer() {
  if (!inactivityTimer) return
  window.clearTimeout(inactivityTimer)
  inactivityTimer = null
}

function resetInactivityTimer() {
  clearInactivityTimer()
  inactivityTimer = window.setTimeout(logoutForInactivity, INACTIVITY_LIMIT_MS)
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function openMobileSidebar() {
  mobileSidebarOpen.value = true
}

function closeMobileSidebar() {
  mobileSidebarOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    closeMobileSidebar()
    resetInactivityTimer()
  },
)

onMounted(() => {
  admin.loadData()
  admin.startAutoRefresh()
  resetInactivityTimer()
  activityEvents.forEach(eventName => {
    window.addEventListener(eventName, resetInactivityTimer, { passive: true })
  })
})

onBeforeUnmount(() => {
  admin.stopAutoRefresh()
  clearInactivityTimer()
  activityEvents.forEach(eventName => {
    window.removeEventListener(eventName, resetInactivityTimer)
  })
})
</script>

<template>
  <div
    class="admin-layout"
    :class="{
      'sidebar-collapsed': sidebarCollapsed,
      'mobile-sidebar-open': mobileSidebarOpen,
    }"
  >
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div>
          <h2><span class="brand-icon">🌸</span><span class="brand-text">Stack Petals</span></h2>
          <p>Admin Panel</p>
        </div>
        <button
          class="sidebar-toggle desktop-sidebar-toggle"
          type="button"
          :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggleSidebar"
        >
          {{ sidebarCollapsed ? '›' : '‹' }}
        </button>
        <button
          class="sidebar-toggle mobile-sidebar-close"
          type="button"
          aria-label="Close sidebar"
          @click="closeMobileSidebar"
        >
          ×
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Admin navigation">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="active"
          :title="sidebarCollapsed ? item.label : undefined"
        >
          <span class="icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-badge" v-if="Number(item.badge || 0) > 0">{{ item.badge }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" @click="logout" :title="sidebarCollapsed ? 'Sign Out' : undefined">
          <span class="logout-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" focusable="false">
              <path class="logout-door" d="M6.5 6.8 15 4.5c1-.28 2 .48 2 1.52v19.96c0 1.04-1 1.8-2 1.52l-8.5-2.3A2 2 0 0 1 5 23.27V8.73a2 2 0 0 1 1.5-1.93Z" />
              <path class="logout-frame" d="M18.5 8h5v6M23.5 18v6h-5" />
              <path class="logout-arrow" d="M15.5 16h9m-3.2-3.6L25 16l-3.7 3.6" />
              <circle class="logout-knob" cx="12.2" cy="16" r="1.15" />
            </svg>
          </span>
          <span class="nav-label">Sign Out</span>
        </button>
      </div>
    </aside>

    <button class="sidebar-backdrop" type="button" aria-label="Close sidebar" @click="closeMobileSidebar"></button>

    <main class="main">
      <div class="topbar">
        <div class="topbar-title">
          <button class="mobile-menu-btn" type="button" aria-label="Open sidebar" @click="openMobileSidebar">☰</button>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-actions">
          <span class="last-refresh">Updated {{ admin.lastRefresh }}</span>
          <button class="refresh-btn" @click="admin.loadData()">Refresh</button>
        </div>
      </div>

      <RouterView />
    </main>
  </div>

  <ProofLightbox />
  <OrderModal />
  <MessageModal />
</template>
