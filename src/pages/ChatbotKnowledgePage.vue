<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/supabaseClient'

type MarketCode = 'PH' | 'CA' | 'ALL'
type KnowledgeStatus = 'draft' | 'approved'
type ReviewStatus = 'new' | 'added' | 'ignored'

type KnowledgeEntry = {
  id: string
  market_code: MarketCode
  category: string
  question: string
  answer: string
  keywords: string[]
  status: KnowledgeStatus
  active: boolean
  updated_at: string
}

type Interaction = {
  id: string
  market_code: 'PH' | 'CA'
  question: string
  answer: string
  topic: string
  in_scope: boolean
  needs_human: boolean
  feedback: 'helpful' | 'not_helpful' | null
  review_status: ReviewStatus
  created_at: string
}

const knowledge = ref<KnowledgeEntry[]>([])
const interactions = ref<Interaction[]>([])
const loading = ref(false)
const saving = ref(false)
const savingId = ref('')
const error = ref('')
const success = ref('')
const formSection = ref<HTMLElement | null>(null)
const sourceInteractionId = ref('')
const marketFilter = ref<'ALL' | 'PH' | 'CA'>('ALL')
const statusFilter = ref<'all' | KnowledgeStatus>('all')

const form = reactive({
  marketCode: 'ALL' as MarketCode,
  category: 'General',
  question: '',
  answer: '',
  keywords: '',
  status: 'approved' as KnowledgeStatus,
  active: true,
})

const canCreate = computed(() => Boolean(
  form.category.trim().length >= 2
  && form.question.trim().length >= 3
  && form.answer.trim().length >= 3
  && !saving.value,
))

const filteredKnowledge = computed(() => knowledge.value.filter(entry => (
  (marketFilter.value === 'ALL' || entry.market_code === marketFilter.value)
  && (statusFilter.value === 'all' || entry.status === statusFilter.value)
)))

const reviewQueue = computed(() => interactions.value.filter(item => (
  item.review_status === 'new'
  && item.in_scope
  && (item.needs_human || item.feedback === 'not_helpful')
)))

const totalQuestions = computed(() => interactions.value.length)
const ratedQuestions = computed(() => interactions.value.filter(item => item.feedback).length)
const helpfulQuestions = computed(() => interactions.value.filter(item => item.feedback === 'helpful').length)
const helpfulRate = computed(() => ratedQuestions.value
  ? Math.round((helpfulQuestions.value / ratedQuestions.value) * 100)
  : 0)
const approvedCount = computed(() => knowledge.value.filter(item => item.status === 'approved' && item.active).length)

const topTopics = computed(() => {
  const totals = new Map<string, number>()
  interactions.value.filter(item => item.in_scope).forEach(item => {
    totals.set(item.topic, (totals.get(item.topic) || 0) + 1)
  })
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
})

function readableError(value: unknown) {
  if (value && typeof value === 'object' && 'message' in value) return String(value.message)
  return 'Something went wrong. Please try again.'
}

async function loadData() {
  loading.value = true
  error.value = ''
  const [knowledgeResult, interactionsResult] = await Promise.all([
    supabase.from('chatbot_knowledge').select('*').order('updated_at', { ascending: false }),
    supabase.from('chatbot_interactions').select('*').order('created_at', { ascending: false }).limit(500),
  ])
  loading.value = false

  if (knowledgeResult.error || interactionsResult.error) {
    error.value = readableError(knowledgeResult.error || interactionsResult.error)
    return
  }

  knowledge.value = (knowledgeResult.data || []) as KnowledgeEntry[]
  interactions.value = (interactionsResult.data || []) as Interaction[]
}

function resetForm() {
  form.marketCode = 'ALL'
  form.category = 'General'
  form.question = ''
  form.answer = ''
  form.keywords = ''
  form.status = 'approved'
  form.active = true
  sourceInteractionId.value = ''
}

