<script setup lang="ts">
import '@/assets/letter-workspace.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { PhQrCode, PhMagnifyingGlass, PhPrinter, PhPlus, PhCopy, PhDownloadSimple, PhEye, PhX } from '@phosphor-icons/vue'
import { supabase } from '@/supabaseClient'
import { giftCardSvg, giftClaimUrl, loadGiftCardTemplates, svgDataUrl, type GiftCardTemplates } from '@/utils/giftCardArtwork'
import { downloadGiftCardPng, downloadGiftCardBatch } from '@/utils/giftCardPng'
import GiftQrManageDialog from '@/components/GiftQrManageDialog.vue'

type Code = { id: string; public_token: string; activation_code: string; product_name: string; has_360_view: boolean; has_photo_upload: boolean; status: string; letter_id?: string | null; created_at: string; qrDataUrl?: string }
const form = ref({ count: 1, product_name: 'Stack Petals gift', has_360_view: false, has_photo_upload: true })
const codes = ref<Code[]>([])
const loading = ref(false)
const error = ref('')
const fetching = ref(false)
const search = ref('')
const statusFilter = ref('all')
const manageCode = ref<Code | null>(null)
const success = ref('')
const copiedId = ref('')
const exportingId = ref('')
const previewCode = ref<Code | null>(null)
const cardTemplates = ref<GiftCardTemplates | null>(null)
const previewDialog = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
watch(previewCode, async (code, old) => {
  if (code && !old) {
    previousFocus = document.activeElement as HTMLElement; previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; await nextTick(); previewDialog.value?.focus()
  } else if (!code && old) { document.body.style.overflow = previousOverflow; previousFocus?.focus() }
})
onBeforeUnmount(() => { if (previewCode.value) document.body.style.overflow = previousOverflow })
function previewKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); previewCode.value = null; return }
  if (event.key !== 'Tab') return
  const buttons = [...(previewDialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])]
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === previewDialog.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === previewDialog.value)) { event.preventDefault(); first?.focus() }
}
const previewFront = computed(() => previewCode.value && cardTemplates.value ? svgDataUrl(giftCardSvg('front', previewCode.value, giftClaimUrl(siteUrl(), previewCode.value.public_token), { templates: cardTemplates.value, transparent: true })) : '')
const previewBack = computed(() => previewCode.value && cardTemplates.value ? svgDataUrl(giftCardSvg('back', previewCode.value, giftClaimUrl(siteUrl(), previewCode.value.public_token), { templates: cardTemplates.value, transparent: true })) : '')
const filteredCodes = computed(() => codes.value.filter(code =>
  (statusFilter.value === 'all' || code.status === statusFilter.value) &&
  [code.product_name, code.public_token, code.activation_code, code.id].some(value => value.toLowerCase().includes(search.value.trim().toLowerCase()))))
