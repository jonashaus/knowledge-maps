import type { JSONContent } from "@tiptap/react";

export interface MapNode {
  id: string;
  parentId: string | null;
  /** Position among siblings (0..n-1). */
  order: number;
  title: string;
  /** TipTap document, or null when the node has no body. */
  content: JSONContent | null;
  /** Label of the edge coming from the parent. */
  edgeLabel?: string;
  /** Custom width in unscaled px. Undefined = auto width. */
  width?: number;
}

export interface CrossLink {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface KnowledgeMap {
  id: string;
  /** Empty name falls back to the root node's title. */
  name: string;
  rootId: string;
  nodes: Record<string, MapNode>;
  links: CrossLink[];
  createdAt: number;
  updatedAt: number;
}

export interface MapMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExportFile {
  format: "knowledge-maps";
  version: 1;
  exportedAt: string;
  map: KnowledgeMap;
}