function parsedKeywords(value: string) {
  return [...new Set(value.split(',').map(keyword => keyword.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
}

async function createKnowledge() {
  if (!canCreate.value) return
  saving.value = true
  error.value = ''
  success.value = ''

  const { error: insertError } = await supabase.from('chatbot_knowledge').insert({
    market_code: form.marketCode,
    category: form.category.trim(),
    question: form.question.trim(),
    answer: form.answer.trim(),
    keywords: parsedKeywords(form.keywords),
    status: form.status,
    active: form.active,
    updated_at: new Date().toISOString(),
  })

  if (insertError) {
    error.value = insertError.message
    saving.value = false
    return
  }

  if (sourceInteractionId.value) {
    await supabase.from('chatbot_interactions')
      .update({ review_status: 'added' })
      .eq('id', sourceInteractionId.value)
  }

  success.value = form.status === 'approved'
    ? 'Approved knowledge added. Petal Guide can use it now.'
    : 'Draft saved for later approval.'
  resetForm()
  saving.value = false
  await loadData()
}

async function saveEntry(entry: KnowledgeEntry) {
  savingId.value = entry.id
  error.value = ''
  const { error: updateError } = await supabase.from('chatbot_knowledge').update({
    market_code: entry.market_code,
    category: entry.category.trim(),
    question: entry.question.trim(),
    answer: entry.answer.trim(),
    keywords: entry.keywords.map(keyword => keyword.trim().toLowerCase()).filter(Boolean),
    status: entry.status,
    active: entry.active,
    updated_at: new Date().toISOString(),
  }).eq('id', entry.id)

  savingId.value = ''
  if (updateError) { error.value = updateError.message; return }
  success.value = entry.status === 'approved' ? 'Approved answer updated.' : 'Draft updated.'
  await loadData()
}

async function removeEntry(entry: KnowledgeEntry) {
  if (!window.confirm(`Delete “${entry.question}”?`)) return
  const { error: deleteError } = await supabase.from('chatbot_knowledge').delete().eq('id', entry.id)
  if (deleteError) { error.value = deleteError.message; return }
  await loadData()
}

async function useForKnowledge(item: Interaction) {
  form.marketCode = item.market_code
  form.category = item.topic === 'other'
    ? 'General'
    : item.topic.charAt(0).toUpperCase() + item.topic.slice(1)
  form.question = item.question
  form.answer = ''
  form.keywords = item.question.split(/\s+/).filter(word => word.length > 4).slice(0, 6).join(', ')
  form.status = 'draft'
  form.active = true
  sourceInteractionId.value = item.id
  await nextTick()
  formSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function ignoreQuestion(item: Interaction) {
  const { error: updateError } = await supabase.from('chatbot_interactions')
    .update({ review_status: 'ignored' })
    .eq('id', item.id)
  if (updateError) { error.value = updateError.message; return }
  item.review_status = 'ignored'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

onMounted(loadData)
</script>

<template>
  <section class="chatbot-admin-page">
    <div class="chatbot-metrics">
      <div><span>Questions</span><strong>{{ totalQuestions }}</strong><small>Latest 500 interactions</small></div>
      <div><span>Needs review</span><strong>{{ reviewQueue.length }}</strong><small>Uncertain or not helpful</small></div>
      <div><span>Helpful rate</span><strong>{{ helpfulRate }}%</strong><small>{{ ratedQuestions }} rated answers</small></div>
      <div><span>Approved answers</span><strong>{{ approvedCount }}</strong><small>Active bot knowledge</small></div>
    </div>

    <p v-if="error" class="investor-access-error chatbot-alert">{{ error }}</p>
    <p v-if="success" class="investor-access-success chatbot-alert">{{ success }}</p>

    <div ref="formSection" class="section-card chatbot-form-section">
      <div class="section-header">
        <div>
          <h3>Teach Petal Guide</h3>
          <small>Only approved and active answers are used by the customer chatbot.</small>
        </div>
        <button v-if="sourceInteractionId" class="refresh-btn" type="button" @click="resetForm">Cancel review</button>
      </div>

      <form class="chatbot-knowledge-form" @submit.prevent="createKnowledge">
        <label>Store
          <select v-model="form.marketCode">
            <option value="ALL">All stores</option><option value="PH">Philippines</option><option value="CA">Canada</option>
          </select>
        </label>
        <label>Category<input v-model="form.category" maxlength="50" placeholder="Pickup, Payment, QR Keepsake..." /></label>
        <label class="chatbot-wide">Customer question<input v-model="form.question" maxlength="300" placeholder="How long does a custom order take?" /></label>
        <label class="chatbot-wide">Approved answer<textarea v-model="form.answer" rows="4" maxlength="2000" placeholder="Write the exact facts Petal Guide may use."></textarea></label>
        <label class="chatbot-wide">Search keywords<input v-model="form.keywords" placeholder="custom, preparation, schedule" /><small>Separate keywords with commas.</small></label>
        <label>Status<select v-model="form.status"><option value="approved">Approved</option><option value="draft">Draft</option></select></label>
        <label class="chatbot-active-toggle"><input v-model="form.active" type="checkbox" /> Active</label>
        <button class="save-btn chatbot-create-btn" type="submit" :disabled="!canCreate">{{ saving ? 'Saving...' : 'Add Knowledge' }}</button>
      </form>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div><h3>Review Queue</h3><small>Questions the bot could not answer confidently or customers marked unhelpful.</small></div>
        <button class="refresh-btn" type="button" @click="loadData">Refresh</button>
      </div>
      <div v-if="loading" class="chatbot-empty">Loading chatbot activity...</div>
      <div v-else-if="!reviewQueue.length" class="chatbot-empty">No questions need review.</div>
      <div v-else class="chatbot-review-list">
        <article v-for="item in reviewQueue" :key="item.id" class="chatbot-review-row">
          <div class="chatbot-review-meta"><span>{{ item.market_code }}</span><span>{{ item.topic }}</span><span>{{ formatDate(item.created_at) }}</span></div>
          <h4>{{ item.question }}</h4>
          <p>{{ item.answer }}</p>
          <div class="chatbot-row-actions">
            <button class="save-btn" type="button" @click="useForKnowledge(item)">Create approved answer</button>
            <button class="refresh-btn" type="button" @click="ignoreQuestion(item)">Ignore</button>
          </div>
        </article>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header chatbot-knowledge-header">
        <div><h3>Knowledge Library</h3><small>Edit, approve, pause, or remove what Petal Guide knows.</small></div>
        <div class="chatbot-filters">
          <select v-model="marketFilter" aria-label="Filter by store"><option value="ALL">All stores</option><option value="PH">Philippines</option><option value="CA">Canada</option></select>
          <select v-model="statusFilter" aria-label="Filter by status"><option value="all">All statuses</option><option value="approved">Approved</option><option value="draft">Draft</option></select>
        </div>
      </div>

      <div v-if="!filteredKnowledge.length" class="chatbot-empty">No knowledge entries match these filters.</div>
      <div v-else class="chatbot-knowledge-list">
        <article v-for="entry in filteredKnowledge" :key="entry.id" class="chatbot-knowledge-row">
          <div class="chatbot-entry-grid">
            <label>Store<select v-model="entry.market_code"><option value="ALL">All</option><option value="PH">PH</option><option value="CA">CA</option></select></label>
            <label>Category<input v-model="entry.category" maxlength="50" /></label>
            <label>Status<select v-model="entry.status"><option value="approved">Approved</option><option value="draft">Draft</option></select></label>
            <label class="chatbot-active-toggle"><input v-model="entry.active" type="checkbox" /> Active</label>
            <label class="chatbot-wide">Question<input v-model="entry.question" maxlength="300" /></label>
            <label class="chatbot-wide">Answer<textarea v-model="entry.answer" rows="3" maxlength="2000"></textarea></label>
            <label class="chatbot-wide">Keywords<input :value="entry.keywords.join(', ')" @input="entry.keywords = parsedKeywords(($event.target as HTMLInputElement).value)" /></label>
          </div>
          <div class="chatbot-row-actions">
            <button class="save-btn" type="button" :disabled="savingId === entry.id" @click="saveEntry(entry)">{{ savingId === entry.id ? 'Saving...' : 'Save' }}</button>
            <button class="delete-btn" type="button" @click="removeEntry(entry)">Delete</button>
          </div>
        </article>
      </div>
    </div>

    <div class="section-card chatbot-topic-section">
      <div class="section-header"><div><h3>Popular Topics</h3><small>Based on recent in-scope questions.</small></div></div>
      <div v-if="!topTopics.length" class="chatbot-empty">No topic data yet.</div>
      <div v-else class="chatbot-topic-list">
        <div v-for="([topic, count], index) in topTopics" :key="topic"><span>{{ index + 1 }}. {{ topic }}</span><strong>{{ count }}</strong></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chatbot-admin-page { display: grid; gap: 22px; }
.chatbot-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.chatbot-metrics > div { padding: 18px; border: 1px solid #e8dfdc; border-radius: 8px; background: #fff; }
.chatbot-metrics span, .chatbot-metrics small { display: block; color: #8b8380; }
.chatbot-metrics span { font-size: 12px; font-weight: 700; text-transform: uppercase; }
.chatbot-metrics strong { display: block; margin: 8px 0 5px; color: #332b29; font: 400 30px/1 Georgia, serif; }
.chatbot-metrics small { font-size: 11px; }
.chatbot-alert { margin: 0; }
.chatbot-form-section { scroll-margin-top: 20px; }
.chatbot-knowledge-form, .chatbot-entry-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; padding: 20px 24px 24px; }
.chatbot-knowledge-form label, .chatbot-entry-grid label { display: grid; align-content: start; gap: 6px; color: #554c49; font-size: 12px; font-weight: 700; }
.chatbot-knowledge-form input, .chatbot-knowledge-form select, .chatbot-knowledge-form textarea,
.chatbot-entry-grid input, .chatbot-entry-grid select, .chatbot-entry-grid textarea,
.chatbot-filters select { width: 100%; padding: 10px 11px; border: 1px solid #ded5d2; border-radius: 6px; background: #fff; color: #332b29; font: 13px/1.35 Arial, sans-serif; }
.chatbot-knowledge-form textarea, .chatbot-entry-grid textarea { resize: vertical; }
.chatbot-wide { grid-column: 1 / -1; }
.chatbot-active-toggle { display: flex !important; align-items: center; align-self: end; grid-auto-flow: column; justify-content: start; min-height: 38px; }
.chatbot-active-toggle input { width: 16px; }
.chatbot-create-btn { align-self: end; min-height: 39px; }
.chatbot-empty { padding: 28px 24px; color: #8b8380; text-align: center; }
.chatbot-review-list, .chatbot-knowledge-list { display: grid; }
.chatbot-review-row, .chatbot-knowledge-row { padding: 20px 24px; border-top: 1px solid #eee6e3; }
.chatbot-review-meta { display: flex; gap: 8px; color: #8b8380; font-size: 11px; text-transform: uppercase; }
.chatbot-review-meta span { padding: 4px 7px; border-radius: 4px; background: #f6f1ef; }
.chatbot-review-row h4 { margin: 12px 0 6px; color: #332b29; font: 500 18px/1.3 Georgia, serif; }
.chatbot-review-row p { margin: 0; color: #6f6663; line-height: 1.5; }
.chatbot-row-actions { display: flex; gap: 8px; margin-top: 14px; }
.chatbot-row-actions button { width: auto; min-width: 92px; }
.chatbot-entry-grid { padding: 0; grid-template-columns: 110px minmax(150px, 1fr) 130px 90px; }
.chatbot-knowledge-header { gap: 14px; }
.chatbot-filters { display: flex; gap: 8px; }
.chatbot-filters select { width: 145px; }
.chatbot-topic-list { display: grid; gap: 1px; background: #eee6e3; }
.chatbot-topic-list div { display: flex; justify-content: space-between; padding: 13px 18px; background: #fff; color: #5d5451; text-transform: capitalize; }

@media (max-width: 900px) {
  .chatbot-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .chatbot-knowledge-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .chatbot-entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .chatbot-metrics, .chatbot-knowledge-form, .chatbot-entry-grid { grid-template-columns: 1fr; }
  .chatbot-wide { grid-column: auto; }
  .chatbot-knowledge-header { align-items: stretch; flex-direction: column; }
  .chatbot-filters { width: 100%; }
  .chatbot-filters select { width: 50%; }
  .chatbot-review-row, .chatbot-knowledge-row { padding: 16px; }
}
</style>
