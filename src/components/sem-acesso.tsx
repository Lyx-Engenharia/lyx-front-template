export type MotivoSemAcesso = "sem-acesso" | "erro";

const TEXTOS: Record<MotivoSemAcesso, { titulo: string; corpo: string }> = {
  "sem-acesso": {
    titulo: "Você não tem acesso a este sistema",
    corpo:
      "Seu login é válido, mas seu usuário não é membro deste sistema. Peça acesso ao administrador dele.",
  },
  erro: {
    titulo: "Não foi possível verificar seu acesso",
    corpo:
      "O servidor não respondeu como esperado. Tente de novo em instantes; se continuar, fale com o suporte.",
  },
};

/**
 * Tela de quem não pode entrar neste sistema agora. Em "erro" a falha é do
 * servidor, não do login, então a saída é tentar de novo (`onTentarDeNovo`),
 * não mandar pro login.
 */
export function SemAcesso({
  motivo,
  hubUrl,
  onTentarDeNovo,
}: {
  motivo: MotivoSemAcesso;
  hubUrl: string;
  onTentarDeNovo?: () => void;
}) {
  const texto = TEXTOS[motivo];
  const podeTentarDeNovo = motivo === "erro" && onTentarDeNovo;
  return (
    <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div
        role="alert"
        className="lyx-card"
        style={{ maxWidth: 440, padding: 32, display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}
      >
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{texto.titulo}</h1>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{texto.corpo}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          {podeTentarDeNovo && (
            <button type="button" className="btn btn-primary" onClick={onTentarDeNovo}>
              Tentar de novo
            </button>
          )}
          <a className={podeTentarDeNovo ? "btn btn-ghost" : "btn btn-primary"} href={hubUrl}>
            Voltar ao Hub
          </a>
        </div>
      </div>
    </div>
  );
}
