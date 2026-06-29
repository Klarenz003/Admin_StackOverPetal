// src/stores/admin.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order, Message, AdminTab } from '@/types'
import { supabase } from '@/supabaseClient'

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
    async function loadData() {
    const [{ data: ordersData }, { data: msgsData }] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    orders.value = (ordersData || []).map(o => ({
      id:             o.id,
      createdAt:      o.created_at,
      customer: {
        name:    o.customer_name,
        email:   o.email,
        phone:   o.phone,
        address: o.address,
        date:    o.delivery_date,
        note:    o.note,
      },
      items:          o.items,
      total:          o.total,
      paymentMethod:  o.payment_method,
      proofImage:     o.proof_url
        ? supabase.storage.from('proofs').getPublicUrl(o.proof_url).data.publicUrl
        : '',
      paymentStatus:  capitalize(o.status) as any,
      deliveryStatus: (o.delivery_status ? capitalize(o.delivery_status) : 'Processing') as any,
    }))

    messages.value = (msgsData || []).map(m => ({
      id:        m.id,
      createdAt: m.created_at,
      name:      m.name,
      email:     m.email,
      subject:   m.subject,
      message:   m.message,
      read:      m.read,
    }))

    lastRefresh.value = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    })
  }

  function toTrackingStatus(order: Order) {
    if (order.paymentStatus === 'Rejected') return 'rejected'
    if (order.paymentStatus === 'Pending') return 'pending'

    const deliveryMap: Record<string, string> = {
      Processing: 'confirmed',
      Packed: 'preparing',
      Shipped: 'out_for_delivery',
      Delivered: 'delivered',
      Cancelled: 'issue',
    }

    return deliveryMap[order.deliveryStatus] || 'confirmed'
  }

  async function saveOrders(orderToSave = activeOrder.value) {
    if (!orderToSave) return
    
    const statusValue = toTrackingStatus(orderToSave)
    const deliveryValue = orderToSave.deliveryStatus.toLowerCase()
    
    console.log('Updating order:', orderToSave.id, { status: statusValue, delivery_status: deliveryValue })
    
    const { error } = await supabase
      .from('orders')
      .update({
        status: statusValue,
        delivery_status: deliveryValue,
      })
      .eq('id', orderToSave.id)

    if (error) {
      console.error('Update error:', error)
      showToast('Failed to update order: ' + error.message)
      return
    }
    
    showToast('Order updated!')
  }


  async function saveMessages() {
    if (!activeMessage.value) return
    await supabase
      .from('messages')
      .update({ read: activeMessage.value.read })
      .eq('id', activeMessage.value.id)
  }

  async function saveFromModal() {
    await saveOrders()
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

  // ── Helpers ────────────────────────────────────────────────────
    function capitalize(s: string) {
      return s.charAt(0).toUpperCase() + s.slice(1)
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
