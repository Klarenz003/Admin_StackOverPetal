<script setup lang="ts">
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { supabase } from '@/supabaseClient'

type Code = { id: string; public_token: string; activation_code: string; product_name: string; has_360_view: boolean; has_photo_upload: boolean; status: string; created_at: string; qrDataUrl?: string }
const form = ref({ count: 1, product_name: 'LetterPage V2', has_360_view: false, has_photo_upload: true })
const codes = ref<Code[]>([])
const loading = ref(false)
const error = ref('')
const siteUrl = () => (import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
function token() { const bytes = new Uint8Array(18); crypto.getRandomValues(bytes); return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('') }
function activation() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = new Uint8Array(8); crypto.getRandomValues(bytes); return [...bytes].map(byte => chars[byte % chars.length]).join('').replace(/(.{4})/, '$1-') }
async function load() {
  const { data, error: loadError } = await supabase.from('letter_v2_qr_codes').select('*').order('created_at', { ascending: false }).limit(200)
  if (loadError) { error.value = loadError.message; return }
  codes.value = await Promise.all((data || []).map(async code => ({ ...code, qrDataUrl: await QRCode.toDataURL(`${siteUrl()}/letter-v2/claim/${code.public_token}`, { width: 420, margin: 2 }) })))
}
async function generate() {
  loading.value = true; error.value = ''
  try {
    const rows = Array.from({ length: Math.min(100, Math.max(1, form.value.count)) }, () => ({ public_token: token(), activation_code: activation(), product_name: form.value.product_name.trim() || 'LetterPage V2', has_360_view: form.value.has_360_view, has_photo_upload: form.value.has_photo_upload }))
    const { error: insertError } = await supabase.from('letter_v2_qr_codes').insert(rows)
    if (insertError) throw insertError
    await load()
  } catch (caught) { error.value = caught instanceof Error ? caught.message : 'Could not generate LetterPage V2 QR codes.' }
  finally { loading.value = false }
}
async function setStatus(code: Code, status: string) {
  const { error: updateError } = await supabase.from('letter_v2_qr_codes').update({ status, revoked_at: status === 'revoked' ? new Date().toISOString() : null }).eq('id', code.id)
  if (updateError) error.value = updateError.message; else code.status = status
}
function printCards() { window.print() }
onMounted(load)
</script>

<template>
  <section class="page qr-page">
    <div class="page-header"><div><p class="eyebrow">Standalone letter experience</p><h1>LetterPage V2 QR codes</h1><p>Generate QR cards exclusively for the LetterPage V2 experience. These do not use checkout or Gift QR codes.</p></div></div>
    <p v-if="error" class="error-text">{{ error }}</p>
    <div class="card qr-form"><label>Quantity<input v-model.number="form.count" type="number" min="1" max="100"></label><label>Product name<input v-model="form.product_name" maxlength="120"></label><label class="check"><input v-model="form.has_360_view" type="checkbox"> Includes 360° viewer</label><label class="check"><input v-model="form.has_photo_upload" type="checkbox"> Allows photo uploads</label><button class="primary-btn" :disabled="loading" @click="generate">{{ loading ? 'Generating…' : 'Generate V2 QR batch' }}</button><button class="secondary-btn" :disabled="!codes.length" @click="printCards">Print cards</button></div>
    <div class="qr-grid"><article v-for="code in codes" :key="code.id" class="card qr-card"><img :src="code.qrDataUrl" alt="LetterPage V2 QR code"><strong>{{ code.product_name }}</strong><small>Activation: {{ code.activation_code }}</small><small>{{ code.has_360_view ? '360 viewer enabled' : 'LetterPage V2' }}</small><small>{{ code.has_photo_upload ? 'Photo uploads enabled' : 'Photo uploads disabled' }}</small><label>Status<select :value="code.status" @change="setStatus(code, ($event.target as HTMLSelectElement).value)"><option v-for="status in ['unused', 'claimed', 'published', 'replaced', 'revoked']" :key="status" :value="status">{{ status }}</option></select></label></article></div>
  </section>
</template>

<style scoped>.qr-page{max-width:1200px}.qr-form{display:flex;align-items:end;gap:14px;flex-wrap:wrap}.qr-form label{display:grid;gap:6px;min-width:170px}.qr-form input{padding:10px;border:1px solid #d9c8c1;border-radius:8px}.check{display:flex!important;align-items:center;min-width:auto!important}.primary-btn,.secondary-btn{border:0;border-radius:8px;padding:11px 16px;cursor:pointer}.primary-btn{background:#5f8872;color:#fff}.secondary-btn{background:#fff;border:1px solid #c48b8d}.qr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px;margin-top:20px}.qr-card{display:flex;align-items:center;gap:7px;flex-direction:column;text-align:center;padding:16px}.qr-card img{width:150px;height:150px}.qr-card small{color:#7d6e68;font-size:11px}.qr-card label{font-size:11px;display:flex;gap:5px;align-items:center}@media print{body *{visibility:hidden}.qr-page,.qr-page *{visibility:visible}.qr-page{position:absolute;left:0;top:0;width:100%}.qr-form{display:none}}</style>