const availableCount = computed(() => codes.value.filter(code => code.status === 'unused').length)
const publishedCount = computed(() => codes.value.filter(code => code.status === 'published').length)
async function copyActivation(code: Code) {
  try { await navigator.clipboard.writeText(code.activation_code); copiedId.value = code.id }
  catch { error.value = 'Could not copy. Select the activation code and copy it manually.' }
}
async function downloadCard(code: Code, sides: 'both' | 'front' | 'back' = 'both') {
  if (exportingId.value) return
  exportingId.value = code.id; error.value = ''
  try { await downloadGiftCardPng(code, siteUrl(), sides) }
  catch { error.value = 'Could not prepare the printable card. Please try again.' }
  finally { exportingId.value = '' }
}
// Physical gift cards must always open the live storefront, even from local admin.
const siteUrl = () => 'https://www.stackoverpetals.shop'
function token() { const bytes = new Uint8Array(18); crypto.getRandomValues(bytes); return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('') }
function activation() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = new Uint8Array(8); crypto.getRandomValues(bytes); return [...bytes].map(byte => chars[byte % chars.length]).join('').replace(/(.{4})/, '$1-') }
async function load() {
  fetching.value = true; error.value = ''
  try {
    const { data, error: loadError } = await supabase.from('letter_v2_qr_codes').select('*').order('created_at', { ascending: false }).limit(200)
    if (loadError) throw loadError
    codes.value = await Promise.all((data || []).map(async code => ({ ...code, qrDataUrl: await QRCode.toDataURL(giftClaimUrl(siteUrl(), code.public_token), { width: 420, margin: 2 }) })))
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
async function managementCompleted(message: string) {
  manageCode.value = null
  await nextTick()
  previewCode.value = null
  success.value = message
  await load()
}
async function printCards() {
  if (exportingId.value) return
  exportingId.value = 'batch'; error.value = ''
  try { await downloadGiftCardBatch(filteredCodes.value, siteUrl()) }
  catch { error.value = 'Could not prepare the print batch. Please try again.' }
  finally { exportingId.value = '' }
}
onMounted(() => {
  void load()
  loadGiftCardTemplates().then(templates => { cardTemplates.value = templates }).catch(() => { error.value = 'Could not load the original print artwork. Refresh to try again.' })
})
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
    <p v-if="success" class="gift-management-success" role="status">{{ success }}</p>
    <div class="workspace-toolbar"><label class="workspace-search"><PhMagnifyingGlass :size="19" aria-hidden="true" /><input v-model="search" type="search" aria-label="Search Gift QR codes" placeholder="Product, activation key, QR token or ID…" /></label><select v-model="statusFilter" aria-label="Filter QR status"><option value="all">All statuses</option><option v-for="status in ['unused','claimed','published','replaced','revoked']" :key="status" :value="status">{{ status }}</option></select><button class="workspace-secondary" :disabled="fetching || loading" @click="load">Refresh</button><button class="workspace-secondary" :disabled="!filteredCodes.length || !!exportingId" @click="printCards"><PhPrinter :size="16" />{{ exportingId === 'batch' ? 'Preparing PNG…' : 'Download compact PNG sheets' }}</button></div>
    <p class="gift-print-note">Transparent PNG · 300 dpi · 90 × 54 mm per side. Compact batches fit up to five front/back pairs per sheet; larger batches download as a ZIP. Print at actual size. Front: QR link. Back: sender activation code.</p>
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
        <div class="workspace-qr-controls gift-card-controls"><small class="gift-owner-note">Owner-managed card</small><button type="button" class="workspace-secondary gift-preview-button" @click="previewCode = code" aria-label="Preview, download or manage gift card"><PhEye :size="18" aria-hidden="true" />Preview</button></div>
      </article>
    </div>
    <Teleport to="body">
      <div v-if="previewCode" class="gift-card-preview-overlay" @click.self="previewCode = null" @keydown="previewKey">
        <section ref="previewDialog" class="gift-card-preview" role="dialog" aria-modal="true" aria-labelledby="gift-card-preview-title" tabindex="-1">
          <header><div><p>THE PRINT EDITION</p><h2 id="gift-card-preview-title">A little card. A lasting feeling.</h2></div><button aria-label="Close card preview" @click="previewCode = null"><PhX :size="22" /></button></header>
          <div class="gift-card-preview-sides"><figure><figcaption>01 / FRONT · THE INVITATION</figcaption><img :src="previewFront" alt="Gift card front with its unique scannable QR" /></figure><figure><figcaption>02 / BACK · FOR THE SENDER</figcaption><img :src="previewBack" alt="Gift card back with the visible activation code" /></figure></div>
          <footer><p>Transparent PNG · 300 dpi · 90 × 54 mm per side.<br />No page background. Keep the activation code private until setup is complete.</p><div class="gift-download-options"><div><button type="button" :disabled="!!exportingId" @click="downloadCard(previewCode, 'front')"><PhDownloadSimple :size="18" aria-hidden="true" />Front PNG</button><button type="button" :disabled="!!exportingId" @click="downloadCard(previewCode, 'back')"><PhDownloadSimple :size="18" aria-hidden="true" />Back PNG</button></div><span v-if="exportingId" role="status">Preparing your PNG…</span></div></footer>
          <div class="gift-management-entry"><div><strong>Owner controls</strong><p>Reset activation, remove a letter, disable or delete this card. Password confirmation required.</p></div><button type="button" class="workspace-secondary" :disabled="!!exportingId" @click="manageCode = previewCode">Manage card</button></div>
        </section>
      </div>
    </Teleport>
    <GiftQrManageDialog v-if="manageCode" :code="manageCode" @close="manageCode = null" @completed="managementCompleted" />
  </section>
</template>
<style scoped>
.gift-print-note { color:#7a7069; font-size:12px; line-height:1.7; margin:12px 4px 22px; }
.gift-owner-note { color:#7a7069; font-size:11px; }
.gift-management-success { background:#edf4ee; color:#41624e; border:1px solid #cfdfd2; border-radius:12px; padding:14px 18px; }
.gift-management-entry { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:24px; padding:18px; background:#f3eae2; border-radius:14px; }
.gift-management-entry strong { font-size:13px; }.gift-management-entry p { margin:6px 0 0; color:#80685b; font-size:12px; line-height:1.6; }.gift-management-entry button { flex-shrink:0; }
.letter-workspace .gift-card-controls { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:12px; padding-top:18px; }
.letter-workspace .gift-card-controls label { display:grid; gap:7px; color:#65756a; font-size:10px; font-weight:600; letter-spacing:.04em; }
.letter-workspace .gift-card-controls select { width:100%; max-width:none; min-width:0; }
.letter-workspace .gift-preview-button { min-height:42px; padding:10px 14px; background:#edf4ee; border-color:#cfdfd2; color:#41624e; white-space:nowrap; }
.gift-preview-button svg { flex-shrink:0; }
.gift-card-controls :is(button,select):focus-visible,.gift-download-options button:focus-visible { outline:2px solid #5f8872; outline-offset:3px; }
.gift-card-preview-overlay { position:fixed; inset:0; z-index:1100; padding:24px; display:grid; place-items:center; background:#292322b8; backdrop-filter:blur(8px); }
.gift-card-preview { width:min(1100px,100%); max-height:90dvh; overflow:auto; padding:30px; border:1px solid #e9d7c8; border-radius:24px; background:#fffaf4; color:#563c32; box-shadow:0 24px 90px #160e0c55; }
.gift-card-preview header { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:28px; }
.gift-card-preview header p { font-size:10px; letter-spacing:.2em; color:#a88067; margin:0 0 9px; }
.gift-card-preview h2 { margin:0; font:normal 30px/1.2 Georgia,serif; }
.gift-card-preview header button { display:grid; place-items:center; width:42px; height:42px; border:1px solid #e5d7cc; background:#fff; color:#725749; border-radius:50%; cursor:pointer; flex:none; }
.gift-card-preview-sides { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.gift-card-preview figure { margin:0; min-width:0; }
.gift-card-preview figcaption { font-size:10px; letter-spacing:.12em; color:#9b7b65; margin-bottom:12px; }
.gift-card-preview img { display:block; width:100%; border-radius:18px; box-shadow:0 10px 28px #6d49321c; }
.gift-card-preview footer { display:flex; justify-content:space-between; align-items:center; gap:24px; margin-top:30px; padding-top:22px; border-top:1px solid #e9dbce; }
.gift-card-preview footer p { font-size:12px; line-height:1.8; margin:0; color:#8c7464; }
.gift-card-preview footer button { display:flex; align-items:center; justify-content:center; gap:10px; flex:none; min-height:48px; padding:12px 20px; border:0; border-radius:12px; background:#5f8872; color:white; cursor:pointer; }
.gift-card-preview button:disabled { opacity:.5; cursor:wait; }
.gift-download-options { display:grid; gap:8px; }
.gift-download-options > div { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.gift-download-options > div button { min-height:46px; padding:10px 16px; background:#f5e9dd; color:#634335; border:1px solid #dfc7b2; white-space:nowrap; transition:background .15s,border-color .15s; }
.gift-download-options > div button:hover:not(:disabled) { background:#efddcb; border-color:#b9926e; }
.gift-download-options span { font-size:11px; color:#634335; text-align:center; }
@media(max-width:700px) { .gift-card-preview-overlay { padding:12px; }.gift-card-preview { padding:20px; }.gift-card-preview-sides { grid-template-columns:1fr; }.gift-card-preview h2 { font-size:24px; }.gift-card-preview footer { align-items:stretch; flex-direction:column; } }
</style>
