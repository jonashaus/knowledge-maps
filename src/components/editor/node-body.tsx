"use client";

import { Extension } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Selection, TextSelection } from "@tiptap/pm/state";
import { EditorContent, type JSONContent, useEditor, useEditorState } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { memo, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Callout } from "./callout";
import { insertImageFile, SlashCommand } from "./slash-command";

const baseExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: true, autolink: true, defaultProtocol: "https" },
  }),
  Placeholder.configure({
    showOnlyCurrent: false,
    placeholder: ({ node, editor }) => {
      if (node.type.name === "detailsSummary") return "Toggle";
      if (node.type.name === "heading") return "Heading";
      return editor.isEmpty ? "Add details – type '/' for blocks" : "";
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true, onReadOnlyChecked: () => true }),
  Details.configure({ persist: true }),
  DetailsSummary,
  DetailsContent,
  TableKit.configure({ table: { resizable: false } }),
  Image.configure({ allowBase64: true }),
  Callout,
  SlashCommand,
];

/** Where the caret should go when the body starts editing (set by double-click). */
let pendingFocusCoords: { left: number; top: number } | null = null;
export const setPendingFocusCoords = (coords: { left: number; top: number } | null) => {
  pendingFocusCoords = coords;
};

interface NodeBodyProps {
  content: JSONContent | null;
  editable: boolean;
  /** True when the body should take keyboard focus. */
  focused: boolean;
  onChange: (content: JSONContent) => void;
  onFocus: () => void;
  onEscape: () => void;
}

function NodeBodyImpl({ content, editable, focused, onChange, onFocus, onEscape }: NodeBodyProps) {
  const lastEmitted = useRef<JSONContent | null>(content);
  const callbacks = useRef({ onChange, onFocus, onEscape });
  useEffect(() => {
    callbacks.current = { onChange, onFocus, onEscape };
  });

  const extensions = useMemo(
    () => [
      ...baseExtensions,
      // Low priority so the slash menu can handle Escape first.
      Extension.create({
        name: "nodeKeys",
        priority: 10,
        addKeyboardShortcuts: () => ({
          Escape: () => {
            callbacks.current.onEscape();
            return true;
          },
          // Lists and tables use Tab first; elsewhere keep focus in the editor.
          Tab: () => true,
          "Shift-Tab": () => true,
        }),
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: content ?? "",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "km-prose" },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length || !editorRef.current) return false;
        files.forEach((f) => insertImageFile(editorRef.current!, f));
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (moved || !files.length || !editorRef.current) return false;
        files.forEach((f) => insertImageFile(editorRef.current!, f));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      lastEmitted.current = json;
      callbacks.current.onChange(json);
    },
    onFocus: () => callbacks.current.onFocus(),
  });
  const editorRef = useRef(editor);
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  // Content changed from outside (undo/redo).
  useEffect(() => {
    if (!editor || content === lastEmitted.current) return;
    lastEmitted.current = content;
    editor.commands.setContent(content ?? "", { emitUpdate: false });
  }, [editor, content]);

  useEffect(() => {
    if (!editor || !focused || !editable || editor.isFocused) return;
    const coords = pendingFocusCoords;
    pendingFocusCoords = null;
    const pos = coords ? editor.view.posAtCoords(coords)?.pos : undefined;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    // Focus synchronously (TipTap's focus command waits a frame, which drops keystrokes).
    const tryFocus = () => {
      if (editor.isDestroyed || editor.view.hasFocus()) return;
      const { doc, tr } = editor.state;
      const selection =
        pos !== undefined ? TextSelection.near(doc.resolve(pos)) : Selection.atEnd(doc);
      editor.view.dispatch(tr.setSelection(selection));
      editor.view.focus();
      if (!editor.view.hasFocus() && tries++ < 30) timer = setTimeout(tryFocus, 16);
    };
    tryFocus();
    return () => clearTimeout(timer);
  }, [editor, focused, editable]);

  const inTable = useEditorState({
    editor,
    selector: ({ editor }) => !!editor?.isEditable && !!editor?.isActive("table"),
  });

  return (
    <div className={cn("km-body", editable && "nodrag nopan nowheel cursor-text")}>
      <EditorContent editor={editor} />
      {inTable && editor && (
        <div className="km-table-tools" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>
            + Row
          </button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Column
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>
            − Row
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>
            − Column
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>
            Delete table
          </button>
        </div>
      )}
    </div>
  );
}

export const NodeBody = memo(NodeBodyImpl);
