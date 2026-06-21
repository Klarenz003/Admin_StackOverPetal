// src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // TODO: Replace with Supabase Auth
  // import { supabase } from '@/lib/supabase'
  // const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  const loggedIn = ref(false)

  function login(username: string, password: string): string {
    // Temporary hardcoded check — swap for Supabase Auth when ready
    if (username === 'admin' && password === 'admin') {
      loggedIn.value = true
      return ''
    }
    return 'Incorrect username or password.'
  }

  function logout() {
    loggedIn.value = false
  }

  return { loggedIn, login, logout }
})
