<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabaseClient'

interface Letter {
  id: string
  order_id: string | null
  recipient: string
  sender: string
  message: string
  petal_messages: string[]
  memories: string[]
  angle_photos: string[]
  music_url: string
  bouquet_image_url: string
  published: boolean
  template: string
  created_at: string
}

const letters = ref<Letter[]>([])
const loading = ref(false)
const activeLetter = ref<Letter | null>(null)
const creatingLetter = ref(false)
const uploading = ref(false)
const uploadingMemories = ref(false)
const uploadingMusic = ref(false)
const uploadingBouquetImage = ref(false)
const publishing = ref(false)
const removingAnglePhotos = ref(false)
const qrUrl = ref('')
const showQR = ref(false)
const QR_LOGO_SRC = '/images/qrlogo.png'
const PETAL_MESSAGE_LIMIT = 30
const PETAL_COUNT = 6

function normalizePetalMessages(messages?: string[]) {
  const petals = Array.isArray(messages) ? [...messages] : []
  while (petals.length < PETAL_COUNT) petals.push('')
  return petals.slice(0, PETAL_COUNT).map(message => (message || '').slice(0, PETAL_MESSAGE_LIMIT))
}

function normalizeLetter(letter: Letter): Letter {
  return {
    ...letter,
    petal_messages: normalizePetalMessages(letter.petal_messages),
    memories: Array.isArray(letter.memories) ? [...letter.memories] : [],
    angle_photos: Array.isArray(letter.angle_photos) ? [...letter.angle_photos] : [],
    music_url: letter.music_url || '',
    bouquet_image_url: letter.bouquet_image_url || '',
  }
}

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
  activeLetter.value = normalizeLetter(letter)
  qrUrl.value = ''
  showQR.value = false
}

async function createStandaloneLetter() {
  if (creatingLetter.value) return
  creatingLetter.value = true

  const { data, error } = await supabase
    .from('letters')
    .insert({
      order_id: null,
      recipient: 'Recipient Name',
      sender: 'Stack Petals',
      message: 'Write your custom letter message here.',
      petal_messages: normalizePetalMessages([]),
      memories: [],
      angle_photos: [],
      music_url: '',
      bouquet_image_url: '',
      published: false,
      template: 'default',
    })
    .select('*')
    .single()

  creatingLetter.value = false

  if (error || !data) {
    console.error(error)
    alert('Failed to create letter')
    return
  }

  await loadLetters()
  openLetter(data)
}

function limitPetalMessage(index: number) {
  if (!activeLetter.value) return
  activeLetter.value.petal_messages[index] = activeLetter.value.petal_messages[index].slice(0, PETAL_MESSAGE_LIMIT)
}

