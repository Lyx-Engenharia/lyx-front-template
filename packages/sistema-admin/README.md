# @lyxai/sistema-admin

Painel **Admin de Sistema** + **troca de senha self-service** reusável pelos fronts de sistema da Lyx.

Consome o backend do monolito (`/admin/sistemas/:slug/*`, `/me/profile`, `/sistemas/catalog`) via cookie cross-subdomain. Decisão e contexto em `lyx-monolith/docs/adr/0006-gestao-de-users-distribuida.md`.

Zero peer pesado: só `react`/`react-dom`. Sem react-query, sem lucide. Usa `fetch` direto.

## Instalação

```bash
npm install @lyxai/sistema-admin
```

## Uso

```tsx
"use client";
import { SistemaAdminPanel, ChangePasswordCard } from "@lyxai/sistema-admin";

// `||` e não `??`: NEXT_PUBLIC_* sem build arg chega como "" e o `??` deixaria
// passar. Fallback de prod é a URL canônica do monolito. No lyx-front-template
// isto já vem pronto: importe `API_URL` de `@/lib/env`.
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "https://api.lyxai.com.br" : "http://localhost:3000");

export default function ConfiguracoesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Só aparece se o usuário logado for Admin deste sistema. */}
      <SistemaAdminPanel apiUrl={API} sistemaSlug="contratos" />

      {/* Qualquer usuário troca a própria senha. */}
      <ChangePasswordCard apiUrl={API} />
    </div>
  );
}
```

- `apiUrl`: base do monolito, **sem barra final** e **sem `/api`** (ex: `https://api.lyxai.com.br`).
- `sistemaSlug`: o slug do sistema deste front (`contratos`, `credito`, ...).
- `accent` (opcional): cor de destaque. Default teal Lyx.

## Pré-requisitos no backend

1. A origin do front precisa estar em `TRUSTED_ORIGINS` (env do monolito no Dokploy) e compartilhar o cookie `Domain=.lyxai.com.br`. Em dev, adicione `http://localhost:<porta>` aos trusted origins.
2. O usuário precisa ter sessão ativa no monolito (login via Hub ou SSO cross-subdomain).

## Autorização

O painel **se auto-esconde** pra quem não é Admin de Sistema (cruza `/me/profile` com `rolesEnriched.isAdmin` do catálogo). A autorização real é **enforced no backend** (`SistemaAdminGuard`): o front é só UX.

## Capacidades do painel

- Listar usuários do sistema, com label + descrição de cargo (fonte única no catálogo).
- Criar usuário (com fluxo `EMAIL_EXISTS` → confirmar e anexar o existente).
- Trocar cargo entre os **não-admin** (promover a admin é exclusivo do Super Admin de Portal).
- Remover do sistema (some a membership; o usuário global persiste).

## Build / test

```bash
npm run build   # tsup → dist (ESM + d.ts)
npm test        # vitest
```
