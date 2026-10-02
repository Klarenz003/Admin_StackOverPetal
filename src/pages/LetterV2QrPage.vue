<script setup lang="ts">
import '@/assets/letter-workspace.css'
import { computed, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { PhQrCode, PhMagnifyingGlass, PhPrinter, PhPlus, PhCopy, PhDownloadSimple } from '@phosphor-icons/vue'
import { supabase } from '@/supabaseClient'

type Code = { id: string; public_token: string; activation_code: string; product_name: string; has_360_view: boolean; has_photo_upload: boolean; status: string; created_at: string; qrDataUrl?: string }
const form = ref({ count: 1, product_name: 'Stack Petals gift', has_360_view: false, has_photo_upload: true })
const codes = ref<Code[]>([])
const loading = ref(false)
const error = ref('')
const fetching = ref(false)
const search = ref('')
const statusFilter = ref('all')
const pendingId = ref('')
const copiedId = ref('')
const filteredCodes = computed(() => codes.value.filter(code =>
  (statusFilter.value === 'all' || code.status === statusFilter.value) &&
  [code.product_name, code.public_token, code.activation_code, code.id].some(value => value.toLowerCase().includes(search.value.trim().toLowerCase()))))
const availableCount = computed(() => codes.value.filter(code => code.status === 'unused').length)
const publishedCount = computed(() => codes.value.filter(code => code.status === 'published').length)
async function copyActivation(code: Code) {
  try { await navigator.clipboard.writeText(code.activation_code); copiedId.value = code.id }
  catch { error.value = 'Could not copy. Select the activation code and copy it manually.' }
}
function downloadCard(code: Code) {
  const link = document.createElement('a'); link.href = code.qrDataUrl || ''
  link.download = `gift-qr-${code.activation_code}.png`; link.click()
}
const siteUrl = () => (import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
function token() { const bytes = new Uint8Array(18); crypto.getRandomValues(bytes); return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('') }
function activation() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = new Uint8Array(8); crypto.getRandomValues(bytes); return [...bytes].map(byte => chars[byte % chars.length]).join('').replace(/(.{4})/, '$1-') }
async function load() {
  fetching.value = true; error.value = ''
  try {
    const { data, error: loadError } = await supabase.from('letter_v2_qr_codes').select('*').order('created_at', { ascending: false }).limit(200)
    if (loadError) throw loadError
    codes.value = await Promise.all((data || []).map(async code => ({ ...code, qrDataUrl: await QRCode.toDataURL(`${siteUrl()}/letter-v2/claim/${code.public_token}`, { width: 420, margin: 2 }) })))
  } catch (cause: any) { error.value = cause?.message || 'Could not load Gift QR codes.' }
  finally { fetching.value = false }
}
async function generate() {
  if (loading.value) return
  if (!Number.isInteger(form.value.count) || form.value.count < 1 || form.value.count > 100) { error.value = 'Choose a whole-number quantity between 1 and 100.'; return }
  loading.value = true; error.value = ''
  try {
    const rows = Array.from({ length: Math.min(100, Math.max(1, form.value.count)) }, () => ({ public_token: token(), activation_code: activation(), product_name: form.value.product_name.trim() || 'Stack Petals gift', has_360_view: form.value.has_360_view, has_photo_upload: form.value.has_photo_upload }))
    const { error: insertError } = await supabase.from('letter_v2_qr_codes').insert(rows)
    if (insertError) throw insertError
    await load()
  } catch (caught) { error.value = caught instanceof Error ? caught.message : 'Could not generate Gift QR codes.' }
  finally { loading.value = false }
}
async function setStatus(code: Code, status: string) {
  if (pendingId.value || status === code.status) return
  if (status === 'revoked' && !window.confirm('Revoke this QR code? Its public link will stop working.')) return
  pendingId.value = code.id; error.value = ''
  try {
    const { error: updateError } = await supabase.from('letter_v2_qr_codes').update({ status, revoked_at: status === 'revoked' ? new Date().toISOString() : null }).eq('id', code.id)
    if (updateError) throw updateError
    code.status = status
  } catch (cause: any) { error.value = cause?.message || 'Could not change QR status.' }
  finally { pendingId.value = '' }
}
function printCards() { window.print() }
async function changeStatus(code: Code, event: Event) {
  const select = event.target as HTMLSelectElement
  await setStatus(code, select.value)
  select.value = code.status
}
onMounted(load)
</script>

<template>
  <section class="page qr-page letter-workspace">
    <header class="workspace-heading"><div><p class="workspace-eyebrow">Letter studio · Physical gifts</p><h1>Gift QR codes</h1><p>From a printed card to a personal keepsake. Generate, organize, and prepare your gift codes here.</p></div><span class="workspace-heading-icon"><PhQrCode :size="30" weight="light" /></span></header>
    <div class="workspace-stats"><div><span>Latest codes</span><strong>{{ codes.length }}</strong><small>Up to 200 most recent cards</small></div><div><span>Ready to gift</span><strong>{{ availableCount }}</strong><small>Not activated yet</small></div><div><span>Published letters</span><strong>{{ publishedCount }}</strong><small>Personal stories brought to life</small></div></div>
    <form class="workspace-batch" @submit.prevent="generate">
      <div class="workspace-batch-heading"><span class="workspace-eyebrow">Create a new batch</span><h2>Little cards. Endless possibilities.</h2><p>Each card gets a unique QR link and activation key.</p></div>
      <div class="workspace-batch-fields"><label>Product name<input v-model="form.product_name" maxlength="120" placeholder="Stack Petals gift" /></label><label>Quantity<input v-model.number="form.count" type="number" min="1" max="100" step="1" required /></label></div>
      <div class="workspace-batch-options"><label><input v-model="form.has_360_view" type="checkbox" /><span>360° bouquet viewer<small>Enable the bouquet experience</small></span></label><label><input v-model="form.has_photo_upload" type="checkbox" /><span>Memory photos<small>Let customers upload their moments</small></span></label></div>
      <button class="workspace-primary" type="submit" :disabled="loading || fetching"><PhPlus :size="16" />{{ loading ? 'Generating your cards…' : 'Generate QR batch' }}</button>
    </form>
    <p v-if="error" class="workspace-error" role="alert">{{ error }}</p>
    <div class="workspace-toolbar"><label class="workspace-search"><PhMagnifyingGlass :size="19" aria-hidden="true" /><input v-model="search" type="search" aria-label="Search Gift QR codes" placeholder="Product, activation key, QR token or ID…" /></label><select v-model="statusFilter" aria-label="Filter QR status"><option value="all">All statuses</option><option v-for="status in ['unused','claimed','published','replaced','revoked']" :key="status" :value="status">{{ status }}</option></select><button class="workspace-secondary" :disabled="fetching || loading" @click="load">Refresh</button><button class="workspace-secondary" :disabled="!filteredCodes.length" @click="printCards"><PhPrinter :size="16" />Print cards</button></div>
    <div class="workspace-results"><span>{{ filteredCodes.length }} of {{ codes.length }} recent cards</span><button v-if="search || statusFilter !== 'all'" @click="search = ''; statusFilter = 'all'">Clear filters</button></div>
    <div v-if="fetching" class="workspace-empty" role="status">Preparing your gift cards…</div>
    <div v-else-if="!filteredCodes.length" class="workspace-empty"><PhQrCode :size="36" weight="light" /><h3>{{ codes.length ? 'No matching cards' : 'Your next keepsake starts here' }}</h3><p>{{ codes.length ? 'Try a different product or activation key, or clear your filters.' : 'Generate your first batch to create unique gift-ready QR codes.' }}</p></div>
    <div v-else class="workspace-qr-grid">
      <article v-for="code in filteredCodes" :key="code.id" class="workspace-qr-card">
        <div class="workspace-qr-top"><span class="workspace-status" :class="'status-' + code.status">{{ code.status }}</span><small>{{ new Date(code.created_at).toLocaleDateString() }}</small></div>
        <div class="workspace-qr-image"><img :src="code.qrDataUrl" alt="Scannable Gift QR code" /></div>
        <h3>{{ code.product_name }}</h3>
        <div class="workspace-activation"><small>Activation key</small><div><code>{{ code.activation_code }}</code><button type="button" :aria-label="copiedId === code.id ? 'Activation key copied' : 'Copy activation key'" @click="copyActivation(code)"><PhCopy :size="16" />{{ copiedId === code.id ? 'Copied' : 'Copy' }}</button></div></div>
        <div class="workspace-qr-features"><span>{{ code.has_360_view ? '360° enabled' : 'Letter only' }}</span><span>{{ code.has_photo_upload ? 'Memory photos' : 'No photo uploads' }}</span></div>
        <div class="workspace-qr-controls"><label>Status<select :value="code.status" :disabled="!!pendingId" @change="changeStatus(code, $event)"><option v-for="status in ['unused','claimed','published','replaced','revoked']" :key="status" :value="status">{{ status }}</option></select></label><button class="workspace-secondary" @click="downloadCard(code)" aria-label="Download QR image"><PhDownloadSimple :size="17" /></button></div>
      </article>
    </div>
  </section>
</template>