// ── Save Edits ─────────────────────────────────────────────────────
async function saveLetter() {
  if (!activeLetter.value) return
  activeLetter.value.petal_messages = normalizePetalMessages(activeLetter.value.petal_messages)
  const { error } = await supabase
    .from('letters')
    .update({
      recipient:      activeLetter.value.recipient,
      sender:         activeLetter.value.sender,
      message:        activeLetter.value.message,
      petal_messages: activeLetter.value.petal_messages,
      memories:       activeLetter.value.memories,
      angle_photos:   activeLetter.value.angle_photos,
      music_url:      activeLetter.value.music_url || '',
      bouquet_image_url: activeLetter.value.bouquet_image_url || '',
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

// ── Memory Photos ──────────────────────────────────────────────────
async function uploadMemoryPhotos(e: Event) {
  if (!activeLetter.value) return
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  uploadingMemories.value = true
  const uploaded: string[] = [...activeLetter.value.memories]

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${activeLetter.value.id}/memory-${Date.now()}-${i}.${extension}`
    const { data, error } = await supabase.storage
      .from('letter-photos')
      .upload(fileName, file, { upsert: true })
    if (error) {
      console.error(error)
      continue
    }
    const { data: urlData } = supabase.storage
      .from('letter-photos')
      .getPublicUrl(data.path)
    uploaded.push(urlData.publicUrl)
  }

  const { error } = await supabase
    .from('letters')
    .update({ memories: uploaded })
    .eq('id', activeLetter.value.id)

  if (error) {
    alert('Failed to upload memory photos')
  } else {
    activeLetter.value.memories = uploaded
    loadLetters()
  }

  input.value = ''
  uploadingMemories.value = false
}

async function removeMemoryPhoto(index: number) {
  if (!activeLetter.value) return
  activeLetter.value.memories.splice(index, 1)
  const { error } = await supabase
    .from('letters')
    .update({ memories: activeLetter.value.memories })
    .eq('id', activeLetter.value.id)

  if (error) alert('Failed to remove memory photo')
  loadLetters()
}

async function removeAllMemoryPhotos() {
  if (!activeLetter.value || activeLetter.value.memories.length === 0) return
  const confirmed = window.confirm('Remove all memory photos from this letter?')
  if (!confirmed) return

  const { error } = await supabase
    .from('letters')
    .update({ memories: [] })
    .eq('id', activeLetter.value.id)

  if (error) {
    alert('Failed to remove memory photos')
    return
  }

  activeLetter.value.memories = []
  loadLetters()
}

// ── Background Music ────────────────────────────────────────────────
async function uploadLetterMusic(e: Event) {
  if (!activeLetter.value) return
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingMusic.value = true
  const extension = file.name.split('.').pop() || 'mp3'
  const fileName = `${activeLetter.value.id}/music-${Date.now()}.${extension}`
  const { data, error } = await supabase.storage
    .from('letter-music')
    .upload(fileName, file, { upsert: true })

  if (error) {
    console.error(error)
    alert('Failed to upload music')
    uploadingMusic.value = false
    input.value = ''
    return
  }

  const { data: urlData } = supabase.storage
    .from('letter-music')
    .getPublicUrl(data.path)

  const { error: updateError } = await supabase
    .from('letters')
    .update({ music_url: urlData.publicUrl })
    .eq('id', activeLetter.value.id)

  if (updateError) {
    alert('Music uploaded, but failed to attach to letter')
  } else {
    activeLetter.value.music_url = urlData.publicUrl
    loadLetters()
  }

  input.value = ''
  uploadingMusic.value = false
}

async function removeLetterMusic() {
  if (!activeLetter.value || !activeLetter.value.music_url) return
  const confirmed = window.confirm('Remove custom background music from this letter?')
  if (!confirmed) return

  const { error } = await supabase
    .from('letters')
    .update({ music_url: '' })
    .eq('id', activeLetter.value.id)

  if (error) {
    alert('Failed to remove music')
    return
  }

  activeLetter.value.music_url = ''
  loadLetters()
}

// ── Page 6 Bouquet Image ────────────────────────────────────────────
async function uploadBouquetImage(e: Event) {
  if (!activeLetter.value) return
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingBouquetImage.value = true
  const extension = file.name.split('.').pop() || 'jpg'
  const fileName = `${activeLetter.value.id}/bouquet-${Date.now()}.${extension}`
  const { data, error } = await supabase.storage
    .from('letter-bouquets')
    .upload(fileName, file, { upsert: true })

  if (error) {
    console.error(error)
    alert('Failed to upload bouquet image')
    uploadingBouquetImage.value = false
    input.value = ''
    return
  }

  const { data: urlData } = supabase.storage
    .from('letter-bouquets')
    .getPublicUrl(data.path)

  const { error: updateError } = await supabase
    .from('letters')
    .update({ bouquet_image_url: urlData.publicUrl })
    .eq('id', activeLetter.value.id)

  if (updateError) {
    alert('Bouquet image uploaded, but failed to attach to letter')
  } else {
    activeLetter.value.bouquet_image_url = urlData.publicUrl
    loadLetters()
  }

  input.value = ''
  uploadingBouquetImage.value = false
}

async function removeBouquetImage() {
  if (!activeLetter.value || !activeLetter.value.bouquet_image_url) return
  const confirmed = window.confirm('Remove custom page 6 bouquet image from this letter?')
  if (!confirmed) return

  const { error } = await supabase
    .from('letters')
    .update({ bouquet_image_url: '' })
    .eq('id', activeLetter.value.id)

  if (error) {
    alert('Failed to remove bouquet image')
    return
  }

  activeLetter.value.bouquet_image_url = ''
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
  showQRCode()
  publishing.value = false
  loadLetters()
}

function getLetterUrl(letterId: string) {
  return `https://stackoverpetals.shop/letter/${letterId}`
}

function getStyledQrUrl(letterId: string) {
  const params = new URLSearchParams({
    size: '720x720',
    data: getLetterUrl(letterId),
    color: '7A4A64',
    bgcolor: 'FFF7F8',
    qzone: '2',
    ecc: 'H',
    format: 'png',
  })
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
}

function showQRCode() {
  if (!activeLetter.value) return
  qrUrl.value = getStyledQrUrl(activeLetter.value.id)
  showQR.value = true
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
  if (!activeLetter.value || !qrUrl.value) return

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 1200
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const qrImage = await loadCanvasImage(qrUrl.value)
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
    link.download = `stack-petals-letter-${activeLetter.value.id}-qr.png`
    link.click()
  } catch (error) {
    console.error('Failed to download styled QR:', error)
    window.open(qrUrl.value, '_blank', 'noopener,noreferrer')
  }
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
        <div>
          <h2>Love Letters</h2>
          <span class="letters-count">{{ letters.length }} total</span>
        </div>
        <button class="btn-save letters-create-btn" type="button" :disabled="creatingLetter" @click="createStandaloneLetter">
          {{ creatingLetter ? 'Creating...' : '+ New Letter' }}
        </button>
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
              <p class="letter-order" v-if="letter.order_id">Order: <code>{{ letter.order_id.slice(0, 8) }}...</code></p>
              <p class="letter-order" v-else>Standalone letter</p>
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
            <template v-if="activeLetter.order_id">
              Order: <code>{{ activeLetter.order_id }}</code>
            </template>
            <template v-else>
              Standalone admin letter
            </template>
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
              <input
                v-model="activeLetter.petal_messages[i]"
                :placeholder="`Petal ${i + 1}...`"
                :maxlength="PETAL_MESSAGE_LIMIT"
                @input="limitPetalMessage(i)"
              />
            </div>
          </div>
        </div>
        <button class="btn-save" @click="saveLetter">Save Changes</button>
      </div>

      <!-- Memory Photos -->
      <div class="detail-section">
        <div class="section-title-row">
          <h3>Memory Photos</h3>
          <span class="photo-count">{{ activeLetter.memories?.length || 0 }} photos</span>
          <button
            v-if="activeLetter.memories?.length > 0"
            class="clear-angle-btn"
            type="button"
            @click="removeAllMemoryPhotos"
          >
            Remove All
          </button>
        </div>
        <p class="section-hint">Customize the customer memories shown on the letter page. You can add, remove, or replace photos here.</p>

        <div v-if="activeLetter.memories?.length > 0" class="memory-preview-grid">
          <div
            v-for="(mem, i) in activeLetter.memories"
            :key="i"
            class="memory-admin-item"
          >
            <img
              :src="mem"
              :alt="`Memory ${i + 1}`"
              class="memory-thumb"
            />
            <button class="remove-angle" @click="removeMemoryPhoto(i)">✕</button>
          </div>
        </div>

        <div class="upload-angle-zone" @click="($refs.memoryInput as HTMLInputElement).click()">
          <input
            ref="memoryInput"
            type="file"
            accept="image/*"
            multiple
            style="display:none"
            @change="uploadMemoryPhotos"
          />
          <span v-if="uploadingMemories">Uploading...</span>
          <span v-else>+ Upload Memory Photos</span>
        </div>
      </div>

      <!-- Background Music -->
      <div class="detail-section">
        <div class="section-title-row">
          <h3>Background Music</h3>
          <span class="photo-count">{{ activeLetter.music_url ? 'Custom' : 'Default' }}</span>
          <button
            v-if="activeLetter.music_url"
            class="clear-angle-btn"
            type="button"
            @click="removeLetterMusic"
          >
            Remove
          </button>
        </div>
        <p class="section-hint">Upload an MP3, WAV, M4A, or OGG file. The letter page will use this music when the recipient taps the music button. If empty, it uses the default song.</p>

        <div v-if="activeLetter.music_url" class="letter-music-preview">
          <audio :src="activeLetter.music_url" controls></audio>
          <p>{{ activeLetter.music_url }}</p>
        </div>

        <div class="upload-angle-zone" @click="($refs.musicInput as HTMLInputElement).click()">
          <input
            ref="musicInput"
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/ogg"
            style="display:none"
            @change="uploadLetterMusic"
          />
          <span v-if="uploadingMusic">Uploading...</span>
          <span v-else>{{ activeLetter.music_url ? 'Replace Background Music' : '+ Upload Background Music' }}</span>
        </div>
      </div>

      <!-- Page 6 Bouquet Image -->
      <div class="detail-section">
        <div class="section-title-row">
          <h3>Page 6 Bouquet Picture</h3>
          <span class="photo-count">{{ activeLetter.bouquet_image_url ? 'Custom' : 'Order image' }}</span>
          <button
            v-if="activeLetter.bouquet_image_url"
            class="clear-angle-btn"
            type="button"
            @click="removeBouquetImage"
          >
            Remove
          </button>
        </div>
        <p class="section-hint">This controls the bouquet picture shown on page 6 of the letter. If empty, the customer order bouquet image is used.</p>

        <div v-if="activeLetter.bouquet_image_url" class="letter-bouquet-preview">
          <img :src="activeLetter.bouquet_image_url" alt="Custom page 6 bouquet" />
        </div>

        <div class="upload-angle-zone" @click="($refs.bouquetImageInput as HTMLInputElement).click()">
          <input
            ref="bouquetImageInput"
            type="file"
            accept="image/*"
            style="display:none"
            @change="uploadBouquetImage"
          />
          <span v-if="uploadingBouquetImage">Uploading...</span>
          <span v-else>{{ activeLetter.bouquet_image_url ? 'Replace Bouquet Picture' : '+ Upload Bouquet Picture' }}</span>
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
            @click="showQRCode"
          >
            Show QR Code
          </button>
        </div>

        <!-- QR Code Display -->
        <div v-if="showQR && qrUrl" class="qr-display">
          <h4>QR Code - Print & Place in Keychain</h4>
          <div class="qr-card" aria-label="Scannable letter QR code">
            <span class="qr-sparkle qr-sparkle-one">+</span>
            <span class="qr-sparkle qr-sparkle-two">+</span>
            <span class="qr-leaf qr-leaf-left"></span>
            <span class="qr-leaf qr-leaf-right"></span>
            <div class="qr-code-wrap">
              <img :src="qrUrl" alt="QR Code" class="qr-image" crossorigin="anonymous" />
              <span class="qr-logo-badge">
                <img :src="QR_LOGO_SRC" alt="Stack Petals" />
              </span>
            </div>
          </div>
          <p class="qr-link">{{ getLetterUrl(activeLetter.id) }}</p>
          <button type="button" class="btn-download-qr" @click="downloadStyledQR">Download Styled QR</button>
        </div>
      </div>
    </div>
  </div>
</template>
