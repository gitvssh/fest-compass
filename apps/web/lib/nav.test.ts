import test from "node:test";
import assert from "node:assert/strict";
import { currentFor, navLinks, normalizePath } from "./nav";

test("menu marks only the exact page as the current page", () => {
  const current = (path: string) => navLinks(true).filter(l => currentFor(path, l.href) === "page").map(l => l.href);
  assert.deepEqual(current("/"), ["/"]);
  assert.deepEqual(current("/regions"), ["/regions"]);
  assert.deepEqual(current("/planning/options"), ["/planning/options"]);
  assert.deepEqual(current("/privacy"), ["/privacy"]);
  assert.deepEqual(current("/festivals/12"), []);
});

test("nested pages mark the parent section without claiming to be it", () => {
  const existing = navLinks(false).find(link => link.href === "/existing/search")!;
  assert.equal(currentFor("/existing/archive%3Anonsan-strawberry/visits", existing.href, existing.section), "true");
  assert.equal(currentFor("/existing/search", existing.href, existing.section), "page");
  assert.equal(currentFor("/existing-other/search", existing.href, existing.section), undefined);
  assert.equal(currentFor("/compare", "/compare"), "page");
  assert.equal(currentFor("/compare/annual", "/compare"), "true");
  assert.equal(currentFor("/compare/annual/", "/compare"), "true");
  assert.equal(currentFor("/compare-annual", "/compare"), undefined);
  assert.equal(currentFor("/planning-other", "/planning"), undefined);
  assert.equal(currentFor("/planning/options-x", "/planning/options"), undefined);
  assert.equal(currentFor("/planning/options/detail", "/planning/options"), "true");
});

test("root is exact only, and trailing slashes, queries and hashes are ignored", () => {
  assert.equal(currentFor("/", "/"), "page");
  assert.equal(currentFor("/regions", "/"), undefined);
  assert.equal(currentFor("/regions/", "/regions"), "page");
  assert.equal(currentFor("/compare?province=44&district=230", "/compare"), "page");
  assert.equal(currentFor("/compare#list", "/compare"), "page");
  assert.equal(currentFor("/compare?next=/compare/annual", "/regions"), undefined);
  assert.equal(normalizePath("///"), "/");
  assert.equal(normalizePath(""), "/");
});

test("editor-only links appear only when enabled and privacy stays in the menu", () => {
  assert.equal(navLinks(false).some(l => l.href === "/logs"), false);
  assert.equal(navLinks(true).some(l => l.href === "/logs"), true);
  assert.equal(navLinks(false).at(-1)?.href, "/privacy");
});
