"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

const SECTIONS: { title: string; rows: [string, string[]][] }[] = [
  {
    title: "Nodes",
    rows: [
      ["Add child", ["Tab"]],
      ["Add sibling", ["Enter"]],
      ["Edit node", ["Double-click", "F2"]],
      ["Title → details", ["Enter"]],
      ["Stop editing", ["Esc"]],
      ["Delete node and its children", ["Del"]],
      ["Change parent", ["Drag onto another node"]],
      ["Reorder siblings", ["Drag around the parent"]],
    ],
  },
  {
    title: "Content",
    rows: [
      ["Insert block", ["/"]],
      ["Markdown shortcuts", ["#", "-", "1.", "[]", ">", "```"]],
      ["Bold / italic", ["Ctrl B", "Ctrl I"]],
      ["Paste or drop images", ["Ctrl V"]],
    ],
  },
  {
    title: "Connections",
    rows: [
      ["Link two nodes", ["Drag the dot on a node's right edge"]],
      ["Label a connection", ["Double-click the line"]],
      ["Delete a link", ["Select it", "Del"]],
    ],
  },
  {
    title: "Canvas",
    rows: [
      ["Pan", ["Drag the background"]],
      ["Zoom", ["Scroll", "Pinch"]],
      ["Fit map to screen", ["Shift 1"]],
      ["Search", ["Ctrl K"]],
      ["Undo / redo", ["Ctrl Z", "Ctrl Shift Z"]],
    ],
  },
];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              <div className="grid gap-1">
                {section.rows.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between gap-4 text-sm">
                    <span>{label}</span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
