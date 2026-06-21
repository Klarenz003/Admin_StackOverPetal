// src/stores/admin.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order, Message, AdminTab } from '@/types'

export const useAdminStore = defineStore('admin', () => {

  // ── State ──────────────────────────────────────────────────────
  const tab         = ref<AdminTab>('overview')
  const orders      = ref<Order[]>([])
  const messages    = ref<Message[]>([])
  const lastRefresh = ref('just now')
  const toast       = ref('')
  let   _toastTimer = 0
  let   _refreshInterval = 0

  // Filters — orders
  const orderSearch    = ref('')
  const orderPayFilter = ref('')
  const orderDelFilter = ref('')

  // Filters — messages
  const msgSearch    = ref('')
  const msgReadFilter = ref('')

  // Filters — transactions
  const txSearch    = ref('')
  const txPayFilter = ref('')

  // Modals
  const activeOrder   = ref<Order | null>(null)
  const activeMessage = ref<Message | null>(null)
  const lightboxSrc   = ref<string | null>(null)

  // Reply
  const replyText   = ref('')
  const replyCopied = ref(false)

  // ── Computed ───────────────────────────────────────────────────
  const tabLabel = computed(() => ({
    overview: 'Overview', orders: 'Orders',
    messages: 'Messages', transactions: 'Transactions',
  }[tab.value]))

  const pendingOrders = computed(() =>
    orders.value.filter(o => o.paymentStatus === 'Pending').length
  )

  const unreadMessages = computed(() =>
    messages.value.filter(m => !m.read).length
  )

  const totalRevenue = computed(() => {
    const sum = orders.value
      .filter(o => o.paymentStatus === 'Verified')
      .reduce((a, o) => a + parseFloat(o.total.replace(/[₱$,]/g, '')), 0)
    return sum.toFixed(2)
  })

  const avgOrder = computed(() => {
    if (!orders.value.length) return '0.00'
    const sum = orders.value.reduce((a, o) => a + parseFloat(o.total.replace(/[₱$,]/g, '')), 0)
    return (sum / orders.value.length).toFixed(2)
  })

  const filteredOrders = computed(() =>
    orders.value.filter(o => {
      const q = orderSearch.value.toLowerCase()
      const matchQ = !q
        || o.id.toLowerCase().includes(q)
        || o.customer.name.toLowerCase().includes(q)
        || o.customer.email.toLowerCase().includes(q)
      const matchP = !orderPayFilter.value || o.paymentStatus === orderPayFilter.value
      const matchD = !orderDelFilter.value || o.deliveryStatus === orderDelFilter.value
      return matchQ && matchP && matchD
    })
  )

  const filteredMessages = computed(() =>
    messages.value.filter(m => {
      const q = msgSearch.value.toLowerCase()
      const matchQ = !q
        || m.name.toLowerCase().includes(q)
        || m.email.toLowerCase().includes(q)
        || (m.subject || '').toLowerCase().includes(q)
      const matchR = !msgReadFilter.value
        || (msgReadFilter.value === 'read'   &&  m.read)
        || (msgReadFilter.value === 'unread' && !m.read)
      return matchQ && matchR
    })
  )

  const filteredTx = computed(() =>
    orders.value.filter(o => {
      const q = txSearch.value.toLowerCase()
      const matchQ = !q
        || o.id.toLowerCase().includes(q)
        || o.customer.name.toLowerCase().includes(q)
      const matchP = !txPayFilter.value || o.paymentStatus === txPayFilter.value
      return matchQ && matchP
    })
  )

  // ── Actions ────────────────────────────────────────────────────
  function loadData() {
    // TODO: Replace with Supabase / API calls
    // orders.value   = await api.get('/orders')
    // messages.value = await api.get('/messages')
    orders.value   = JSON.parse(localStorage.getItem('sp_orders')   || '[]')
    messages.value = JSON.parse(localStorage.getItem('sp_messages') || '[]')
    lastRefresh.value = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  function saveOrders() {
    localStorage.setItem('sp_orders', JSON.stringify(orders.value))
  }

  function saveMessages() {
    localStorage.setItem('sp_messages', JSON.stringify(messages.value))
  }

  function saveFromModal() {
    saveOrders()
    showToast('Order updated successfully!')
    activeOrder.value = null
  }

  function openOrder(o: Order) {
    activeOrder.value = o
  }

  function openMessage(m: Message) {
    m.read = true
    saveMessages()
    activeMessage.value = m
    replyText.value   = ''
    replyCopied.value = false
  }

  function toggleRead(m: Message) {
    m.read = !m.read
    saveMessages()
  }

  function viewProof(src: string) {
    lightboxSrc.value = src
  }

  function copyReply() {
    if (!replyText.value) return
    navigator.clipboard.writeText(replyText.value).then(() => {
      replyCopied.value = true
      setTimeout(() => replyCopied.value = false, 2500)
    })
  }

  function showToast(msg: string) {
    toast.value = msg
    clearTimeout(_toastTimer)
    _toastTimer = window.setTimeout(() => toast.value = '', 2500)
  }

  function formatDate(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function paymentBadgeClass(s: string) {
    return {
      badge: true,
      'badge-pending':  s === 'Pending',
      'badge-verified': s === 'Verified',
      'badge-rejected': s === 'Rejected',
    }
  }

  function deliveryBadgeClass(s: string) {
    return {
      badge: true,
      'badge-processing': s === 'Processing',
      'badge-packed':     s === 'Packed',
      'badge-shipped':    s === 'Shipped',
      'badge-delivered':  s === 'Delivered',
      'badge-cancelled':  s === 'Cancelled',
    }
  }

  function startAutoRefresh() {
    _refreshInterval = window.setInterval(() => loadData(), 30000)
  }

  function stopAutoRefresh() {
    clearInterval(_refreshInterval)
  }

  return {
    // state
    tab, orders, messages, lastRefresh, toast,
    orderSearch, orderPayFilter, orderDelFilter,
    msgSearch, msgReadFilter,
    txSearch, txPayFilter,
    activeOrder, activeMessage, lightboxSrc,
    replyText, replyCopied,
    // computed
    tabLabel, pendingOrders, unreadMessages,
    totalRevenue, avgOrder,
    filteredOrders, filteredMessages, filteredTx,
    // actions
    loadData, saveOrders, saveMessages, saveFromModal,
    openOrder, openMessage, toggleRead,
    viewProof, copyReply, showToast, formatDate,
    paymentBadgeClass, deliveryBadgeClass,
    startAutoRefresh, stopAutoRefresh,
  }
})
