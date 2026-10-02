<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { PhEnvelopeOpen, PhCheckCircle, PhClock, PhMagnifyingGlass } from '@phosphor-icons/vue'
import { supabase } from '@/supabaseClient'
import { useAdminStore } from '@/stores/admin'

interface GiftLetter {
  id: string
  letter_v2_qr_id: string | null
  recipient: string | null
  sender: string | null
  message: string | null
  letter_theme: string | null
  published: boolean
  created_at: string
  market_code: 'PH' | 'CA'
}

const admin = useAdminStore()
const letters = ref<GiftLetter[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const activeLetter = ref<GiftLetter | null>(null)
const activeMarket = computed(() => admin.effectiveMarket)

const filteredLetters = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return letters.value
  return letters.value.filter(letter => [letter.recipient, letter.sender, letter.message, letter.letter_theme]
    .some(value => value?.toLowerCase().includes(term)))
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function loadLetters() {
  loading.value = true
  error.value = ''
  const { data, error: loadError } = await supabase
    .from('letters')
    .select('id, letter_v2_qr_id, recipient, sender, message, letter_theme, published, created_at, market_code')
    .eq('market_code', activeMarket.value)
    .not('letter_v2_qr_id', 'is', null)
    .order('created_at', { ascending: false })
  if (loadError) error.value = loadError.message
  letters.value = (data || []) as GiftLetter[]
  loading.value = false
}

watch(activeMarket, loadLetters)
onMounted(loadLetters)
</script>

<template>
  <section class="gift-letters-page">
    <div class="page-header gift-letters-header">
      <div>
        <p class="eyebrow">Standalone QR gifts</p>
        <h1>Gift Letters</h1>
        <p>Letters created by customers after activating a Gift QR code.</p>
      </div>
      <div class="gift-letters-count"><PhEnvelopeOpen :size="18" /> {{ filteredLetters.length }} letters</div>
    </div>

    <div class="gift-letters-toolbar card">
      <PhMagnifyingGlass :size="18" />
      <input v-model="search" type="search" placeholder="Search recipient, sender, or message…">
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>
    <div v-if="loading" class="loading">Loading gift letters…</div>
    <div v-else-if="filteredLetters.length === 0" class="empty-state">
      <PhEnvelopeOpen :size="32" />
      <h3>No gift letters yet</h3>
      <p>Published letters from Gift QR codes will appear here, separate from order letters.</p>
    </div>
    <div v-else class="gift-letters-list">
      <article v-for="letter in filteredLetters" :key="letter.id" class="card gift-letter-card" @click="activeLetter = letter">
        <div class="gift-letter-icon"><PhEnvelopeOpen :size="22" /></div>
        <div class="gift-letter-main">
          <h3>{{ letter.recipient || 'Unnamed recipient' }}</h3>
          <p>From {{ letter.sender || 'Anonymous' }}</p>
          <span>{{ (letter.message || 'No message').slice(0, 160) }}{{ (letter.message || '').length > 160 ? '…' : '' }}</span>
        </div>
        <div class="gift-letter-meta">
          <strong :class="letter.published ? 'is-published' : 'is-draft'"><PhCheckCircle v-if="letter.published" :size="15" /> <PhClock v-else :size="15" /> {{ letter.published ? 'Published' : 'Draft' }}</strong>
          <small>{{ formatDate(letter.created_at) }}</small>
        </div>
      </article>
    </div>

    <div v-if="activeLetter" class="modal-backdrop" @click.self="activeLetter = null">
      <div class="modal-box gift-letter-modal">
        <button class="modal-close" type="button" aria-label="Close" @click="activeLetter = null">×</button>
        <p class="eyebrow">Gift QR letter</p>
        <h2>{{ activeLetter.recipient || 'Unnamed recipient' }}</h2>
        <p class="gift-letter-modal-from">From {{ activeLetter.sender || 'Anonymous' }} · {{ activeLetter.letter_theme || 'romance' }}</p>
        <div class="gift-letter-message">{{ activeLetter.message || 'No message provided.' }}</div>
        <small>Created {{ formatDate(activeLetter.created_at) }}</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gift-letters-page { max-width: 1180px; padding: 24px; }
.gift-letters-header { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:20px; }
.gift-letters-header h1 { margin:0 0 8px; }
.gift-letters-header p:last-child { margin:0; color:#887975; }
.gift-letters-count { display:flex; align-items:center; gap:8px; color:#705660; font-weight:600; white-space:nowrap; }
.gift-letters-toolbar { display:flex; align-items:center; gap:10px; padding:12px 16px; margin-bottom:16px; color:#98747d; }
.gift-letters-toolbar input { width:100%; border:0; outline:0; background:transparent; color:#4e3c42; font:inherit; }
.gift-letters-list { display:grid; gap:12px; }
.gift-letter-card { display:flex; align-items:center; gap:16px; padding:17px 20px; cursor:pointer; transition:transform .2s, box-shadow .2s; }
.gift-letter-card:hover { transform:translateY(-1px); box-shadow:0 8px 24px rgba(102,68,77,.12); }
.gift-letter-icon { width:44px; height:44px; display:grid; place-items:center; border-radius:50%; background:#f8e7e7; color:#a06170; flex:none; }
.gift-letter-main { min-width:0; flex:1; }
.gift-letter-main h3 { margin:0 0 3px; font-size:16px; }
.gift-letter-main p { margin:0 0 5px; color:#856e73; font-size:13px; }
.gift-letter-main span { display:block; color:#6f6265; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gift-letter-meta { display:grid; justify-items:end; gap:7px; color:#8b797d; font-size:12px; white-space:nowrap; }
.gift-letter-meta strong { display:flex; align-items:center; gap:4px; font-size:12px; }
.is-published { color:#5d896f; }.is-draft { color:#a07861; }
.gift-letter-modal { position:relative; max-width:560px; padding:32px; }
.modal-close { position:absolute; top:12px; right:16px; border:0; background:none; color:#9d6975; font-size:28px; cursor:pointer; }
.gift-letter-modal h2 { margin:4px 0; }.gift-letter-modal-from { color:#856e73; }
.gift-letter-message { margin:22px 0; padding:18px; border:1px solid #ecd5d4; border-radius:12px; white-space:pre-wrap; line-height:1.6; color:#57464b; }
@media (max-width:700px) { .gift-letters-page { padding:16px; }.gift-letters-header { align-items:flex-start; flex-direction:column; }.gift-letter-card { align-items:flex-start; }.gift-letter-meta { margin-left:auto; }.gift-letter-main span { max-width:42vw; } }
</style>
