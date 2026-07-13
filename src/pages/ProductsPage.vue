<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '@/supabaseClient'

interface Product {
  id: string
  name: string
  price: number
  image: string
  category: string
  badge: string | null
  stock: number
  featured: boolean
  pre_order_allowed: boolean
  prep_days: number
  delivery_restrictions: string
}

const products = ref<Product[]>([])
const loading = ref(false)
const uploadingImage = ref(false)
const productImageInput = ref<HTMLInputElement | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  name: '',
  price: 0,
  image: '',
  category: 'Romance',
  badge: null as string | null,
  stock: 10,
  featured: false,
  pre_order_allowed: true,
  prep_days: 5,
  delivery_restrictions: '',
})

async function loadProducts() {
  loading.value = true
  const { data } = await supabase
    .from('products')
    .select('*')
    .order('order', { ascending: true })
  products.value = data || []
  loading.value = false
}

async function compressProductImage(file: File, maxSize = 1000, quality = 0.82) {
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

    return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function uploadProductImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file')
    input.value = ''
    return
  }

  uploadingImage.value = true

  try {
    const optimized = await compressProductImage(file)
    const uniqueName = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`
    const fileName = `products/${uniqueName}.webp`

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, optimized, {
        upsert: true,
        cacheControl: '31536000',
        contentType: optimized.type || 'image/webp',
      })

    if (error || !data) {
      console.error(error)
      alert('Failed to upload product image')
      return
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path)

    form.value.image = urlData.publicUrl
  } finally {
    uploadingImage.value = false
    input.value = ''
  }
}
async function saveProduct() {
  if (!form.value.name || !form.value.price) {
    alert('Please fill in all required fields')
    return
  }

const payload = {
  name: form.value.name,
  price: form.value.price,
  image: form.value.image,
  category: form.value.category,
  badge: form.value.badge || null,
  stock: form.value.stock,
  featured: form.value.featured,
  pre_order_allowed: form.value.pre_order_allowed,
  prep_days: Math.max(0, Number(form.value.prep_days || 0)),
  delivery_restrictions: form.value.delivery_restrictions || '',
}

  if (editingId.value) {
    // Update
    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', editingId.value)
    if (error) {
      alert('Error updating product')
      return
    }
  } else {
    // Insert
    const { error } = await supabase
      .from('products')
      .insert([payload])
    if (error) {
      alert('Error creating product')
      return
    }
  }

  resetForm()
  loadProducts()
}

function editProduct(product: Product) {
  editingId.value = product.id
  form.value = {
    ...product,
    pre_order_allowed: product.pre_order_allowed ?? true,
    prep_days: product.prep_days ?? 5,
    delivery_restrictions: product.delivery_restrictions ?? '',
  }
  showForm.value = true
}

async function deleteProduct(id: string) {
  if (!confirm('Delete this product?')) return
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) {
    alert('Error deleting product')
    return
  }
  loadProducts()
}

async function adjustStock(product: Product, delta: number) {
  const nextStock = Math.max(0, Number(product.stock || 0) + delta)
  const { error } = await supabase
    .from('products')
    .update({ stock: nextStock })
    .eq('id', product.id)

  if (error) {
    alert('Error updating stock')
    return
  }

  product.stock = nextStock
}

function stockLabel(stock: number) {
  if (stock <= 0) return 'Out'
  if (stock <= 3) return 'Low'
  return 'In stock'
}

function stockClass(stock: number) {
  return {
    'stock-pill': true,
    'stock-out': stock <= 0,
    'stock-low': stock > 0 && stock <= 3,
    'stock-ok': stock > 3,
  }
}

function resetForm() {
  editingId.value = null
  form.value = {
    name: '',
    price: 0,
    image: '',
    category: 'Romance',
    badge: null,
    stock: 10,
    featured: false,
    pre_order_allowed: true,
    prep_days: 5,
    delivery_restrictions: '',
  }
    showForm.value = false
}

onMounted(() => {
  loadProducts()
})



const draggedIndex = ref<number | null>(null)

function dragStart(index: number) {
  draggedIndex.value = index
}

function dragOver(index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) return
  
  const draggedItem = products.value[draggedIndex.value]
  products.value.splice(draggedIndex.value, 1)
  products.value.splice(index, 0, draggedItem)
  draggedIndex.value = index
}

function dragDrop(index: number) {
  // Drop happens, will save in dragEnd
}

async function dragEnd() {
  // Save new order to Supabase
  for (let i = 0; i < products.value.length; i++) {
    await supabase
      .from('products')
      .update({ order: i })
      .eq('id', products.value[i].id)
  }
  draggedIndex.value = null
}
</script>

<template>
  <div class="products-page">
    <div class="products-header">
      <h2>Product Inventory</h2>
      <button class="btn-primary" @click="showForm = !showForm">
        {{ showForm ? 'Cancel' : '+ Add Product' }}
      </button>
    </div>

    <!-- Form -->
    <div v-if="showForm" class="product-form">
      <h3>{{ editingId ? 'Edit Product' : 'New Product' }}</h3>
      <div class="form-group">
        <label>Name *</label>
        <input v-model="form.name" type="text" placeholder="Product name" />
      </div>
      <div class="form-group">
        <label>Price *</label>
        <input v-model.number="form.price" type="number" placeholder="0" />
      </div>
      <div class="form-group">
        <label>Product Image</label>
        <div v-if="form.image" class="product-image-preview">
          <img :src="form.image" :alt="form.name || 'Product preview'" />
        </div>
        <div class="product-upload-row">
          <button class="btn-small" type="button" :disabled="uploadingImage" @click="productImageInput?.click()">
            {{ uploadingImage ? 'Uploading...' : 'Upload Bouquet Photo' }}
          </button>
          <input
            ref="productImageInput"
            type="file"
            accept="image/*"
            class="hidden-file-input"
            @change="uploadProductImage"
          />
          <span v-if="uploadingImage" class="upload-note">Optimizing image for faster loading...</span>
        </div>
        <input v-model="form.image" type="url" placeholder="Uploaded image URL" />
      </div>
      <div class="form-group">
        <label>Category</label>
        <select v-model="form.category">
          <option>Romance</option>
          <option>Birthday</option>
          <option>Sympathy</option>
          <option>Celebration</option>
        </select>
      </div>
      <div class="form-group">
        <label>Badge</label>
        <input v-model="form.badge" type="text" placeholder="Best Seller, New, etc." />
      </div>
      <div class="form-group">
        <label>Stock</label>
        <input v-model.number="form.stock" type="number" placeholder="10" />
      </div>
      <div class="form-group checkbox">
        <label>
          <input v-model="form.pre_order_allowed" type="checkbox" />
          Allow pre-order when stock is 0
        </label>
      </div>
      <div class="form-group">
        <label>Prep Days</label>
        <input v-model.number="form.prep_days" type="number" min="0" placeholder="5" />
      </div>
      <div class="form-group">
        <label>Delivery Restrictions</label>
        <input v-model="form.delivery_restrictions" type="text" placeholder="Example: Metro Manila only" />
      </div>
      <div class="form-group checkbox">
        <label>
          <input v-model="form.featured" type="checkbox" />
          Featured on homepage
        </label>
      </div>
      <button class="btn-primary" style="width: 100%; margin-top: 16px" @click="saveProduct">
        {{ editingId ? 'Update' : 'Create' }} Product
      </button>
    </div>

    <!-- Products Table -->
<div class="products-table">
  <div v-if="loading" class="loading">Loading products...</div>
  <table v-else>
    <thead>
      <tr>
        <th style="width: 40px">⋮</th>
        <th>Image</th>
        <th>Name</th>
        <th>Category</th>
        <th>Price</th>
        <th>Stock</th>
        <th>Availability</th>
        <th>Featured</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(product, index) in products"
        :key="product.id"
        draggable="true"
        @dragstart="dragStart(index)"
        @dragover.prevent="dragOver(index)"
        @drop="dragDrop(index)"
        @dragend="dragEnd"
        :class="{ 'dragging': draggedIndex === index }"
      >
        <td style="cursor: grab; text-align: center">⋮</td>
        <td><img v-if="product.image" :src="product.image" :alt="product.name" class="product-thumb" /><span v-else class="no-proof">No image</span></td>
        <td><strong>{{ product.name }}</strong></td>
        <td>{{ product.category }}</td>
        <td>₱{{ product.price.toLocaleString() }}</td>
        <td>
          <div class="stock-control">
            <button class="stock-stepper" @click="adjustStock(product, -1)">-</button>
            <strong>{{ product.stock }}</strong>
            <button class="stock-stepper" @click="adjustStock(product, 1)">+</button>
            <span :class="stockClass(product.stock)">{{ stockLabel(product.stock) }}</span>
          </div>
        </td>
        <td>
          <div class="availability-cell">
            <span :class="['stock-pill', product.pre_order_allowed ? 'stock-ok' : 'stock-out']">
              {{ product.pre_order_allowed ? 'Pre-order allowed' : 'No pre-order' }}
            </span>
            <small>{{ product.prep_days ?? 5 }} day{{ (product.prep_days ?? 5) === 1 ? '' : 's' }} prep</small>
            <small v-if="product.delivery_restrictions">{{ product.delivery_restrictions }}</small>
          </div>
        </td>
        <td>{{ product.featured ? '✓' : '—' }}</td>
        <td>
          <button class="btn-small" @click="editProduct(product)">Edit</button>
          <button class="btn-small btn-danger" @click="deleteProduct(product.id)">Delete</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
  </div>
</template>
