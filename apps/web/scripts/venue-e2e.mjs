import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL;
if (!base) throw Error("E2E_BASE_URL required");
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await mockMapTiles(context);
const page = await context.newPage(), errors = [], writes = [], passed = [], key = "fest-compass.planning.v1";
page.on("pageerror", e => errors.push(e.message));
page.on("request", r => { if (r.url().startsWith(base) && r.method() !== "GET") writes.push(r.method()); });
const button = name => page.getByRole("button", { name, exact: true }), field = name => page.getByLabel(name, { exact: true });
const data = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const save = async () => { await button("초안 저장").click(); await page.getByText("이 브라우저에 초안을 저장했습니다.", { exact: true }).waitFor(); };
await page.route("**/api/regions?*", async route => {
  const q = new URL(route.request().url()).searchParams;
  await route.fulfill({ json: {
    query: { province: q.get("province"), district: q.get("district"), start: q.get("start"), end: q.get("end"), kind: q.get("kind") },
    region: { provinceCode: "44", provinceName: "충청남도", districtCode: "230", districtName: "논산시" },
    resources: { status: "complete", message: "가상 장소 연결 검증 자료", total: 1, pages: 1, collectedAt: "2026-09-10T00:00:00Z", source: "https://www.data.go.kr/data/15101578/openapi.do", items: [{ id: "9001", title: "검증용 문화공원 (가상)", address: "검증용 주소 1", latitude: 36.2, longitude: 127.1, start: null, end: null, modifiedAt: null }] },
    history: { status: "unavailable", message: "검증용 결측", source: "https://www.data.go.kr/data/15101972/openapi.do", unit: "명", metric: "시군구 일별 외지인 방문", points: [] },
  } });
});
try {
  await page.goto(`${base}/regions`); await button("논산 2025년 3월 자료로 살펴보기 →").filter({ visible: true }).click();
  await page.getByRole("button", { name: /^1\. 검증용 문화공원/ }).click();
  await field("기획에 참고할 이유").fill("장소 조사 시험"); await button("선택 자료를 기획 근거에 담기").click();
  await page.getByText(/기획 근거에 담았습니다/).waitFor(); await page.goto(`${base}/evidence`);
  await page.getByRole("link", { name: "이 지역 근거로 후보 기획 →", exact: true }).click();
  const preview = page.getByRole("region", { name: "관광자료로 장소 입력", exact: true });
  await preview.waitFor(); await field("기획 담당 지역").selectOption("44/150");
  await field("후보 장소·주소").fill("기존 장소 입력");
  assert.equal(await field("후보 장소·주소").inputValue(), "기존 장소 입력");
  await preview.getByText("위도 36.2 · 경도 127.1", { exact: true }).waitFor();
  passed.push("map-evidence-planning-deep-link", "source-preview-without-overwrite");
  await button("같은 항목으로 비교").click(); await button("현재 안을 보관본으로 남기기").click();
  await page.getByText(/현재 후보·근거·확인 상태를 보관본으로 남겼습니다/).waitFor();
  const archived = JSON.stringify((await data()).revisions);
  await button("후보 작성").click(); await field("이 자료를 참고하는 판단 이유").fill("공원 자원을 활용할 가능성을 검토");
  await button("현재 장소를 이 자료로 바꾸기").click();
  assert.equal(await field("후보 장소·주소").inputValue(), "검증용 문화공원 (가상) · 검증용 주소 1");
  assert.equal(await button("현재 장소를 이 자료로 바꾸기").isDisabled(), true);
  await save(); let p = await data();
  assert.equal(p.draft.regionKey, "44/150"); assert.equal(JSON.stringify(p.revisions), archived);
  assert.equal(p.draft.options[0].links[0].field, "venue"); assert.equal(p.draft.options[0].venueChecks.length, 0);
  assert.equal(p.draft.evidence[0].value.result.resources.items[0].latitude, 36.2);
  passed.push("atomic-venue-and-source-copy", "owner-and-archive-unchanged", "tourism-is-not-permission");
  await field("후보 장소·주소").fill("담당자 수정"); await field("이 자료를 참고하는 판단 이유").fill("덮어쓰지 않을 새 메모");
  await button("현재 장소를 이 자료로 바꾸기").click(); await save(); p = await data();
  assert.equal(p.draft.options[0].links.length, 1); assert.equal(p.draft.options[0].links[0].reason, "공원 자원을 활용할 가능성을 검토");
  await page.evaluate(() => localStorage.removeItem("fest-compass.region-evidence.v1")); await page.reload(); await preview.waitFor();
  passed.push("existing-link-reason-kept", "source-survives-library-removal");
  const pending = page.waitForEvent("download"); await button("기획 입력 파일 보관").click(); const raw = readFileSync(await (await pending).path());
  await button("보관본 1개").click(); await field("기획 파일을 새 초안으로 가져오기").setInputFiles({ name: "venue.json", mimeType: "application/json", buffer: raw });
  await page.getByText(/가져오기 전 초안과 기존 보관본/).waitFor();
  assert.equal((await data()).draft.evidence[0].value.result.resources.items[0].address, "검증용 주소 1");
  await button("후보 작성").click(); await preview.waitFor();
  mkdirSync("output/playwright", { recursive: true }); await preview.screenshot({ path: "output/playwright/venue-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await preview.screenshot({ path: "output/playwright/venue-mobile.png" });
  passed.push("planning-file-roundtrip", "390px-no-overflow");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log(JSON.stringify({ headless: true, fixture: true, passed, browserErrors: errors.length, clientWrites: writes.length }));
} finally { await browser.close(); }
