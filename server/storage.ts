import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Concept, ModelRun } from "./types.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const runsDir = path.join(rootDir, "runs");

export function getRunDir(runId: string) {
  return path.join(runsDir, runId);
}

export function getRunFile(runId: string) {
  return path.join(getRunDir(runId), "run.json");
}

export async function ensureRunDir(runId: string) {
  await mkdir(getRunDir(runId), { recursive: true });
}

export async function saveRun(run: ModelRun) {
  await ensureRunDir(run.runId);
  run.updatedAt = new Date().toISOString();
  await writeFile(getRunFile(run.runId), JSON.stringify(run, null, 2), "utf8");
}

export async function loadRun(runId: string): Promise<ModelRun> {
  const raw = await readFile(getRunFile(runId), "utf8");
  return JSON.parse(raw) as ModelRun;
}

export async function listRuns(limit = 30): Promise<ModelRun[]> {
  try {
    const entries = await readdir(runsDir, { withFileTypes: true });
    const runs = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const run = await loadRun(entry.name).catch(() => null);
        return run ? markPersistedStl(run) : null;
      }));
    return runs
      .filter((run): run is ModelRun => Boolean(run))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function markPersistedStl(run: ModelRun): Promise<ModelRun> {
  if (run.status !== "Ready" || !run.files.stl) return run;
  if (run.files.stlSourceUrl || run.files.stlPersisted) return run;

  const fileName = path.basename(run.files.stl);
  try {
    const stlStats = await stat(path.join(getRunDir(run.runId), fileName));
    if (stlStats.size >= 256) {
      return {
        ...run,
        files: {
          ...run.files,
          stlPersisted: true
        }
      };
    }
  } catch {
  }

  return run;
}

export function publicRunFile(runId: string, fileName: string) {
  return `/runs/${runId}/${fileName}`;
}

export async function persistConceptImages(runId: string, concepts: Concept[], rootDir = runsDir) {
  await mkdir(path.join(rootDir, runId), { recursive: true });

  return Promise.all(
    concepts.map(async (concept, index): Promise<Concept> => {
      const image = parseDataImage(concept.imageUrl);
      if (!image) return concept;

      const fileName = `concept-${index + 1}.${image.extension}`;
      await writeFile(path.join(rootDir, runId, fileName), image.bytes);

      return {
        ...concept,
        imageDataUrl: concept.imageUrl,
        imageUrl: publicRunFile(runId, fileName)
      };
    })
  );
}

function parseDataImage(imageUrl: string) {
  const match = imageUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeSubtype = match[1].toLowerCase();
  return {
    bytes: Buffer.from(match[2], "base64"),
    extension: mimeSubtype === "jpeg" ? "jpg" : mimeSubtype
  };
}
