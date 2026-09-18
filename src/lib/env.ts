const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Slug da org deste sistema no monolito: o `slug` da entrada do catálogo em
 * `lyx-monolith/src/modules/sistemas/sistemas.service.ts`. Ao clonar o
 * template, troque o default pelo slug do seu sistema. O default não casa com
 * nenhuma org de verdade de propósito: front sem slug configurado não deixa
 * ninguém entrar.
 */
export const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG || "meu-sistema";

/** Hub de sistemas: de onde a pessoa vem e pra onde volta quando não tem acesso. */
export const HUB_URL =
  process.env.NEXT_PUBLIC_HUB_URL ||
  (IS_PROD ? "https://hub.lyxai.com.br" : "http://localhost:3002");
