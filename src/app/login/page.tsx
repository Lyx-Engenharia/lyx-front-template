import { redirect } from "next/navigation";

/**
 * O login é do Hub (SSO pelo cookie `.lyxai.com.br`): este front não tem tela
 * de login própria. A rota fica só pra link antigo não dar 404; sem sessão, o
 * layout do dashboard manda pro login do Hub com `?redirect=`.
 */
export default function LoginPage() {
  redirect("/dashboard");
}
