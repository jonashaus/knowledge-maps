import type { JSONContent } from "@tiptap/react";
import { nanoid } from "nanoid";
import type { KnowledgeMap, MapNode } from "./types";

export const newId = () => nanoid(10);

export function createEmptyMap(): KnowledgeMap {
  const rootId = newId();
  const now = Date.now();
  return {
    id: newId(),
    name: "",
    rootId,
    nodes: {
      [rootId]: { id: rootId, parentId: null, order: 0, title: "", content: null },
    },
    links: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function displayName(map: Pick<KnowledgeMap, "name" | "rootId" | "nodes">) {
  return map.name.trim() || map.nodes[map.rootId]?.title.trim() || "Untitled map";
}

/** Children of every node, sorted by `order`. */
export function childrenMap(nodes: Record<string, MapNode>) {
  const children: Record<string, string[]> = {};
  for (const n of Object.values(nodes)) {
    children[n.id] ??= [];
    if (n.parentId) (children[n.parentId] ??= []).push(n.id);
  }
  for (const id in children) {
    children[id].sort((a, b) => nodes[a].order - nodes[b].order);
  }
  return children;
}

export function depthMap(rootId: string, children: Record<string, string[]>) {
  const depth: Record<string, number> = { [rootId]: 0 };
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of children[id] ?? []) {
      depth[c] = depth[id] + 1;
      queue.push(c);
    }
  }
  return depth;
}

export function descendants(id: string, children: Record<string, string[]>) {
  const out: string[] = [];
  const stack = [...(children[id] ?? [])];
  while (stack.length) {
    const c = stack.pop()!;
    out.push(c);
    stack.push(...(children[c] ?? []));
  }
  return out;
}

export function plainText(content: JSONContent | null | undefined, limit = Infinity): string {
  if (!content) return "";
  const parts: string[] = [];
  let length = 0;
  const walk = (node: JSONContent) => {
    if (length >= limit) return;
    if (node.text) {
      parts.push(node.text);
      length += node.text.length;
    }
    const isBlock = node.type !== "text" && node.type !== "hardBreak";
    node.content?.forEach(walk);
    if (isBlock && node.content?.length) {
      parts.push(" ");
      length += 1;
    }
  };
  walk(content);
  return parts.join("").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function isEmptyContent(content: JSONContent | null | undefined) {
  if (!content?.content?.length) return true;
  if (content.content.length > 1) return false;
  const first = content.content[0];
  return first.type === "paragraph" && !first.content?.length;
}
