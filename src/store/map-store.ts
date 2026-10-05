"use client";

import type { JSONContent } from "@tiptap/react";
import { create } from "zustand";
import { childrenMap, descendants, isEmptyContent, newId } from "@/lib/tree";
import type { CrossLink, KnowledgeMap, MapNode } from "@/lib/types";

type Snapshot = Pick<KnowledgeMap, "nodes" | "links" | "rootId">;

const HISTORY_LIMIT = 200;
export const treeEdgeId = (childId: string) => `t-${childId}`;

interface MapState {
  map: KnowledgeMap | null;
  past: Snapshot[];
  future: Snapshot[];

  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  editing: { id: string; field: "title" | "body" } | null;
  editingEdgeId: string | null;
  dropTargetId: string | null;
  /** While exporting a PNG, every node is shown in full detail. */
  exporting: boolean;

  /** Snapshot taken when editing started; pushed to history when it ends. */
  editSnapshot: Snapshot | null;

  load: (map: KnowledgeMap) => void;
  rename: (name: string) => void;

  select: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  startEditing: (id: string, field: "title" | "body") => void;
  stopEditing: () => void;
  setEditingEdge: (edgeId: string | null) => void;
  setDropTarget: (id: string | null) => void;
  setExporting: (exporting: boolean) => void;

  addChild: (parentId: string) => string;
  addSibling: (id: string) => string;
  deleteNode: (id: string) => void;
  moveNode: (id: string, parentId: string, index: number) => void;
  setTitle: (id: string, title: string) => void;
  setContent: (id: string, content: JSONContent) => void;
  setWidth: (id: string, width: number | undefined, withHistory: boolean) => void;
  setEdgeLabel: (edgeId: string, label: string) => void;
  addLink: (source: string, target: string) => void;
  deleteLink: (id: string) => void;

  undo: () => void;
  redo: () => void;
}

const snapshot = (map: KnowledgeMap): Snapshot => ({
  nodes: map.nodes,
  links: map.links,
  rootId: map.rootId,
});

/** Renumbers `order` of the given sibling list. */
function reorder(nodes: Record<string, MapNode>, ids: string[]) {
  ids.forEach((id, i) => {
    if (nodes[id].order !== i) nodes[id] = { ...nodes[id], order: i };
  });
}

