<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PhHeartbeat, PhShieldCheck, PhWarningCircle, PhCheckCircle, PhArrowClockwise, PhMagnifyingGlass, PhCaretLeft, PhCaretRight, PhDeviceMobile, PhDesktop, PhX } from '@phosphor-icons/vue'
import { supabase } from '@/supabaseClient'

type Report = { id: string; created_at: string; operation: string; code: string; page: string; market: string; device: string; status: 'open' | 'resolved' }
const rows = ref<Report[]>([])
const selected = ref<Report | null>(null)
const loading = ref(false), saving = ref(false), error = ref('')
const query = ref(''), status = ref('all'), market = ref('all'), days = ref('30'), page = ref(0)
const total = ref(0), allCount = ref(0), openCount = ref(0), criticalCount = ref(0)
const autoRefresh = ref(false), updated = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let debounce: ReturnType<typeof setTimeout> | undefined
let generation = 0
const labels: Record<string, string> = { runtime: 'Unexpected crash', navigation: 'Page navigation', 'products.load': 'Collection loading', 'checkout.availability': 'Delivery availability', 'checkout.reserve': 'Holding cart items', 'checkout.submit': 'Order submission', 'letter.load': 'Opening a letter', 'letter.publish': 'Publishing a letter', 'contact.send': 'Contact form', 'chat.send': 'Customer chat', 'order.lookup': 'Order tracking' }
const critical = (operation: string) => ['runtime','checkout.submit','letter.publish'].includes(operation)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 25)))
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  const request = ++generation
  loading.value = true; error.value = ''
  const since = new Date(Date.now() - Number(days.value) * 86400000).toISOString()
  try {
    let list = supabase.from('storefront_errors').select('*', { count: 'exact' }).gte('created_at', since)
    if (status.value !== 'all') list = list.eq('status', status.value)
    if (market.value !== 'all') list = list.eq('market', market.value)
    const search = query.value.replace(/[^a-zA-Z0-9._ -]/g, '').trim().slice(0,80)
    if (search) list = list.or(`operation.ilike.%${search}%,page.ilike.%${search}%,code.ilike.%${search}%`)
    const countQuery = () => {
      let q = supabase.from('storefront_errors').select('id', { count: 'exact', head: true }).gte('created_at', since)
      if (market.value !== 'all') q = q.eq('market', market.value)
      return q
    }
    const [result, all, open, important] = await Promise.all([
      list.order('created_at', { ascending: false }).range(page.value * 25, page.value * 25 + 24),
      countQuery(), countQuery().eq('status','open'),
      countQuery().eq('status','open').in('operation',['runtime','checkout.submit','letter.publish']),
    ])
    if (request !== generation) return
    if ([result,all,open,important].some(x => x.error)) throw new Error('Unavailable')
    rows.value = result.data || []; total.value = result.count || 0
    allCount.value = all.count || 0; openCount.value = open.count || 0; criticalCount.value = important.count || 0
    selected.value = null; updated.value = new Date().toLocaleTimeString()
  } catch {
    if (request === generation) error.value = 'Reports could not be loaded. Check that the error-tracking migration is installed and that you are signed in as the owner, then retry.'
  } finally { if (request === generation) loading.value = false }
}

async function triage(report: Report) {
  if (saving.value) return
  saving.value = true; error.value = ''
  try {
    const next = report.status === 'open' ? 'resolved' : 'open'
    const { data, error: updateError } = await supabase.from('storefront_errors').update({ status: next }).eq('id', report.id).select('id').single()
    if (updateError || !data) throw new Error('Update failed')
    await load()
  } catch { error.value = 'This report could not be updated. Please try again.' }
  finally { saving.value = false }
}

watch([status,market,days], () => { page.value = 0; void load() })
watch(query, () => { clearTimeout(debounce); debounce = setTimeout(() => { page.value = 0; void load() }, 350) })
watch(autoRefresh, enabled => { clearInterval(timer); if (enabled) timer = setInterval(() => { if (!document.hidden && !loading.value && !saving.value) void load() }, 30_000) })
onMounted(load)
onBeforeUnmount(() => { generation++; clearInterval(timer); clearTimeout(debounce) })
function move(delta: number) { page.value += delta; void load() }
</script>

