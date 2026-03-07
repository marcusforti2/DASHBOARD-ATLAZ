import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { BarChart3, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) navigate("/", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
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

        <p className="text-[9px] text-muted-foreground/30 text-center mt-6 leading-relaxed">
          Ao continuar, você concorda com nossos{" "}
          <button type="button" onClick={() => setShowTerms(true)} className="underline hover:text-muted-foreground/50 transition-colors">Termos de Uso</button>
          {" "}e{" "}
          <button type="button" onClick={() => setShowPrivacy(true)} className="underline hover:text-muted-foreground/50 transition-colors">Política de Privacidade</button>.
        </p>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowTerms(false)}>
          <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-foreground">Termos de Uso</h2>
            <div className="text-xs text-muted-foreground space-y-3 leading-relaxed">
              <p><strong>1. Aceitação dos Termos</strong><br/>Ao acessar e utilizar a plataforma Learning Brand, você concorda integralmente com estes Termos de Uso. Caso não concorde, não utilize o sistema.</p>
              <p><strong>2. Descrição do Serviço</strong><br/>A plataforma é uma ferramenta de gestão comercial que inclui acompanhamento de métricas, treinamentos, inteligência artificial e integrações com serviços de terceiros.</p>
              <p><strong>3. Cadastro e Conta</strong><br/>O acesso é realizado mediante credenciais fornecidas pelo administrador da sua equipe. Você é responsável por manter a confidencialidade de suas credenciais.</p>
              <p><strong>4. Uso Adequado</strong><br/>Você concorda em utilizar a plataforma apenas para fins comerciais legítimos, não compartilhar credenciais de acesso e não tentar acessar dados de outros usuários.</p>
              <p><strong>5. Propriedade Intelectual</strong><br/>Todo o conteúdo, design e funcionalidades da plataforma são de propriedade exclusiva da Learning Brand.</p>
              <p><strong>6. Limitação de Responsabilidade</strong><br/>A plataforma é fornecida "como está". Não garantimos disponibilidade ininterrupta ou ausência de erros.</p>
              <p><strong>7. Modificações</strong><br/>Reservamos o direito de alterar estes termos a qualquer momento. Alterações entram em vigor imediatamente após publicação.</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="w-full rounded-lg bg-primary/10 text-primary text-xs font-semibold py-2 hover:bg-primary/20 transition-colors">Fechar</button>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowPrivacy(false)}>
          <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-foreground">Política de Privacidade</h2>
            <div className="text-xs text-muted-foreground space-y-3 leading-relaxed">
              <p><strong>1. Dados Coletados</strong><br/>Coletamos nome, email, dados de desempenho comercial e informações de uso da plataforma para fins de operação do serviço.</p>
              <p><strong>2. Uso dos Dados</strong><br/>Seus dados são utilizados exclusivamente para: operação da plataforma, geração de relatórios de desempenho, funcionalidades de inteligência artificial e comunicações do sistema.</p>
              <p><strong>3. Compartilhamento</strong><br/>Seus dados não são vendidos ou compartilhados com terceiros, exceto quando necessário para integrações solicitadas (Google Calendar, WhatsApp) ou por exigência legal.</p>
              <p><strong>4. Armazenamento e Segurança</strong><br/>Os dados são armazenados em servidores seguros com criptografia. Implementamos medidas técnicas e organizacionais para proteger suas informações.</p>
              <p><strong>5. Seus Direitos</strong><br/>Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais entrando em contato com o administrador da sua equipe.</p>
              <p><strong>6. Cookies e Rastreamento</strong><br/>Utilizamos cookies essenciais para manter sua sessão ativa. Não utilizamos cookies de rastreamento de terceiros.</p>
              <p><strong>7. Alterações</strong><br/>Esta política pode ser atualizada periodicamente. Recomendamos revisá-la regularmente.</p>
            </div>
            <button onClick={() => setShowPrivacy(false)} className="w-full rounded-lg bg-primary/10 text-primary text-xs font-semibold py-2 hover:bg-primary/20 transition-colors">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
