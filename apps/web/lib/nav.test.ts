import test from "node:test";
import assert from "node:assert/strict";
import { currentFor, NAV_LINKS, navLinks, normalizePath, planningLinks, PRIVACY_LINK, publicStorageNoticeFor } from "./nav";

test("menu marks only the exact page as the current page", () => {
  const current = (path: string) => navLinks(true).filter(l => currentFor(path, l.href) === "page").map(l => l.href);
  assert.deepEqual(current("/"), []);
  assert.deepEqual(current("/regions"), ["/regions"]);
  assert.deepEqual(current("/planning/options"), ["/planning/options"]);
  assert.deepEqual(current("/privacy"), []);
  assert.deepEqual(current("/festivals/12"), []);
});

test("nested pages mark the parent section without claiming to be it", () => {
  const existing = navLinks(false).find(link => link.href === "/existing/search")!;
  assert.equal(currentFor("/existing/archive%3Anonsan-strawberry/visits", existing.href, existing.section), "true");
  assert.equal(currentFor("/existing/search", existing.href, existing.section), "page");
  assert.equal(currentFor("/existing-other/search", existing.href, existing.section), undefined);
  const fresh = navLinks(false).find(link => link.href === "/new")!;
  assert.equal(fresh.label, "새 축제");
  assert.equal(currentFor("/new", fresh.href, fresh.section), "page");
  assert.equal(currentFor("/new/", fresh.href, fresh.section), "page");
  assert.equal(currentFor("/new/44-230/visits", fresh.href, fresh.section), "true");
  assert.equal(currentFor("/new-other", fresh.href, fresh.section), undefined);
  assert.equal(currentFor("/festivals/new", fresh.href, fresh.section), undefined);
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

test("primary navigation has four research entries and recording tools stay in their own group", () => {
  assert.deepEqual(NAV_LINKS.map(link => link.href), ["/existing/search", "/new", "/regions", "/compare"]);
  assert.deepEqual(planningLinks(false).map(link => link.href), ["/evidence", "/planning/options", "/planning/budget", "/planning/proposal", "/planning/outcomes", "/workspace"]);
  assert.equal(new Set(navLinks(true).map(link => link.href)).size, navLinks(true).length);
});

test("editor-only links appear only when enabled and privacy has a separate footer destination", () => {
  assert.equal(navLinks(false).some(l => l.href === "/logs"), false);
  assert.equal(navLinks(true).some(l => l.href === "/logs"), true);
  assert.equal(planningLinks(false).some(l => l.href === "/festivals/new"), false);
  assert.equal(planningLinks(true).some(l => l.href === "/festivals/new"), true);
  assert.equal(navLinks(false).some(l => l.href === PRIVACY_LINK.href), false);
  assert.equal(PRIVACY_LINK.href, "/privacy");
});

test("storage conditions appear only in recording contexts and distinguish public records", () => {
  for (const path of ["/", "/existing/search", "/new/44-230/visits", "/regions", "/compare", "/forecast", "/privacy", "/planning-other"]) {
    assert.equal(publicStorageNoticeFor(path), undefined, path);
  }
  for (const path of ["/evidence", "/planning/options", "/planning/proposal/", "/workspace?tab=0"]) {
    assert.match(publicStorageNoticeFor(path) ?? "", /이 브라우저에만 저장/, path);
  }
  assert.equal(publicStorageNoticeFor("/festivals/example/evidence"), "공개 운영 기록은 읽기 전용입니다.");
});
