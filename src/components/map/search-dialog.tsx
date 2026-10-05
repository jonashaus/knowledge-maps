"use client";

import { useMemo } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { plainText } from "@/lib/tree";
import { useMapStore } from "@/store/map-store";

export function SearchDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (nodeId: string) => void;
}) {
  const nodes = useMapStore((s) => s.map?.nodes);
  const rootId = useMapStore((s) => s.map?.rootId);

  const items = useMemo(() => {
    if (!open || !nodes) return [];
    return Object.values(nodes).map((n) => ({
      id: n.id,
      title: n.title || (n.id === rootId ? "Central topic" : "Untitled"),
      text: plainText(n.content, 2000),
    }));
  }, [open, nodes, rootId]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search nodes"
      description="Find a node by its title or content"
    >
      <Command
        filter={(_value, search, keywords) =>
          (keywords ?? []).join(" ").toLowerCase().includes(search.toLowerCase().trim()) ? 1 : 0
        }
      >
        <CommandInput placeholder="Search nodes…" />
        <CommandList>
          <CommandEmpty>No matching nodes.</CommandEmpty>
          {items.map((item) => (
            <CommandItem
              key={item.id}
              value={item.id}
              keywords={[item.title, item.text]}
              onSelect={() => {
                onOpenChange(false);
                onPick(item.id);
              }}
              className="flex-col items-start gap-0.5"
            >
              <span className="font-medium">{item.title}</span>
              {item.text && (
                <span className="line-clamp-1 text-xs text-muted-foreground">{item.text}</span>
              )}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
