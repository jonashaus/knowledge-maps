"use client";

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  type InternalNode,
  useInternalNode,
  useStore,
} from "@xyflow/react";
import { memo, useState } from "react";
import { depthScale, edgeLabelVisible } from "@/lib/lod";
import { cn } from "@/lib/utils";
import { useMapStore } from "@/store/map-store";

export interface FloatingEdgeData extends Record<string, unknown> {
  kind: "tree" | "link";
  label?: string;
  /** Depth of the deeper end, used for label size and visibility. */
  depth: number;
  hidden: boolean;
}

export type FloatingEdgeType = Edge<FloatingEdgeData, "floating">;

function center(node: InternalNode) {
  const { x, y } = node.internals.positionAbsolute;
  return {
    x: x + (node.measured.width ?? 0) / 2,
    y: y + (node.measured.height ?? 0) / 2,
  };
}

/** Point where the line from the node's center towards `to` leaves the node's box. */
function borderPoint(node: InternalNode, to: { x: number; y: number }) {
  const c = center(node);
  const hw = (node.measured.width ?? 0) / 2;
  const hh = (node.measured.height ?? 0) / 2;
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  if (!dx && !dy) return c;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

function LabelEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const { setEdgeLabel, setEditingEdge } = useMapStore.getState();
  const commit = () => {
    setEdgeLabel(id, value);
    setEditingEdge(null);
  };
  return (
    <input
      autoFocus
      value={value}
      placeholder="Label"
      size={Math.max(6, value.length + 1)}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditingEdge(null);
        e.stopPropagation();
      }}
    />
  );
}

function FloatingEdgeImpl({ id, source, target, data, selected }: EdgeProps<FloatingEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const editing = useMapStore((s) => s.editingEdgeId === id);
  const exporting = useMapStore((s) => s.exporting);
  const depth = data?.depth ?? 1;
  const labelReadable = useStore((s) => edgeLabelVisible(s.transform[2], depth));

  if (!sourceNode || !targetNode || !data) return null;

  const sc = center(sourceNode);
  const tc = center(targetNode);
  const sp = borderPoint(sourceNode, tc);
  const tp = borderPoint(targetNode, sc);

  let path: string;
  let labelX: number;
  let labelY: number;
  if (data.kind === "link") {
    // Cross-links curve slightly so they don't hide behind tree edges.
    const mx = (sp.x + tp.x) / 2;
    const my = (sp.y + tp.y) / 2;
    const cx = mx - (tp.y - sp.y) * 0.18;
    const cy = my + (tp.x - sp.x) * 0.18;
    path = `M ${sp.x},${sp.y} Q ${cx},${cy} ${tp.x},${tp.y}`;
    labelX = 0.25 * sp.x + 0.5 * cx + 0.25 * tp.x;
    labelY = 0.25 * sp.y + 0.5 * cy + 0.25 * tp.y;
  } else {
    path = `M ${sp.x},${sp.y} L ${tp.x},${tp.y}`;
    labelX = (sp.x + tp.x) / 2;
    labelY = (sp.y + tp.y) / 2;
  }

  const showLabel =
    !data.hidden && (editing || (!!data.label && (labelReadable || exporting)));

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={18}
        className={cn("km-edge", data.kind === "link" && "km-edge-link", selected && "km-edge-selected")}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className={cn("km-edge-label nodrag nopan", selected && "km-edge-label-selected")}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 13 * depthScale(depth),
            }}
            onDoubleClick={() => useMapStore.getState().setEditingEdge(id)}
          >
            {editing ? <LabelEditor id={id} initial={data.label ?? ""} /> : data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FloatingEdge = memo(FloatingEdgeImpl);
