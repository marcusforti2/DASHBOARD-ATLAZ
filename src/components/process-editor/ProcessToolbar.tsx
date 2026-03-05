import React, { memo, useState } from 'react';
import { Play, Square, GitBranch, GitMerge, CheckSquare, Hand, Zap, ThumbsUp, Clock, Bell, Mail, MessageCircle, FileText, Server, File, PenTool, StickyNote, Timer, User, Link, Repeat, Eye, CheckCircle, Search, Users, Phone, Smartphone, Globe, Database, Webhook, ListChecks, Paperclip, CreditCard, Receipt, Calculator, UserCheck, Truck, UsersRound, Trash2, Save, FolderOpen, Download, Undo, Redo, ZoomIn, ZoomOut, Maximize2, LayoutTemplate, AlignVerticalSpaceAround, Sparkles, ChevronUp, ChevronDown, Image, Send, Instagram, Facebook, Linkedin, Twitter, Youtube, Music, Share2, Bot, BarChart3, Cog, Workflow, Target, Rocket, ShoppingCart, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ProcessNodeType, NodeCategory } from './types';
import { nodeTypeConfigs, categoryLabels, getNodesByCategory } from './nodeConfig';

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = { Play, Square, GitBranch, GitMerge, CheckSquare, Hand, Zap, ThumbsUp, Clock, Bell, Mail, MessageCircle, FileText, Server, File, PenTool, StickyNote, Timer, User, Link, Repeat, Eye, CheckCircle, Search, Users, Phone, Smartphone, Globe, Database, Webhook, ListChecks, Paperclip, CreditCard, Receipt, Calculator, UserCheck, Truck, UsersRound, Send, Instagram, Facebook, Linkedin, Twitter, Youtube, Music, Bot, BarChart3, Cog, Workflow, Target, Rocket, ShoppingCart, TrendingUp, Image, Filter };
const categoryIcons: Record<NodeCategory, React.ComponentType<{ className?: string }>> = { fluxo: GitBranch, operacional: Zap, comunicacao: Mail, integracao: Server, documentacao: FileText, financeiro: CreditCard, pessoas: Users, redes_sociais: Share2, funil: TrendingUp, automacao: Cog, analise: BarChart3 };

interface ProcessToolbarProps { onAddNode: (type: ProcessNodeType) => void; onReset: () => void; onSave: () => void; onLoad: () => void; onExport: () => void; onLoadTemplate: () => void; onAIGenerate: () => void; onAutoAlign: () => void; onUndo: () => void; onRedo: () => void; onZoomIn: () => void; onZoomOut: () => void; onFitView: () => void; onShare?: () => void; canUndo: boolean; canRedo: boolean; canShare: boolean; processName?: string; totalTime?: React.ReactNode; }

function ProcessToolbarComponent({ onAddNode, onReset, onSave, onLoad, onExport, onLoadTemplate, onAIGenerate, onAutoAlign, onUndo, onRedo, onZoomIn, onZoomOut, onFitView, onShare, canUndo, canRedo, canShare, processName, totalTime }: ProcessToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const categories: NodeCategory[] = ['fluxo', 'operacional', 'comunicacao', 'redes_sociais', 'funil', 'automacao', 'integracao', 'documentacao', 'financeiro', 'pessoas', 'analise'];

  if (isCollapsed) return (<div className="absolute top-4 left-4 z-10"><Tooltip><TooltipTrigger asChild><Button variant="secondary" size="icon" className="h-8 w-8 bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg" onClick={() => setIsCollapsed(false)}><ChevronDown className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="right">Expandir toolbar</TooltipContent></Tooltip></div>);

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-1 p-1 bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg flex-wrap max-w-[calc(100%-2rem)]">
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsCollapsed(true)} className="h-8 w-8"><ChevronUp className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">Recolher</TooltipContent></Tooltip>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onReset} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">Limpar</TooltipContent></Tooltip>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={onAIGenerate}><Sparkles className="h-4 w-4" /><span className="text-xs">IA</span></Button></TooltipTrigger><TooltipContent side="bottom">Gerar com IA</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={onLoadTemplate}><LayoutTemplate className="h-4 w-4" /><span className="text-xs">Templates</span></Button></TooltipTrigger><TooltipContent side="bottom">Templates</TooltipContent></Tooltip>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onSave} className="h-8 w-8"><Save className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">Salvar</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onLoad} className="h-8 w-8"><FolderOpen className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">Carregar</TooltipContent></Tooltip>
      {canShare && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={onShare} className="h-8 px-2 gap-1 text-primary hover:text-primary"><Link className="h-4 w-4" /><span className="text-xs">Compartilhar</span></Button></TooltipTrigger><TooltipContent side="bottom">Link público</TooltipContent></Tooltip>}
      <Separator orientation="vertical" className="h-6 mx-1" />
      {categories.map(cat => { const CI = categoryIcons[cat]; const nodesInCat = getNodesByCategory(cat); return (
        <DropdownMenu key={cat}><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 px-2 gap-1"><CI className="h-4 w-4" /><ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent side="bottom">{categoryLabels[cat]}</TooltipContent></Tooltip>
          <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto"><DropdownMenuLabel>{categoryLabels[cat]}</DropdownMenuLabel><DropdownMenuSeparator />{nodesInCat.map(cfg => { const Icon = iconMap[cfg.icon] || CheckSquare; return <DropdownMenuItem key={cfg.type} onClick={() => onAddNode(cfg.type)} className="gap-2 cursor-pointer"><Icon className="h-4 w-4" /><span>{cfg.label}</span></DropdownMenuItem>; })}</DropdownMenuContent></DropdownMenu>); })}
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="h-8 w-8"><Undo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">Desfazer</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} className="h-8 w-8"><Redo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">Refazer</TooltipContent></Tooltip>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8"><ZoomOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">-</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8"><ZoomIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">+</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onFitView} className="h-8 w-8"><Maximize2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">Ajustar</TooltipContent></Tooltip>
      {(processName || totalTime) && <><Separator orientation="vertical" className="h-6 mx-1" /><div className="flex items-center gap-2 px-2">{totalTime}{processName && <span className="text-xs text-muted-foreground truncate max-w-32">{processName}</span>}</div></>}
    </div>
  );
}

export const ProcessToolbar = memo(ProcessToolbarComponent);
