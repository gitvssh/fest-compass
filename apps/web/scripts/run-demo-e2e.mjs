import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(webRoot, "output", "playwright");
const port = await findOpenPort();
const baseUrl = `http://127.0.0.1:${port}`;
mkdirSync(outputDir, { recursive: true });

const env = {
  ...process.env,
  // Prisma resolves SQLite URLs from the schema directory. Keep the isolated
  // test DB beside dev.db because the Windows engine rejects parent traversal
  // when the repository path contains Korean characters.
  DATABASE_URL: "file:./e2e.db",
  E2E_BASE_URL: baseUrl,
  NODE_ENV: "production",
  APP_MODE: "editor",
  TOUR_API_KEY: "",
};

const prismaCli = join(webRoot, "node_modules", "prisma", "build", "index.js");
const tsxCli = join(webRoot, "node_modules", "tsx", "dist", "cli.mjs");
const nextCli = join(webRoot, "node_modules", "next", "dist", "bin", "next");
const developmentDb = join(webRoot, "prisma", "dev.db");
const e2eDb = join(webRoot, "prisma", "e2e.db");

function runNode(entrypoint, args) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: webRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${entrypoint} exited with ${result.status}`);
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new Error(`Next server did not become ready at ${baseUrl}`);
}

async function findOpenPort() {
  const probe = createServer();
  await new Promise((resolveListen, rejectListen) => {
    probe.once("error", rejectListen);
    probe.listen(0, "127.0.0.1", resolveListen);
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve an E2E port");
  await new Promise((resolveClose, rejectClose) => probe.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

async function removeWithRetries(path) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      rmSync(path, { force: true });
      return;
    } catch (error) {
      if (!["EBUSY", "EPERM"].includes(error?.code) || attempt === 19) throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
}

// On this Windows workspace the Prisma engine can reset an existing SQLite
// file but cannot create a second file under the Korean path. Copy the synced
// schema-bearing DB first, then reset only the isolated copy.
copyFileSync(developmentDb, e2eDb);
runNode(prismaCli, ["db", "push", "--force-reset", "--skip-generate", "--schema", "prisma/schema.prisma"]);
runNode(tsxCli, ["prisma/seed.ts"]);
runNode(nextCli, ["build"]);

const server = spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: webRoot,
  env,
  stdio: "inherit",
});

try {
  await waitForServer();
  runNode(join(webRoot, "scripts", "demo-e2e.mjs"), []);
} finally {
  if (server.exitCode === null && server.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      server.kill();
    }
  }
  await Promise.race([
    once(server, "exit"),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
  await removeWithRetries(e2eDb);
  await removeWithRetries(`${e2eDb}-journal`);
}
