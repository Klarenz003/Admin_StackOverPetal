// src/stores/auth.ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/supabaseClient'

export type AdminMarket = 'PH' | 'CA' | 'ALL'

type AdminProfile = {
  id: string
  fullName: string
  email: string
  role: string
  adminMarket: AdminMarket | null
}

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const initialized = ref(false)
  const profile = ref<AdminProfile | null>(null)
  let initPromise: Promise<void> | null = null

  async function initAuth() {
    if (initPromise) return initPromise

    initPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      loggedIn.value = Boolean(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      initialized.value = true

      supabase.auth.onAuthStateChange(async (_event, session) => {
        loggedIn.value = Boolean(session)
        profile.value = session?.user ? await fetchProfile(session.user.id) : null
      })
    })()

    return initPromise
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('investor_profiles')
      .select('id, full_name, email, role, admin_market')
      .eq('id', userId)
      .maybeSingle()

    if (!data) return null
    return {
      id: data.id,
      fullName: data.full_name || '',
      email: data.email || '',
      role: data.role || '',
      adminMarket: data.admin_market as AdminMarket | null,
    }
  }

  async function loadProfile(userId: string) {
    profile.value = await fetchProfile(userId)
  }

  async function login(email: string, password: string): Promise<string> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    if (!data.user) return 'Could not verify this admin account.'
    await loadProfile(data.user.id)
    if (profile.value?.role !== 'admin' || !profile.value.adminMarket) {
      await supabase.auth.signOut()
      profile.value = null
      loggedIn.value = false
      return 'This account does not have Stack Petals admin access.'
    }
    loggedIn.value = true
    return ''
  }

  async function logout() {
    await supabase.auth.signOut()
    loggedIn.value = false
    profile.value = null
  }

  const isAdmin = computed(() => profile.value?.role === 'admin' && Boolean(profile.value.adminMarket))
  const isOwner = computed(() => isAdmin.value && profile.value?.adminMarket === 'ALL')
  const marketCode = computed(() => profile.value?.adminMarket || null)
  const marketLabel = computed(() => marketCode.value === 'CA' ? 'Canada' : marketCode.value === 'PH' ? 'Philippines' : 'All markets')

  return { loggedIn, initialized, profile, isAdmin, isOwner, marketCode, marketLabel, initAuth, login, logout, loadProfile }
})
