<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { supabase } from '@/supabaseClient'

type DeliverySlot = {
  delivery_date: string
  max_deliveries: number
  booked_deliveries: number
  remaining_slots: number
  is_full: boolean
  is_limited: boolean
}

const loading = ref(false)
const saving = ref(false)
const slots = ref<DeliverySlot[]>([])
const selectedDate = ref('')
const statusMessage = ref('')
const formPanel = ref<HTMLElement | null>(null)
const maxInput = ref<HTMLInputElement | null>(null)
const form = ref({
  date: '',
  max: 5,
})

const minDate = computed(() => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
})

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

async function loadSlots() {
  loading.value = true
  const upcoming = Array.from({ length: 14 }, (_, index) => dateAfter(index + 1))
  const loaded: DeliverySlot[] = []

  for (const date of upcoming) {
    const { data, error } = await supabase.rpc('get_delivery_date_availability', {
      p_delivery_date: date,
    })
    if (!error && data?.[0]) loaded.push(data[0])
  }

  slots.value = loaded
  loading.value = false
}

async function saveCapacity() {
  if (!form.value.date) return
  saving.value = true
  statusMessage.value = ''
  const { error } = await supabase.rpc('set_delivery_date_capacity', {
    p_delivery_date: form.value.date,
    p_max_deliveries: form.value.max,
  })
  saving.value = false

  if (error) {
    alert('Failed to save delivery capacity. Please apply the latest Supabase migration.')
    return
  }

  selectedDate.value = form.value.date
  statusMessage.value = `Saved ${form.value.max} max deliveries for ${form.value.date}.`
  await loadSlots()
}

async function useSlot(slot: DeliverySlot) {
  form.value.date = slot.delivery_date
  form.value.max = slot.max_deliveries
  selectedDate.value = slot.delivery_date
  statusMessage.value = `Editing ${slot.delivery_date}. Change max deliveries, then save.`

  await nextTick()
  formPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  maxInput.value?.focus()
  maxInput.value?.select()
}

onMounted(() => {
  form.value.date = minDate.value
  loadSlots()
})
</script>

<template>
  <div class="delivery-capacity-page">
    <div class="products-header">
      <div>
        <h2>Delivery Slots</h2>
        <p class="capacity-subtitle">Set how many deliveries Stack Petals can accept per day.</p>
      </div>
    </div>

    <div ref="formPanel" class="capacity-form" :class="{ editing: selectedDate === form.date }">
      <label>
        Delivery Date
        <input v-model="form.date" type="date" :min="minDate" />
      </label>
      <label>
        Max Deliveries
        <input ref="maxInput" v-model.number="form.max" type="number" min="0" />
      </label>
      <button class="btn-primary capacity-save-btn" :disabled="saving || !form.date" @click="saveCapacity">
        {{ saving ? 'Saving...' : 'Save Capacity' }}
      </button>
      <p v-if="statusMessage" class="capacity-status">{{ statusMessage }}</p>
    </div>

    <div class="products-table">
      <div v-if="loading" class="loading">Loading delivery slots...</div>
      <table v-else>
        <thead>
          <tr>
            <th>Date</th>
            <th>Max</th>
            <th>Booked</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in slots" :key="slot.delivery_date" :class="{ 'selected-slot-row': selectedDate === slot.delivery_date }">
            <td>{{ slot.delivery_date }}</td>
            <td>{{ slot.max_deliveries }}</td>
            <td>{{ slot.booked_deliveries }}</td>
            <td>{{ slot.remaining_slots }}</td>
            <td>
              <span :class="['stock-pill', slot.is_full ? 'stock-out' : slot.is_limited ? 'stock-low' : 'stock-ok']">
                {{ slot.is_full ? 'Full' : slot.is_limited ? 'Limited slots' : 'Available' }}
              </span>
            </td>
            <td>
              <button class="btn-small" type="button" @click="useSlot(slot)">
                {{ selectedDate === slot.delivery_date ? 'Editing' : 'Edit' }}
              </button>
            </td>
          </tr>
          <tr v-if="slots.length === 0">
            <td colspan="6">
              <div class="empty-state">
                <p>No delivery slot data yet. Apply the delivery capacity migration first.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
