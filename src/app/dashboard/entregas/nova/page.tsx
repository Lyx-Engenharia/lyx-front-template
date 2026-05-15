"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCriarEntrega, useSetores, useSistemas } from "@/lib/queries";
import { useSession } from "@/lib/auth-client";

const schema = z.object({
  codigo: z.string().min(3).max(50),
  titulo: z.string().min(3).max(255),
  objetivo: z.string().min(10),
  sistemaId: z.uuid(),
  setorId: z.uuid(),
  versao: z.string().min(1).max(50),
  responsavelSetorUserId: z.string().min(1, "Informe o responsável do setor"),
});

type FormData = z.infer<typeof schema>;

export default function NovaEntregaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const setores = useSetores();
  const sistemas = useSistemas();
  const criar = useCriarEntrega();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      versao: "1.0.0",
      codigo: `ENT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    },
  });

  async function onSubmit(data: FormData) {
    if (!session?.user.id) return;
    const result = await criar.mutateAsync({
      ...data,
      responsavelTecnicoUserId: session.user.id,
    });
    router.push(`/dashboard/entregas/${(result as { id: string }).id}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <Link
        href="/dashboard/entregas"
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start" }}
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div className="lyx-card">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700 }}>Nova entrega</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
            Cadastrar como rascunho. Depois adicione funcionalidades e libere para
            homologação.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div className="card-grid card-grid-2" style={{ gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" {...register("codigo")} />
              {errors.codigo && (
                <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                  {errors.codigo.message}
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Versão</label>
              <input className="form-input" {...register("versao")} />
              {errors.versao && (
                <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                  {errors.versao.message}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Título</label>
            <input className="form-input" {...register("titulo")} />
            {errors.titulo && (
              <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                {errors.titulo.message}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Objetivo</label>
            <textarea
              className="form-textarea"
              rows={4}
              {...register("objetivo")}
            />
            {errors.objetivo && (
              <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                {errors.objetivo.message}
              </span>
            )}
          </div>

          <div className="card-grid card-grid-2" style={{ gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Sistema</label>
              <select className="form-select" {...register("sistemaId")}>
                <option value="">Selecione...</option>
                {sistemas.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              {errors.sistemaId && (
                <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                  Sistema obrigatório
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Setor</label>
              <select className="form-select" {...register("setorId")}>
                <option value="">Selecione...</option>
                {setores.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              {errors.setorId && (
                <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                  Setor obrigatório
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Responsável do setor (user ID)</label>
            <input
              className="form-input"
              placeholder="ID do usuário responsável no setor"
              {...register("responsavelSetorUserId")}
            />
            {errors.responsavelSetorUserId && (
              <span style={{ fontSize: "0.72rem", color: "var(--danger)" }}>
                {errors.responsavelSetorUserId.message}
              </span>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <Link href="/dashboard/entregas" className="btn btn-secondary">
              Cancelar
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={criar.isPending}
            >
              {criar.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar entrega
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
