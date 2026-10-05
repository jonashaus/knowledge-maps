# Knowledge Maps

Mind maps with rich, Notion-style nodes on an infinite canvas.

Put a topic in the center and branch out. Every node can hold headings, lists,
to-dos, toggles, callouts, quotes, code, tables and images. The map lays itself
out radially, and nodes adapt their size to their content. Zoom out and details
give way to titles; the deepest levels fade out first.

## Features

- **Radial auto-layout** – no manual positioning. Drag a node onto another to
  change its parent, or drag it around its parent to reorder siblings.
- **Rich nodes** – type `/` inside a node for blocks, or use Markdown shortcuts.
- **Semantic zoom** – full content up close, title + summary further out, titles
  only when far away. Deeper rings are drawn smaller and fade out first.
- **Connections** – label any connection (double-click it) and link any two
  nodes with a dashed cross-link (drag the dot on a node's right edge).
- **Export / import** – lossless JSON (`.kmap.json`) and PNG images.
- **Local-first** – maps are stored in your browser (IndexedDB). No account.
- Undo/redo, search (`Ctrl K`), light/dark mode. Press `?` for all shortcuts.

## Development

```bash
pnpm install
pnpm dev
```

Built with [Next.js](https://nextjs.org), [shadcn/ui](https://ui.shadcn.com),
[TipTap](https://tiptap.dev) and [React Flow](https://reactflow.dev).

## How it works

| Path | Purpose |
| --- | --- |
| `src/lib/layout.ts` | Radial layout for nodes of arbitrary size |
| `src/lib/lod.ts` | Depth scaling and zoom thresholds (semantic zoom) |
| `src/store/map-store.ts` | Map state, editing state, undo/redo |
| `src/components/map/` | Canvas, node and edge components, editor chrome |
| `src/components/editor/` | TipTap setup, slash menu, callout block |

## License

[MIT](LICENSE)
