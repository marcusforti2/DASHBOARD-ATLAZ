import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Play, Square, GitBranch, GitMerge, CheckSquare, Hand, Zap, ThumbsUp, Clock,
  Bell, Mail, MessageCircle, FileText, Server, File, PenTool, StickyNote, Timer, User,
  Copy, Trash2, Link, Repeat, Eye, CheckCircle, Search, Users, Phone, Smartphone, 
  Globe, Database, Webhook, ListChecks, Paperclip, CreditCard, Receipt, Calculator,
  UserCheck, Truck, UsersRound, Send, Instagram, Facebook, Linkedin, Twitter, Youtube, Music,
  Filter, Star, ArrowUpCircle, BellRing, Bot, Mic, Image, AtSign, Video,
  UserPlus, Sprout, Layout, Heart, ShoppingCart, TrendingUp, TrendingDown, PlusCircle,
  RefreshCcw, ShoppingBag, Rocket, Mails, Contact, Building2, Workflow, Settings, Cog,
  Crosshair, PlayCircle, Split, Tag, Target, MoveRight, FileSignature, FileSpreadsheet,
  Banknote, RotateCcw, Percent, UserSearch, Sparkles, BarChart3, FileBarChart,
  LayoutDashboard, Scan, Link2, LineChart
} from 'lucide-react';
import { ProcessNodeData, NodeColor } from '../types';
import { nodeTypeConfigs, statusColors, statusLabels } from '../nodeConfig';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play, Square, GitBranch, GitMerge, CheckSquare, Hand, Zap, ThumbsUp, Clock,
  Bell, Mail, MessageCircle, FileText, Server, File, PenTool, StickyNote, Timer, User,
  Link, Repeat, Eye, CheckCircle, Search, Users, Phone, Smartphone, Globe, Database,
  Webhook, ListChecks, Paperclip, CreditCard, Receipt, Calculator, UserCheck, Truck, UsersRound,
  Send, Instagram, Facebook, Linkedin, Twitter, Youtube, Music,
  Filter, Star, ArrowUpCircle, BellRing, Bot, Mic, Image, AtSign, Video,
  UserPlus, Sprout, Layout, Heart, ShoppingCart, TrendingUp, TrendingDown, PlusCircle,
  RefreshCcw, ShoppingBag, Rocket, Mails, Contact, Building2, Workflow, Settings, Cog,
  Crosshair, PlayCircle, Split, Tag, Target, MoveRight, FileSignature, FileSpreadsheet,
  Banknote, RotateCcw, Percent, UserSearch, Sparkles, BarChart3, FileBarChart,
  LayoutDashboard, Scan, Link2, LineChart
};

export const nodeColorMap: Record<NodeColor, { bg: string; border: string; accent: string }> = {
  default: { bg: '', border: '', accent: '' },
  red: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-700', accent: 'bg-red-500' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-300 dark:border-yellow-700', accent: 'bg-yellow-500' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-700', accent: 'bg-blue-500' },
  green: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-300 dark:border-green-700', accent: 'bg-green-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-300 dark:border-purple-700', accent: 'bg-purple-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-300 dark:border-orange-700', accent: 'bg-orange-500' }
};

let deleteNodeCallback: ((id: string) => void) | null = null;
let duplicateNodeCallback: ((id: string) => void) | null = null;

export const setNodeCallbacks = (
  deleteFn: (id: string) => void,
  duplicateFn: (id: string) => void
) => {
  deleteNodeCallback = deleteFn;
  duplicateNodeCallback = duplicateFn;
};

const ProcessNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as ProcessNodeData;
  const config = nodeTypeConfigs[nodeData.type];
  const Icon = iconMap[config?.icon || 'CheckSquare'];
  
  const customColor = nodeData.cor && nodeData.cor !== 'default' ? nodeColorMap[nodeData.cor] : null;
  const bgColor = customColor?.bg || config?.bgColor || 'bg-card';
  const borderColor = customColor?.border || config?.borderColor || 'border-border';
  const hasLink = Boolean(nodeData.link);

  // Special shapes for start/end/decision
  const isStart = nodeData.type === 'inicio';
  const isEnd = nodeData.type === 'fim';
  const isDecision = nodeData.type === 'decisao';

  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if (deleteNodeCallback) deleteNodeCallback(id); };
  const handleDuplicate = (e: React.MouseEvent) => { e.stopPropagation(); if (duplicateNodeCallback) duplicateNodeCallback(id); };
  const handleNodeClick = (e: React.MouseEvent) => { if (hasLink && e.detail === 2) { e.stopPropagation(); window.open(nodeData.link, '_blank', 'noopener,noreferrer'); } };

  const formatTempo = () => {
    if (!nodeData.tempoEstimado) return null;
    const unidade = nodeData.tempoUnidade || 'minutos';
    const abbrev: Record<string, string> = { minutos: 'min', horas: 'h', dias: 'd' };
    return `${nodeData.tempoEstimado}${abbrev[unidade] || unidade}`;
  };

  // Rounded pill shape for start/end
  if (isStart || isEnd) {
    return (
      <div onClick={handleNodeClick}
        className={`relative rounded-full border-2 shadow-md transition-all ${bgColor} ${borderColor} ${selected ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : 'hover:shadow-md'} group`}
      >
        {!isStart && <Handle type="target" position={Position.Left} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-background" />}
        <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={handleDuplicate} className="p-0.5 rounded-full bg-background border shadow-sm hover:bg-accent" title="Duplicar"><Copy className="h-2.5 w-2.5" /></button>
          <button onClick={handleDelete} className="p-0.5 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground" title="Excluir"><Trash2 className="h-2.5 w-2.5" /></button>
        </div>
        <div className="px-6 py-3 flex items-center gap-2.5">
          <div className={`p-1.5 rounded-full ${config?.color || ''} ${isStart ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
            {Icon && <Icon className="h-4 w-4" />}
          </div>
          <span className="font-semibold text-sm whitespace-nowrap">{nodeData.label}</span>
        </div>
        {!isEnd && <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-background" />}
      </div>
    );
  }

  // Diamond-inspired shape for decisions
  if (isDecision) {
    return (
      <div onClick={handleNodeClick}
        className={`relative border-2 shadow-md transition-all ${bgColor} ${borderColor} ${selected ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : 'hover:shadow-md'} group`}
        style={{ borderRadius: '8px', transform: 'rotate(0deg)', minWidth: '160px' }}
      >
        <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-background" />
        <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button onClick={handleDuplicate} className="p-0.5 rounded-full bg-background border shadow-sm hover:bg-accent" title="Duplicar"><Copy className="h-2.5 w-2.5" /></button>
          <button onClick={handleDelete} className="p-0.5 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground" title="Excluir"><Trash2 className="h-2.5 w-2.5" /></button>
        </div>
        {/* Top accent bar */}
        <div className="h-1 bg-amber-400 rounded-t-md" />
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700">
              <GitBranch className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Decisão</span>
          </div>
          <h4 className="font-semibold text-sm leading-tight">{nodeData.label}</h4>
          {nodeData.condicao && <p className="text-[11px] text-amber-700 bg-amber-100/60 px-2 py-1 rounded mt-1.5 italic">{nodeData.condicao}</p>}
        </div>
        <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-background" id="a" />
        <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-background" id="b" />
      </div>
    );
  }

  // Standard process node - cleaner card design
  return (
    <div onClick={handleNodeClick}
      className={`relative rounded-xl border shadow-sm transition-all ${bgColor} ${borderColor} ${selected ? 'ring-2 ring-primary ring-offset-2 shadow-lg border-primary/50' : 'hover:shadow-md hover:border-primary/30'} ${hasLink ? 'cursor-pointer' : ''} group`}
      style={{ minWidth: '200px', maxWidth: '260px' }}
      title={hasLink ? 'Duplo clique para abrir o link' : undefined}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-background" />
      
      {/* Action buttons */}
      <div className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button onClick={handleDuplicate} className="p-0.5 rounded-full bg-background border shadow-sm hover:bg-accent" title="Duplicar"><Copy className="h-2.5 w-2.5" /></button>
        <button onClick={handleDelete} className="p-0.5 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground" title="Excluir"><Trash2 className="h-2.5 w-2.5" /></button>
      </div>

      {/* Top colored accent bar */}
      <div className={`h-1 rounded-t-xl ${config?.color?.replace('text-', 'bg-').replace('-700', '-400') || 'bg-primary'}`} />

      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${config?.color || ''} bg-opacity-10`} 
               style={{ backgroundColor: `color-mix(in srgb, currentColor 12%, transparent)` }}>
            {Icon && <Icon className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">{config?.label || nodeData.type}</span>
            <h4 className="font-semibold text-[13px] leading-tight truncate">{nodeData.label}</h4>
          </div>
          {hasLink && <Link className="h-3.5 w-3.5 text-primary shrink-0" />}
        </div>

        {/* Description */}
        {nodeData.descricao && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{nodeData.descricao}</p>
        )}

        {/* Status badge */}
        {nodeData.status && (
          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[nodeData.status]}`}>
            {statusLabels[nodeData.status]}
          </span>
        )}

        {/* Condition */}
        {nodeData.condicao && (
          <div className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md border border-amber-200/50">
            {nodeData.condicao}
          </div>
        )}

        {/* Metrics row */}
        {(nodeData.conversao !== undefined || nodeData.valor !== undefined) && (
          <div className="flex gap-1.5">
            {nodeData.conversao !== undefined && (
              <span className="text-[10px] text-green-700 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md font-medium">
                {nodeData.conversao}% conv.
              </span>
            )}
            {nodeData.valor !== undefined && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md font-medium">
                R$ {nodeData.valor.toLocaleString('pt-BR')}
              </span>
            )}
          </div>
        )}

        {/* Meta info chips */}
        {(nodeData.responsavel || formatTempo() || nodeData.sla || nodeData.sistemaNome) && (
          <div className="flex flex-wrap gap-1 pt-0.5 border-t border-border/50">
            {nodeData.responsavel && (
              <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 text-muted-foreground">
                <User className="h-2.5 w-2.5" />{nodeData.responsavel}
              </span>
            )}
            {formatTempo() && (
              <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />{formatTempo()}
              </span>
            )}
            {nodeData.sla && (
              <span className="text-[10px] bg-rose-50 dark:bg-rose-900/20 text-rose-600 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Timer className="h-2.5 w-2.5" />SLA {nodeData.sla}h
              </span>
            )}
            {nodeData.sistemaNome && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800/40 text-slate-600 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Server className="h-2.5 w-2.5" />{nodeData.sistemaNome}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-background" />
    </div>
  );
};

export const ProcessNode = memo(ProcessNodeComponent);
