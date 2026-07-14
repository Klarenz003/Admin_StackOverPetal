<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '@/supabaseClient'

interface GalleryImage {
  id: string
  image_url: string
  title: string
  caption: string
  featured: boolean
  sort_order: number
  created_at: string
}

const images = ref<GalleryImage[]>([])
const loading = ref(false)
const uploading = ref(false)
const savingId = ref<string | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)

async function loadGalleryImages() {
  loading.value = true
  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    alert('Failed to load gallery images')
  } else {
    images.value = data || []
  }

  loading.value = false
}

async function compressGalleryImage(file: File, maxSize = 1400, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file

  const image = new Image()
  const objectUrl = URL.createObjectURL(file)

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = reject
      image.src = objectUrl
    })

    const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'gallery'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function uploadGalleryImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return

  uploading.value = true

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue

      const optimized = await compressGalleryImage(file)
      const uniqueName = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${i}`
      const fileName = `gallery/${uniqueName}.webp`

      const { data, error } = await supabase.storage
        .from('gallery-images')
        .upload(fileName, optimized, {
          upsert: true,
          cacheControl: '31536000',
          contentType: optimized.type || 'image/webp',
        })

      if (error || !data) {
        console.error(error)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('gallery-images')
        .getPublicUrl(data.path)

      const nextOrder = images.value.length + i
      const { error: insertError } = await supabase.from('gallery_images').insert({
        image_url: urlData.publicUrl,
        title: file.name.replace(/\.[^.]+$/, ''),
        caption: '',
        featured: true,
        sort_order: nextOrder,
      })

      if (insertError) console.error(insertError)
    }

    await loadGalleryImages()
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function saveImage(image: GalleryImage) {
  savingId.value = image.id
  const { error } = await supabase
    .from('gallery_images')
    .update({
      title: image.title || '',
      caption: image.caption || '',
      featured: image.featured,
      sort_order: Number(image.sort_order || 0),
    })
    .eq('id', image.id)

  savingId.value = null

  if (error) {
    alert('Failed to save gallery image')
    return
  }

  await loadGalleryImages()
}

async function removeImage(image: GalleryImage) {
  if (!confirm('Remove this image from the gallery?')) return

  const { error } = await supabase
    .from('gallery_images')
    .delete()
    .eq('id', image.id)

  if (error) {
    alert('Failed to remove gallery image')
    return
  }

  images.value = images.value.filter(item => item.id !== image.id)
}

onMounted(loadGalleryImages)
</script>

<template>
  <div class="gallery-admin-page">
    <div class="section-card">
      <div class="section-header gallery-admin-header">
        <div>
          <h3>Customer Gallery</h3>
          <small>Upload photos to feature on the public Gallery page.</small>
        </div>
        <button class="btn-small" type="button" :disabled="uploading" @click="galleryInput?.click()">
          {{ uploading ? 'Uploading...' : 'Upload Images' }}
        </button>
        <input
          ref="galleryInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden-file-input"
          @change="uploadGalleryImages"
        />
      </div>

      <div v-if="loading" class="loading">Loading gallery...</div>
      <div v-else-if="images.length === 0" class="empty-state">
        <div class="emoji">Gallery</div>
        <p>No gallery images yet. Upload photos to feature them on the customer site.</p>
      </div>

      <div v-else class="gallery-admin-grid">
        <article v-for="image in images" :key="image.id" class="gallery-admin-card">
          <img :src="image.image_url" :alt="image.title || 'Gallery image'" />
          <div class="gallery-admin-fields">
            <label>
              Title
              <input v-model="image.title" class="detail-input" type="text" placeholder="Bouquet title" />
            </label>
            <label>
              Caption
              <textarea v-model="image.caption" class="detail-input" rows="2" placeholder="Short caption"></textarea>
            </label>
            <label>
              Sort Order
              <input v-model.number="image.sort_order" class="detail-input" type="number" min="0" />
            </label>
            <label class="gallery-featured-toggle">
              <input v-model="image.featured" type="checkbox" />
              Featured on customer gallery
            </label>
          </div>
          <div class="gallery-admin-actions">
            <button class="btn-small" type="button" :disabled="savingId === image.id" @click="saveImage(image)">
              {{ savingId === image.id ? 'Saving...' : 'Save' }}
            </button>
            <button class="btn-small btn-danger" type="button" @click="removeImage(image)">Remove</button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>