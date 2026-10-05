"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import {
  ChevronRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Minus,
  PanelTop,
  Quote,
  Table,
  Type,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { imageToDataUrl, pickFile } from "@/lib/io";
import { cn } from "@/lib/utils";

interface SlashItem {
  title: string;
  keywords: string;
  icon: LucideIcon;
  run: (args: { editor: Editor; range: Range }) => void;
}

export async function insertImageFile(editor: Editor, file: File) {
  const src = await imageToDataUrl(file);
  editor.chain().focus().setImage({ src }).run();
}

const ITEMS: SlashItem[] = [
  {
    title: "Text",
    keywords: "paragraph plain",
    icon: Type,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    keywords: "h1 title big",
    icon: Heading1,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    keywords: "h2 subtitle",
    icon: Heading2,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    keywords: "h3 small",
    icon: Heading3,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: "Bulleted list",
    keywords: "ul unordered bullet",
    icon: List,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    keywords: "ol ordered number",
    icon: ListOrdered,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    keywords: "todo task checkbox check",
    icon: ListTodo,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Toggle",
    keywords: "details collapse expand",
    icon: ChevronRight,
    // Start open, so Enter in the summary moves into the content.
    run: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setDetails()
        .updateAttributes("details", { open: true })
        .run(),
  },
  {
    title: "Quote",
    keywords: "blockquote citation",
    icon: Quote,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Callout",
    keywords: "note info box highlight",
    icon: PanelTop,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setCallout().run(),
  },
  {
    title: "Divider",
    keywords: "hr horizontal rule line separator",
    icon: Minus,
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: "Code",
    keywords: "code block snippet",
    icon: Code,
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Table",
    keywords: "grid rows columns",
    icon: Table,
    run: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: "Image",
    keywords: "picture photo upload",
    icon: ImageIcon,
    run: async ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const file = await pickFile("image/*");
      if (file) await insertImageFile(editor, file);
    },
  },
];

function filterItems(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return ITEMS;
  return ITEMS.filter(
    (item) => item.title.toLowerCase().includes(q) || item.keywords.includes(q),
  );
}

interface SlashState {
  open: boolean;
  items: SlashItem[];
  index: number;
  rect: DOMRect | null;
  command: ((item: SlashItem) => void) | null;
  show: (props: SuggestionProps<SlashItem, SlashItem>, reset: boolean) => void;
  hide: () => void;
  keyDown: (event: KeyboardEvent) => boolean;
}

const useSlash = create<SlashState>()((set, get) => ({
  open: false,
  items: [],
  index: 0,
  rect: null,
  command: null,
  show: (props, reset) =>
    set((s) => ({
      open: true,
      items: props.items,
      index: reset ? 0 : Math.min(s.index, Math.max(0, props.items.length - 1)),
      rect: props.clientRect?.() ?? null,
      command: props.command,
    })),
  hide: () => set({ open: false, command: null }),
  keyDown: (event) => {
    const { open, items, index, command } = get();
    if (!open) return false;
    if (event.key === "ArrowDown") {
      set({ index: (index + 1) % Math.max(1, items.length) });
      return true;
    }
    if (event.key === "ArrowUp") {
      set({ index: (index - 1 + items.length) % Math.max(1, items.length) });
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      if (items[index] && command) command(items[index]);
      return true;
    }
    if (event.key === "Escape") {
      get().hide();
      return true;
    }
    return false;
  },
}));

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        allow: ({ state, range }) =>
          state.doc.resolve(range.from).parent.type.name !== "codeBlock",
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }) => props.run({ editor, range }),
        render: () => ({
          onStart: (props) => useSlash.getState().show(props, true),
          onUpdate: (props) => useSlash.getState().show(props, false),
          onKeyDown: ({ event }) => useSlash.getState().keyDown(event),
          onExit: () => useSlash.getState().hide(),
        }),
      }),
    ];
  },
});

/** The popup for the "/" command. Rendered once per page. */
export function SlashMenu() {
  const { open, items, index, rect, command } = useSlash();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open || !rect || !items.length) return null;

  const below = rect.bottom + 320 < window.innerHeight;
  return createPortal(
    <div
      ref={listRef}
      className="fixed z-50 max-h-72 w-56 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      style={{
        left: Math.min(rect.left, window.innerWidth - 232),
        ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={item.title}
          data-index={i}
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm",
            i === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
          )}
          onMouseEnter={() => useSlash.setState({ index: i })}
          onClick={() => command?.(item)}
        >
          <span className="flex size-7 items-center justify-center rounded-md border bg-background">
            <item.icon className="size-4" />
          </span>
          {item.title}
        </button>
      ))}
    </div>,
    document.body,
  );
}
