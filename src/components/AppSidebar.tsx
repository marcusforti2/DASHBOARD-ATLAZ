import { BarChart3, LayoutDashboard, Users, Target, FileText, Eye, Settings, LogOut, ClipboardList, ChevronDown } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";

export type AdminView = "dashboard" | "team" | "goals" | "reports" | "closer-preview" | "settings";
export type CloserView = "entry" | "dashboard";

interface AppSidebarProps {
  isAdmin: boolean;
  activeView: string;
  onViewChange: (view: string) => void;
  userName: string;
  userRole: string;
  onSignOut: () => void;
}

const adminItems = [
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
  { id: "team", title: "Equipe", icon: Users },
  { id: "goals", title: "Metas", icon: Target },
  { id: "reports", title: "Relatórios IA", icon: FileText },
  { id: "closer-preview", title: "Ver como Closer", icon: Eye },
  { id: "settings", title: "Configurações", icon: Settings },
];

const closerItems = [
  { id: "entry", title: "Inserir Dados", icon: ClipboardList },
  { id: "dashboard", title: "Meu Dashboard", icon: LayoutDashboard },
];

export function AppSidebar({ isAdmin, activeView, onViewChange, userName, userRole, onSignOut }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const items = isAdmin ? adminItems : closerItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <BarChart3 size={16} className="text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-sidebar-foreground tracking-tight truncate">LEARNING BRAND</h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Sales Tracker</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[9px] text-muted-foreground uppercase tracking-widest px-4 mb-1">
              {isAdmin ? "Gestão" : "Menu"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.id)}
                    isActive={activeView === item.id}
                    tooltip={item.title}
                    className={`transition-all ${
                      activeView === item.id
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <item.icon size={16} />
                    {!collapsed && <span className="text-xs">{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">
              {userName?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate">{userName}</p>
              <p className="text-[9px] text-primary uppercase font-semibold tracking-wider">{userRole}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
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
