import { useState } from "react";
import {
  BarChart3, LayoutDashboard, Users, Target, Sparkles, Eye, Settings, LogOut,
  MessageCircle, BookOpen, Brain, GitBranch, GraduationCap, ChevronRight,
  Wrench, FlaskConical, Megaphone, Calendar, Smartphone, Mail
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type AdminView = "dashboard" | "team" | "goals" | "reports" | "inspect-team" | "settings" | "whatsapp" | "popups" | "knowledge" | "dna-mapping" | "processos" | "training" | "calendars" | "wa-hub" | "ai-sdr" | "email-marketing";
export type CloserView = "hub";

interface AppSidebarProps {
  isAdmin: boolean;
  activeView: string;
  onViewChange: (view: string) => void;
  userName: string;
  userRole: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
}

type SidebarItem = { id: string; title: string; icon: React.ElementType };

const adminMainItems: SidebarItem[] = [
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
  { id: "team", title: "Equipe", icon: Users },
  { id: "goals", title: "Metas", icon: Target },
  { id: "calendars", title: "Agendas", icon: Calendar },
  { id: "reports", title: "Relatórios IA", icon: Sparkles },
];

const toolCategories: { label: string; icon: React.ElementType; items: SidebarItem[] }[] = [
  {
    label: "Capacitação",
    icon: GraduationCap,
    items: [
      { id: "training", title: "Treinamentos", icon: GraduationCap },
      { id: "dna-mapping", title: "DNA Vendedor", icon: Brain },
    ],
  },
  {
    label: "Automação",
    icon: Wrench,
    items: [
      { id: "processos", title: "Processos", icon: GitBranch },
      { id: "whatsapp", title: "WhatsApp", icon: MessageCircle },
      { id: "wa-hub", title: "WhatsApp Hub", icon: Smartphone },
      { id: "ai-sdr", title: "SDR IA", icon: Brain },
      { id: "email-marketing", title: "Email Marketing", icon: Mail },
    ],
  },
  {
    label: "Conteúdo",
    icon: FlaskConical,
    items: [
      { id: "popups", title: "Popups", icon: Megaphone },
      { id: "knowledge", title: "Conhecimento IA", icon: BookOpen },
    ],
  },
];

const adminBottomItems: SidebarItem[] = [
  { id: "inspect-team", title: "Inspecionar Equipe", icon: Eye },
  { id: "settings", title: "Configurações", icon: Settings },
];

const closerItems: SidebarItem[] = [
  { id: "hub", title: "Meu Painel", icon: LayoutDashboard },
];

export function AppSidebar({ isAdmin, activeView, onViewChange, userName, userRole, avatarUrl, onSignOut }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderItem = (item: SidebarItem) => {
    const isActive = activeView === item.id;
    const button = (
      <SidebarMenuButton
        onClick={() => onViewChange(item.id)}
        isActive={isActive}
        tooltip={item.title}
        className={`transition-all h-9 ${
          isActive
            ? "bg-primary/15 text-primary font-semibold border-l-2 border-primary rounded-l-none"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        } ${collapsed ? "justify-center px-0" : ""}`}
      >
        <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} className="shrink-0" />
        {!collapsed && <span className="text-[11px] tracking-wide">{item.title}</span>}
      </SidebarMenuButton>
    );

    return (
      <SidebarMenuItem key={item.id}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{item.title}</TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={`p-4 pb-2 ${collapsed ? "p-2 flex items-center justify-center" : ""}`}>
        <div className={`flex items-center overflow-hidden ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]">
            <BarChart3 size={16} className="text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-[11px] font-bold text-sidebar-foreground tracking-tight truncate">LEARNING BRAND</h1>
              <p className="text-[8px] text-muted-foreground uppercase tracking-[0.15em]">Sales Tracker</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={collapsed ? "px-1" : "px-2"}>
        {isAdmin ? (
          <>
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[8px] text-muted-foreground/60 uppercase tracking-[0.2em] px-3 mb-0.5 font-semibold">
                  Principal
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>{adminMainItems.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="my-1 opacity-30" />

            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[8px] text-muted-foreground/60 uppercase tracking-[0.2em] px-3 mb-0.5 font-semibold">
                  Ferramentas
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {toolCategories.map((cat) => (
                    <CategoryPopover
                      key={cat.label}
                      category={cat}
                      activeView={activeView}
                      collapsed={collapsed}
                      onViewChange={onViewChange}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="my-1 opacity-30" />

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>{adminBottomItems.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[8px] text-muted-foreground/60 uppercase tracking-[0.2em] px-3 mb-0.5 font-semibold">
                Menu
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>{closerItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border/50 ${collapsed ? "p-2" : "p-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-full object-cover shrink-0 cursor-default" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0 cursor-default">
                    <span className="text-[10px] font-bold text-primary">{userName?.charAt(0)?.toUpperCase() || "U"}</span>
                  </div>
                )}
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{userName} — {userRole}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onSignOut} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sair</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">{userName?.charAt(0)?.toUpperCase() || "U"}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate">{userName}</p>
              <p className="text-[8px] text-primary uppercase font-bold tracking-[0.15em]">{userRole}</p>
            </div>
            <button onClick={onSignOut} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0" title="Sair">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

// ── Category Popover ──
function CategoryPopover({
  category,
  activeView,
  collapsed,
  onViewChange,
}: {
  category: { label: string; icon: React.ElementType; items: SidebarItem[] };
  activeView: string;
  collapsed: boolean;
  onViewChange: (view: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActiveChild = category.items.some((i) => i.id === activeView);
  const Icon = category.icon;

  const trigger = (
    <SidebarMenuButton
      onClick={() => setOpen(!open)}
      className={`transition-all h-9 ${
        hasActiveChild
          ? "bg-primary/15 text-primary font-semibold"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      <Icon size={18} strokeWidth={hasActiveChild ? 2.5 : 1.5} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="text-[11px] tracking-wide flex-1">{category.label}</span>
          <ChevronRight size={12} className={`shrink-0 text-muted-foreground/50 transition-transform ${open ? "rotate-90" : ""}`} />
        </>
      )}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{trigger}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{category.label}</TooltipContent>
            </Tooltip>
          ) : (
            trigger
          )}
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-48 p-1.5 bg-popover border border-border shadow-xl rounded-xl"
        >
          <p className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-[0.15em] px-2 py-1.5">
            {category.label}
          </p>
          {category.items.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onViewChange(item.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-popover-foreground/70 hover:text-popover-foreground hover:bg-secondary"
                }`}
              >
                <item.icon size={15} strokeWidth={isActive ? 2.5 : 1.5} className="shrink-0" />
                <span className="text-[11px]">{item.title}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}
