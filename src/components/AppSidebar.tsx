import {
  BarChart3, LayoutDashboard, Users, Target, FileText, Eye, Settings, LogOut,
  ClipboardList, Sparkles, MessageCircle, BookOpen, Bot
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

export type AdminView = "dashboard" | "team" | "goals" | "reports" | "closer-preview" | "settings" | "whatsapp" | "popups" | "knowledge";
export type CloserView = "hub";

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
  { id: "whatsapp", title: "WhatsApp", icon: MessageCircle },
  { id: "popups", title: "Popups", icon: Sparkles },
  { id: "knowledge", title: "Conhecimento IA", icon: BookOpen },
  { id: "closer-preview", title: "Ver como SDR", icon: Eye },
  { id: "settings", title: "Configurações", icon: Settings },
];

const closerItems = [
  { id: "hub", title: "Meu Painel", icon: LayoutDashboard },
];

export function AppSidebar({ isAdmin, activeView, onViewChange, userName, userRole, onSignOut }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderItem = (item: { id: string; title: string; icon: React.ElementType }) => {
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
                <SidebarMenu>{adminSecondaryItems.map(renderItem)}</SidebarMenu>
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0 cursor-default">
                  <span className="text-[10px] font-bold text-primary">{userName?.charAt(0)?.toUpperCase() || "U"}</span>
                </div>
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">{userName?.charAt(0)?.toUpperCase() || "U"}</span>
            </div>
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
