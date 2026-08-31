<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/supabaseClient'

type MarketCode = 'PH' | 'CA'
type StaffAccount = {
  id: string
  full_name: string
  email: string
  phone: string
  admin_market: MarketCode | 'ALL'
  created_at: string
}

const staff = ref<StaffAccount[]>([])
const loading = ref(false)
const creating = ref(false)
const error = ref('')
const success = ref('')
const form = reactive({
  fullName: '', email: '', phone: '', password: '', confirmPassword: '', adminMarket: 'PH' as MarketCode,
})

const canSubmit = computed(() => Boolean(
  form.fullName.trim() && form.email.trim() && form.password.length >= 8
  && form.password === form.confirmPassword && !creating.value
))

async function loadStaff() {
  loading.value = true
  error.value = ''
  const { data, error: loadError } = await supabase
    .from('investor_profiles')
    .select('id, full_name, email, phone, admin_market, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: false })
  loading.value = false
  if (loadError) { error.value = loadError.message; return }
  staff.value = (data || []) as StaffAccount[]
}

async function readableFunctionError(err: unknown) {
  if (err && typeof err === 'object' && 'context' in err) {
    const response = (err as { context?: Response }).context
    if (response) {
      try {
        const payload = await response.clone().json()
        if (payload?.error) return String(payload.error)
      } catch { /* Use the normal error message below. */ }
    }
  }
  return err instanceof Error ? err.message : 'Could not create the admin account.'
}

async function createStaffAccount() {
  error.value = ''
  success.value = ''
  if (!canSubmit.value) return
  creating.value = true
  try {
    const { data, error: functionError } = await supabase.functions.invoke('create-investor-access', {
      body: {
        accountType: 'admin', adminMarket: form.adminMarket,
        fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(), password: form.password,
      },
    })
    if (functionError) throw functionError
    success.value = `${form.adminMarket === 'CA' ? 'Canada' : 'Philippines'} admin access ${data?.restored ? 'restored' : 'created'}.`
    form.fullName = ''; form.email = ''; form.phone = ''; form.password = ''; form.confirmPassword = ''
    await loadStaff()
  } catch (err) {
    error.value = await readableFunctionError(err)
  } finally { creating.value = false }
}

function marketName(market: StaffAccount['admin_market']) {
  if (market === 'ALL') return 'Owner - All markets'
  return market === 'CA' ? 'Canada only' : 'Philippines only'
}

onMounted(loadStaff)
</script>

<template>
  <section class="investor-access-page">
    <div class="section-card investor-access-card">
      <div class="section-header"><div><h3>Create Market Admin</h3><small>Each account can access orders from one country only.</small></div></div>
      <form class="investor-access-form" @submit.prevent="createStaffAccount">
        <label>Admin Name<input v-model="form.fullName" type="text" placeholder="Full name" required /></label>
        <label>Assigned Store<select v-model="form.adminMarket" required><option value="PH">Philippines</option><option value="CA">Canada</option></select></label>
        <label>Email<input v-model="form.email" type="email" placeholder="admin@email.com" required /></label>
        <label>Phone<input v-model="form.phone" type="tel" placeholder="Optional contact number" /></label>
        <label>Password<input v-model="form.password" type="password" minlength="8" autocomplete="new-password" required /></label>
        <label>Confirm Password<input v-model="form.confirmPassword" type="password" minlength="8" autocomplete="new-password" required /></label>
        <button class="save-btn investor-create-btn" type="submit" :disabled="!canSubmit">{{ creating ? 'Creating account...' : 'Create Admin Account' }}</button>
      </form>
      <p v-if="error" class="investor-access-error">{{ error }}</p>
      <p v-if="success" class="investor-access-success">{{ success }}</p>
    </div>

    <div class="section-card">
      <div class="section-header"><div><h3>Admin Accounts</h3><small>Market restrictions are enforced by Supabase.</small></div><button class="refresh-btn" type="button" @click="loadStaff">Refresh</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Store Access</th><th>Created</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="4" class="empty-cell">Loading admin accounts...</td></tr>
          <tr v-else-if="!staff.length"><td colspan="4" class="empty-cell">No admin accounts found.</td></tr>
          <tr v-for="account in staff" v-else :key="account.id">
            <td><div class="name-primary">{{ account.full_name || 'Unnamed admin' }}</div></td><td>{{ account.email }}</td>
            <td><span class="badge badge-standard">{{ marketName(account.admin_market) }}</span></td>
            <td class="date-cell">{{ new Date(account.created_at).toLocaleDateString() }}</td>
          </tr>
        </tbody>
      </table></div>
    </div>
  </section>
</template>
