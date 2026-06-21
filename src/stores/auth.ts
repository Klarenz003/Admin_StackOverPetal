// src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/supabaseClient'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)

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

  return { loggedIn, login, logout }
})