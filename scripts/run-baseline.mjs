import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const nodeCommand = isWindows ? "node.exe" : "node";

const apiPort = await getFreePort(6200);
const webPort = await getFreePort(apiPort + 1);
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || findLocalChromium();
const children = [];

try {
  await run(npmCommand, ["run", "typecheck"]);
  await run(nodeCommand, ["--import", "tsx", "--test", "tests/model-viewer-rendering.test.ts"]);

  const api = spawnManaged(npmCommand, ["run", "dev:api"], {
    PORT: String(apiPort),
    OPENAI_API_KEY: "",
    TRIPO_API_KEY: ""
  });
  await waitForHttp(`http://127.0.0.1:${apiPort}/api/health`);

  const web = spawnManaged(npmCommand, ["run", "dev:toybox", "--", "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], {
    VITE_APP: "toybox"
  });
  await waitForHttp(`http://127.0.0.1:${webPort}/configure`);

  await run(npmCommand, ["run", "test:e2e", "--", "tests/run-restore.spec.ts"], {
    PLAYWRIGHT_TEST_BASE_URL: `http://127.0.0.1:${webPort}`,
    API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    ...(chromiumExecutablePath ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: chromiumExecutablePath } : {})
  });
} finally {
  for (const child of children.reverse()) {
    killChildTree(child);
  }
}

function spawnManaged(command, args, env = {}) {
  const child = spawn(...commandArgs(command, args), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
    stdio: "inherit",
    shell: false
  });
  children.push(child);
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.stderr.write(`[baseline] managed process exited: ${command} ${args.join(" ")} (${code})\n`);
    }
  });
  return child;
}

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(...commandArgs(command, args), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env
      },
      stdio: "inherit",
      shell: false
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function commandArgs(command, args) {
  if (!isWindows) return [command, args];
  return ["cmd.exe", ["/d", "/s", "/c", command, ...args]];
}

function killChildTree(child) {
  if (child.exitCode !== null) return;
  if (isWindows) {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function getFreePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free port found from ${startPort}`);
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function waitForHttp(url) {
  const deadline = Date.now() + 45_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findLocalChromium() {
  if (!isWindows) return undefined;
  const root = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (!existsSync(root)) return undefined;

  const candidates = readdirSync(root)
    .filter((name) => name.startsWith("chromium-"))
    .sort()
    .reverse()
    .map((name) => path.join(root, name, "chrome-win64", "chrome.exe"));

  return candidates.find((candidate) => existsSync(candidate));
}
