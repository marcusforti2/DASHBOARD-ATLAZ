import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Connection, Node, MarkerType, Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Save, Plus, Mail, Clock, GitBranch, Zap, Users, Send, Trash2, Eye,
} from "lucide-react";

import TriggerNode from './nodes/TriggerNode';
import EmailNode from './nodes/EmailNode';
import WaitNode from './nodes/WaitNode';
import ConditionNode from './nodes/ConditionNode';

const nodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
  wait: WaitNode,
  condition: ConditionNode,
};

interface FlowEditorProps {
  flow: {
    id: string;
    name: string;
    description?: string | null;
    nodes: any[];
    edges: any[];
    audience_type?: string;
  };
  templates: any[];
  onSave: (nodes: any[], edges: any[], audienceType: string, name?: string, description?: string) => void;
  onClose: () => void;
}

const TRIGGER_TYPES = [
  { value: 'new_member', label: 'Novo Membro', icon: Users },
  { value: 'manual', label: 'Disparo Manual', icon: Zap },
  { value: 'schedule', label: 'Agendamento', icon: Clock },
];

const NODE_TEMPLATES = [
  { type: 'email', label: 'Enviar Email', icon: Mail, color: '#3b82f6' },
  { type: 'wait', label: 'Aguardar', icon: Clock, color: '#f59e0b' },
  { type: 'condition', label: 'Condição', icon: GitBranch, color: '#8b5cf6' },
];

export default function FlowEditor({ flow, templates, onSave, onClose }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isNodeSheetOpen, setIsNodeSheetOpen] = useState(false);
  const [audienceType, setAudienceType] = useState<string>(flow.audience_type || 'all');
  const [flowName, setFlowName] = useState(flow.name);
  const [flowDescription, setFlowDescription] = useState(flow.description || '');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    if (nodes.length === 0) {
      setNodes([{
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: { label: 'Gatilho', triggerType: 'manual', config: {} },
      }]);
    }
  }, []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsNodeSheetOpen(true);
  }, []);

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 250, y: nodes.length * 150 + 100 },
      data: getDefaultNodeData(type),
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const getDefaultNodeData = (type: string) => {
    switch (type) {
      case 'trigger': return { label: 'Gatilho', triggerType: 'manual', config: {} };
      case 'email': return { label: 'Enviar Email', subject: '', templateId: '', body: '' };
      case 'wait': return { label: 'Aguardar', duration: 1, unit: 'days' };
      case 'condition': return { label: 'Condição', conditionType: 'is_sdr', config: {} };
      default: return { label: type };
    }
  };

  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const updated = { ...node, data: { ...node.data, ...newData } };
          if (selectedNode?.id === nodeId) setSelectedNode(updated);
          return updated;
        }
        return node;
      })
    );
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setIsNodeSheetOpen(false);
    setSelectedNode(null);
  };

  const handleSave = () => {
    onSave(nodes, edges, audienceType, flowName, flowDescription);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            {isEditingName ? (
              <Input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                className="h-8 text-lg font-bold w-64"
                autoFocus
              />
            ) : (
              <h2 className="text-xl font-bold cursor-pointer hover:text-primary transition-colors" onClick={() => setIsEditingName(true)}>
                {flowName}
              </h2>
            )}
            <p className="text-sm text-muted-foreground">Editor de Fluxo</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={audienceType} onValueChange={setAudienceType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda equipe</SelectItem>
              <SelectItem value="sdrs">Só SDRs</SelectItem>
              <SelectItem value="closers">Só Closers</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-left" className="flex gap-2">
            {NODE_TEMPLATES.map((t) => (
              <Button key={t.type} variant="outline" size="sm" onClick={() => addNode(t.type)} className="gap-1.5">
                <t.icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                {t.label}
              </Button>
            ))}
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Editor Sheet */}
      <Sheet open={isNodeSheetOpen} onOpenChange={setIsNodeSheetOpen}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>Configurar Nó</SheetTitle>
          </SheetHeader>
          {selectedNode && (
            <div className="space-y-4 mt-4">
              {selectedNode.type === 'trigger' && (
                <div className="space-y-3">
                  <Label>Tipo de Gatilho</Label>
                  <Select
                    value={selectedNode.data.triggerType as string || 'manual'}
                    onValueChange={(v) => updateNodeData(selectedNode.id, { triggerType: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedNode.type === 'email' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input
                      value={selectedNode.data.subject as string || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { subject: e.target.value })}
                      placeholder="Assunto do email..."
                    />
                  </div>
                  {templates.length > 0 && (
                    <div className="space-y-2">
                      <Label>Ou usar Template</Label>
                      <Select
                        value={selectedNode.data.templateId as string || ''}
                        onValueChange={(v) => updateNodeData(selectedNode.id, { templateId: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecionar template" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhum (usar corpo abaixo)</SelectItem>
                          {templates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Corpo (HTML)</Label>
                    <Textarea
                      value={selectedNode.data.body as string || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { body: e.target.value })}
                      rows={8}
                      className="font-mono text-xs"
                      placeholder="<p>Olá {{nome}}!</p>"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{role}}"}, {"{{metricas_hoje}}"}, {"{{progresso_meta}}"}
                  </p>
                </div>
              )}

              {selectedNode.type === 'wait' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Input
                      type="number"
                      min={1}
                      value={selectedNode.data.duration as number || 1}
                      onChange={(e) => updateNodeData(selectedNode.id, { duration: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select
                      value={selectedNode.data.unit as string || 'days'}
                      onValueChange={(v) => updateNodeData(selectedNode.id, { unit: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Horas</SelectItem>
                        <SelectItem value="days">Dias</SelectItem>
                        <SelectItem value="weeks">Semanas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div className="space-y-3">
                  <Label>Tipo de Condição</Label>
                  <Select
                    value={selectedNode.data.conditionType as string || 'is_sdr'}
                    onValueChange={(v) => updateNodeData(selectedNode.id, { conditionType: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opened_email">Abriu email?</SelectItem>
                      <SelectItem value="is_sdr">É SDR?</SelectItem>
                      <SelectItem value="is_closer">É Closer?</SelectItem>
                      <SelectItem value="inactive_days">Inativo há X dias?</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteNode(selectedNode.id)}
                className="w-full mt-4"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover Nó
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
