<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/supabaseClient'
import { PhLockKey, PhX } from '@phosphor-icons/vue'
const props = defineProps<{ code: { id: string; product_name: string; status: string; letter_id?: string | null } }>()
const emit = defineEmits<{ close: []; completed: [message: string] }>()
const action = ref('reset'), password = ref(''), confirmation = ref(''), busy = ref(false), error = ref('')
const dialog = ref<HTMLElement | null>(null)
const choices = computed(() => [
  { value: 'reset', title: 'Reset activation', body: 'Keep the same printed QR and activation code. The sender must activate it again.', disabled: !!props.code.letter_id || !['unused','claimed'].includes(props.code.status) },
  { value: 'remove_letter', title: 'Remove letter & reset', body: 'Permanently erase the letter, its photos, password and remembered access. Keep the printed card for reuse.', disabled: !props.code.letter_id },
  { value: 'revoke', title: 'Disable this QR', body: 'Stop the public link from working without deleting its letter.', disabled: props.code.status === 'revoked' },
  { value: 'delete', title: 'Permanently delete QR & letter', body: 'Erase this card and any attached letter. Its printed QR will stop working permanently.', disabled: false },
])
const selected = computed(() => choices.value.find(choice => choice.value === action.value)!)
let previousFocus: HTMLElement | null = null, previousOverflow = ''
onMounted(async () => {
  action.value = choices.value.find(choice => !choice.disabled)?.value || 'delete'
  previousFocus = document.activeElement as HTMLElement; previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'; await nextTick(); dialog.value?.focus()
})
onBeforeUnmount(() => { password.value = ''; document.body.style.overflow = previousOverflow; previousFocus?.focus() })
function close() { if (!busy.value) emit('close') }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key !== 'Tab') return
  const elements = [...(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)') || [])]
  const first = elements[0], last = elements[elements.length-1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.value)) { event.preventDefault(); first?.focus() }
}
async function submit() {
  if (busy.value || !password.value || selected.value.disabled || confirmation.value !== 'CONFIRM') return
  busy.value = true; error.value = ''
  // Separate, in-memory sign-in: never replace or persist the dashboard session.
  const verifier = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'gift-qr-owner-confirmation' },
  })
  try {
    const { data: current, error: userError } = await supabase.auth.getUser()
    if (userError || !current.user?.email) throw new Error('Your admin session expired. Sign in again.')
    const { data, error: authError } = await verifier.auth.signInWithPassword({ email: current.user.email, password: password.value })
    password.value = ''
    if (authError || !data.user) throw new Error('Password could not be confirmed. Check it and try again.')
    if (data.user.id !== current.user.id) throw new Error('Confirm using the signed-in owner account.')
    const { data: done, error: rpcError } = await verifier.rpc('manage_gift_qr', { p_qr_id: props.code.id, p_action: action.value })
    if (rpcError || done !== true) throw new Error(rpcError?.code === 'PGRST202' ? 'Management is not installed yet. Apply the admin migration first.' : rpcError?.message || 'The action could not be completed.')
    emit('completed', action.value === 'delete' ? 'Gift QR and its attached letter permanently deleted.' : action.value === 'remove_letter' ? 'Letter permanently deleted. Card is ready for activation again.' : action.value === 'revoke' ? 'Gift QR disabled. Its public link no longer works.' : 'Activation reset. The sender must activate this card again.')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not confirm the action.' }
  finally { password.value = ''; await verifier.auth.signOut({ scope: 'local' }).catch(() => {}); busy.value = false }
}
</script>
<template>
  <Teleport to="body">
    <div class="qr-manage-overlay" @click.self="close" @keydown="keydown">
      <section ref="dialog" class="qr-manage" role="dialog" aria-modal="true" aria-labelledby="qr-manage-title" tabindex="-1">
        <header><div><p>OWNER ONLY · PROTECTED ACTIONS</p><h2 id="qr-manage-title">Manage this keepsake.</h2></div><button type="button" aria-label="Close management" :disabled="busy" @click="close"><PhX :size="22" /></button></header>
        <p class="qr-manage-product">{{ code.product_name }} · {{ code.status }} <small>Card {{ code.id.slice(-8) }}</small></p>
        <form @submit.prevent="submit">
          <fieldset :disabled="busy"><legend>Choose what happens to this card</legend>
            <label v-for="choice in choices" :key="choice.value" class="qr-action" :class="{ selected: action === choice.value, unavailable: choice.disabled }"><input v-model="action" type="radio" :value="choice.value" :disabled="choice.disabled" @change="confirmation = ''; error = ''" /><span><strong>{{ choice.title }}</strong><small>{{ choice.body }}</small></span></label>
            <p class="qr-manage-warning">{{ action === 'delete' || action === 'remove_letter' ? 'Permanent deletion cannot be undone. Export or retain any needed records first.' : 'This affects the customer’s access. Reset is not a fix for a mismatched activation code.' }}</p>
            <label class="qr-manage-field"><span><PhLockKey :size="16" />Your admin login password</span><input v-model="password" type="password" autocomplete="current-password" required placeholder="Confirm your owner password" /></label>
            <label class="qr-manage-field">Type CONFIRM to continue<input v-model="confirmation" autocomplete="off" spellcheck="false" required placeholder="CONFIRM" /></label>
          </fieldset>
          <p v-if="error" role="alert" class="qr-manage-error">{{ error }}</p>
          <footer><button type="button" :disabled="busy" @click="close">Cancel</button><button type="submit" :disabled="busy || !password || confirmation !== 'CONFIRM' || selected.disabled">{{ busy ? 'Verifying & applying…' : selected.title }}</button></footer>
          <p class="qr-manage-hint">Password verified for this action only. Never saved or sent to a letter recipient.</p>
        </form>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.qr-manage-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:20px;background:#282320ba;backdrop-filter:blur(6px)}
