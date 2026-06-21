<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const auth   = useAuthStore()
const admin  = useAdminStore()

const username   = ref('')
const password   = ref('')
const loginError = ref('')

function login() {
  const err = auth.login(username.value, password.value)
  if (err) {
    loginError.value = err
  } else {
    admin.loadData()
    admin.startAutoRefresh()
    router.push('/overview')
  }
}
</script>

<template>
  <div class="login-screen">
    <div class="login-card">
      <div class="brand">
        <h1>🌸 Stack Petals</h1>
        <p>Admin Dashboard</p>
      </div>

      <label>Username</label>
      <input
        v-model="username"
        type="text"
        placeholder="admin"
        @keyup.enter="login"
      />

      <label>Password</label>
      <input
        v-model="password"
        type="password"
        placeholder="••••••••"
        @keyup.enter="login"
      />

      <button class="login-btn" @click="login">Sign In</button>
      <p class="login-error" v-if="loginError">{{ loginError }}</p>
      <p class="login-hint">@2026 Stack Petals</p>
    </div>
  </div>
</template>
