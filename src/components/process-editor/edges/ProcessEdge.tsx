import React, { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { X } from 'lucide-react';
import { EdgeColor } from '../types';

export const edgeColorMap: Record<EdgeColor, string> = {
  default: '#94a3b8', red: '#f87171', yellow: '#fbbf24', blue: '#60a5fa',
  green: '#4ade80', purple: '#a78bfa', orange: '#fb923c', black: '#475569'
};

export const pulseColorMap: Record<EdgeColor, string> = {
  default: '#64748b', red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6',
  green: '#22c55e', purple: '#8b5cf6', orange: '#f97316', black: '#1e293b'
};

export interface ProcessEdgeData {
  label?: string;
  color?: EdgeColor;
  thickness?: number;
  speed?: number;
  [key: string]: unknown;
}

export const ProcessEdge: React.FC<EdgeProps> = memo(({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, label
}) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition
  });

  const edgeData = data as ProcessEdgeData | undefined;
  const edgeColor = edgeData?.color || 'default';
  const thickness = edgeData?.thickness || 2;
  const speed = edgeData?.speed || 1;
  const animationDuration = 2 / speed;
  const edgeLabel = label || edgeData?.label;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(eds => eds.filter(edge => edge.id !== id));
  };

  return (
    <>
      <path id={id} d={edgePath} fill="none" stroke={edgeColorMap[edgeColor]}
        strokeWidth={selected ? thickness + 1 : thickness} strokeLinecap="round"
        style={{ filter: selected ? 'drop-shadow(0 0 3px rgba(99, 102, 241, 0.5))' : undefined, transition: 'stroke-width 0.2s ease' }}
      />
      <circle r={4} fill={pulseColorMap[edgeColor]}>
        <animateMotion dur={`${animationDuration}s`} repeatCount="indefinite" path={edgePath} />
      </circle>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer' }} />
      <EdgeLabelRenderer>
        <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }} className="flex items-center gap-1">
          {edgeLabel && <span className="bg-background border rounded px-2 py-0.5 text-xs font-medium shadow-sm">{edgeLabel}</span>}
          {selected && (
            <button onClick={handleDelete} className="p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm" title="Excluir conexão">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ProcessEdge.displayName = 'ProcessEdge';