export const useMapStore = create<MapState>()((set, get) => {
  /** Applies a change to the map, optionally recording an undo step. */
  const change = (
    fn: (map: KnowledgeMap) => Partial<KnowledgeMap>,
    withHistory = true,
  ) => {
    const { map, past } = get();
    if (!map) return;
    const patch = fn(map);
    set({
      map: { ...map, ...patch, updatedAt: Date.now() },
      ...(withHistory
        ? { past: [...past, snapshot(map)].slice(-HISTORY_LIMIT), future: [] }
        : {}),
    });
  };

  const insertNode = (parentId: string, index: number) => {
    const id = newId();
    change((map) => {
      const nodes = { ...map.nodes };
      const siblings = childrenMap(nodes)[parentId] ?? [];
      nodes[id] = { id, parentId, order: 0, title: "", content: null };
      siblings.splice(index, 0, id);
      reorder(nodes, siblings);
      return { nodes };
    });
    set({ selectedNodeId: id, selectedEdgeId: null });
    get().startEditing(id, "title");
    return id;
  };

  return {
    map: null,
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    editing: null,
    editingEdgeId: null,
    dropTargetId: null,
    exporting: false,
    editSnapshot: null,

    load: (map) =>
      set({
        map,
        past: [],
        future: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        editing: null,
        editingEdgeId: null,
        editSnapshot: null,
      }),

    rename: (name) => change(() => ({ name }), false),

    select: (nodeId) => {
      const { editing } = get();
      if (editing && editing.id !== nodeId) get().stopEditing();
      set({ selectedNodeId: nodeId, selectedEdgeId: null });
    },
    selectEdge: (edgeId) => {
      if (get().editing) get().stopEditing();
      set({ selectedEdgeId: edgeId, selectedNodeId: null });
    },

    startEditing: (id, field) => {
      const { map, editing, editSnapshot } = get();
      if (!map) return;
      if (editing && editing.id !== id) get().stopEditing();
      set({
        editing: { id, field },
        selectedNodeId: id,
        selectedEdgeId: null,
        editSnapshot:
          editing?.id === id && editSnapshot ? editSnapshot : snapshot(get().map!),
      });
    },

    stopEditing: () => {
      const { editing, editSnapshot, map, past } = get();
      if (!editing || !map) return;
      let nodes = map.nodes;
      const node = nodes[editing.id];
      // Drop empty bodies so the node shrinks back to its title.
      if (node && node.content && isEmptyContent(node.content)) {
        nodes = { ...nodes, [node.id]: { ...node, content: null } };
      }
      const changed = editSnapshot && editSnapshot.nodes !== nodes;
      set({
        editing: null,
        editSnapshot: null,
        map: nodes === map.nodes ? map : { ...map, nodes },
        ...(changed ? { past: [...past, editSnapshot].slice(-HISTORY_LIMIT), future: [] } : {}),
      });
    },

    setEditingEdge: (editingEdgeId) => {
      if (editingEdgeId && get().editing) get().stopEditing();
      set({ editingEdgeId });
    },
    setDropTarget: (dropTargetId) => {
      if (get().dropTargetId !== dropTargetId) set({ dropTargetId });
    },
    setExporting: (exporting) => set({ exporting }),

    addChild: (parentId) => {
      const { map } = get();
      if (!map) return parentId;
      get().stopEditing();
      const count = (childrenMap(map.nodes)[parentId] ?? []).length;
      return insertNode(parentId, count);
    },

    addSibling: (id) => {
      const { map } = get();
      if (!map) return id;
      const node = map.nodes[id];
      if (!node.parentId) return get().addChild(id);
      get().stopEditing();
      return insertNode(node.parentId, node.order + 1);
    },

    deleteNode: (id) => {
      const { map } = get();
      if (!map || id === map.rootId) return;
      get().stopEditing();
      const parentId = map.nodes[id].parentId!;
      change((map) => {
        const children = childrenMap(map.nodes);
        const removed = new Set([id, ...descendants(id, children)]);
        const nodes: Record<string, MapNode> = {};
        for (const n of Object.values(map.nodes)) if (!removed.has(n.id)) nodes[n.id] = n;
        reorder(nodes, children[parentId].filter((c) => !removed.has(c)));
        const links = map.links.filter((l) => !removed.has(l.source) && !removed.has(l.target));
        return { nodes, links };
      });
      set({ selectedNodeId: parentId });
    },

    moveNode: (id, parentId, index) => {
      const { map } = get();
      if (!map || id === map.rootId) return;
      const children = childrenMap(map.nodes);
      if (id === parentId || descendants(id, children).includes(parentId)) return;
      const oldParent = map.nodes[id].parentId!;
      const oldSiblings = children[oldParent].filter((c) => c !== id);
      const newSiblings =
        oldParent === parentId ? oldSiblings : (children[parentId] ?? []).slice();
      const clamped = Math.max(0, Math.min(index, newSiblings.length));
      const unchanged =
        oldParent === parentId && children[parentId].indexOf(id) === clamped;
      if (unchanged) return;
      change((map) => {
        const nodes = { ...map.nodes, [id]: { ...map.nodes[id], parentId } };
        newSiblings.splice(clamped, 0, id);
        if (oldParent !== parentId) reorder(nodes, oldSiblings);
        reorder(nodes, newSiblings);
        return { nodes };
      });
    },

    setTitle: (id, title) =>
      change((map) => ({ nodes: { ...map.nodes, [id]: { ...map.nodes[id], title } } }), false),

    setContent: (id, content) =>
      change((map) => ({ nodes: { ...map.nodes, [id]: { ...map.nodes[id], content } } }), false),

    setWidth: (id, width, withHistory) =>
      change(
        (map) => ({ nodes: { ...map.nodes, [id]: { ...map.nodes[id], width } } }),
        withHistory,
      ),

    setEdgeLabel: (edgeId, label) => {
      const { map } = get();
      if (!map) return;
      const value = label.trim() || undefined;
      if (edgeId.startsWith("t-")) {
        const childId = edgeId.slice(2);
        if (map.nodes[childId]?.edgeLabel === value) return;
        change((map) => ({
          nodes: { ...map.nodes, [childId]: { ...map.nodes[childId], edgeLabel: value } },
        }));
      } else {
        if (map.links.find((l) => l.id === edgeId)?.label === value) return;
        change((map) => ({
          links: map.links.map((l) => (l.id === edgeId ? { ...l, label: value } : l)),
        }));
      }
    },

    addLink: (source, target) => {
      const { map } = get();
      if (!map || source === target) return;
      const exists = map.links.some(
        (l) =>
          (l.source === source && l.target === target) ||
          (l.source === target && l.target === source),
      );
      if (exists) return;
      const link: CrossLink = { id: newId(), source, target };
      change((map) => ({ links: [...map.links, link] }));
      set({ selectedEdgeId: link.id, selectedNodeId: null });
    },

    deleteLink: (id) => {
      change((map) => ({ links: map.links.filter((l) => l.id !== id) }));
      set({ selectedEdgeId: null });
    },

    undo: () => {
      get().stopEditing();
      const { map, past, future } = get();
      if (!map || !past.length) return;
      const prev = past[past.length - 1];
      set({
        map: { ...map, ...prev, updatedAt: Date.now() },
        past: past.slice(0, -1),
        future: [snapshot(map), ...future],
        selectedNodeId: prev.nodes[get().selectedNodeId ?? ""] ? get().selectedNodeId : null,
        selectedEdgeId: null,
      });
    },

    redo: () => {
      get().stopEditing();
      const { map, past, future } = get();
      if (!map || !future.length) return;
      const next = future[0];
      set({
        map: { ...map, ...next, updatedAt: Date.now() },
        past: [...past, snapshot(map)],
        future: future.slice(1),
        selectedNodeId: next.nodes[get().selectedNodeId ?? ""] ? get().selectedNodeId : null,
        selectedEdgeId: null,
      });
    },
  };
});
