<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { supabase } from '@/supabaseClient'

interface Expense { id: string; expense_date: string; category: string; description: string; amount: number; note: string }
interface RevenueOrder { total: string | number; status: string }
const categories = ['Materials', 'Packaging', 'Labor', 'Delivery', 'Marketing', 'Utilities', 'Equipment', 'Other']
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const expenses = ref<Expense[]>([])
const orders = ref<RevenueOrder[]>([])
const monthlyBudget = ref(0)
const loading = ref(false), saving = ref(false), errorMessage = ref('')
const form = reactive({ expense_date: new Date().toISOString().slice(0, 10), category: 'Materials', description: '', amount: 0, note: '' })
const monthStart = computed(() => `${selectedMonth.value}-01`)
const nextMonthStart = computed(() => { const d = new Date(`${monthStart.value}T00:00:00`); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10) })
const parseMoney = (value: string | number) => { const parsed = Number(String(value || '').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) ? parsed : 0 }
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
const revenue = computed(() => orders.value
  .filter(o => !['pending', 'rejected'].includes(String(o.status || '').toLowerCase()))
  .reduce((sum, o) => sum + parseMoney(o.total), 0))
const totalExpenses = computed(() => expenses.value.reduce((sum, e) => sum + Number(e.amount || 0), 0))
const netProfit = computed(() => revenue.value - totalExpenses.value)
const profitMargin = computed(() => revenue.value ? netProfit.value / revenue.value * 100 : 0)
const budgetRemaining = computed(() => monthlyBudget.value - totalExpenses.value)
const budgetUsed = computed(() => monthlyBudget.value ? Math.min(totalExpenses.value / monthlyBudget.value * 100, 100) : 0)

async function loadCosting() {
  loading.value = true; errorMessage.value = ''
  const [expenseResult, budgetResult, orderResult] = await Promise.all([
    supabase.from('business_expenses').select('*').gte('expense_date', monthStart.value).lt('expense_date', nextMonthStart.value).order('expense_date', { ascending: false }),
    supabase.from('business_budgets').select('amount').eq('month_start', monthStart.value).maybeSingle(),
    supabase.from('orders').select('total, status').gte('created_at', `${monthStart.value}T00:00:00`).lt('created_at', `${nextMonthStart.value}T00:00:00`),
  ])
  errorMessage.value = expenseResult.error?.message || budgetResult.error?.message || orderResult.error?.message || ''
  expenses.value = (expenseResult.data || []) as Expense[]; monthlyBudget.value = Number(budgetResult.data?.amount || 0); orders.value = (orderResult.data || []) as RevenueOrder[]; loading.value = false
}
async function saveBudget() { saving.value = true; const { error } = await supabase.from('business_budgets').upsert({ month_start: monthStart.value, amount: Math.max(Number(monthlyBudget.value || 0), 0), updated_at: new Date().toISOString() }); saving.value = false; if (error) errorMessage.value = error.message }
async function addExpense() {
  if (!form.description.trim() || Number(form.amount) <= 0) { errorMessage.value = 'Enter a description and an amount greater than zero.'; return }
  saving.value = true
  const { error } = await supabase.from('business_expenses').insert({ expense_date: form.expense_date, category: form.category, description: form.description.trim(), amount: Number(form.amount), note: form.note.trim() })
  saving.value = false
  if (error) { errorMessage.value = error.message; return }
  form.description = ''; form.amount = 0; form.note = ''; await loadCosting()
}
async function removeExpense(expense: Expense) { if (!confirm(`Remove "${expense.description}"?`)) return; const { error } = await supabase.from('business_expenses').delete().eq('id', expense.id); if (error) errorMessage.value = error.message; else expenses.value = expenses.value.filter(e => e.id !== expense.id) }
watch(selectedMonth, () => { form.expense_date = `${selectedMonth.value}-01`; loadCosting() })
onMounted(loadCosting)
</script>

<template><div class="costing-page">
  <div class="costing-toolbar"><div><h2>Business Costing</h2><p>Order revenue less recorded expenses for the selected month.</p></div><label class="costing-month">Month <input v-model="selectedMonth" type="month"></label></div>
  <p v-if="errorMessage" class="costing-error">{{ errorMessage }}</p><div v-if="loading" class="loading">Loading costing records...</div>
  <template v-else>
    <div class="costing-stats">
      <div class="costing-stat"><span>Revenue</span><strong>{{ money(revenue) }}</strong><small>verified payments only</small></div>
      <div class="costing-stat expense"><span>Recorded Expenses</span><strong>{{ money(totalExpenses) }}</strong><small>{{ expenses.length }} entries</small></div>
      <div class="costing-stat" :class="{ loss: netProfit < 0 }"><span>Estimated Net Profit</span><strong>{{ money(netProfit) }}</strong><small>{{ profitMargin.toFixed(1) }}% margin</small></div>
      <div class="costing-stat budget"><span>Budget Remaining</span><strong>{{ money(budgetRemaining) }}</strong><small>{{ budgetUsed.toFixed(0) }}% used</small></div>
    </div>
    <div class="costing-layout">
      <section class="section-card"><div class="section-header"><div><h3>Monthly Budget</h3><small>Spending limit for {{ selectedMonth }}</small></div></div><div class="costing-budget-form"><label>Budget amount <input v-model.number="monthlyBudget" min="0" step="100" type="number"></label><button class="btn-small" :disabled="saving" @click="saveBudget">Save Budget</button></div><div class="budget-track"><span :style="{ width: `${budgetUsed}%` }"></span></div><small class="budget-caption">{{ money(totalExpenses) }} spent of {{ money(monthlyBudget) }}</small></section>
      <section class="section-card"><div class="section-header"><div><h3>Add Expense</h3><small>Materials, labor, delivery, and overhead</small></div></div><form class="costing-expense-form" @submit.prevent="addExpense"><label>Date<input v-model="form.expense_date" type="date" required></label><label>Category<select v-model="form.category"><option v-for="category in categories" :key="category">{{ category }}</option></select></label><label class="wide">Description<input v-model="form.description" maxlength="120" required></label><label>Amount<input v-model.number="form.amount" min="0.01" step="0.01" type="number" required></label><label>Note<input v-model="form.note" maxlength="200"></label><button class="save-btn wide" :disabled="saving">{{ saving ? 'Saving...' : 'Add Expense' }}</button></form></section>
    </div>
    <section class="section-card"><div class="section-header"><h3>Expense Ledger</h3><small>{{ expenses.length }} entries</small></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Note</th><th>Amount</th><th></th></tr></thead><tbody><tr v-for="expense in expenses" :key="expense.id"><td>{{ expense.expense_date }}</td><td><span class="cost-category">{{ expense.category }}</span></td><td>{{ expense.description }}</td><td>{{ expense.note || '-' }}</td><td class="total-cell">{{ money(Number(expense.amount)) }}</td><td><button class="btn-small btn-danger" @click="removeExpense(expense)">Remove</button></td></tr><tr v-if="!expenses.length"><td colspan="6" class="empty-cell">No expenses recorded for this month.</td></tr></tbody></table></div></section>
  </template>
</div></template>
