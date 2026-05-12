import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

loadEnvFile(".env");
loadEnvFile(".env.local");

function loadEnvFile(fileName: string) {
  const envPath = path.join(process.cwd(), fileName);
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    const current = process.env[key];
    if (current !== undefined && current !== "") continue;

    process.env[key] = parseEnvValue(rawValue);
  }
}

function parseEnvValue(rawValue: string) {
  let value = rawValue.trim();
  const quote = value[0];

  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  }

  return value;
}
