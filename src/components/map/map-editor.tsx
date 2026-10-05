"use client";

import { ReactFlowProvider, useReactFlow, useStore } from "@xyflow/react";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  Download,
  FileJson,
  FileUp,
  HelpCircle,
  ImageDown,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Search,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SlashMenu } from "@/components/editor/slash-command";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadBlob, exportMapJson, fileBaseName, importMapFile, pickFile } from "@/lib/io";
import { loadMap, saveMap } from "@/lib/storage";
import { displayName } from "@/lib/tree";
import { useMapStore } from "@/store/map-store";
import { HelpDialog } from "./help-dialog";
import { MapCanvas } from "./map-canvas";
import { SearchDialog } from "./search-dialog";

function IconButton({
  label,
  shortcut,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; shortcut?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1.5 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function EditorChrome() {
  const map = useMapStore((s) => s.map)!;
  const canUndo = useMapStore((s) => s.past.length > 0);
  const canRedo = useMapStore((s) => s.future.length > 0);
  const zoom = useStore((s) => s.transform[2]);
  const reactFlow = useReactFlow();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const isEmpty = Object.keys(map.nodes).length === 1;

  const focusNode = useCallback(
    (id: string) => {
      useMapStore.getState().select(id);
      const node = reactFlow.getInternalNode(id);
      if (!node) return;
      reactFlow.setCenter(
        node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
        node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2,
        { zoom: Math.max(reactFlow.getZoom(), 1), duration: 450 },
      );
    },
    [reactFlow],
  );

  const exportPng = useCallback(async () => {
    const store = useMapStore.getState();
    store.stopEditing();
    store.setExporting(true);
    try {
      await nextFrame();
      await nextFrame();
      const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
      if (!viewport) return;
      const bounds = reactFlow.getNodesBounds(reactFlow.getNodes());
      const padding = 48;
      const width = Math.ceil(bounds.width + padding * 2);
      const height = Math.ceil(bounds.height + padding * 2);
      // Browsers limit canvas size; keep the longest side below ~12k px.
      const pixelRatio = Math.min(2, 12000 / Math.max(width, height));
      const dataUrl = await toPng(viewport, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        width,
        height,
        pixelRatio,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${padding - bounds.x}px, ${padding - bounds.y}px) scale(1)`,
        },
      });
      const blob = await (await fetch(dataUrl)).blob();
      downloadBlob(blob, `${fileBaseName(store.map!)}.png`);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't export the image.");
    } finally {
      useMapStore.getState().setExporting(false);
    }
  }, [reactFlow]);

  const importMap = useCallback(async () => {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      const imported = await importMapFile(file);
      await saveMap(imported);
      toast.success(`Imported “${displayName(imported)}”`);
      router.push(`/map/${imported.id}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [router]);

  // Keyboard shortcuts on the canvas (editors handle their own keys).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useMapStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && (key === "k" || key === "f")) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      // Already handled by an editor (e.g. Escape that just ended editing).
      if (e.defaultPrevented) return;
      if (isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        reactFlow.fitView({ padding: 0.2, duration: 400, maxZoom: 1 });
        return;
      }
      if (e.key === "?") {
        setHelpOpen(true);
        return;
      }

      const nodeId = store.selectedNodeId;
      const edgeId = store.selectedEdgeId;
      if (nodeId && store.map?.nodes[nodeId]) {
        if (e.key === "Tab") {
          e.preventDefault();
          store.addChild(nodeId);
        } else if (e.key === "Enter") {
          e.preventDefault();
          store.addSibling(nodeId);
        } else if (e.key === "F2") {
          e.preventDefault();
          store.startEditing(nodeId, "title");
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          store.deleteNode(nodeId);
        } else if (e.key === "Escape") {
          store.select(null);
        }
      } else if (edgeId) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          if (edgeId.startsWith("t-")) store.setEdgeLabel(edgeId, "");
          else store.deleteLink(edgeId);
        } else if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          store.setEditingEdge(edgeId);
        } else if (e.key === "Escape") {
          store.selectEdge(null);
        }
      } else if (e.key === "Tab" && store.map) {
        e.preventDefault();
        store.select(store.map.rootId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reactFlow]);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-3">
        <div className="km-panel pointer-events-auto flex min-w-0 items-center gap-1 p-1">
          <IconButton label="All maps" asChild>
            <Link href="/">
              <ArrowLeft />
            </Link>
          </IconButton>
          <input
            className="h-7 min-w-0 rounded-md bg-transparent px-1.5 text-sm font-medium outline-none placeholder:text-foreground hover:bg-muted focus:bg-muted focus:placeholder:text-muted-foreground"
            style={{ width: `${Math.min(28, Math.max(8, (map.name || displayName(map)).length + 2))}ch` }}
            value={map.name}
            placeholder={displayName(map)}
            onChange={(e) => useMapStore.getState().rename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            aria-label="Map name"
          />
        </div>

        <div className="km-panel pointer-events-auto flex items-center gap-0.5 p-1">
          <IconButton label="Undo" shortcut="Ctrl Z" disabled={!canUndo} onClick={() => useMapStore.getState().undo()}>
            <Undo2 />
          </IconButton>
          <IconButton label="Redo" shortcut="Ctrl Shift Z" disabled={!canRedo} onClick={() => useMapStore.getState().redo()}>
            <Redo2 />
          </IconButton>
          <IconButton label="Search" shortcut="Ctrl K" onClick={() => setSearchOpen(true)}>
            <Search />
          </IconButton>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Export and import">
                    <Download />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Export / import</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportMapJson(useMapStore.getState().map!)}>
                <FileJson /> Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportPng()}>
                <ImageDown /> Export as PNG
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void importMap()}>
                <FileUp /> Import map…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
          <IconButton label="Shortcuts" shortcut="?" onClick={() => setHelpOpen(true)}>
            <HelpCircle />
          </IconButton>
        </div>
      </div>

      <div className="km-panel pointer-events-auto absolute right-3 bottom-3 z-10 flex items-center gap-0.5 p-1">
        <IconButton label="Zoom out" onClick={() => reactFlow.zoomOut({ duration: 200 })}>
          <Minus />
        </IconButton>
        <button
          type="button"
          className="h-7 w-12 rounded-md text-xs tabular-nums text-muted-foreground hover:bg-muted"
          onClick={() => reactFlow.zoomTo(1, { duration: 300 })}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton label="Zoom in" onClick={() => reactFlow.zoomIn({ duration: 200 })}>
          <Plus />
        </IconButton>
        <IconButton
          label="Fit to screen"
          shortcut="Shift 1"
          onClick={() => reactFlow.fitView({ padding: 0.2, duration: 400, maxZoom: 1 })}
        >
          <Maximize />
        </IconButton>
      </div>

      {isEmpty && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
          <p className="text-center text-xs text-muted-foreground">
            Double-click to edit · <b className="font-medium">Tab</b> adds a child ·{" "}
            <b className="font-medium">/</b> inserts blocks ·{" "}
            <b className="font-medium">?</b> shows all shortcuts
          </p>
        </div>
      )}

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} onPick={focusNode} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SlashMenu />
    </>
  );
}

