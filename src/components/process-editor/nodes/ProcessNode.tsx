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

export const nodeColorMap: Record<NodeColor, { bg: string; border: string }> = {
  default: { bg: '', border: '' },
  red: { bg: 'bg-red-50', border: 'border-red-400' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-400' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-400' },
  green: { bg: 'bg-green-50', border: 'border-green-400' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-400' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-400' }
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

  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); if (deleteNodeCallback) deleteNodeCallback(id); };
  const handleDuplicate = (e: React.MouseEvent) => { e.stopPropagation(); if (duplicateNodeCallback) duplicateNodeCallback(id); };
  const handleNodeClick = (e: React.MouseEvent) => { if (hasLink && e.detail === 2) { e.stopPropagation(); window.open(nodeData.link, '_blank', 'noopener,noreferrer'); } };

  const formatTempo = () => {
    if (!nodeData.tempoEstimado) return null;
    return `${nodeData.tempoEstimado} ${nodeData.tempoUnidade || 'minutos'}`;
  };

  return (
    <div onClick={handleNodeClick}
      className={`relative min-w-[180px] max-w-[240px] rounded-lg border-2 shadow-sm transition-all ${bgColor} ${borderColor} ${selected ? 'ring-2 ring-primary ring-offset-2' : ''} ${hasLink ? 'cursor-pointer hover:shadow-md' : ''} group`}
      title={hasLink ? 'Duplo clique para abrir o link' : undefined}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3" />
      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button onClick={handleDuplicate} className="p-1 rounded bg-background border shadow-sm hover:bg-accent" title="Duplicar"><Copy className="h-3 w-3" /></button>
        <button onClick={handleDelete} className="p-1 rounded bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground" title="Excluir"><Trash2 className="h-3 w-3" /></button>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded ${config?.color || ''}`}>{Icon && <Icon className="h-4 w-4" />}</div>
          <span className="text-xs font-medium text-muted-foreground uppercase flex-1">{config?.label || nodeData.type}</span>
          {hasLink && <Link className="h-3 w-3 text-primary" />}
        </div>
        <h4 className="font-medium text-sm leading-tight mb-2">{nodeData.label}</h4>
        {nodeData.descricao && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{nodeData.descricao}</p>}
        {nodeData.status && <div className="mb-2"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[nodeData.status]}`}>{statusLabels[nodeData.status]}</span></div>}
        {nodeData.condicao && <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded mb-2">{nodeData.condicao}</div>}
        {nodeData.conversao !== undefined && <div className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded mb-2">Conversão: {nodeData.conversao}%</div>}
        {nodeData.valor !== undefined && <div className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded mb-2">R$ {nodeData.valor.toLocaleString('pt-BR')}</div>}
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          {nodeData.responsavel && <span className="bg-muted px-1.5 py-0.5 rounded flex items-center gap-1"><User className="h-3 w-3" />{nodeData.responsavel}</span>}
          {formatTempo() && <span className="bg-muted px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="h-3 w-3" />{formatTempo()}</span>}
          {nodeData.sla && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Timer className="h-3 w-3" />SLA: {nodeData.sla}h</span>}
          {nodeData.sistemaNome && <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Server className="h-3 w-3" />{nodeData.sistemaNome}</span>}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
    </div>
  );
};

export const ProcessNode = memo(ProcessNodeComponent);
