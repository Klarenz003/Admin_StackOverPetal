<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabaseClient'

interface Letter {
  id: string
  order_id: string
  recipient: string
  sender: string
  message: string
  petal_messages: string[]
  memories: string[]
  angle_photos: string[]
  published: boolean
  template: string
  created_at: string
}

const letters = ref<Letter[]>([])
const loading = ref(false)
const activeLetter = ref<Letter | null>(null)
const uploading = ref(false)
const publishing = ref(false)
const removingAnglePhotos = ref(false)
const qrUrl = ref('')
const showQR = ref(false)

// ── Load Letters ───────────────────────────────────────────────────
async function loadLetters() {
  loading.value = true
  const { data, error } = await supabase
    .from('letters')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) console.error(error)
  letters.value = data || []
  loading.value = false
}

// ── Open Letter ────────────────────────────────────────────────────
function openLetter(letter: Letter) {
  activeLetter.value = { ...letter }
  qrUrl.value = ''
  showQR.value = false
}

// ── Save Edits ─────────────────────────────────────────────────────
async function saveLetter() {
  if (!activeLetter.value) return
  const { error } = await supabase
    .from('letters')
    .update({
      recipient:      activeLetter.value.recipient,
      sender:         activeLetter.value.sender,
      message:        activeLetter.value.message,
      petal_messages: activeLetter.value.petal_messages,
    })
    .eq('id', activeLetter.value.id)
  if (error) { alert('Failed to save'); return }
  alert('Saved!')
  loadLetters()
}

// ── Upload Angle Photos ────────────────────────────────────────────
async function uploadAnglePhotos(e: Event) {
  if (!activeLetter.value) return
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return

  uploading.value = true
  const uploaded: string[] = [...activeLetter.value.angle_photos]

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fileName = `${activeLetter.value.id}/angle-${Date.now()}-${i}.png`
    const { data, error } = await supabase.storage
      .from('letter-photos')
      .upload(fileName, file, { upsert: true })
    if (error) { console.error(error); continue }
    const { data: urlData } = supabase.storage
      .from('letter-photos')
      .getPublicUrl(data.path)
    uploaded.push(urlData.publicUrl)
  }

  const { error } = await supabase
    .from('letters')
    .update({ angle_photos: uploaded })
    .eq('id', activeLetter.value.id)

  if (!error) {
    activeLetter.value.angle_photos = uploaded
    loadLetters()
  }

  uploading.value = false
}

// ── Remove Angle Photo ─────────────────────────────────────────────
async function removeAnglePhoto(index: number) {
  if (!activeLetter.value) return
  activeLetter.value.angle_photos.splice(index, 1)
  await supabase
    .from('letters')
    .update({ angle_photos: activeLetter.value.angle_photos })
    .eq('id', activeLetter.value.id)
  loadLetters()
}

async function removeAllAnglePhotos() {
  if (!activeLetter.value || activeLetter.value.angle_photos.length === 0) return
  const confirmed = window.confirm('Remove all 360 bouquet photos from this letter?')
  if (!confirmed) return

  removingAnglePhotos.value = true

  const { error } = await supabase
    .from('letters')
    .update({ angle_photos: [] })
    .eq('id', activeLetter.value.id)

  if (error) {
    alert('Failed to remove 360 photos')
    removingAnglePhotos.value = false
    return
  }

  activeLetter.value.angle_photos = []
  removingAnglePhotos.value = false
  loadLetters()
}

