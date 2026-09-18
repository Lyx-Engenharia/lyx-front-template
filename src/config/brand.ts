/**
 * Identidade do sistema, num lugar só: sidebar do dashboard e
 * `<title>`/description da página. Ao clonar o template, troque aqui.
 */
export const BRAND = {
  prefix: "Meu",
  suffix: "Sistema",
  tagline: "Sub-título do sistema",
  description: "Substitua pela descrição do seu sistema",
} as const;

/** Nome por extenso, pro `<title>` da página. */
export const NOME_DO_SISTEMA = `${BRAND.prefix} ${BRAND.suffix}`;
