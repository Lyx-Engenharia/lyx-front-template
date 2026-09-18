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
# edita NEXT_PUBLIC_API_URL + NEXT_PUBLIC_ORG_SLUG

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
│   ├── page.tsx                ← redirect → /dashboard
│   ├── login/page.tsx          ← só redirect: o login é do Hub (SSO)
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
    └── example/queries.ts      ← EXEMPLO de hooks TanStack (rota /items não existe)
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

Nome, tagline e descrição moram num lugar só, `src/config/brand.ts`, lido pela sidebar do dashboard e pelo `metadata` (`<title>`/description) do `app/layout.tsx`:
```ts
export const BRAND = {
  prefix: "Meu",
  suffix: "Sistema",
  tagline: "Sub-título do sistema",
  // ...
} as const;
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

Renomear `src/app/dashboard/entregas/` → seu domínio. Escrever os hooks do domínio em `src/lib/` (use `lib/example/queries.ts` só como formato: a rota `/items` não existe no monolito) e apagar `src/lib/example/queries.ts`.

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

Login é do Hub (SSO pelo cookie `.lyxai.com.br`): sem sessão, o layout do dashboard manda pra `https://hub.lyxai.com.br/login?redirect=<url atual>`. Com sessão, o gate busca `GET /me/profile` e exige membership na org `NEXT_PUBLIC_ORG_SLUG`; confirmada a membership, ativa essa org na sessão via `authClient.organization.setActive({ organizationSlug: ORG_SLUG })` (`ativarOrgDoSistema()` em `lib/auth-client.ts`).

Pra funcionar em prod, a origin do front precisa estar na allowlist de redirect do Hub (`lyx-hub-front/src/lib/login-redirect.ts`; fora dela a pessoa cai no dashboard do Hub depois do login) e no `TRUSTED_ORIGINS` do monolito (CORS + CSRF do Better Auth).

## Build & Deploy

```bash
# Build
npm run build

# Docker
docker compose up --build
```

`next.config.ts` configurado com `output: "standalone"` para Docker minimal.

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ORG_SLUG` e `NEXT_PUBLIC_HUB_URL` são inlinadas no `next build`: no Dokploy elas vão como **build args** (o `Dockerfile` declara `ARG` + `ENV` no estágio de build), não como env de runtime. Sem o build arg, `src/lib/env.ts` cai no fallback de produção (`https://api.lyxai.com.br`, `https://hub.lyxai.com.br`), nunca no `localhost`.

## Compatibilidade

- Node ≥ 20.18
- Next 16.x (App Router)
- React 19.x
