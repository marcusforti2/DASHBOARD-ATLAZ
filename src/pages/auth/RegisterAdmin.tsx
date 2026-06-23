import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import { toast } from "sonner";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

export default function RegisterAdmin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 max-w-md text-center space-y-3">
          <ShieldCheck size={32} className="text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Link Inválido</h1>
          <p className="text-sm text-muted-foreground">Este link de convite é inválido. Solicite um novo link ao administrador.</p>
          <button onClick={() => navigate("/login")} className="text-xs text-primary hover:underline">
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email e senha são obrigatórios");
      return;
    }
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/register-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
        },
        body: JSON.stringify({ token, email: email.trim(), password, full_name: fullName.trim() || email.trim() }),
      });

      const data = await response.json();

      if (!response.ok || data?.error) {
        toast.error(data?.error || "Erro ao cadastrar");
      } else {
        toast.success("Conta criada com sucesso! Faça login.");
        navigate("/login");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro inesperado");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <ShieldCheck size={28} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Cadastro de Administrador</h1>
          <p className="text-sm text-muted-foreground">Você foi convidado para ser administrador do sistema.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Seu nome"
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Senha *</label>
            <div className="relative mt-1">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 pr-10 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Criar Conta
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <button onClick={() => navigate("/login")} className="text-primary hover:underline">Fazer login</button>
        </p>
      </div>
    </div>
  );
}
