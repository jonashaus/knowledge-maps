import { del, get, set, update } from "idb-keyval";
import { displayName } from "./tree";
import type { KnowledgeMap, MapMeta } from "./types";

// Maps are stored in IndexedDB (not localStorage) because embedded images
// quickly exceed localStorage's ~5 MB limit.

const INDEX_KEY = "maps-index";
const mapKey = (id: string) => `map:${id}`;

export async function listMaps(): Promise<MapMeta[]> {
  const index = (await get<MapMeta[]>(INDEX_KEY)) ?? [];
  return index.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadMap(id: string) {
  return get<KnowledgeMap>(mapKey(id));
}

export async function saveMap(map: KnowledgeMap) {
  await set(mapKey(map.id), map);
  const meta: MapMeta = {
    id: map.id,
    name: displayName(map),
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
  };
  await update<MapMeta[]>(INDEX_KEY, (index = []) => [
    meta,
    ...index.filter((m) => m.id !== map.id),
  ]);
}

export async function deleteMap(id: string) {
  await del(mapKey(id));
  await update<MapMeta[]>(INDEX_KEY, (index = []) => index.filter((m) => m.id !== id));
}