function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: ReturnType<typeof useMapStore.getState>["map"] = null;
    const flush = () => {
      if (pending) void saveMap(pending);
      pending = null;
    };
    const unsubscribe = useMapStore.subscribe((state, prev) => {
      if (!state.map || state.map === prev.map || state.map.id !== prev.map?.id) return;
      pending = state.map;
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    });
    window.addEventListener("beforeunload", flush);
    return () => {
      clearTimeout(timer);
      flush();
      unsubscribe();
      window.removeEventListener("beforeunload", flush);
    };
  }, []);
}

export function MapEditor({ id }: { id: string }) {
  const loadedId = useMapStore((s) => s.map?.id);
  const [missing, setMissing] = useState(false);
  useAutosave();

  useEffect(() => {
    let cancelled = false;
    loadMap(id).then((map) => {
      if (cancelled) return;
      if (map) useMapStore.getState().load(map);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const map = useMapStore.getState().map;
    if (map?.id === id) document.title = `${displayName(map)} · Knowledge Maps`;
  });

  if (missing) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">This map doesn&apos;t exist in this browser.</p>
        <Button variant="outline" asChild>
          <Link href="/">All maps</Link>
        </Button>
      </div>
    );
  }
  if (loadedId !== id) return <div className="h-dvh" />;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <ReactFlowProvider key={id}>
        <MapCanvas />
        <EditorChrome />
      </ReactFlowProvider>
    </div>
  );
}
