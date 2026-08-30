import { readdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const standaloneRoot = resolve(process.cwd(), ".next", "standalone");

function isEnvironmentFile(name) {
  return name === ".env" || name.startsWith(".env.");
}

async function findEnvironmentFiles(directory) {
  const matches = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      matches.push(...(await findEnvironmentFiles(path)));
    } else if (entry.isFile() && isEnvironmentFile(entry.name)) {
      matches.push(path);
    }
  }

  return matches;
}

const output = await stat(standaloneRoot).catch(() => null);
if (!output?.isDirectory()) {
  throw new Error("Next.js standalone output is missing; refusing to publish an unchecked build.");
}

const environmentFiles = await findEnvironmentFiles(standaloneRoot);
await Promise.all(environmentFiles.map((path) => unlink(path)));

const remaining = await findEnvironmentFiles(standaloneRoot);
if (remaining.length > 0) {
  throw new Error("Environment files remain in the standalone output.");
}

console.log(`Standalone environment-file check passed; removed ${environmentFiles.length} file(s).`);
