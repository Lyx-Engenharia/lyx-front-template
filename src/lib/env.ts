const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Valor de uma `NEXT_PUBLIC_*` com fallback por ambiente.
 *
 * `NEXT_PUBLIC_*` é inlinada no bundle durante o `next build`. Sem o ARG no
 * Dockerfile ela chega como `""`, por isso `||` e nunca `??` (o `""` passaria
 * pelo `??`). O fallback de produção é a URL canônica, como o lyx-hub-front
 * faz em `src/lib/env.ts`: build sem ARG não pode mandar o browser pro
 * localhost.
 */
export function valorPublico(
  valor: string | undefined,
  padrao: { prod: string; dev: string },
  isProd: boolean = IS_PROD,
): string {
  return valor || (isProd ? padrao.prod : padrao.dev);
}

/** Monolito (Better Auth + API). */
export const API_URL = valorPublico(process.env.NEXT_PUBLIC_API_URL, {
  prod: "https://api.lyxai.com.br",
  dev: "http://localhost:3000",
});

/**
 * Slug da org deste sistema no monolito: o `slug` da entrada do catálogo em
 * `lyx-monolith/src/modules/sistemas/sistemas.service.ts`. Ao clonar o
 * template, troque o default pelo slug do seu sistema. O default não casa com
 * nenhuma org de verdade de propósito: front sem slug configurado não deixa
 * ninguém entrar.
 */
export const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG || "meu-sistema";

/** Hub de sistemas: de onde a pessoa vem e pra onde volta quando não tem acesso. */
export const HUB_URL = valorPublico(process.env.NEXT_PUBLIC_HUB_URL, {
  prod: "https://hub.lyxai.com.br",
  dev: "http://localhost:3002",
});
