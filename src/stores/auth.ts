// src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/supabaseClient'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const initialized = ref(false)
  let initPromise: Promise<void> | null = null

  async function initAuth() {
    if (initPromise) return initPromise

    initPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      loggedIn.value = Boolean(data.session)
      initialized.value = true

      supabase.auth.onAuthStateChange((_event, session) => {
        loggedIn.value = Boolean(session)
      })
    })()

    return initPromise
  }

  async function login(email: string, password: string): Promise<string> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    loggedIn.value = true
    return ''
  }

  async function logout() {
    await supabase.auth.signOut()
    loggedIn.value = false
  }

  return { loggedIn, initialized, initAuth, login, logout }
})
