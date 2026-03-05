import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ProcessNode } from '@/components/process-editor/nodes/ProcessNode';
import { ProcessEdge } from '@/components/process-editor/edges/ProcessEdge';
import { ProcessNodeData } from '@/components/process-editor/types';
import { Loader2, AlertCircle } from 'lucide-react';

const nodeTypes = { processNode: ProcessNode };
const edgeTypes = { processEdge: ProcessEdge };

function ProcessoPublicoInner() {
  const { token } = useParams<{ token: string }>();
  const [process, setProcess] = useState<{ name: string; nodes: Node[]; edges: Edge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (token) load(token); }, [token]);

  const load = async (t: string) => {
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase.from('process_flows').select('name, nodes, edges, is_public').eq('public_token', t).eq('is_public', true).single();
      if (e) { setError(e.code === 'PGRST116' ? 'Processo não encontrado.' : 'Erro ao carregar.'); return; }
      if (!data) { setError('Não encontrado.'); return; }
      setProcess({ name: data.name, nodes: data.nodes as unknown as Node[], edges: data.edges as unknown as Edge[] });
    } catch { setError('Erro ao carregar.'); } finally { setLoading(false); }
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="h-screen w-screen flex items-center justify-center bg-background"><div className="flex flex-col items-center gap-4 text-center max-w-md px-4"><div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center"><AlertCircle className="h-8 w-8 text-destructive" /></div><h1 className="text-xl font-semibold">Link Inválido</h1><p className="text-muted-foreground">{error}</p></div></div>;
  if (!process) return null;

  return (
    <div className="h-screen w-screen bg-background relative">
      <div className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg border"><h1 className="text-lg font-semibold">{process.name}</h1></div>
      <ReactFlow nodes={process.nodes} edges={process.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={4} defaultEdgeOptions={{ type: 'processEdge' }}>
        <Background color="hsl(var(--muted-foreground))" gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export default function ProcessoPublico() { return <ReactFlowProvider><ProcessoPublicoInner /></ReactFlowProvider>; }