// ── Publish & Generate QR ──────────────────────────────────────────
async function publishLetter() {
  if (!activeLetter.value) return
  if (activeLetter.value.angle_photos.length < 0) {
    alert('Please upload at least 1 angle photos for the 360° view')
    return
  }

  publishing.value = true

  const { error } = await supabase
    .from('letters')
    .update({ published: true })
    .eq('id', activeLetter.value.id)

  if (error) { alert('Failed to publish'); publishing.value = false; return }

  activeLetter.value.published = true
  const letterUrl = `https://stackoverpetals.shop/letter/${activeLetter.value.id}`
  qrUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(letterUrl)}`
  showQR.value = true
  publishing.value = false
  loadLetters()
}

// ── Unpublish ──────────────────────────────────────────────────────
async function unpublishLetter() {
  if (!activeLetter.value) return
  await supabase.from('letters').update({ published: false }).eq('id', activeLetter.value.id)
  activeLetter.value.published = false
  showQR.value = false
  loadLetters()
}

onMounted(() => loadLetters())
</script>

<template>
  <div class="letters-page">

    <!-- List View -->
    <div v-if="!activeLetter">
      <div class="letters-header">
        <h2>Love Letters</h2>
        <span class="letters-count">{{ letters.length }} total</span>
      </div>

      <div v-if="loading" class="loading">Loading letters...</div>

      <div v-else-if="letters.length === 0" class="empty-state">
        <div class="emoji">💌</div>
        <p>No letters yet. Letters appear here when customers include them in their orders.</p>
      </div>

      <div v-else class="letters-list">
        <div
          v-for="letter in letters"
          :key="letter.id"
          class="letter-card"
          @click="openLetter(letter)"
        >
          <div class="letter-card-left">
            <div class="letter-avatar">{{ letter.recipient?.charAt(0) || '?' }}</div>
            <div>
              <p class="letter-recipient">To: <strong>{{ letter.recipient }}</strong></p>
              <p class="letter-sender">From: <strong>{{ letter.sender }}</strong></p>
              <p class="letter-order">Order: <code>{{ letter.order_id?.slice(0, 8) }}...</code></p>
              <p class="letter-preview">{{ letter.message?.slice(0, 60) }}...</p>
            </div>
          </div>
          <div class="letter-card-right">
            <span :class="letter.published ? 'badge-published' : 'badge-draft'">
              {{ letter.published ? 'Published' : 'Draft' }}
            </span>
            <p class="letter-photos">{{ letter.angle_photos?.length || 0 }} / 24 photos</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail View -->
    <div v-else class="letter-detail">
      <button class="back-btn" @click="activeLetter = null">← Back to Letters</button>

      <div class="detail-header">
        <div>
          <h2>Letter for {{ activeLetter.recipient }}</h2>
          <p class="detail-order-id">
            From: <strong>{{ activeLetter.sender }}</strong>
            &nbsp;·&nbsp;
            Order: <code>{{ activeLetter.order_id }}</code>
          </p>
        </div>
        <span :class="activeLetter.published ? 'badge-published' : 'badge-draft'">
          {{ activeLetter.published ? 'Published' : 'Draft' }}
        </span>
      </div>

      <!-- Edit Fields -->
      <div class="detail-section">
        <h3>Letter Content</h3>
        <div class="detail-field">
          <label>To (Recipient)</label>
          <input v-model="activeLetter.recipient" type="text" />
        </div>
        <div class="detail-field">
          <label>From (Sender)</label>
          <input v-model="activeLetter.sender" type="text" />
        </div>
        <div class="detail-field">
          <label>Main Message</label>
          <textarea v-model="activeLetter.message" rows="5"></textarea>
        </div>
        <div class="detail-field">
          <label>Petal Messages</label>
          <div class="petals-edit">
            <div v-for="(_, i) in activeLetter.petal_messages" :key="i" class="petal-edit-row">
              <span class="petal-num">{{ i + 1 }}</span>
              <input v-model="activeLetter.petal_messages[i]" :placeholder="`Petal ${i + 1}...`" />
            </div>
          </div>
        </div>
        <button class="btn-save" @click="saveLetter">Save Changes</button>
      </div>

      <!-- Memory Photos -->
      <div class="detail-section" v-if="activeLetter.memories?.length > 0">
        <h3>Customer Memory Photos</h3>
        <div class="memory-preview-grid">
          <img
            v-for="(mem, i) in activeLetter.memories"
            :key="i"
            :src="mem"
            :alt="`Memory ${i + 1}`"
            class="memory-thumb"
          />
        </div>
      </div>

      <!-- 360° Angle Photos -->
      <div class="detail-section">
        <div class="section-title-row">
          <h3>360° Bouquet Photos</h3>
          <span class="photo-count">{{ activeLetter.angle_photos?.length || 0 }} frames</span>
          <button
            v-if="activeLetter.angle_photos?.length > 0"
            class="clear-angle-btn"
            type="button"
            :disabled="removingAnglePhotos"
            @click="removeAllAnglePhotos"
          >
            {{ removingAnglePhotos ? 'Removing...' : 'Remove All' }}
          </button>
        </div>
        <p class="section-hint">Upload as many PNG photos as you want with transparent background in order (front → right → back → left → front). More frames = smoother rotation.</p>

        <div v-if="activeLetter.angle_photos?.length > 0" class="angle-grid">
          <div
            v-for="(photo, i) in activeLetter.angle_photos"
            :key="i"
            class="angle-item"
          >
            <img :src="photo" :alt="`Angle ${i + 1}`" />
            <button class="remove-angle" @click="removeAnglePhoto(i)">✕</button>
            <span class="angle-num">{{ i + 1 }}</span>
          </div>
        </div>

        <div class="upload-angle-zone" @click="($refs.angleInput as HTMLInputElement).click()">
          <input
            ref="angleInput"
            type="file"
            accept="image/png,image/webp"
            multiple
            style="display:none"
            @change="uploadAnglePhotos"
          />
          <span v-if="uploading">Uploading...</span>
          <span v-else>+ Upload Angle Photos (PNG with transparent bg)</span>
        </div>
      </div>

      <!-- Publish & QR -->
      <div class="detail-section publish-section">
        <h3>Publish Letter</h3>
        <p class="section-hint">Once published, the QR code will be generated and the letter page goes live.</p>

        <div v-if="!activeLetter.published">
          <button
            class="btn-publish"
            @click="publishLetter"
            :disabled="publishing"
          >
            {{ publishing ? 'Publishing...' : '🌸 Publish & Generate QR' }}
          </button>
        </div>

        <div v-else>
          <button class="btn-unpublish" @click="unpublishLetter">Unpublish</button>
          <button
            class="btn-publish"
            style="margin-left: 12px"
            @click="showQR = true; qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('https://stackoverpetals.shop/letter/' + activeLetter.id)}`"
          >
            Show QR Code
          </button>
        </div>

        <!-- QR Code Display -->
        <div v-if="showQR && qrUrl" class="qr-display">
          <h4>QR Code — Print & Place in Keychain</h4>
          <img :src="qrUrl" alt="QR Code" class="qr-image" />
          <p class="qr-link">{{ `https://stackoverpetals.shop/letter/${activeLetter.id}` }}</p>
          <a :href="qrUrl" download="qr-code.png" class="btn-download-qr">⬇ Download QR</a>
        </div>
      </div>
    </div>
  </div>
</template>
