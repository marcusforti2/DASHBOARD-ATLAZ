import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Informe seu nome"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada! Verifique seu email para confirmar.");
      setMode("login");
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Link de redefinição enviado para seu email!");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={28} className="text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">LEARNING BRAND</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "login" ? "Entre na sua conta" : mode === "signup" ? "Crie sua conta" : "Recupere sua senha"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome Completo</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"
                placeholder="Seu nome"
                required
              />
            </div>
          )}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"
              placeholder="seu@email.com"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Senha</label>
              <div className="relative mt-1">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 pr-10 text-sm text-card-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Enviar Link"}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 text-xs">
          {mode === "login" && (
            <>
              <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-primary transition-colors">
                Esqueci minha senha
              </button>
              <button onClick={() => setMode("signup")} className="text-primary hover:text-primary/80 transition-colors font-medium">
                Criar nova conta
              </button>
            </>
          )}
          {mode !== "login" && (
            <button onClick={() => setMode("login")} className="text-primary hover:text-primary/80 transition-colors font-medium">
              Voltar para login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