<template>
  <section class="health-workspace" aria-labelledby="health-title">
    <header class="health-hero">
      <div class="hero-icon"><PhHeartbeat :size="32" weight="duotone" /></div>
      <div class="hero-copy"><p class="health-eyebrow">CARE BEHIND THE EXPERIENCE</p><h1 id="health-title">A little care. A smoother storefront.</h1><p>See where customers get stuck, and give every issue a clear next step.</p></div>
      <div class="private-pill"><PhShieldCheck :size="18" weight="duotone" /> Owner-only workspace</div>
    </header>

    <div class="health-stats">
      <article><span class="stat-icon"><PhHeartbeat :size="23" weight="duotone" /></span><div><p>Reports received</p><strong>{{ allCount.toLocaleString() }}</strong><small>Past {{ days }} days · {{ market === 'all' ? 'all markets' : market }}</small></div></article>
      <article><span class="stat-icon rose"><PhWarningCircle :size="23" weight="duotone" /></span><div><p>Needs attention</p><strong>{{ openCount.toLocaleString() }}</strong><small>Reports still open</small></div></article>
      <article><span class="stat-icon amber"><PhWarningCircle :size="23" weight="bold" /></span><div><p>Priority issues</p><strong>{{ criticalCount.toLocaleString() }}</strong><small>Crashes, checkout & publishing</small></div></article>
      <article><span class="stat-icon"><PhCheckCircle :size="23" weight="fill" /></span><div><p>Reviewed & resolved</p><strong>{{ (allCount - openCount).toLocaleString() }}</strong><small>Marked resolved by an admin</small></div></article>
    </div>

    <div class="health-inbox">
      <div class="inbox-heading"><div><p class="health-eyebrow">THE CUSTOMER EXPERIENCE</p><h2>Issue inbox</h2></div><div class="refresh-tools"><label><input v-model="autoRefresh" type="checkbox"> Live refresh · 30s</label><button class="health-button" :disabled="loading" @click="load"><PhArrowClockwise :size="17" :class="{ spinning: loading }" /> Refresh</button></div></div>
      <form class="health-filters" @submit.prevent="load">
        <label class="search-field"><PhMagnifyingGlass :size="19" /><input v-model="query" type="search" placeholder="Search action, page, or diagnostic code" aria-label="Search reports"></label>
        <label>Status<select v-model="status"><option value="all">All reports</option><option value="open">Needs attention</option><option value="resolved">Resolved</option></select></label>
        <label>Market<select v-model="market"><option value="all">All markets</option><option value="PH">Philippines</option><option value="CA">Canada</option></select></label>
        <label>Time range<select v-model="days"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      </form>
      <p v-if="error" class="health-alert" role="alert">{{ error }}</p>
      <p v-if="loading" class="health-notice" role="status">Refreshing the issue inbox…</p>
      <div v-if="!rows.length && !loading && !error" class="health-empty"><span><PhShieldCheck :size="42" weight="duotone" /></span><h3>No reports in this view.</h3><p>No matching issues have been reported. This is not a guarantee of uptime—offline devices cannot send reports.</p><button v-if="query || status !== 'all'" class="health-button" @click="query = ''; status = 'all'">Clear search & status</button></div>
      <div v-if="rows.length" class="health-table-wrap" :aria-busy="loading">
        <table class="health-table"><thead><tr><th>Customer action</th><th>Where</th><th>Received</th><th>Status</th><th><span class="sr-only">Details</span></th></tr></thead>
          <tbody><tr v-for="report in rows" :key="report.id"><td><div class="action-cell"><span class="issue-icon" :class="{ priority: critical(report.operation) }"><PhWarningCircle :size="21" weight="duotone" /></span><div><strong>{{ labels[report.operation] || report.operation }}</strong><small>{{ report.code }}<span v-if="critical(report.operation)"> · Priority</span></small></div></div></td><td data-label="Where"><div class="location-cell"><strong>{{ report.page }} · {{ report.market }}</strong><small><component :is="report.device === 'mobile' ? PhDeviceMobile : PhDesktop" :size="13" /> {{ report.device }}</small></div></td><td data-label="Received" class="received-cell">{{ date(report.created_at) }}</td><td><span class="status-pill" :class="report.status">{{ report.status === 'open' ? 'Needs attention' : 'Resolved' }}</span></td><td><button class="details-button" :aria-label="`View ${labels[report.operation] || report.operation} report`" @click="selected = report">Details <PhCaretRight :size="14" /></button></td></tr></tbody>
        </table>
      </div>
      <footer class="inbox-footer"><p>{{ total.toLocaleString() }} matching reports <span v-if="updated">· Updated {{ updated }}</span></p><div><button aria-label="Previous page" :disabled="page === 0 || loading" @click="move(-1)"><PhCaretLeft :size="18" /></button><span>{{ page + 1 }} / {{ pageCount }}</span><button aria-label="Next page" :disabled="page + 1 >= pageCount || loading" @click="move(1)"><PhCaretRight :size="18" /></button></div></footer>
    </div>

    <section v-if="selected" class="health-detail" aria-labelledby="report-detail-title" aria-live="polite">
      <div class="detail-heading"><div><p class="health-eyebrow">REPORT DETAILS</p><h2 id="report-detail-title">{{ labels[selected.operation] || selected.operation }}</h2></div><button class="health-button" aria-label="Close report details" @click="selected = null"><PhX :size="18" /></button></div>
      <dl><div><dt>Diagnostic code</dt><dd>{{ selected.code }}</dd></div><div><dt>Page & market</dt><dd>{{ selected.page }} · {{ selected.market }}</dd></div><div><dt>Device category</dt><dd>{{ selected.device }}</dd></div><div><dt>Received</dt><dd>{{ date(selected.created_at) }}</dd></div></dl>
      <p>Reproduce this action in the storefront and check the service logs using the timestamp and code. Reports intentionally exclude customer content and full URLs.</p>
      <button class="health-button primary" :disabled="saving || loading" @click="triage(selected)"><PhCheckCircle :size="18" weight="fill" /> {{ saving ? 'Saving…' : selected.status === 'open' ? 'Mark as resolved' : 'Reopen report' }}</button>
    </section>
    <p class="privacy-note"><PhShieldCheck :size="18" weight="duotone" /> Private by design. No names, emails, letter content, payment proof, or QR tokens are collected. Repeated errors are throttled; report counts are not unique customer counts.</p>
  </section>
