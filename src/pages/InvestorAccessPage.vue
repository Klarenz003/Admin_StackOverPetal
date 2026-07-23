<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/supabaseClient'

interface InvestorProfile {
  id: string
  full_name: string
  email: string
  phone: string
  role: 'admin' | 'investor'
  created_at: string
}

const investors = ref<InvestorProfile[]>([])
const loading = ref(false)
const creating = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const canSubmit = computed(() =>
  form.fullName.trim()
  && form.email.trim()
  && form.password.length >= 8
  && form.password === form.confirmPassword
  && !creating.value
)

async function loadInvestors() {
  loading.value = true
  error.value = ''

  const { data, error: loadError } = await supabase
    .from('investor_profiles')
    .select('id, full_name, email, phone, role, created_at')
    .order('created_at', { ascending: false })

  loading.value = false

  if (loadError) {
    error.value = loadError.message
    return
  }

  investors.value = data || []
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const maybeError = err as { message?: string; msg?: string; details?: string; hint?: string }
    return maybeError.message || maybeError.msg || maybeError.details || maybeError.hint || 'Failed to create investor access.'
  }

  return 'Failed to create investor access.'
}

async function functionErrorMessage(err: unknown) {
  const context = err && typeof err === 'object' && 'context' in err
    ? (err as { context?: Response }).context
    : null

  if (context) {
    try {
      const result = await context.clone().json()
      if (result?.error) return String(result.error)
    } catch {
      try {
        const text = await context.clone().text()
        if (text) return text
      } catch {
        // Fall through to the normal error message.
      }
    }
  }

  return errorMessage(err)
}

async function createInvestorAccess() {
  error.value = ''
  success.value = ''

  if (!form.fullName.trim()) {
    error.value = 'Investor name is required.'
    return
  }

  if (!form.email.trim()) {
    error.value = 'Investor email is required.'
    return
  }

  if (form.password.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }

  if (form.password !== form.confirmPassword) {
    error.value = 'Passwords do not match.'
    return
  }

  if (investors.value.some(investor => investor.email.toLowerCase() === form.email.trim().toLowerCase())) {
    error.value = 'This email already has investor portal access. Use a different investor email.'
    return
  }

  creating.value = true

  try {
    const { error: functionError } = await supabase.functions.invoke('create-investor-access', {
      body: {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      },
    })

    if (functionError) throw functionError

    success.value = 'Investor access created. They can now sign in to the investor portal.'
    form.fullName = ''
    form.email = ''
    form.phone = ''
    form.password = ''
    form.confirmPassword = ''
    await loadInvestors()
  } catch (err) {
    error.value = await functionErrorMessage(err)
  } finally {
    creating.value = false
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

onMounted(loadInvestors)
</script>

<template>
  <section class="investor-access-page">
    <div class="section-card investor-access-card">
      <div class="section-header">
        <div>
          <h3>Create Investor Login</h3>
          <small>Password is required every time you create an investor account.</small>
        </div>
      </div>

      <form class="investor-access-form" @submit.prevent="createInvestorAccess">
        <label>
          Investor Name
          <input v-model="form.fullName" type="text" placeholder="Full name" required />
        </label>

        <label>
          Email
          <input v-model="form.email" type="email" placeholder="investor@email.com" required />
        </label>

        <label>
          Phone
          <input v-model="form.phone" type="tel" placeholder="Optional contact number" />
        </label>

        <label>
          Password
          <input
            v-model="form.password"
            type="password"
            minlength="8"
            autocomplete="new-password"
            placeholder="Minimum 8 characters"
            required
          />
        </label>

        <label>
          Confirm Password
          <input
            v-model="form.confirmPassword"
            type="password"
            minlength="8"
            autocomplete="new-password"
            placeholder="Repeat password"
            required
          />
        </label>

        <button class="save-btn investor-create-btn" type="submit" :disabled="!canSubmit">
          {{ creating ? 'Creating access...' : 'Create Investor Access' }}
        </button>
      </form>

      <p v-if="error" class="investor-access-error">{{ error }}</p>
      <p v-if="success" class="investor-access-success">{{ success }}</p>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div>
          <h3>Investor Accounts</h3>
          <small>Accounts allowed to sign in to the investor portal.</small>
        </div>
        <button class="refresh-btn" @click="loadInvestors">Refresh</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="empty-cell">Loading investor accounts...</td>
            </tr>
            <tr v-else-if="!investors.length">
              <td colspan="5" class="empty-cell">No investor accounts yet.</td>
            </tr>
            <tr v-for="investor in investors" v-else :key="investor.id">
              <td>
                <div class="name-primary">{{ investor.full_name || 'Unnamed investor' }}</div>
                <div class="id-code">{{ investor.id }}</div>
              </td>
              <td>{{ investor.email }}</td>
              <td>{{ investor.phone || '-' }}</td>
              <td>
                <span class="badge" :class="investor.role === 'admin' ? 'badge-verified' : 'badge-standard'">
                  {{ investor.role }}
                </span>
              </td>
              <td class="date-cell">{{ formatDate(investor.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
