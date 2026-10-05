"use client";

import {
  type EdgeChange,
  type EdgeTypes,
  type FinalConnectionState,
  type NodeChange,
  type NodeTypes,
  type OnNodeDrag,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  useStore,
  useStoreApi,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { radialLayout, relativeAngle, type Size } from "@/lib/layout";
import { depthScale, maxVisibleDepth } from "@/lib/lod";
import type { MapNode } from "@/lib/types";
import { childrenMap, depthMap, descendants, plainText } from "@/lib/tree";
import { useMapStore, treeEdgeId } from "@/store/map-store";
import { FloatingEdge, type FloatingEdgeType } from "./floating-edge";
import { MindNode, type MindNodeData, type MindNodeType } from "./mind-node";
import { useAnimatedPositions } from "./use-animated-positions";

const nodeTypes: NodeTypes = { mind: MindNode };
const edgeTypes: EdgeTypes = { floating: FloatingEdge };

const estimateSize = (depth: number): Size => ({
  w: 150 * depthScale(depth),
  h: 46 * depthScale(depth),
});

// Reuse data objects so unchanged nodes don't re-render (map nodes are immutable).
const dataCache = new WeakMap<MapNode, MindNodeData>();

function nodeIdAtPoint(x: number, y: number, exclude: string) {
  for (const el of document.elementsFromPoint(x, y)) {
    const nodeEl = el.closest<HTMLElement>(".react-flow__node");
    const id = nodeEl?.dataset.id;
    if (id && id !== exclude && !nodeEl.classList.contains("km-hidden")) return id;
  }
  return null;
}

function clientPoint(event: MouseEvent | TouchEvent) {
  if ("changedTouches" in event) {
    const t = event.changedTouches[0];
    return { x: t.clientX, y: t.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

export function MapCanvas() {
  const map = useMapStore((s) => s.map)!;
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const editingId = useMapStore((s) => s.editing?.id ?? null);
  const exporting = useMapStore((s) => s.exporting);
  const { resolvedTheme } = useTheme();
  const reactFlow = useReactFlow();
  const storeApi = useStoreApi();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragInfo = useRef<{ excluded: Set<string> } | null>(null);

  const { children, depth } = useMemo(() => {
    const children = childrenMap(map.nodes);
    return { children, depth: depthMap(map.rootId, children) };
  }, [map.nodes, map.rootId]);

  const layout = useMemo(
    () =>
      radialLayout(map.rootId, children, depth, (id) => sizes[id] ?? estimateSize(depth[id])),
    [map.rootId, children, depth, sizes],
  );

  // Animate only after the first measured layout, so the map doesn't fly in on load.
  const initialized = useNodesInitialized();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!initialized || settled) return;
    const raf = requestAnimationFrame(() => {
      reactFlow.fitView({ maxZoom: 1, padding: 0.2 });
      setSettled(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [initialized, settled, reactFlow]);

  const [centers, setCurrentCenter] = useAnimatedPositions(layout.centers, {
    animate: settled,
    spawnFrom: (id) => {
      const parent = map.nodes[id]?.parentId;
      return parent ? layout.centers[parent] : undefined;
    },
  });

  // Expose the zoom as a CSS variable (used to size zoomed-out titles) without re-rendering.
  useEffect(() => {
    const apply = (zoom: number) => wrapperRef.current?.style.setProperty("--zoom", String(zoom));
    apply(storeApi.getState().transform[2]);
    return storeApi.subscribe((s) => apply(s.transform[2]));
  }, [storeApi]);

  const zoomVisibleDepth = useStore((s) => maxVisibleDepth(s.transform[2]));
  const visibleDepth = exporting ? Infinity : zoomVisibleDepth;

  const nodes = useMemo<MindNodeType[]>(() => {
    const result: MindNodeType[] = [];
    for (const n of Object.values(map.nodes)) {
      const d = depth[n.id];
      if (d === undefined) continue;
      let data = dataCache.get(n);
      if (!data || data.depth !== d || data.isRoot !== (n.id === map.rootId)) {
        data = {
          node: n,
          depth: d,
          isRoot: n.id === map.rootId,
          summary: n.content ? plainText(n.content, 220) : "",
        };
        dataCache.set(n, data);
      }
      const size = sizes[n.id] ?? estimateSize(d);
      const c = centers[n.id] ?? layout.centers[n.id];
      result.push({
        id: n.id,
        type: "mind",
        position:
          drag?.id === n.id
            ? { x: drag.x, y: drag.y }
            : { x: c.x - size.w / 2, y: c.y - size.h / 2 },
        data,
        // Controlled nodes must carry a measured size, or React Flow keeps them invisible
        // (and unfocusable) until measured. New nodes start with an estimate.
        measured: { width: size.w, height: size.h },
        selected: n.id === selectedNodeId,
        draggable: n.id !== map.rootId && editingId !== n.id,
        className: d > visibleDepth ? "km-hidden" : undefined,
        zIndex: drag?.id === n.id || editingId === n.id ? 10 : d === 0 ? 1 : 0,
      });
    }
    return result;
  }, [map.nodes, map.rootId, depth, sizes, centers, layout, drag, selectedNodeId, editingId, visibleDepth]);

  const edges = useMemo<FloatingEdgeType[]>(() => {
    const result: FloatingEdgeType[] = [];
    for (const n of Object.values(map.nodes)) {
      if (!n.parentId || depth[n.id] === undefined) continue;
      const id = treeEdgeId(n.id);
      const hidden = depth[n.id] > visibleDepth;
      result.push({
        id,
        source: n.parentId,
        target: n.id,
        sourceHandle: "s",
        targetHandle: "t",
        type: "floating",
        selected: id === selectedEdgeId,
        className: hidden ? "km-hidden" : undefined,
        data: { kind: "tree", label: n.edgeLabel, depth: depth[n.id], hidden },
      });
    }
    for (const l of map.links) {
      const d = Math.max(depth[l.source] ?? 0, depth[l.target] ?? 0);
      const hidden = d > visibleDepth;
      result.push({
        id: l.id,
        source: l.source,
        target: l.target,
        sourceHandle: "s",
        targetHandle: "t",
        type: "floating",
        selected: l.id === selectedEdgeId,
        className: hidden ? "km-hidden" : undefined,
        data: { kind: "link", label: l.label, depth: d, hidden },
      });
    }
    return result;
  }, [map.nodes, map.links, depth, selectedEdgeId, visibleDepth]);

  const onNodesChange = useCallback((changes: NodeChange<MindNodeType>[]) => {
    const measured: Record<string, Size> = {};
    let hasMeasured = false;
    for (const change of changes) {
      if (change.type === "dimensions" && change.dimensions) {
        measured[change.id] = { w: change.dimensions.width, h: change.dimensions.height };
        hasMeasured = true;
      } else if (change.type === "position" && change.dragging && change.position) {
        setDrag({ id: change.id, x: change.position.x, y: change.position.y });
      } else if (change.type === "select" && change.selected) {
        useMapStore.getState().select(change.id);
      }
    }
    if (hasMeasured) {
      setSizes((prev) => {
        const changed = Object.entries(measured).some(
          ([id, s]) => prev[id]?.w !== s.w || prev[id]?.h !== s.h,
        );
        return changed ? { ...prev, ...measured } : prev;
      });
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<FloatingEdgeType>[]) => {
    for (const change of changes) {
      if (change.type === "select" && change.selected) {
        useMapStore.getState().selectEdge(change.id);
      }
    }
  }, []);

  const onNodeDragStart: OnNodeDrag<MindNodeType> = useCallback(
    (_, node) => {
      useMapStore.getState().select(node.id);
      dragInfo.current = { excluded: new Set([node.id, ...descendants(node.id, children)]) };
    },
    [children],
  );

  const onNodeDrag: OnNodeDrag<MindNodeType> = useCallback((event, node) => {
    const { x, y } = clientPoint(event);
    const excluded = dragInfo.current?.excluded;
    let target = nodeIdAtPoint(x, y, node.id);
    if (target && excluded?.has(target)) target = null;
    useMapStore.getState().setDropTarget(target);
  }, []);

  const onNodeDragStop: OnNodeDrag<MindNodeType> = useCallback(
    (_, node) => {
      const store = useMapStore.getState();
      const dropTarget = store.dropTargetId;
      store.setDropTarget(null);
      dragInfo.current = null;
      const size = sizes[node.id] ?? estimateSize(depth[node.id]);
      const dropCenter = { x: node.position.x + size.w / 2, y: node.position.y + size.h / 2 };
      setCurrentCenter(node.id, dropCenter);
      setDrag(null);

      const parentId = map.nodes[node.id].parentId!;
      if (dropTarget && dropTarget !== parentId) {
        store.moveNode(node.id, dropTarget, (children[dropTarget] ?? []).length);
        return;
      }
      // Dropped on empty canvas: reorder among siblings by angle around the parent.
      const parentCenter = layout.centers[parentId];
      const parentAngle = parentId === map.rootId ? undefined : layout.angles[parentId];
      const theta = Math.atan2(dropCenter.y - parentCenter.y, dropCenter.x - parentCenter.x);
      const rel = relativeAngle(theta, parentAngle);
      const siblings = children[parentId].filter((id) => id !== node.id);
      const index = siblings.filter(
        (id) => relativeAngle(layout.angles[id], parentAngle) < rel,
      ).length;
      store.moveNode(node.id, parentId, index);
    },
    [sizes, depth, map.nodes, map.rootId, children, layout, setCurrentCenter],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      const from = state.fromNode?.id;
      if (!from || state.fromHandle?.id !== "link") return;
      const { x, y } = clientPoint(event);
      const target = nodeIdAtPoint(x, y, from);
      if (target) useMapStore.getState().addLink(from, target);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    const store = useMapStore.getState();
    store.stopEditing();
    store.setEditingEdge(null);
    store.select(null);
  }, []);

  // Bring a node into view when it starts being edited (e.g. a freshly added child).
  useEffect(() => {
    if (!editingId || !settled) return;
    const timer = setTimeout(() => {
      const node = reactFlow.getInternalNode(editingId);
      const el = wrapperRef.current;
      if (!node || !el) return;
      const { x, y, zoom } = reactFlow.getViewport();
      const w = node.measured.width ?? 0;
      const h = node.measured.height ?? 0;
      const left = node.internals.positionAbsolute.x * zoom + x;
      const top = node.internals.positionAbsolute.y * zoom + y;
      const margin = 40;
      const outside =
        left < margin ||
        top < margin ||
        left + w * zoom > el.clientWidth - margin ||
        top + h * zoom > el.clientHeight - margin;
      if (outside) {
        reactFlow.setCenter(
          node.internals.positionAbsolute.x + w / 2,
          node.internals.positionAbsolute.y + h / 2,
          { zoom, duration: 300 },
        );
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [editingId, settled, reactFlow]);

  return (
    <div ref={wrapperRef} className="km-canvas absolute inset-0" data-exporting={exporting || undefined}>
      <ReactFlow<MindNodeType, FloatingEdgeType>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onEdgeDoubleClick={(_, edge) => useMapStore.getState().setEditingEdge(edge.id)}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        minZoom={0.04}
        maxZoom={2.5}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        nodeDragThreshold={4}
        connectionLineStyle={{ strokeDasharray: "5 5" }}
        attributionPosition="bottom-left"
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
      />
    </div>
  );
}
