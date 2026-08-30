import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATION_NAME = /^\d{14}_[a-z0-9_]+$/;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:/")) {
  throw new Error("DATABASE_URL must be an absolute file URL");
}

const databasePath = fileURLToPath(new URL(databaseUrl));
const migrationRoot = process.env.FEST_COMPASS_MIGRATIONS_DIR
  ? resolve(process.env.FEST_COMPASS_MIGRATIONS_DIR)
  : fileURLToPath(new URL("../prisma/migrations/", import.meta.url));

const migrations = readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && MIGRATION_NAME.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (migrations.length === 0) throw new Error("No SQLite migrations found");

const db = new DatabaseSync(databasePath, { timeout: 10_000 });
try {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_fest_compass_migrations" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "sha256" TEXT NOT NULL,
      "appliedAt" TEXT NOT NULL
    )
  `);

  const findApplied = db.prepare(
    'SELECT "sha256" FROM "_fest_compass_migrations" WHERE "name" = ?',
  );
  const recordApplied = db.prepare(
    'INSERT INTO "_fest_compass_migrations" ("name", "sha256", "appliedAt") VALUES (?, ?, ?)',
  );

  for (const name of migrations) {
    const sqlPath = resolve(migrationRoot, name, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    if (!sql.trim()) throw new Error(`Migration ${name} is empty`);
    const digest = createHash("sha256").update(sql).digest("hex");
    const applied = findApplied.get(name);
    if (applied) {
      if (applied.sha256 !== digest) {
        throw new Error(`Migration checksum mismatch: ${name}`);
      }
      continue;
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      recordApplied.run(name, digest, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
} finally {
  db.close();
}

if (process.env.FEST_COMPASS_MIGRATION_REPORT === "1") {
  process.stdout.write(`${pathToFileURL(databasePath).href}\n`);
}
