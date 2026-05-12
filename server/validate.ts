import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getRunDir } from "./storage.js";

export async function validateStl(runId: string, fileName: string) {
  const reasons: string[] = [];
  const filePath = path.join(getRunDir(runId), fileName);

  try {
    const stats = await stat(filePath);
    if (stats.size < 256) {
      reasons.push("stl_file_too_small");
    }
  } catch {
    reasons.push("stl_missing");
    return reasons;
  }

  try {
    const chunk = await readFile(filePath, "utf8");
    const lower = chunk.slice(0, 4096).toLowerCase();
    const looksAscii = lower.includes("solid") && lower.includes("facet");
    const looksBinary = !looksAscii && chunk.length > 512;

    if (!looksAscii && !looksBinary) {
      reasons.push("stl_unrecognized");
    }
  } catch {
    reasons.push("stl_unreadable");
  }

  return reasons;
}
