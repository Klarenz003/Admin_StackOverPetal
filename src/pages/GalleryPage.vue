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
  category: string
  focal_position: 'top' | 'center' | 'bottom'
}

const galleryCategories = ['Crafted Flowers', 'Bouquets', 'Keepsakes', 'Customer Moments']

const images = ref<GalleryImage[]>([])
const loading = ref(false)
const uploading = ref(false)
const savingId = ref<string | null>(null)
const savingAll = ref(false)
const draggedIndex = ref<number | null>(null)
const savingOrder = ref(false)
const galleryInput = ref<HTMLInputElement | null>(null)

function dragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', images.value[index].id)
  }
}

function dragOver(index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) return
  const [draggedImage] = images.value.splice(draggedIndex.value, 1)
  images.value.splice(index, 0, draggedImage)
  draggedIndex.value = index
}

async function saveGalleryOrder() {
  savingOrder.value = true
  images.value.forEach((image, index) => { image.sort_order = index })

  const results = await Promise.all(
    images.value.map((image, index) =>
      supabase.from('gallery_images').update({ sort_order: index }).eq('id', image.id)
    )
  )
  savingOrder.value = false

  if (results.some(result => result.error)) {
    alert('Failed to save the new gallery arrangement')
    await loadGalleryImages()
  }
}

async function dragEnd() {
  if (draggedIndex.value === null) return
  draggedIndex.value = null
  await saveGalleryOrder()
}

async function moveImage(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= images.value.length || savingOrder.value) return
  const [image] = images.value.splice(index, 1)
  images.value.splice(target, 0, image)
  await saveGalleryOrder()
}

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
        category: 'Crafted Flowers',
        focal_position: 'center',
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
      category: image.category || 'Crafted Flowers',
      focal_position: image.focal_position || 'center',
    })
    .eq('id', image.id)

  savingId.value = null

  if (error) {
    alert('Failed to save gallery image')
    return
  }

  await loadGalleryImages()
}

async function saveAllImages() {
  if (savingAll.value || images.value.length === 0) return

  savingAll.value = true
  images.value.forEach((image, index) => { image.sort_order = index })

  const results = await Promise.all(
    images.value.map((image, index) =>
      supabase
        .from('gallery_images')
        .update({
          title: image.title || '',
          caption: image.caption || '',
          featured: image.featured,
          sort_order: index,
          category: image.category || 'Crafted Flowers',
          focal_position: image.focal_position || 'center',
        })
        .eq('id', image.id)
    )
  )

  savingAll.value = false

  if (results.some(result => result.error)) {
    alert('Failed to save all gallery changes')
    await loadGalleryImages()
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
          <small class="gallery-compression-note">Uploads are automatically resized and converted to WebP.</small>
        </div>
        <div class="gallery-header-actions">
          <button class="btn-small gallery-save-all-btn" type="button" :disabled="savingAll || uploading || images.length === 0" @click="saveAllImages">
            {{ savingAll ? 'Saving All...' : 'Save All' }}
          </button>
          <button class="btn-small" type="button" :disabled="uploading || savingAll" @click="galleryInput?.click()">
            {{ uploading ? 'Uploading...' : 'Upload Images' }}
          </button>
        </div>
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
        <article
          v-for="(image, index) in images"
          :key="image.id"
          class="gallery-admin-card"
          :class="{ dragging: draggedIndex === index }"
          draggable="true"
          @dragstart="dragStart(index, $event)"
          @dragover.prevent="dragOver(index)"
          @dragend="dragEnd"
        >
          <div class="gallery-drag-toolbar">
            <span class="gallery-drag-handle" title="Drag to rearrange" aria-label="Drag to rearrange">&#8942;&#8942;</span>
            <span>{{ savingOrder ? 'Saving arrangement...' : 'Drag to rearrange' }}</span>
            <div class="gallery-mobile-order-actions">
              <button type="button" :disabled="index === 0 || savingOrder" aria-label="Move image earlier" @click="moveImage(index, -1)">&#8593;</button>
              <button type="button" :disabled="index === images.length - 1 || savingOrder" aria-label="Move image later" @click="moveImage(index, 1)">&#8595;</button>
            </div>
          </div>
          <img
            :src="image.image_url"
            :alt="image.title || 'Gallery image'"
            :style="{ objectPosition: image.focal_position || 'center' }"
          />
          <div class="gallery-admin-fields">
            <label>
              Title
              <input v-model="image.title" class="detail-input" type="text" placeholder="Bouquet title" />
            </label>
            <label>
              Caption
              <textarea v-model="image.caption" class="detail-input" rows="2" placeholder="Short caption"></textarea>
            </label>
            <div class="gallery-admin-options">
              <label>
                Category
                <select v-model="image.category" class="detail-input">
                  <option v-for="category in galleryCategories" :key="category" :value="category">{{ category }}</option>
                </select>
              </label>
              <label>
                Crop Focus
                <select v-model="image.focal_position" class="detail-input">
                  <option value="top">Top</option>
                  <option value="center">Center</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
            </div>
            <label class="gallery-featured-toggle">
              <input v-model="image.featured" type="checkbox" />
              Featured on customer gallery
            </label>
          </div>
          <div class="gallery-admin-actions">
            <button class="btn-small" type="button" :disabled="savingId === image.id || savingAll" @click="saveImage(image)">
              {{ savingId === image.id ? 'Saving...' : 'Save' }}
            </button>
            <button class="btn-small btn-danger" type="button" :disabled="savingAll" @click="removeImage(image)">Remove</button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
