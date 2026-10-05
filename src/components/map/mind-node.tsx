"use client";

import { Handle, type Node, type NodeProps, Position, useStore } from "@xyflow/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { NodeBody, setPendingFocusCoords } from "@/components/editor/node-body";
import { BASE_FONT, depthScale, lodFor, MAX_AUTO_WIDTH } from "@/lib/lod";
import type { MapNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMapStore } from "@/store/map-store";

export interface MindNodeData extends Record<string, unknown> {
  node: MapNode;
  depth: number;
  isRoot: boolean;
  /** Plain-text excerpt shown when zoomed out. */
  summary: string;
}

export type MindNodeType = Node<MindNodeData, "mind">;

function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function TitleEditor({ id, title, focused }: { id: string; title: string; focused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { setTitle, startEditing, stopEditing, addChild, addSibling } = useMapStore.getState();

  // Uncontrolled: only sync from the store when the text differs (e.g. undo).
  useEffect(() => {
    if (ref.current && ref.current.textContent !== title) ref.current.textContent = title;
  }, [title]);

  // New nodes stay invisible until React Flow has measured them, and invisible
  // elements can't take focus, so retry for a few frames.
  useEffect(() => {
    if (!focused) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryFocus = () => {
      const el = ref.current;
      if (!el || document.activeElement === el) return;
      placeCaretAtEnd(el);
      if (document.activeElement !== el && tries++ < 30) timer = setTimeout(tryFocus, 16);
    };
    tryFocus();
    return () => clearTimeout(timer);
  }, [focused]);

  return (
    <div
      ref={ref}
      className="km-title km-title-input nodrag nopan"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label="Node title"
      data-placeholder="Untitled"
      onFocus={() => startEditing(id, "title")}
      onInput={(e) => setTitle(id, (e.currentTarget.textContent ?? "").replace(/\n/g, " "))}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, text);
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          startEditing(id, "body");
        } else if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          addSibling(id);
        } else if (e.key === "Tab") {
          e.preventDefault();
          addChild(id);
        } else if (e.key === "Escape") {
          e.preventDefault();
          stopEditing();
        }
      }}
    />
  );
}

function WidthHandle({ id, node, scale }: { id: string; node: MapNode; scale: number }) {
  const zoom = useStore((s) => s.transform[2]);
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget.parentElement!;
      const startX = e.clientX;
      const startWidth = el.offsetWidth / scale;
      let first = true;
      const move = (ev: PointerEvent) => {
        const width = Math.round(
          Math.max(140, Math.min(1400, startWidth + (ev.clientX - startX) / zoom / scale)),
        );
        useMapStore.getState().setWidth(id, width, first);
        first = false;
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [id, scale, zoom],
  );
  return (
    <div
      className="km-width-handle nodrag nopan"
      title="Drag to resize · double-click for auto width"
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (node.width !== undefined) useMapStore.getState().setWidth(id, undefined, true);
      }}
    />
  );
}

function MindNodeImpl({ id, data, selected }: NodeProps<MindNodeType>) {
  const { node, depth, isRoot, summary } = data;
  const scale = depthScale(depth);
  const exporting = useMapStore((s) => s.exporting);
  const editingField = useMapStore((s) => (s.editing?.id === id ? s.editing.field : null));
  const isDropTarget = useMapStore((s) => s.dropTargetId === id);
  const zoomLod = useStore((s) => lodFor(s.transform[2], depth));
  const isEditing = editingField !== null;
  const hasBody = node.content !== null;
  const lod = exporting || isEditing || !hasBody ? "full" : zoomLod;

  const { setContent, startEditing, stopEditing } = useMapStore.getState();
  const onChange = useCallback((c: Parameters<typeof setContent>[1]) => setContent(id, c), [id, setContent]);
  const onBodyFocus = useCallback(() => startEditing(id, "body"), [id, startEditing]);

  return (
    <div
      className={cn(
        "km-node",
        isRoot && "km-root",
        depth === 1 && "km-branch",
        selected && !exporting && "km-selected",
        isEditing && "km-editing",
        isDropTarget && "km-drop-target",
      )}
      style={{
        fontSize: BASE_FONT * scale,
        width: node.width ? node.width * scale : "max-content",
        maxWidth: node.width ? undefined : MAX_AUTO_WIDTH * scale,
      }}
      onDoubleClick={(e) => {
        if (isEditing) return;
        const inBody = (e.target as HTMLElement).closest(".km-body");
        setPendingFocusCoords(inBody ? { left: e.clientX, top: e.clientY } : null);
        startEditing(id, inBody ? "body" : "title");
      }}
    >
      <Handle type="target" id="t" position={Position.Top} isConnectable={false} className="km-center-handle" />
      <Handle type="source" id="s" position={Position.Top} isConnectable={false} className="km-center-handle" />

      <div className="km-inner" style={{ visibility: lod === "full" ? undefined : "hidden" }}>
        {isEditing ? (
          <TitleEditor id={id} title={node.title} focused={editingField === "title"} />
        ) : (
          <div className={cn("km-title", !node.title && "km-placeholder")}>
            {node.title || (isRoot ? "Central topic" : "Untitled")}
          </div>
        )}
        {(hasBody || isEditing) && (
          <NodeBody
            content={node.content}
            editable={isEditing}
            focused={editingField === "body"}
            onChange={onChange}
            onFocus={onBodyFocus}
            onEscape={stopEditing}
          />
        )}
      </div>

      {lod !== "full" && (
        <div className="km-overlay" data-lod={lod}>
          <div className="km-overlay-title">{node.title || "Untitled"}</div>
          {lod === "summary" && summary && <div className="km-overlay-summary">{summary}</div>}
        </div>
      )}

      <Handle
        type="source"
        id="link"
        position={Position.Right}
        className="km-link-handle"
        title="Drag to another node to link"
      />
      {selected && !exporting && <WidthHandle id={id} node={node} scale={scale} />}
    </div>
  );
}

export const MindNode = memo(
  MindNodeImpl,
  (a, b) => a.data === b.data && a.selected === b.selected && a.id === b.id,
);
