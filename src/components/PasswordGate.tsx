import { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const GATE_HASH = "VyNIdWIyMDI2IQ=="; // base64 of the password

function check(input: string): boolean {
  try {
    return btoa(input) === GATE_HASH;
  } catch {
    return false;
  }
}

const SESSION_KEY = "restricted_area_unlocked";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (check(value)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 text-center px-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="text-primary" size={28} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Área Restrita</h2>
          <p className="text-sm text-muted-foreground mt-1">Digite a senha para acessar esta seção</p>
        </div>
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); }}
            placeholder="Senha de acesso"
            className={error ? "border-destructive pr-10" : "pr-10"}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">Senha incorreta</p>}
        <Button type="submit" className="w-full gap-2">
          <ShieldCheck size={16} /> Entrar
        </Button>
      </form>
    </div>
  );
}
