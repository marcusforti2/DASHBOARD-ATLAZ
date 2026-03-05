import React, { memo } from 'react';
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
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
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 12,
  });

  const edgeData = data as ProcessEdgeData | undefined;
  const edgeColor = edgeData?.color || 'default';
  const thickness = edgeData?.thickness || 2;
  const speed = edgeData?.speed || 1;
  const animationDuration = 3 / speed;
  const edgeLabel = label || edgeData?.label;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges(eds => eds.filter(edge => edge.id !== id));
  };

  const isDecisionEdge = edgeColor === 'green' || edgeColor === 'red';
  const strokeColor = edgeColorMap[edgeColor];

  return (
    <>
      {/* Shadow/glow for selected edges */}
      {selected && (
        <path d={edgePath} fill="none" stroke={strokeColor} strokeWidth={thickness + 4}
          strokeLinecap="round" opacity={0.2}
        />
      )}
      {/* Main edge path */}
      <path id={id} d={edgePath} fill="none" stroke={strokeColor}
        strokeWidth={selected ? thickness + 1 : thickness} strokeLinecap="round"
        strokeDasharray={isDecisionEdge ? undefined : undefined}
        style={{ transition: 'stroke-width 0.2s ease' }}
      />
      {/* Animated dot */}
      <circle r={3} fill={pulseColorMap[edgeColor]} opacity={0.8}>
        <animateMotion dur={`${animationDuration}s`} repeatCount="indefinite" path={edgePath} />
      </circle>
      {/* Hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer' }} />
      <EdgeLabelRenderer>
        <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }} className="flex items-center gap-1">
          {edgeLabel && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-sm border ${
              edgeColor === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
              edgeColor === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
              'bg-background text-foreground border-border'
            }`}>
              {edgeLabel}
            </span>
          )}
          {selected && (
            <button onClick={handleDelete} className="p-0.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm" title="Excluir">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ProcessEdge.displayName = 'ProcessEdge';
