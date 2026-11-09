import type { Scene } from "./schema";
export function normalizeScene(s: Scene, term?: string): Scene {
  return { ...s, term: s.term || term || "", actors: s.actors ?? [], beats: s.beats ?? [], captions: s.captions ?? [] };
}
