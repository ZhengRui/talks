import { randomUUID } from "crypto";

export interface RefineArtifact {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000;

// Use globalThis so the Map is shared across Next.js route module instances
// in the same process. Without this, the POST route and GET route each get
// their own empty Map and artifact lookups always 404.
const GLOBAL_KEY = "__refineArtifacts";
const artifacts: Map<string, RefineArtifact> =
  ((globalThis as Record<string, unknown>)[GLOBAL_KEY] as Map<string, RefineArtifact>) ??
  (() => {
    const m = new Map<string, RefineArtifact>();
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = m;
    return m;
  })();

export function putRefineArtifact(artifact: RefineArtifact): string {
  sweepRefineArtifacts();
  const id = randomUUID();
  artifacts.set(id, artifact);
  return id;
}

export function getRefineArtifact(id: string): RefineArtifact | null {
  const artifact = artifacts.get(id);
  if (!artifact) return null;
  if (Date.now() - artifact.createdAt > TTL_MS) {
    artifacts.delete(id);
    return null;
  }
  return artifact;
}

export function sweepRefineArtifacts(ttl = TTL_MS): void {
  const cutoff = Date.now() - ttl;
  for (const [id, artifact] of artifacts) {
    if (artifact.createdAt <= cutoff) {
      artifacts.delete(id);
    }
  }
}
