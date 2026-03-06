import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMemberRoles } from "@/lib/db";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlaybookMarkdown } from "./PlaybookMarkdown";
import { BookMarked, ChevronLeft, Search, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PlaybookViewerUserProps {
  memberRole: string;
}

type Playbook = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string;
  target_role: string;
  updated_at: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  sdr: "bg-primary/15 text-primary border-primary/30",
  closer: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  onboarding: "bg-accent/15 text-accent border-accent/30",
  processos: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  scripts: "bg-destructive/15 text-destructive border-destructive/30",
  geral: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_ICONS: Record<string, string> = {
  sdr: "📞",
  closer: "🤝",
  onboarding: "🚀",
  processos: "⚙️",
  scripts: "📝",
  geral: "📚",
};

export function PlaybookViewerUser({ memberRole }: PlaybookViewerUserProps) {
  const roles = getMemberRoles({ member_role: memberRole });
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [search, setSearch] = useState("");

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["user-playbooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_playbooks")
        .select("*")
        .eq("is_published", true)
        .order("updated_at", { ascending: false });
      return (data || []) as Playbook[];
    },
  });

  const visible = playbooks.filter(
    (p) => p.target_role === "all" || roles.includes(p.target_role)
  );

  const filtered = visible.filter((p) => {
    if (!search) return true;
    return (
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    );
  });

  // ── Reading view ──
  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Voltar aos Playbooks
        </button>

        <div className="max-w-3xl mx-auto">
          {/* Cover header */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.geral}>
                  {CATEGORY_ICONS[selected.category] || "📚"} {selected.category}
                </Badge>
                <Badge variant="outline" className="text-[9px]">
                  {selected.target_role === "all" ? "📢 Para todos" : selected.target_role.toUpperCase()}
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                {selected.title}
              </h1>
              {selected.description && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {selected.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-4 text-[10px] text-muted-foreground/60">
                <Clock size={10} />
                Atualizado em {new Date(selected.updated_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8">
              <PlaybookMarkdown content={selected.content || "*Conteúdo em breve...*"} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked size={18} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Playbooks</h2>
          <Badge variant="outline" className="text-[9px]">{visible.length}</Badge>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="h-8 text-xs pl-8 w-44"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <BookMarked size={36} className="text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum playbook disponível</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Os playbooks publicados aparecerão aqui</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((pb) => (
            <Card
              key={pb.id}
              className="group cursor-pointer overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              onClick={() => setSelected(pb)}
            >
              {/* Top colored strip */}
              <div className={`h-1.5 ${
                pb.category === "sdr" ? "bg-primary" :
                pb.category === "closer" ? "bg-chart-3" :
                pb.category === "onboarding" ? "bg-accent" :
                pb.category === "scripts" ? "bg-destructive" :
                "bg-muted-foreground/30"
              }`} />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    {CATEGORY_ICONS[pb.category] || "📚"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {pb.title}
                    </p>
                    {pb.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {pb.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  <Badge className={`text-[9px] ${CATEGORY_COLORS[pb.category] || CATEGORY_COLORS.geral}`}>
                    {pb.category}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground/50 ml-auto">
                    {new Date(pb.updated_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
