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
  const products    = ref<any[]>([])
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
  const savingOrderIds = new Set<string>()

  // Reply
  const replyText   = ref('')
  const replyCopied = ref(false)

  // ── Computed ───────────────────────────────────────────────────
  const tabLabel = computed(() => ({
    overview: 'Overview', orders: 'Orders',
    messages: 'Messages', transactions: 'Transactions',
    products: 'Products', gallery: 'Gallery', letters: 'Letters',
    delivery: 'Delivery Slots',
  }[tab.value]))

  const pendingOrders = computed(() =>
    orders.value.filter(o => o.paymentStatus === 'Pending').length
  )

  const unreadMessages = computed(() =>
    messages.value.filter(m => !m.read).length
  )

  const preorderOrders = computed(() =>
    orders.value.filter(o => isPreorder(o)).length
  )

  const lowStockProducts = computed(() =>
    products.value.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 3)
  )

  const outOfStockProducts = computed(() =>
    products.value.filter(p => Number(p.stock || 0) <= 0)
  )

  const bestSellingItems = computed(() => {
    const counts = new Map<string, number>()
    orders.value.forEach(order => {
      order.items.forEach(item => {
        counts.set(item.name, (counts.get(item.name) || 0) + (item.quantity || 1))
      })
    })
    return Array.from(counts.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  })

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
    const [{ data: ordersData }, { data: msgsData }, { data: lettersData }, { data: historyData }, { data: productsData }] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('letters')
        .select('id, order_id, published'),
      supabase
        .from('order_status_history')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase
        .from('products')
        .select('id, name, stock, pre_order_allowed, prep_days, delivery_restrictions'),
    ])

    const lettersByOrder = new Map(
      (lettersData || []).map(letter => [letter.order_id, letter])
    )
    const historyByOrder = new Map<string, any[]>()
    ;(historyData || []).forEach(item => {
      const list = historyByOrder.get(item.order_id) || []
      list.push(item)
      historyByOrder.set(item.order_id, list)
    })

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
      items:          normalizeOrderItems(o.items),
      total:          o.total,
      paymentMethod:  o.payment_method,
      proofImage:     o.proof_url
        ? supabase.storage.from('proofs').getPublicUrl(o.proof_url).data.publicUrl
        : '',
      paymentStatus:  toPaymentStatus(o.status),
      deliveryStatus: toDeliveryStatus(o.delivery_status),
      trackingStatus: o.status || 'pending',
      letterId:       lettersByOrder.get(o.id)?.id,
      letterPublished: !!lettersByOrder.get(o.id)?.published,
      adminNote:      o.admin_note || '',
      statusHistory:  (historyByOrder.get(o.id) || []).map(item => ({
        id: item.id,
        status: item.status,
        label: item.label,
        note: item.note,
        createdAt: item.created_at,
      })),
    }))

    products.value = productsData || []

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
    if (isPreorder(order) && order.deliveryStatus === 'Processing') return 'preorder'

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
    if (savingOrderIds.has(orderToSave.id)) return
    savingOrderIds.add(orderToSave.id)
    
    try {
      const statusValue = toTrackingStatus(orderToSave)
      const deliveryValue = orderToSave.deliveryStatus.toLowerCase()
      const existingOrder = orders.value.find(o => o.id === orderToSave.id)
      const latestHistoryStatus = orderToSave.statusHistory?.[orderToSave.statusHistory.length - 1]?.status
      const changed = orderToSave.trackingStatus !== statusValue && latestHistoryStatus !== statusValue
      
      console.log('Updating order:', orderToSave.id, { status: statusValue, delivery_status: deliveryValue })
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: statusValue,
          delivery_status: deliveryValue,
          delivery_date: orderToSave.customer.date,
          admin_note: orderToSave.adminNote || '',
        })
        .eq('id', orderToSave.id)

      if (error) {
        console.error('Update error:', error)
        showToast('Failed to update order: ' + error.message)
        return
      }

      orderToSave.trackingStatus = statusValue
      if (changed) {
        const recorded = await recordStatusHistory(orderToSave, statusValue)
        if (recorded) {
          orderToSave.statusHistory = [
            ...(orderToSave.statusHistory || []),
            {
              id: `${Date.now()}`,
              status: statusValue,
              label: statusLabel(statusValue),
              note: `Updated from admin: payment ${orderToSave.paymentStatus}, delivery ${orderToSave.deliveryStatus}.`,
              createdAt: new Date().toISOString(),
            },
          ]
        }
      }

      if (existingOrder) {
        existingOrder.paymentStatus = orderToSave.paymentStatus
        existingOrder.deliveryStatus = orderToSave.deliveryStatus
        existingOrder.trackingStatus = statusValue
        existingOrder.customer.date = orderToSave.customer.date
        existingOrder.adminNote = orderToSave.adminNote || ''
        existingOrder.statusHistory = orderToSave.statusHistory || existingOrder.statusHistory
      }

      showToast('Order updated!')
    } finally {
      savingOrderIds.delete(orderToSave.id)
    }
  }

  async function recordStatusHistory(order: Order, status: string) {
    if (order.statusHistory?.[order.statusHistory.length - 1]?.status === status) return false

    const { error } = await supabase.rpc('record_order_status_history', {
      p_order_id: order.id,
      p_status: status,
      p_label: statusLabel(status),
      p_note: `Updated from admin: payment ${order.paymentStatus}, delivery ${order.deliveryStatus}.`,
    })

    if (error) {
      console.warn('Status history was not recorded:', error)
      return false
    }

    return true
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      pending: 'Order received',
      confirmed: 'Payment confirmed',
      preorder: 'Pre-order confirmed',
      preparing: 'Preparing bouquet',
      out_for_delivery: 'Out for delivery',
      delivered: 'Delivered',
      issue: 'Needs attention',
      rejected: 'Payment issue',
    }
    return labels[status] || status.replace(/_/g, ' ')
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
    activeOrder.value = { ...o, customer: { ...o.customer }, items: [...o.items], statusHistory: [...(o.statusHistory || [])] }
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

  async function approvePayment(order = activeOrder.value) {
    if (!order) return
    order.paymentStatus = 'Verified'
    order.deliveryStatus = order.deliveryStatus === 'Cancelled' ? 'Processing' : order.deliveryStatus
    await saveOrders(order)
    showToast('Payment approved')
  }

  async function rejectPayment(order = activeOrder.value) {
    if (!order) return
    order.paymentStatus = 'Rejected'
    await saveOrders(order)
    showToast('Payment rejected')
  }

  async function requestClearerProof(order = activeOrder.value) {
    if (!order) return
    order.paymentStatus = 'Pending'
    order.adminNote = `${order.adminNote || ''}${order.adminNote ? '\n' : ''}Needs clearer payment screenshot.`
    await saveOrders(order)
    showToast('Marked as needing clearer proof')
  }

  function isPreorder(order: Order) {
    return ['preorder', 'pre_order'].includes(order.trackingStatus.toLowerCase())
  }

  function orderReference(id: string) {
    return id.startsWith('SP-') ? id : `SP-${id}`
  }

  function customerSiteBaseUrl() {
    return (import.meta.env.VITE_CUSTOMER_SITE_URL || 'https://stackoverpetals.shop').replace(/\/$/, '')
  }

  function normalizeOrderItems(items: any[] = []) {
    return items.map(item => ({
      ...item,
      image: normalizeOrderItemImage(item?.image),
    }))
  }

  function normalizeOrderItemImage(src = '') {
    if (/^(https?:|data:|blob:)/.test(src)) return src
    const path = src ? src.replace(/^\/?/, '/') : '/images/b5.png'
    return `${customerSiteBaseUrl()}${path}`
  }

  function letterUrl(order: Order) {
    if (!order.letterId) return ''
    return `${customerSiteBaseUrl()}/letter/${order.letterId}`
  }

  function customerTrackUrl() {
    return `${customerSiteBaseUrl()}/track`
  }

  function orderEmailSubject(order: Order) {
    const ref = orderReference(order.id)

    if (order.paymentStatus === 'Rejected') return `Stack Petals payment update - ${ref}`
    if (order.deliveryStatus === 'Cancelled') return `Stack Petals order update - ${ref}`
    if (order.deliveryStatus === 'Delivered') return `Stack Petals order delivered - ${ref}`
    if (order.deliveryStatus === 'Shipped') return `Your Stack Petals delivery is on the way - ${ref}`
    if (order.deliveryStatus === 'Packed') return `Your Stack Petals bouquet is preparing - ${ref}`
    if (isPreorder(order)) return `Stack Petals pre-order confirmed - ${ref}`
    if (order.paymentStatus === 'Verified') return `Stack Petals payment confirmed - ${ref}`

    return `Stack Petals order received - ${ref}`
  }

  function orderEmailStatusLine(order: Order) {
    if (order.paymentStatus === 'Rejected') {
      return 'We reviewed your payment proof and need your help confirming the payment details.'
    }

    if (order.deliveryStatus === 'Cancelled') {
      return 'We have an important update about your order. Please contact us so we can assist you right away.'
    }

    if (order.deliveryStatus === 'Delivered') {
      return 'Your bouquet has been marked as delivered. Thank you for choosing Stack Petals.'
    }

    if (order.deliveryStatus === 'Shipped') {
      return 'Your bouquet is now on the way to the delivery address.'
    }

    if (order.deliveryStatus === 'Packed') {
      return 'Your bouquet is now being prepared for delivery.'
    }

    if (isPreorder(order)) {
      return 'Your pre-order has been received. Pre-order bouquets usually need 3-5 days of preparation.'
    }

    if (order.paymentStatus === 'Verified') {
      return 'Your payment has been confirmed and your order is now being processed.'
    }

    return 'We received your order and will review your payment proof shortly.'
  }

  function orderEmailBody(order: Order) {
    const ref = orderReference(order.id)
    const items = order.items
      .map(item => {
        const qty = item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ''
        const preorder = item.preOrder ? ' (pre-order)' : ''
        return `- ${item.name}${qty}${preorder}`
      })
      .join('\n')

    return [
      `Hi ${order.customer.name || 'there'},`,
      '',
      orderEmailStatusLine(order),
      '',
      `Order ID: ${ref}`,
      `Status: ${toTrackingStatus(order).replace(/_/g, ' ')}`,
      `Delivery Date: ${order.customer.date || 'To be confirmed'}`,
      `Total: ${order.total}`,
      '',
      'Items:',
      items || '- Bouquet order',
      '',
      `You can track your order here: ${customerTrackUrl()}`,
      `Use your Order ID and phone number: ${order.customer.phone || 'your checkout phone number'}`,
      '',
      'For concerns or changes, you can reply to this email or contact us through our website.',
      '',
      'Thank you,',
      'Stack Petals',
    ].join('\n')
  }

  function copyText(value: string, label = 'Copied!') {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => showToast(label))
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

  function orderTypeBadgeClass(order: Order) {
    return {
      badge: true,
      'badge-preorder': isPreorder(order),
      'badge-standard': !isPreorder(order),
    }
  }

  function startAutoRefresh() {
    _refreshInterval = window.setInterval(() => loadData(), 30000)
  }

  function stopAutoRefresh() {
    clearInterval(_refreshInterval)
  }

  // ── Helpers ────────────────────────────────────────────────────
    function capitalize(s = '') {
      return s.charAt(0).toUpperCase() + s.slice(1)
    }

    function toPaymentStatus(status = '') {
      const normalized = status.toLowerCase()
      if (normalized === 'rejected') return 'Rejected'
      if (normalized === 'pending') return 'Pending'
      return 'Verified'
    }

    function toDeliveryStatus(status = '') {
      const normalized = status.toLowerCase()
      const labels: Record<string, Order['deliveryStatus']> = {
        processing: 'Processing',
        packed: 'Packed',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
        issue: 'Cancelled',
      }
      return labels[normalized] || 'Processing'
    }

  return {
    // state
    tab, orders, messages, products, lastRefresh, toast,
    orderSearch, orderPayFilter, orderDelFilter,
    msgSearch, msgReadFilter,
    txSearch, txPayFilter,
    activeOrder, activeMessage, lightboxSrc,
    replyText, replyCopied,
    // computed
    tabLabel, pendingOrders, unreadMessages, preorderOrders,
    totalRevenue, avgOrder, lowStockProducts, outOfStockProducts, bestSellingItems,
    filteredOrders, filteredMessages, filteredTx,
    // actions
    loadData, saveOrders, saveMessages, saveFromModal,
    openOrder, openMessage, toggleRead,
    viewProof, approvePayment, rejectPayment, requestClearerProof,
    copyReply, showToast, formatDate,
    isPreorder, orderReference, letterUrl, copyText,
    customerTrackUrl, orderEmailSubject, orderEmailBody,
    normalizeOrderItemImage,
    paymentBadgeClass, deliveryBadgeClass,
    orderTypeBadgeClass,
    startAutoRefresh, stopAutoRefresh,
  }
})
