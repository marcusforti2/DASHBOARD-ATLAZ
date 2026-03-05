import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow, Node, Edge, addEdge, Connection, useNodesState, useEdgesState,
  Controls, Background, BackgroundVariant, ReactFlowProvider, ReactFlowInstance,
  useReactFlow, MiniMap, SelectionMode, ConnectionLineType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProcessToolbar } from './ProcessToolbar';
import { ProcessPropertiesPanel } from './ProcessPropertiesPanel';
import { ProcessTemplateDialog } from './ProcessTemplateDialog';
import { ProcessSaveDialog } from './ProcessSaveDialog';
import { ProcessLoadDialog } from './ProcessLoadDialog';
import { AIProcessDialog } from './AIProcessDialog';
import { ProcessTimeCalculator } from './ProcessTimeCalculator';
import { ProcessShareDialog } from './ProcessShareDialog';
import { ProcessNode, setNodeCallbacks } from './nodes';
import { ProcessEdge } from './edges';
import { ProcessNodeType, ProcessNodeData, ProcessTemplate } from './types';
import { nodeTypeConfigs } from './nodeConfig';

const nodeTypes = { processNode: ProcessNode };
const edgeTypes = { processEdge: ProcessEdge };

function ProcessEditorInner() {
  const { user } = useAuth();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [currentProcessName, setCurrentProcessName] = useState('');
  const [currentProcessDescription, setCurrentProcessDescription] = useState('');
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const deleteNode = useCallback((id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  }, [setNodes, setEdges, selectedNode]);

  const duplicateNode = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const nd = node.data as unknown as ProcessNodeData;
    setNodes(nds => [...nds, { ...node, id: `${Date.now()}`, position: { x: node.position.x + 50, y: node.position.y + 50 }, selected: false, data: { ...node.data, label: `${nd.label} (cópia)` } }]);
  }, [nodes, setNodes]);

  useEffect(() => { setNodeCallbacks(deleteNode, duplicateNode); }, [deleteNode, duplicateNode]);

  const saveToHistory = useCallback(() => {
    const nh = history.slice(0, historyIndex + 1);
    nh.push({ nodes: [...nodes], edges: [...edges] });
    if (nh.length > 50) nh.shift();
    setHistory(nh);
    setHistoryIndex(nh.length - 1);
  }, [nodes, edges, history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const undo = useCallback(() => { if (canUndo) { const p = history[historyIndex - 1]; setNodes(p.nodes); setEdges(p.edges); setHistoryIndex(historyIndex - 1); } }, [canUndo, history, historyIndex, setNodes, setEdges]);
  const redo = useCallback(() => { if (canRedo) { const n = history[historyIndex + 1]; setNodes(n.nodes); setEdges(n.edges); setHistoryIndex(historyIndex + 1); } }, [canRedo, history, historyIndex, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    saveToHistory();
    const sourceNode = nodes.find(n => n.id === params.source);
    const isDecision = (sourceNode?.data as unknown as ProcessNodeData)?.type === 'decisao';
    let edgeData: Record<string, unknown> = {};
    if (isDecision) {
      const existing = edges.filter(e => e.source === params.source);
      if (existing.length === 0) edgeData = { label: 'Sim', color: 'green' };
      else if (existing.length === 1) edgeData = { label: 'Não', color: 'red' };
    }
    setEdges(eds => addEdge({ ...params, type: 'processEdge', data: edgeData }, eds));
  }, [setEdges, saveToHistory, nodes, edges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNode(node); }, []);
  const onPaneClick = useCallback(() => { setSelectedNode(null); }, []);

  const addNode = useCallback((type: ProcessNodeType) => {
    saveToHistory();
    const config = nodeTypeConfigs[type];
    let newX = 250, newY = 150;
    if (nodes.length > 0) { const maxX = Math.max(...nodes.map(n => n.position.x)); newX = maxX + 300; const atMax = nodes.filter(n => n.position.x === maxX); newY = atMax.reduce((s, n) => s + n.position.y, 0) / atMax.length; }
    setNodes(nds => [...nds, { id: `${Date.now()}`, type: 'processNode', position: { x: newX, y: newY }, data: { type, ...config.defaultData, label: config.defaultData.label || config.label } }]);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [nodes, setNodes, saveToHistory, fitView]);

  const updateNodeData = useCallback((id: string, data: Partial<ProcessNodeData>) => {
    saveToHistory();
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
    if (selectedNode?.id === id) setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
  }, [setNodes, selectedNode, saveToHistory]);

  const getCanvasOffset = useCallback(() => {
    if (nodes.length === 0) return { x: 0, y: 0 };
    return { x: 0, y: Math.max(...nodes.map(n => n.position.y)) + 300 };
  }, [nodes]);

  const loadTemplate = useCallback((template: ProcessTemplate, addToCanvas = false) => {
    saveToHistory();
    const ts = Date.now(), off = addToCanvas ? getCanvasOffset() : { x: 0, y: 0 };
    const nn = template.nodes.map(n => ({ ...n, id: `${ts}-${n.id}`, position: { x: n.position.x + off.x, y: n.position.y + off.y } }));
    const ne = template.edges.map(e => ({ ...e, id: `${ts}-${e.id}`, source: `${ts}-${e.source}`, target: `${ts}-${e.target}`, type: 'processEdge' }));
    if (addToCanvas) { setNodes(nds => [...nds, ...nn]); setEdges(eds => [...eds, ...ne]); } else { setNodes(nn); setEdges(ne); setCurrentProcessId(null); setCurrentProcessName(''); setCurrentProcessDescription(''); }
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [setNodes, setEdges, saveToHistory, fitView, getCanvasOffset]);

  const autoAlignNodes = useCallback(() => {
    if (nodes.length === 0) return;
    saveToHistory();
    const HS = 300, VS = 150, SX = 100, SY = 200;
    const adj = new Map<string, string[]>(), ind = new Map<string, number>();
    nodes.forEach(n => { adj.set(n.id, []); ind.set(n.id, 0); });
    edges.forEach(e => { adj.get(e.source)?.push(e.target); ind.set(e.target, (ind.get(e.target) || 0) + 1); });
    const starts = nodes.filter(n => (ind.get(n.id) || 0) === 0);
    const levels = new Map<string, number>(), rows = new Map<string, number>(), visited = new Set<string>();
    const queue: { id: string; level: number; row: number }[] = [];
    starts.forEach((n, i) => queue.push({ id: n.id, level: 0, row: i }));
    const ln = new Map<number, string[]>();
    while (queue.length) { const { id, level, row } = queue.shift()!; if (visited.has(id)) continue; visited.add(id); levels.set(id, level); rows.set(id, row); if (!ln.has(level)) ln.set(level, []); ln.get(level)!.push(id); (adj.get(id) || []).forEach((c, i, a) => { if (!visited.has(c)) queue.push({ id: c, level: level + 1, row: row + (a.length > 1 ? i - (a.length - 1) / 2 : 0) }); }); }
    nodes.forEach(n => { if (!visited.has(n.id)) { levels.set(n.id, Math.max(...Array.from(levels.values()), -1) + 1); rows.set(n.id, 0); } });
    ln.forEach(ids => ids.forEach((id, i) => rows.set(id, i - (ids.length - 1) / 2)));
    setNodes(nodes.map(n => ({ ...n, position: { x: SX + (levels.get(n.id) || 0) * HS, y: SY + (rows.get(n.id) || 0) * VS } })));
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [nodes, edges, setNodes, saveToHistory, fitView]);

  const handleAIGenerate = useCallback((newNodes: Node[], newEdges: Edge[], addToCanvas = false) => {
    saveToHistory();
    const off = addToCanvas ? getCanvasOffset() : { x: 0, y: 0 };
    const on = newNodes.map(n => ({ ...n, position: { x: n.position.x + off.x, y: n.position.y + off.y } }));
    const oe = newEdges.map(e => ({ ...e, type: 'processEdge' }));
    if (addToCanvas) { setNodes(nds => [...nds, ...on]); setEdges(eds => [...eds, ...oe]); } else { setNodes(on); setEdges(oe); setCurrentProcessId(null); setCurrentProcessName(''); setCurrentProcessDescription(''); }
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [setNodes, setEdges, saveToHistory, fitView, getCanvasOffset]);

  const handleSave = useCallback(async (name: string, description: string) => {
    if (!user) { toast.error('Faça login para salvar'); return; }
    try {
      if (currentProcessId) {
        const { error } = await supabase.from('process_flows').update({ name, description, nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }).eq('id', currentProcessId);
        if (error) throw error;
        toast.success('Processo atualizado');
      } else {
        const { data, error } = await supabase.from('process_flows').insert([{ user_id: user.id, name, description, nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }]).select().single();
        if (error) throw error;
        setCurrentProcessId(data.id);
        toast.success('Processo salvo');
      }
      setCurrentProcessName(name); setCurrentProcessDescription(description);
    } catch (e) { console.error(e); toast.error('Erro ao salvar'); }
  }, [user, currentProcessId, nodes, edges]);

  const handleLoad = useCallback((process: { id: string; name: string; description: string | null; nodes: Node[]; edges: Edge[] }, addToCanvas = false) => {
    saveToHistory();
    const off = addToCanvas ? getCanvasOffset() : { x: 0, y: 0 };
    const ts = Date.now();
    const on = process.nodes.map(n => ({ ...n, id: addToCanvas ? `${ts}-${n.id}` : n.id, position: { x: n.position.x + off.x, y: n.position.y + off.y } }));
    const oe = process.edges.map(e => ({ ...e, id: addToCanvas ? `${ts}-${e.id}` : e.id, source: addToCanvas ? `${ts}-${e.source}` : e.source, target: addToCanvas ? `${ts}-${e.target}` : e.target, type: 'processEdge' }));
    if (addToCanvas) { setNodes(nds => [...nds, ...on]); setEdges(eds => [...eds, ...oe]); } else { setNodes(on); setEdges(oe); setCurrentProcessId(process.id); setCurrentProcessName(process.name); setCurrentProcessDescription(process.description || ''); }
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [setNodes, setEdges, saveToHistory, fitView, getCanvasOffset]);

  const clearCanvas = useCallback(() => {
    if (nodes.length === 0) return;
    saveToHistory(); setNodes([]); setEdges([]); setSelectedNode(null); setCurrentProcessId(null); setCurrentProcessName(''); setCurrentProcessDescription('');
  }, [nodes.length, setNodes, setEdges, saveToHistory]);

  const handleFitView = useCallback(() => fitView({ padding: 0.2, duration: 300 }), [fitView]);
  const defaultEdgeOptions = useMemo(() => ({ type: 'processEdge' }), []);

  return (
    <TooltipProvider>
      <div className="relative h-full bg-background rounded-lg overflow-hidden border shadow-sm">
        <ProcessToolbar onAddNode={addNode} onReset={clearCanvas} onSave={() => setSaveDialogOpen(true)} onLoad={() => setLoadDialogOpen(true)} onExport={() => {}} onLoadTemplate={() => setTemplateDialogOpen(true)} onAIGenerate={() => setAiDialogOpen(true)} onAutoAlign={autoAlignNodes} onUndo={undo} onRedo={redo} onZoomIn={zoomIn} onZoomOut={zoomOut} onFitView={handleFitView} onShare={() => setShareDialogOpen(true)} canUndo={canUndo} canRedo={canRedo} canShare={!!currentProcessId} processName={currentProcessName} totalTime={<ProcessTimeCalculator nodes={nodes} />} />
        <div ref={reactFlowWrapper} className="h-full">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick} onInit={setReactFlowInstance as any} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={defaultEdgeOptions} fitView snapToGrid snapGrid={[20, 20]} deleteKeyCode={['Backspace', 'Delete']} selectionOnDrag selectionMode={SelectionMode.Partial} connectionLineType={ConnectionLineType.SmoothStep} connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2 }} proOptions={{ hideAttribution: true }}>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap nodeStrokeWidth={3} zoomable pannable className="!bg-background/80" />
          </ReactFlow>
        </div>
        {selectedNode && <ProcessPropertiesPanel node={selectedNode} onUpdate={updateNodeData} onClose={() => setSelectedNode(null)} />}
        <ProcessTemplateDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} onSelect={loadTemplate} />
        <AIProcessDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} onGenerate={handleAIGenerate} />
        <ProcessSaveDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} onSave={handleSave} initialName={currentProcessName} initialDescription={currentProcessDescription} isUpdate={!!currentProcessId} />
        <ProcessLoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} onLoad={handleLoad} />
        <ProcessShareDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} processId={currentProcessId} processName={currentProcessName || 'Processo'} />
      </div>
    </TooltipProvider>
  );
}

export const ProcessEditor: React.FC = () => (<ReactFlowProvider><ProcessEditorInner /></ReactFlowProvider>);
export const ProcessEditorWithProvider = ProcessEditor;
