import { displayName, newId } from "./tree";
import type { ExportFile, KnowledgeMap } from "./types";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileBaseName(map: KnowledgeMap) {
  return (
    displayName(map)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "knowledge-map"
  );
}

export function exportMapJson(map: KnowledgeMap) {
  const file: ExportFile = {
    format: "knowledge-maps",
    version: 1,
    exportedAt: new Date().toISOString(),
    map,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${fileBaseName(map)}.kmap.json`);
}

/** Parses an exported file and returns it as a new map with a fresh id. */
export async function importMapFile(file: File): Promise<KnowledgeMap> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  const parsed = data as Partial<ExportFile>;
  const map = parsed?.map;
  if (
    parsed?.format !== "knowledge-maps" ||
    !map ||
    typeof map.rootId !== "string" ||
    typeof map.nodes !== "object" ||
    !map.nodes[map.rootId]
  ) {
    throw new Error("This file isn't a Knowledge Maps export.");
  }
  const now = Date.now();
  return {
    ...map,
    id: newId(),
    name: map.name ?? "",
    links: Array.isArray(map.links) ? map.links : [],
    createdAt: now,
    updatedAt: now,
  };
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Reads an image file, downscaled so embedded images stay reasonably small. */
export async function imageToDataUrl(file: File, maxSize = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 400_000) {
    bitmap.close();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.86);
}
