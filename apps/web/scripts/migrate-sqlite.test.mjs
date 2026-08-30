import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const webRoot = resolve(import.meta.dirname, "..");
const runner = resolve(import.meta.dirname, "migrate-sqlite.mjs");
const sourceMigrations = resolve(webRoot, "prisma", "migrations");

function runMigration(databasePath, migrationsPath) {
  return spawnSync(process.execPath, [runner], {
    cwd: webRoot,
    env: {
      ...process.env,
      DATABASE_URL: pathToFileURL(databasePath).href,
      FEST_COMPASS_MIGRATIONS_DIR: migrationsPath,
    },
    encoding: "utf8",
  });
}

test("fresh database migration is repeatable and checksum-bound", () => {
  const directory = mkdtempSync(join(tmpdir(), "fest-compass-migrations-"));
  try {
    const migrationsPath = join(directory, "migrations");
    const databasePath = join(directory, "fest-compass.db");
    cpSync(sourceMigrations, migrationsPath, { recursive: true });

    const first = runMigration(databasePath, migrationsPath);
    assert.equal(first.status, 0, first.stderr);
    const second = runMigration(databasePath, migrationsPath);
    assert.equal(second.status, 0, second.stderr);

    const db = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(
        db.prepare('SELECT count(*) AS count FROM "_fest_compass_migrations"').get().count,
        2,
      );
      assert.equal(
        db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'Festival'").get().count,
        1,
      );
      assert.equal(
        db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'Festival_isDemo_createdAt_idx'").get().count,
        1,
      );
    } finally {
      db.close();
    }

    const changedMigration = join(
      migrationsPath,
      "20260830001000_add_runtime_indexes",
      "migration.sql",
    );
    writeFileSync(changedMigration, `${readFileSync(changedMigration, "utf8")}\n-- drift\n`);
    const drift = runMigration(databasePath, migrationsPath);
    assert.notEqual(drift.status, 0);
    assert.match(drift.stderr, /checksum mismatch/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
