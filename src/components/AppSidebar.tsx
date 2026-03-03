import { BarChart3, LayoutDashboard, Users, Target, FileText, Eye, Settings, LogOut, ClipboardList, Sparkles } from "lucide-react";
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

export type AdminView = "dashboard" | "team" | "goals" | "reports" | "closer-preview" | "settings";
export type CloserView = "entry" | "dashboard" | "daily-goals";

interface AppSidebarProps {
  isAdmin: boolean;
  activeView: string;
  onViewChange: (view: string) => void;
  userName: string;
  userRole: string;
  onSignOut: () => void;
}

const adminMainItems = [
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
  { id: "team", title: "Equipe", icon: Users },
  { id: "goals", title: "Metas", icon: Target },
  { id: "reports", title: "Relatórios IA", icon: Sparkles },
];

const adminSecondaryItems = [
  { id: "closer-preview", title: "Ver como SDR", icon: Eye },
  { id: "settings", title: "Configurações", icon: Settings },
];

const closerItems = [
  { id: "daily-goals", title: "Meu Dia", icon: Target },
  { id: "entry", title: "Inserir Dados", icon: ClipboardList },
  { id: "dashboard", title: "Dashboard Geral", icon: LayoutDashboard },
];

export function AppSidebar({ isAdmin, activeView, onViewChange, userName, userRole, onSignOut }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderItem = (item: { id: string; title: string; icon: React.ElementType }) => (
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton
        onClick={() => onViewChange(item.id)}
        isActive={activeView === item.id}
        tooltip={item.title}
        className={`transition-all h-9 ${
          activeView === item.id
            ? "bg-primary/15 text-primary font-semibold border-l-2 border-primary rounded-l-none"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        }`}
      >
        <item.icon size={18} strokeWidth={activeView === item.id ? 2.5 : 1.5} />
        {!collapsed && <span className="text-[11px] tracking-wide">{item.title}</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-2.5 overflow-hidden">
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

      <SidebarContent className="px-2">
        {isAdmin ? (
          <>
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[8px] text-muted-foreground/60 uppercase tracking-[0.2em] px-3 mb-0.5 font-semibold">
                  Principal
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminMainItems.map(renderItem)}
                </SidebarMenu>
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
                  {adminSecondaryItems.map(renderItem)}
                </SidebarMenu>
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
              <SidebarMenu>
                {closerItems.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">
              {userName?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate">{userName}</p>
              <p className="text-[8px] text-primary uppercase font-bold tracking-[0.15em]">{userRole}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
