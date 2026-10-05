"use client";

import { FileUp, MoreHorizontal, Plus, Trash2, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportMapJson, importMapFile, pickFile } from "@/lib/io";
import { deleteMap, listMaps, loadMap, saveMap } from "@/lib/storage";
import { createEmptyMap, displayName } from "@/lib/tree";
import type { MapMeta } from "@/lib/types";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function timeAgo(ts: number) {
  const seconds = (ts - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export default function HomePage() {
  const router = useRouter();
  const [maps, setMaps] = useState<MapMeta[] | null>(null);
  const [toDelete, setToDelete] = useState<MapMeta | null>(null);

  useEffect(() => {
    listMaps().then(setMaps);
  }, []);

  const createMap = async () => {
    const map = createEmptyMap();
    await saveMap(map);
    router.push(`/map/${map.id}`);
  };

  const importMap = async () => {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      const map = await importMapFile(file);
      await saveMap(map);
      toast.success(`Imported “${displayName(map)}”`);
      router.push(`/map/${map.id}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const exportMap = async (id: string) => {
    const map = await loadMap(id);
    if (map) exportMapJson(map);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteMap(toDelete.id);
    setMaps(await listMaps());
    setToDelete(null);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-10 sm:py-16">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Knowledge Maps</h1>
          <p className="text-sm text-muted-foreground">Mind maps with rich, detailed nodes.</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="mb-3 flex gap-2">
        <Button onClick={createMap}>
          <Plus /> New map
        </Button>
        <Button variant="outline" onClick={importMap}>
          <FileUp /> Import
        </Button>
      </div>

      {maps === null ? null : maps.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            No maps yet. Create one, or import a <code className="text-xs">.kmap.json</code> file.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {maps.map((m) => (
            <li key={m.id} className="group flex items-center gap-2 pr-2">
              <Link
                href={`/map/${m.id}`}
                className="flex min-w-0 flex-1 items-baseline justify-between gap-4 rounded-l-xl px-4 py-3 hover:bg-muted/60"
              >
                <span className="truncate font-medium">{m.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(m.updatedAt)}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Options for ${m.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void exportMap(m.id)}>
                    <Download /> Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setToDelete(m)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-10 text-xs text-muted-foreground">
        Maps are stored in this browser only. Export them to keep a backup or move them to
        another device.
      </p>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the map from this browser. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