.qr-manage{width:min(580px,100%);max-height:90dvh;overflow:auto;border:1px solid #ead8cc;border-radius:24px;background:#fffaf5;padding:26px;color:#523f36;box-shadow:0 24px 80px #20161444}
.qr-manage{scrollbar-width:none}
.qr-manage::-webkit-scrollbar{display:none;width:0;height:0}
header{display:flex;justify-content:space-between;align-items:center;gap:12px}header p{font-size:10px;letter-spacing:.14em;color:#8a6957}h2{font:normal 28px/1.2 Georgia,serif;margin:8px 0}header button{background:white;border:1px solid #e5d7cc;border-radius:50%;padding:10px;display:flex;color:inherit}
.qr-manage-product{font-size:14px}.qr-manage-product small{display:block;color:#8b786b;margin-top:4px}fieldset{border:0;padding:0;margin:22px 0 0}legend{font-size:12px;margin-bottom:10px}
.qr-action{display:flex;align-items:flex-start;gap:12px;padding:14px;margin:8px 0;border:1px solid #e6d7cc;border-radius:14px;background:#fff}.qr-action.selected{border-color:#8baf96;background:#eef4ed}.qr-action.unavailable{opacity:.5}.qr-action input{margin-top:4px;accent-color:#5f8872}.qr-action strong{font-size:14px;font-weight:600}.qr-action small{display:block;font-size:12px;line-height:1.6;margin-top:5px;color:#75665a}
.qr-manage-warning{font-size:12px;line-height:1.7;background:#f8eae3;border-radius:10px;padding:12px;color:#834e3c}.qr-manage-field{display:grid;gap:8px;font-size:12px;margin:16px 0}.qr-manage-field span{display:flex;gap:6px;align-items:center}.qr-manage-field input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #e1cec0;border-radius:10px;background:white;color:#523f36;font-size:16px}
footer{display:flex;gap:10px;margin-top:20px}footer button{padding:13px 16px;min-height:46px;border:1px solid #e1cec0;background:white;border-radius:12px;color:inherit;cursor:pointer}footer button[type=submit]{flex:1;background:#754e40;color:white;border-color:#754e40}button:disabled{opacity:.5;cursor:not-allowed}.qr-manage-hint{font-size:11px;line-height:1.6;color:#817265}.qr-manage-error{color:#9c343c;font-size:13px;line-height:1.6}input:focus-visible,button:focus-visible{outline:2px solid #5f8872;outline-offset:3px}
@media(max-width:600px){.qr-manage-overlay{padding:12px}.qr-manage{padding:20px;max-height:92dvh}h2{font-size:25px}}
</style>