</template>

<style scoped>
.health-workspace{max-width:1440px;margin:0 auto;color:#3c403b;font:14px/1.6 'DM Sans',sans-serif}.health-workspace button,.health-workspace input,.health-workspace select{font:inherit}.health-hero{display:flex;align-items:center;gap:22px;padding:32px;border:1px solid #d9e2d5;border-radius:24px;background:linear-gradient(115deg,#eaf0e4,#fbf7f1);margin-bottom:24px}.hero-icon{flex-shrink:0;display:grid;place-items:center;width:68px;height:68px;border-radius:21px;background:#fffaf2;border:1px solid #dce4d5;color:#507360}.hero-copy{flex:1}.health-eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;color:#887165;margin:0 0 7px}.health-hero h1{font:500 clamp(26px,3vw,38px)/1.2 'Cormorant Garamond',Georgia,serif;margin:0 0 10px;color:#364d3f}.hero-copy>p:last-child{margin:0;color:#626e61;max-width:540px}.private-pill{display:flex;align-items:center;gap:8px;border:1px solid #d7e2d1;background:#ffffffb3;padding:9px 13px;border-radius:999px;white-space:nowrap;font-size:12px;color:#426a50}.health-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:26px}.health-stats article{padding:22px 18px;display:flex;gap:15px;border:1px solid #eadbd2;background:#fffcf8;border-radius:19px;min-width:0}.stat-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex-shrink:0;color:#50725a;background:#edf2e8}.stat-icon.rose{color:#a55e65;background:#faecec}.stat-icon.amber{color:#986a37;background:#f6eddf}.health-stats p{margin:0;color:#6f7169;font-size:12px}.health-stats strong{display:block;font:500 36px/1.3 Georgia,serif;color:#354a3d}.health-stats small{font-size:11px;color:#77766c;display:block}.health-inbox,.health-detail{border:1px solid #eadbd2;border-radius:23px;background:#fffcf8;overflow:hidden}.inbox-heading,.detail-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:25px 26px}.health-workspace h2{margin:0;font:500 28px/1.2 'Cormorant Garamond',Georgia,serif}.refresh-tools{display:flex;align-items:center;gap:20px}.refresh-tools label{display:flex;align-items:center;gap:8px;font-size:12px;color:#676f63}.health-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;border:1px solid #d9dfd3;border-radius:12px;background:#f7f8f2;color:#4e6654;cursor:pointer;min-height:42px}.health-button.primary{background:#50745e;color:#fff;border-color:#50745e}.health-filters{display:grid;grid-template-columns:minmax(180px,1fr) repeat(3,150px);gap:14px;padding:0 26px 23px;align-items:end}.health-filters>label{display:flex;flex-direction:column;gap:5px;font-size:11px;color:#6e7368;font-weight:600}.health-filters select{height:43px;border:1px solid #e2d8ce;border-radius:11px;background:#fff;color:#444e42;padding:0 10px;width:100%}.health-filters>.search-field{flex-direction:row;align-items:center;gap:9px;border:1px solid #e2d8ce;border-radius:11px;padding:0 12px;height:43px;background:#fff}.search-field input{border:0;background:transparent;width:100%;min-width:0;color:#3c463c;outline:none;font-size:12px}.search-field:focus-within{outline:2px solid #6d9177;outline-offset:2px}.health-workspace :is(button,input,select):focus-visible{outline:2px solid #50745e;outline-offset:3px}.health-alert{margin:0 26px 20px;padding:15px;border:1px solid #e5c1be;border-radius:12px;background:#fff1ee;color:#8c454b}.health-notice{padding:10px 26px;color:#687663;margin:0;font-size:12px}.health-table-wrap{overflow-x:auto}.health-table{width:100%;border-collapse:collapse;text-align:left;min-width:720px}.health-table th{padding:13px 22px;background:#f5f5ed;color:#7a7e72;font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:600}.health-table td{padding:18px 22px;border-top:1px solid #eee5dc;vertical-align:middle}.health-table tbody tr:hover{background:#fbf8f2}.action-cell{display:flex;align-items:center;gap:13px}.issue-icon{width:39px;height:39px;border:1px solid #e1e7d9;border-radius:12px;background:#f1f4eb;display:grid;place-items:center;color:#6a8060;flex-shrink:0}.issue-icon.priority{color:#a05e65;background:#faeded;border-color:#f0d9d9}.action-cell strong,.location-cell strong{display:block;font-size:13px;font-weight:600}.action-cell small,.location-cell small{font-size:11px;color:#7a7c72;display:flex;align-items:center;gap:5px;margin-top:3px}.received-cell{font-size:12px;color:#72776a}.status-pill{display:inline-block;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:600;white-space:nowrap}.status-pill.open{background:#f8e9e7;color:#964f54}.status-pill.resolved{background:#e9f0e4;color:#506d4d}.details-button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:#557260;font-size:12px;cursor:pointer;padding:8px}.inbox-footer{display:flex;justify-content:space-between;align-items:center;padding:18px 26px;border-top:1px solid #ede3d9;gap:16px}.inbox-footer p{margin:0;font-size:11px;color:#767c6e}.inbox-footer>div{display:flex;gap:12px;align-items:center;font-size:11px;white-space:nowrap}.inbox-footer button{display:grid;place-items:center;width:34px;height:34px;border:1px solid #dfdfd2;background:#fafaf3;border-radius:9px;color:#52715b;cursor:pointer}.health-workspace button:disabled{opacity:.45;cursor:default}.health-empty{padding:60px 24px;text-align:center;max-width:540px;margin:auto}.health-empty>span{display:grid;place-items:center;width:84px;height:84px;background:#edf2e7;border-radius:27px;color:#6a8a65;margin:0 auto 20px}.health-empty h3{font:500 29px Georgia,serif;margin:0 0 14px;color:#4d604d}.health-empty p{color:#7a7e73;font-size:13px;margin:0 0 20px}.health-detail{margin-top:22px;padding:0 26px 26px}.detail-heading{padding:24px 0}.health-detail dl{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:0;padding:18px 0;border-top:1px solid #e8e0d5;border-bottom:1px solid #e8e0d5}.health-detail dt{font-size:10px;text-transform:uppercase;color:#817f73;letter-spacing:.08em;margin-bottom:5px}.health-detail dd{margin:0;color:#475344;font-size:13px;overflow-wrap:anywhere}.health-detail>p{color:#6f766b;font-size:13px;max-width:750px;margin:20px 0}.privacy-note{display:flex;align-items:flex-start;gap:9px;color:#777f70;font-size:11px;padding:20px 5px;margin:0}.privacy-note svg{flex-shrink:0}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.spinning{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinning{animation:none}}@media(max-width:1100px){.health-stats{grid-template-columns:repeat(2,1fr)}.health-hero{flex-wrap:wrap}.private-pill{margin-left:90px}.health-filters{grid-template-columns:repeat(3,1fr)}.search-field{grid-column:1/-1}.health-detail dl{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.health-hero{padding:22px;gap:15px}.hero-icon{width:48px;height:48px;border-radius:15px}.hero-copy{flex-basis:calc(100% - 64px)}.private-pill{margin-left:0;font-size:11px}.health-stats{gap:10px}.health-stats article{padding:16px 12px;flex-direction:column;gap:9px}.health-stats strong{font-size:30px}.inbox-heading{padding:22px 18px;align-items:flex-start;flex-direction:column}.refresh-tools{width:100%;justify-content:space-between}.health-filters{padding:0 18px 20px;gap:10px;grid-template-columns:1fr 1fr}.health-filters>label:last-child{grid-column:1/-1}.inbox-footer{padding:15px 18px;flex-wrap:wrap}.health-detail{padding:0 18px 22px}.health-detail dl{gap:20px}.health-hero h1{font-size:27px}.hero-copy>p:last-child{font-size:12px}.privacy-note{line-height:1.8}}
</style>

<style scoped>
@media(max-width:600px){
  .health-table{min-width:0;display:block}
  .health-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
  .health-table tbody{display:block}
  .health-table tbody tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;padding:20px 18px;border-top:1px solid #eee5dc}
  .health-table td{display:block;padding:0;border:0;min-width:0}
  .health-table td:first-child{grid-column:1/-1}
  .health-table td[data-label]:before{content:attr(data-label);display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7a7e72;margin-bottom:6px}
  .health-table td:last-child{text-align:right}
  .health-table .details-button{padding:0;min-height:28px}
  .health-table .received-cell{font-size:11px}
}
</style>
