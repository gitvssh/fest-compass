import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assertEditorMode, ReadOnlyModeError, resolveAppMode } from "./app-mode";

test("로컬 기본 모드는 editor이고 production 기본값과 잘못된 값은 읽기 전용이다", () => {
  assert.equal(resolveAppMode(undefined, "development"), "editor");
  assert.equal(resolveAppMode(undefined, "test"), "editor");
  assert.equal(resolveAppMode(undefined, "production"), "public-readonly");
  assert.equal(resolveAppMode("editor", "production"), "editor");
  assert.equal(resolveAppMode("public-readonly", "development"), "public-readonly");
  assert.equal(resolveAppMode("typo", "development"), "public-readonly");
});

test("공개 읽기 전용 모드에서 공통 guard가 fail-closed한다", () => {
  const before = process.env.APP_MODE;
  process.env.APP_MODE = "public-readonly";
  try {
    assert.throws(() => assertEditorMode(), (error) => {
      assert.ok(error instanceof ReadOnlyModeError);
      assert.equal(error.code, "APP_READ_ONLY");
      return true;
    });
  } finally {
    if (before === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = before;
  }
});

test("use server 모듈의 모든 export async function이 공통 guard로 시작한다", () => {
  const source = readFileSync(fileURLToPath(new URL("./actions.ts", import.meta.url)), "utf8");
  const exports = [...source.matchAll(/export async function\s+(\w+)\s*\([^)]*\)\s*\{/g)];
  assert.ok(exports.length > 0);
  for (const match of exports) {
    const bodyStart = (match.index ?? 0) + match[0].length;
    const firstStatement = source.slice(bodyStart).match(/\S[^\n;]*;/)?.[0] ?? "";
    assert.match(firstStatement, /^assertEditorMode\(\);$/, `${match[1]} must fail closed first`);
  }
});
