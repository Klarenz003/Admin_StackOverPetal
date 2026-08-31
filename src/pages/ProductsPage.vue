<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '@/supabaseClient'
import { useAdminStore } from '@/stores/admin'

const admin = useAdminStore()

interface Product {
  id: string
  marketProductId: string
  name: string
  price: number
  sale_price: number | null
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

const productCategoryOptions = [
  'Romance',
  'Birthday',
  'Anniversary',
  'Celebration',
  'Sympathy',
  'Graduation',
  'Thank You',
  'Apology',
  'Get Well',
  'Friendship',
  'Home Decor',
  'Keepsakes',
  'Accessories',
  'Custom Gifts',
]

const form = ref({
  name: '',
  price: 0,
  sale_price: null as number | null,
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
    .from('product_markets')
    .select('id, product_id, price, sale_price, stock, featured, pre_order_allowed, prep_days, delivery_restrictions, sort_order, products(name, image, category, badge)')
    .eq('market_code', admin.effectiveMarket)
    .order('sort_order', { ascending: true })
  products.value = (data || []).map((row: any) => ({
    id: row.product_id,
    marketProductId: row.id,
    name: row.products?.name || '',
    image: row.products?.image || '',
    category: row.products?.category || 'Romance',
    badge: row.products?.badge || null,
    price: Number(row.price || 0),
    sale_price: row.sale_price === null ? null : Number(row.sale_price),
    stock: Number(row.stock || 0),
    featured: !!row.featured,
    pre_order_allowed: row.pre_order_allowed ?? true,
    prep_days: row.prep_days ?? 5,
    delivery_restrictions: row.delivery_restrictions || '',
  }))
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

const sharedPayload = {
  name: form.value.name,
  price: form.value.price,
  image: form.value.image,
  category: form.value.category,
  badge: form.value.badge || null,
  stock: form.value.stock,
}
const marketPayload = {
  market_code: admin.effectiveMarket,
  price: form.value.price,
  sale_price: form.value.sale_price && form.value.sale_price > 0 ? form.value.sale_price : null,
  stock: form.value.stock,
  featured: form.value.featured,
  pre_order_allowed: form.value.pre_order_allowed,
  prep_days: Math.max(0, Number(form.value.prep_days || 0)),
  delivery_restrictions: form.value.delivery_restrictions || '',
}

  if (editingId.value) {
    // Update
    const { error: productError } = await supabase
      .from('products')
      .update(sharedPayload)
      .eq('id', editingId.value)
    const marketProduct = products.value.find(product => product.id === editingId.value)
    const { error: marketError } = await supabase
      .from('product_markets')
      .update(marketPayload)
      .eq('id', marketProduct?.marketProductId || '')
    if (productError || marketError) {
      alert('Error updating product')
      return
    }
  } else {
    // Insert
    const { data: createdProduct, error } = await supabase
      .from('products')
      .insert([sharedPayload])
      .select('id')
      .single()
    if (error || !createdProduct) {
      alert('Error creating product')
      return
    }
    const { error: marketError } = await supabase.from('product_markets').insert({
      ...marketPayload,
      product_id: createdProduct.id,
      active: true,
    })
    if (marketError) {
      alert('Product created, but its market availability could not be saved')
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
    sale_price: product.sale_price ?? null,
    pre_order_allowed: product.pre_order_allowed ?? true,
    prep_days: product.prep_days ?? 5,
    delivery_restrictions: product.delivery_restrictions ?? '',
  }
  showForm.value = true
}

async function deleteProduct(id: string) {
  if (!confirm(`Remove this product from the ${admin.marketLabel} store?`)) return
  const product = products.value.find(item => item.id === id)
  const { error } = await supabase.from('product_markets').delete().eq('id', product?.marketProductId || '')
  if (error) {
    alert('Error deleting product')
    return
  }
  loadProducts()
}

async function adjustStock(product: Product, delta: number) {
  const nextStock = Math.max(0, Number(product.stock || 0) + delta)
  const { error } = await supabase
    .from('product_markets')
    .update({ stock: nextStock })
    .eq('id', product.marketProductId)

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

const categoryOptions = computed(() => {
  const savedCategories = products.value
    .map(product => product.category?.trim())
    .filter((category): category is string => Boolean(category))

  return Array.from(new Set([...productCategoryOptions, ...savedCategories]))
})

function resetForm() {
  editingId.value = null
  form.value = {
    name: '',
    price: 0,
    sale_price: null,
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
watch(() => admin.effectiveMarket, () => { resetForm(); loadProducts() })



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
      .from('product_markets')
      .update({ sort_order: i })
      .eq('id', products.value[i].marketProductId)
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
        <input v-model.number="form.price" type="number" min="0" placeholder="0" />
      </div>
      <div class="form-group">
        <label>Sale Price</label>
        <input v-model.number="form.sale_price" type="number" min="0" placeholder="Leave empty if not on sale" />
      </div>
      <div class="form-group">
        <label>Product Image</label>
        <div v-if="form.image" class="product-image-preview">
          <img :src="form.image" :alt="form.name || 'Product preview'" />
        </div>
        <div class="product-upload-row">
          <button class="btn-small" type="button" :disabled="uploadingImage" @click="productImageInput?.click()">
            {{ uploadingImage ? 'Uploading...' : 'Upload Product Photo' }}
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
          <option v-for="category in categoryOptions" :key="category" :value="category">{{ category }}</option>
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
        <td>
          <div v-if="product.sale_price && product.sale_price > 0 && product.sale_price < product.price" class="admin-sale-price">
            <strong>{{ admin.formatMoney(product.sale_price) }}</strong>
            <span>{{ admin.formatMoney(product.price) }}</span>
          </div>
          <span v-else>{{ admin.formatMoney(product.price) }}</span>
        </td>
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
