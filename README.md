# Stack Petals — Admin Dashboard

> Vite · Vue 3 · TypeScript · Pinia · Vue Router · Vercel

Separate repo from the main shop. Deployed to `admin.stackoverpetals.shop`.

---

## Quick Start

```bash
npm install
npm run dev       # http://localhost:5174
npm run build
npm run type-check
```

**Login credentials (temporary):**
- Username: `admin`
- Password: `admin`

---

## Project Structure

```
stack-petals-admin/
├── src/
│   ├── assets/
│   │   └── admin.css            ← all styles
│   ├── components/
│   │   ├── ProofLightbox.vue    ← payment proof image viewer
│   │   ├── OrderModal.vue       ← order detail + status editor
│   │   └── MessageModal.vue     ← message viewer + reply draft
│   ├── pages/
│   │   ├── LoginPage.vue
│   │   ├── DashboardLayout.vue  ← sidebar + topbar shell
│   │   ├── OverviewPage.vue
│   │   ├── OrdersPage.vue
│   │   ├── MessagesPage.vue
│   │   └── TransactionsPage.vue
│   ├── router/index.ts          ← auth guard built in
│   ├── stores/
│   │   ├── auth.ts              ← login/logout (swap for Supabase Auth)
│   │   └── admin.ts             ← all data, filters, modals, toast
│   ├── types/index.ts
│   ├── App.vue
│   └── main.ts
├── vercel.json
└── .env.example
```

---

## Deploying to Vercel + Custom Subdomain

1. Push this repo to GitHub (separate from the shop repo)
2. Import in Vercel → it auto-detects Vite
3. After deploy, go to **Settings → Domains**
4. Add `admin.stackoverpetals.shop`
5. In your Vercel DNS Records, add:
   ```
   Type:  CNAME
   Name:  admin
   Value: cname.vercel-dns.com
   ```

---

## Migration Roadmap

### Phase 1 — Now
- localStorage (reads same data as the shop frontend)
- Hardcoded login (admin / admin)

### Phase 2 — Supabase Auth
- Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Replace `src/stores/auth.ts → login()` with:
  ```ts
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  ```
- The `TODO` comment in auth.ts marks the exact swap point

### Phase 3 — Node.js/Express API
- Replace localStorage calls in `src/stores/admin.ts → loadData()`, `saveOrders()`, `saveMessages()`
- The `TODO` comments mark the exact swap points
