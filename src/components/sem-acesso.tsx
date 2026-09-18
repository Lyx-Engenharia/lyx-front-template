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

/** Tela de quem tem sessão na Lyx mas não pode entrar neste sistema. */
export function SemAcesso({ motivo, hubUrl }: { motivo: MotivoSemAcesso; hubUrl: string }) {
  const texto = TEXTOS[motivo];
  return (
    <div className="app-shell" style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div
        role="alert"
        className="lyx-card"
        style={{ maxWidth: 440, padding: 32, display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}
      >
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{texto.titulo}</h1>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>{texto.corpo}</p>
        <a className="btn btn-primary" href={hubUrl} style={{ alignSelf: "center", marginTop: 8 }}>
          Voltar ao Hub
        </a>
      </div>
    </div>
  );
}
