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
const qrImageUrl = ref('')
const QR_LOGO_SRC = '/images/qrlogo.png'

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

function showQRCode() {
  if (!activeInvitation.value) return
  qrImageUrl.value = qrUrl(activeInvitation.value.id)
  showQR.value = true
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
  if (invitation.published) showQRCode()
  else showQR.value = false
}

function newInvitation() {
  activeInvitation.value = null
  form.investorName = ''
  form.senderName = 'Owner of Stack Petals'
  form.message = `I would like to personally invite you to take a closer look at Stack Petals - a handcrafted flower and digital keepsake business built with care, creativity, and long-term growth in mind.

Stack Petals combines crafted flowers, personalized QR letters, photo memories, music, and interactive bouquet experiences into one meaningful gift. We are building not just a product, but a memorable customer experience.

If you are open to learning more, I would be honored for you to view our website and see what we are growing.`
  showQR.value = false
  qrImageUrl.value = ''
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
  if (publish) showQRCode()
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
  qrImageUrl.value = ''
  await loadInvitations()
}

function copyLink() {
  if (!activeInvitation.value) return
  navigator.clipboard.writeText(invitationUrl(activeInvitation.value.id))
  success.value = 'Invitation link copied.'
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function drawQrDecorations(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#F0B7C1'
  ctx.fillStyle = '#F0B7C1'
  ctx.lineWidth = 8
  ctx.globalAlpha = 0.9
  drawRoundRect(ctx, 52, 52, 1096, 1096, 88)
  ctx.stroke()
  ctx.lineWidth = 3
  drawRoundRect(ctx, 70, 70, 1060, 1060, 72)
  ctx.stroke()

  ctx.globalAlpha = 0.75
  ;[
    [126, 142, 18], [104, 182, 10], [1084, 1018, 18], [1046, 1068, 6], [112, 510, 8],
  ].forEach(([x, y, size]) => {
    ctx.beginPath()
    ctx.moveTo(x, y - size)
    ctx.lineTo(x + size * 0.3, y - size * 0.3)
    ctx.lineTo(x + size, y)
    ctx.lineTo(x + size * 0.3, y + size * 0.3)
    ctx.lineTo(x, y + size)
    ctx.lineTo(x - size * 0.3, y + size * 0.3)
    ctx.lineTo(x - size, y)
    ctx.lineTo(x - size * 0.3, y - size * 0.3)
    ctx.closePath()
    ctx.fill()
  })
  ctx.globalAlpha = 1
}

async function downloadStyledQR() {
  if (!activeInvitation.value || !qrImageUrl.value) return

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 1200
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const qrImage = await loadCanvasImage(qrImageUrl.value)
    const logoImage = await loadCanvasImage(QR_LOGO_SRC)

    const bg = ctx.createRadialGradient(600, 560, 80, 600, 600, 760)
    bg.addColorStop(0, '#FFF9F9')
    bg.addColorStop(1, '#FFF0F2')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 1200, 1200)
    drawQrDecorations(ctx)

    ctx.drawImage(qrImage, 170, 170, 860, 860)

    ctx.save()
    ctx.beginPath()
    ctx.arc(600, 600, 112, 0, Math.PI * 2)
    ctx.fillStyle = '#FFF0F2'
    ctx.shadowColor = 'rgba(122, 74, 100, 0.18)'
    ctx.shadowBlur = 18
    ctx.fill()
    ctx.clip()
    ctx.shadowBlur = 0
    ctx.drawImage(logoImage, 488, 488, 224, 224)
    ctx.restore()

    ctx.beginPath()
    ctx.arc(600, 600, 112, 0, Math.PI * 2)
    ctx.lineWidth = 10
    ctx.strokeStyle = '#FFF7F8'
    ctx.stroke()

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `stack-petals-investor-invite-${activeInvitation.value.id}-qr.png`
    link.click()
  } catch (downloadError) {
    console.error('Failed to download styled QR:', downloadError)
    window.open(qrImageUrl.value, '_blank', 'noopener,noreferrer')
  }
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

    <div v-if="activeInvitation?.published && showQR && qrImageUrl" class="section-card investor-qr-section">
      <div class="section-header">
        <div>
          <h3>Invitation QR</h3>
          <small>Print or send this QR to the potential investor.</small>
        </div>
      </div>

      <div class="investor-qr-card">
        <div class="qr-card" aria-label="Scannable investor invitation QR code">
          <span class="qr-sparkle qr-sparkle-one">+</span>
          <span class="qr-sparkle qr-sparkle-two">+</span>
          <span class="qr-leaf qr-leaf-left"></span>
          <span class="qr-leaf qr-leaf-right"></span>
          <div class="qr-code-wrap">
            <img :src="qrImageUrl" alt="Investor invitation QR code" class="qr-image" crossorigin="anonymous" />
            <span class="qr-logo-badge">
              <img :src="QR_LOGO_SRC" alt="Stack Petals" />
            </span>
          </div>
        </div>
        <p>{{ invitationUrl(activeInvitation.id) }}</p>
        <div class="investor-qr-actions">
          <button class="refresh-btn" type="button" @click="copyLink">Copy Link</button>
          <button class="btn-download-qr" type="button" @click="downloadStyledQR">Download Styled QR</button>
        </div>
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
