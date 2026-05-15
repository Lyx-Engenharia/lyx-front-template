# Lyx Front Template

Template Next.js 16 + Lyx Design System v2. Clone-ready, layout dashboard pronto, integrações Better Auth + TanStack Query + Sonner já configuradas.

## Stack

- Next 16 (App Router) + React 19 + TypeScript 5
- Tailwind CSS 4 + tokens OKLCH + classes 52W (`.app-shell`, `.sidebar`, `.lyx-card`, etc)
- Inter (next/font) + Geist Mono
- Radix UI + CVA + Lucide
- TanStack Query 5 + Sonner + React Hook Form + Zod 4
- Recharts 3
- Better Auth client (organization plugin)

## Quickstart

```bash
# 1. Clone template
npx degit Lyx-Engenharia/lyx-front-template meu-novo-front
cd meu-novo-front

# 2. Deps
npm install

# 3. Env
cp .env.example .env.local
# edita NEXT_PUBLIC_API_URL + NEXT_PUBLIC_ORG_ID_ENTREGAS

# 4. Dev
npm run dev
# http://localhost:3001
```

## Estrutura

```
src/
├── app/
│   ├── layout.tsx              ← root: fonts + Providers
│   ├── globals.css             ← tokens 52W + classes Lyx
│   ├── page.tsx                ← redirect → /login
│   ├── login/page.tsx
│   └── dashboard/
│       ├── layout.tsx          ← sidebar + topbar 52W
│       ├── page.tsx            ← dashboard demo (entregas)
│       ├── entregas/{page,nova,[id]/page}.tsx
│       ├── sistemas/page.tsx
│       └── setores/page.tsx
├── components/
│   ├── providers.tsx           ← QueryClient + Toaster
│   ├── theme-toggle.tsx
│   ├── lyx-modal.tsx
│   ├── entrega-actions.tsx     ← exemplo CRUD via dialogs
│   └── ui/                     ← 15 componentes prontos
└── lib/
    ├── utils.ts                ← cn()
    ├── api.ts                  ← fetch wrapper credentials
    ├── auth-client.ts          ← Better Auth + organization
    └── queries.ts              ← TanStack hooks padrão
```

## Customizar para seu sistema

### 1. Cores e tokens

`src/app/globals.css`:
```css
:root {
  --accent: #025864;        /* trocar pela cor do seu sistema */
  --accent-hover: #014049;
  --accent-light: rgba(2, 88, 100, 0.08);
  /* ... */
}
```

### 2. Logo + Brand

`src/app/dashboard/layout.tsx` — header da sidebar:
```tsx
<span>Meu<span style={{ color: "var(--accent)" }}>Sistema</span></span>
<span>Tracking de algo</span>
```

SVG logo: `src/components/ui/lyx-logo.tsx` ou inline no layout.

### 3. Navigation

```tsx
const navOperacional = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/entregas", label: "Entregas", icon: Package },
  // adicionar/remover
];
```

### 4. Domínio (substituir Entregas)

Renomear `src/app/dashboard/entregas/` → seu domínio. Atualizar `lib/queries.ts` com types/endpoints.

### 5. Auth

Backend (Better Auth) precisa estar disponível em `NEXT_PUBLIC_API_URL`. Por padrão consome o monolith Lyx.

## Padrões obrigatórios

- **Apenas classes 52W ou Tailwind utility** — evitar inline styles fora de layout.tsx
- **Tipografia Inter** — `font-family: var(--font-inter)` (já em body)
- **Números: Inter Bold** — NÃO usar mono (sem slashed zero)
- **Botões: `.btn .btn-primary`** (teal) ou `.btn-secondary` (outline)
- **Cards: `.lyx-card`** ou shadcn `Card` (ambos funcionam)
- **Forms: `.form-input/select/textarea` + `.form-label`**
- **Badges: `.lyx-badge.{gray|accent|success|warning|danger}`**
- **Tables: `.lyx-table`**
- **Modais: `<LyxModal>`** (component) com Portal + ESC

## Integração com monolith Lyx

Consumo via `NEXT_PUBLIC_API_URL`:
- Auth: `/api/auth/*` (Better Auth)
- Domínio: `/<modulo>/*` (ex: `/entregas`, `/sistemas`, `/setores`)
- Cookie cross-subdomain via `credentials: 'include'`

Org ativa setada no login via `authClient.organization.setActive({ organizationId })`.

## Build & Deploy

```bash
# Build
npm run build

# Docker
docker compose up --build
```

`next.config.ts` configurado com `output: "standalone"` para Docker minimal.

## Compatibilidade

- Node ≥ 20.18
- Next 16.x (App Router)
- React 19.x
