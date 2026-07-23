<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/supabaseClient'

interface InvestorInvitation {
  id: string
  investor_name: string
  message: string
  sender_name: string
  published: boolean
  created_at: string
  updated_at: string
}

const invitations = ref<InvestorInvitation[]>([])
const activeInvitation = ref<InvestorInvitation | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const showQR = ref(false)

const form = reactive({
  investorName: '',
  senderName: 'Owner of Stack Petals',
  message: `I would like to personally invite you to take a closer look at Stack Petals - a handcrafted flower and digital keepsake business built with care, creativity, and long-term growth in mind.

Stack Petals combines crafted flowers, personalized QR letters, photo memories, music, and interactive bouquet experiences into one meaningful gift. We are building not just a product, but a memorable customer experience.

If you are open to learning more, I would be honored for you to view our website and see what we are growing.`,
})

const inviteBaseUrl = computed(() =>
  (import.meta.env.VITE_INVESTOR_PORTAL_URL || 'https://invest.stackoverpetals.shop').replace(/\/$/, ''),
)

function invitationUrl(id: string) {
  return `${inviteBaseUrl.value}/invite/${id}`
}

function qrUrl(id: string) {
  const params = new URLSearchParams({
    size: '720x720',
    data: invitationUrl(id),
    color: '7A4A64',
    bgcolor: 'FFF7F8',
    qzone: '2',
    ecc: 'H',
    format: 'png',
  })
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
}

async function loadInvitations() {
  loading.value = true
  error.value = ''

  const { data, error: loadError } = await supabase
    .from('investor_invitations')
    .select('*')
    .order('created_at', { ascending: false })

  loading.value = false

  if (loadError) {
    error.value = loadError.message
    return
  }

  invitations.value = data || []
}

function openInvitation(invitation: InvestorInvitation) {
  activeInvitation.value = { ...invitation }
  form.investorName = invitation.investor_name
  form.senderName = invitation.sender_name || 'Owner of Stack Petals'
  form.message = invitation.message
  showQR.value = false
}

function newInvitation() {
  activeInvitation.value = null
  form.investorName = ''
  form.senderName = 'Owner of Stack Petals'
  form.message = `I would like to personally invite you to take a closer look at Stack Petals - a handcrafted flower and digital keepsake business built with care, creativity, and long-term growth in mind.

Stack Petals combines crafted flowers, personalized QR letters, photo memories, music, and interactive bouquet experiences into one meaningful gift. We are building not just a product, but a memorable customer experience.

If you are open to learning more, I would be honored for you to view our website and see what we are growing.`
  showQR.value = false
}

async function saveInvitation(publish = false) {
  error.value = ''
  success.value = ''

  if (!form.investorName.trim()) {
    error.value = 'Investor name is required.'
    return
  }

  if (!form.message.trim()) {
    error.value = 'Invitation message is required.'
    return
  }

  saving.value = true

  const payload = {
    investor_name: form.investorName.trim(),
    sender_name: form.senderName.trim() || 'Owner of Stack Petals',
    message: form.message.trim(),
    published: publish ? true : activeInvitation.value?.published || false,
    updated_at: new Date().toISOString(),
  }

  const query = activeInvitation.value
    ? supabase.from('investor_invitations').update(payload).eq('id', activeInvitation.value.id).select('*').single()
    : supabase.from('investor_invitations').insert(payload).select('*').single()

  const { data, error: saveError } = await query
  saving.value = false

  if (saveError || !data) {
    error.value = saveError?.message || 'Failed to save investor invitation.'
    return
  }

  activeInvitation.value = data
  success.value = publish ? 'Invitation published and QR is ready.' : 'Invitation saved.'
  showQR.value = publish
  await loadInvitations()
}

async function unpublishInvitation() {
  if (!activeInvitation.value) return
  const { error: updateError } = await supabase
    .from('investor_invitations')
    .update({ published: false, updated_at: new Date().toISOString() })
    .eq('id', activeInvitation.value.id)

  if (updateError) {
    error.value = updateError.message
    return
  }

  activeInvitation.value.published = false
  showQR.value = false
  await loadInvitations()
}

function copyLink() {
  if (!activeInvitation.value) return
  navigator.clipboard.writeText(invitationUrl(activeInvitation.value.id))
  success.value = 'Invitation link copied.'
}

function formatDate(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

onMounted(loadInvitations)
</script>

<template>
  <section class="investor-letters-page">
    <div class="section-card investor-letter-editor">
      <div class="section-header">
        <div>
          <h3>Investor Invitation Letter</h3>
          <small>Create a QR-based invitation letter for a specific potential investor.</small>
        </div>
        <button class="refresh-btn" type="button" @click="newInvitation">New Invitation</button>
      </div>

      <div class="investor-letter-form">
        <label>
          Investor Name
          <input v-model="form.investorName" type="text" placeholder="Potential investor name" />
        </label>

        <label>
          From
          <input v-model="form.senderName" type="text" placeholder="Owner of Stack Petals" />
        </label>

        <label class="full">
          Invitation Message
          <textarea v-model="form.message" rows="9"></textarea>
        </label>

        <div class="investor-letter-actions">
          <button class="save-btn" type="button" :disabled="saving" @click="saveInvitation(false)">
            {{ saving ? 'Saving...' : 'Save Draft' }}
          </button>
          <button class="save-btn publish-investor-btn" type="button" :disabled="saving" @click="saveInvitation(true)">
            {{ saving ? 'Publishing...' : 'Publish & Generate QR' }}
          </button>
          <button
            v-if="activeInvitation?.published"
            class="refresh-btn"
            type="button"
            @click="unpublishInvitation"
          >
            Unpublish
          </button>
        </div>

        <p v-if="error" class="investor-access-error">{{ error }}</p>
        <p v-if="success" class="investor-access-success">{{ success }}</p>
      </div>
    </div>

    <div v-if="activeInvitation?.published && (showQR || activeInvitation)" class="section-card investor-qr-section">
      <div class="section-header">
        <div>
          <h3>Invitation QR</h3>
          <small>Print or send this QR to the potential investor.</small>
        </div>
      </div>

      <div class="investor-qr-card">
        <img :src="qrUrl(activeInvitation.id)" alt="Investor invitation QR code" />
        <p>{{ invitationUrl(activeInvitation.id) }}</p>
        <button class="refresh-btn" type="button" @click="copyLink">Copy Link</button>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div>
          <h3>Saved Invitations</h3>
          <small>{{ invitations.length }} investor invitations</small>
        </div>
        <button class="refresh-btn" type="button" @click="loadInvitations">Refresh</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Investor</th>
              <th>From</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="empty-cell">Loading investor invitations...</td>
            </tr>
            <tr v-else-if="!invitations.length">
              <td colspan="4" class="empty-cell">No investor invitations yet.</td>
            </tr>
            <tr
              v-for="invitation in invitations"
              v-else
              :key="invitation.id"
              class="clickable-row"
              @click="openInvitation(invitation)"
            >
              <td>
                <div class="name-primary">{{ invitation.investor_name }}</div>
                <div class="preview-cell">{{ invitation.message.slice(0, 80) }}...</div>
              </td>
              <td>{{ invitation.sender_name }}</td>
              <td>
                <span :class="invitation.published ? 'badge-published' : 'badge-draft'">
                  {{ invitation.published ? 'Published' : 'Draft' }}
                </span>
              </td>
              <td class="date-cell">{{ formatDate(invitation.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
