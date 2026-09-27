// Controlled, explicitly synthetic tourism-media fixtures. These checks prove UI behavior, not provider coverage.
// List/detail API answers and fixture image URLs are intercepted. The live companion script never intercepts them.
// Run against an already started app: E2E_BASE_URL=http://127.0.0.1:3100 node scripts/tourism-media-e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";

const base = process.env.E2E_BASE_URL ?? process.env.BASE_URL;
if (!base) throw Error("E2E_BASE_URL (or BASE_URL) required");
const origin = new URL(base).origin;
const output = resolve(process.env.MEDIA_OUTPUT_DIR ?? "output/playwright/tourism-media-controlled");
mkdirSync(output, { recursive: true });
const catalogue = JSON.parse(readFileSync(new URL("../data/region-catalogue.json", import.meta.url), "utf8"));
const regionRow = catalogue.rows.find(row => `${row.provinceCode}${row.districtCode}` === "44230");
assert.ok(regionRow, "real region catalogue contains Nonsan");
const REGION = { province: "44", district: "230", code: "44230", name: `${regionRow.provinceName} ${regionRow.districtName}`, districtName: regionRow.districtName };
const SOURCE_URL = "https://www.data.go.kr/data/15101578/openapi.do";
const AT = "2026-09-20T03:00:00.000Z";
// Section provenance deliberately differs from common metadata; freshness must never borrow the common time.
const GALLERY_AT = "2026-09-19T03:00:00.000Z", INFO_AT = "2026-09-18T03:00:00.000Z";
const photo = (n, license = "Type3") => ({
  url: `https://tong.visitkorea.or.kr/cms/resource/01/99999${String(n).padStart(2, "0")}_image2_1.jpg`,
  thumbnailUrl: null, title: `검증용 가상 사진 ${n}`, license, sourceUrl: SOURCE_URL,
});
const P = [photo(1), photo(2), photo(3), photo(4, "Type1"), photo(5), photo(6), photo(7), photo(8), photo(9), photo(10)];
const item = (id, title, image) => ({ id, kind: "12", title: `검증용 ${title} (가상)`, address: `검증용 가상 주소 ${id}`,
  point: { latitude: 36.18 + (Number(id) % 10) * 0.01, longitude: 127.1 }, modifiedAt: null, photo: image });
// A cached list can retain older license/title metadata for the same URL. The newer detail is authoritative.
const A = item("98001", "사진 세 장", { ...P[0], license: "Type1", title: "검증용 오래된 대표사진 정보" });
const B = item("98002", "사진 없음", null);
const C = item("98003", "사진 전송 실패", P[3]);
const D = item("98004", "이용정보 부분 실패", P[4]);
const E = item("98005", "추가 사진 부분 실패", P[5]);
const F = item("98006", "이전 선택 응답 지연", P[6]);
const G = item("98007", "나중 선택", { ...P[7], license: "Type1", title: "검증용 오래된 나중 선택 대표사진 정보" });
const H = item("98008", "사진 정보 보존 후 원천 실패", P[8]);
const I = item("98009", "사진 정보 보존 후 통신 실패", P[9]);
const ITEMS = [A, B, C, D, E, F, G, H, I];
const intro = resource => `${resource.title}의 검증용 소개입니다. 실제 관광지 안내가 아닙니다.`;
const FACTS = [{ label: "이용시간", value: "검증용 09:00~18:00" }, { label: "주차", value: "검증용 주차장 있음" }];
const G_FACTS = [{ label: "이용시간", value: "검증용 10:00~16:00" }, { label: "주차", value: "검증용 주차장 없음" }];
const FLOWS = {
  existing: { path: "/existing/archive%3Anonsan-strawberry/resources?types=12", heading: "resource-detail-heading" },
  new: { path: "/new/44230/resources?types=12", heading: "new-resource-detail-heading" },
  regions: { path: "/regions?province=44&district=230&start=2025-03-01&end=2025-03-31&kind=12" },
};
const report = { checkedAt: new Date().toISOString(), base, headless: true,
  dataProvenance: "CONTROLLED SYNTHETIC FIXTURES: API responses and photos, not evidence of real provider records",
  checks: [], layouts: [], apiRequests: [], imageRequests: [], browserErrors: [], appWrites: [] };

function listBody(params) {
  const request = { province: params.get("province"), district: params.get("district"), types: params.get("types").split(",") };
  assert.equal(`${request.province}${request.district}`, REGION.code);
  return { request, key: JSON.stringify(["resources", request.province, request.district, request.types]), retrievedAt: AT, region: REGION,
    byType: request.types.map(kind => ({ kind, label: { 12: "관광지", 14: "문화시설", 39: "음식점", 32: "숙박" }[kind],
      status: kind === "12" ? "complete" : "empty", error: null, collectedAt: AT, total: kind === "12" ? ITEMS.length : 0, items: kind === "12" ? ITEMS : [] })) };
}
function regionBody(params) {
  const query = Object.fromEntries(params);
  return { query, region: regionRow, resources: { status: "complete", message: "검증용 가상 관광자원 목록", total: ITEMS.length, pages: 1, collectedAt: AT, source: SOURCE_URL,
    items: ITEMS.map(({ point, ...row }) => ({ ...row, latitude: point.latitude, longitude: point.longitude, start: null, end: null })) },
  history: { status: "unavailable", message: "검증용 방문 이력 없음", source: SOURCE_URL, unit: "명", metric: "검증용", points: [] } };
}
function detailBody(params, state) {
  const request = { province: params.get("province"), district: params.get("district"), kind: params.get("kind"), id: params.get("id") };
  const resource = ITEMS.find(row => row.id === request.id);
  assert.ok(resource, `known synthetic resource ${request.id}`);
  const base = { key: JSON.stringify(["new-resource-detail", request.province, request.district, request.kind, request.id]), request, retrievedAt: AT, region: REGION };
  if (state.totalFailures.get(request.id) === "unavailable") return { ...base, status: "unavailable", error: { code: "source-unavailable", retryable: true }, detail: null, source: null };
  const photos = resource === A ? P.slice(0, 3) : resource === G ? [P[7]] : resource.photo ? [resource.photo] : [];
  return { ...base,
    status: "complete", error: null, source: { title: "검증용 가상 소개 출처", url: SOURCE_URL, checkedAt: null, publishedAt: null, collectedAt: AT },
    detail: { id: request.id, kind: request.kind, overview: [H, I].includes(resource) ? "" : intro(resource), truncated: false, modifiedAt: null,
      photos, galleryStatus: (resource === E && !state.galleryRecovered) || [H, I].includes(resource) ? "unavailable" : photos.length ? "complete" : "empty",
      facts: resource === D && !state.infoRecovered ? [] : resource === G ? G_FACTS : FACTS, infoStatus: resource === D && !state.infoRecovered ? "unavailable" : "complete",
      galleryCollectedAt: GALLERY_AT, infoCollectedAt: INFO_AT,
      phone: "검증용 전화 안내", website: "https://example.org/controlled-tourism-fixture" } };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function within(promise, label, ms = 20000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`Timed out: ${label}`)), ms); })]); }
  finally { clearTimeout(timer); }
}
const list = (page, flow) => flow === "regions" ? page.getByRole("region", { name: "조회 자료 목록", exact: true }) : page.getByRole("list", { name: "관광자원 목록", exact: true });
const row = (page, flow, resource) => list(page, flow).locator(`[data-resource-id="${resource.id}"]`);
const detail = (page, flow, resource) => flow === "regions" ? page.getByRole("region", { name: "자료 상세와 근거 담기", exact: true }) : page.getByRole("complementary", { name: resource.title, exact: true });
const gallery = (page, flow, resource) => detail(page, flow, resource).locator("[data-resource-gallery]");
const mainImage = (page, flow, resource) => gallery(page, flow, resource).locator("img[data-resource-photo]");
const next = (page, resource) => page.getByRole("button", { name: `${resource.title} 다음 사진`, exact: true });
const previous = (page, resource) => page.getByRole("button", { name: `${resource.title} 이전 사진`, exact: true });
async function loaded(locator, expectedUrl) {
  await locator.waitFor({ state: "visible" });
  await locator.evaluate((img, url) => new Promise((resolve, reject) => {
    const check = () => img.complete && img.naturalWidth > 0 && (!url || img.currentSrc === url);
    if (check()) return resolve();
    const timer = setTimeout(() => reject(Error(`Image did not load: ${img.currentSrc}`)), 20000);
    const done = () => { if (check()) { clearTimeout(timer); resolve(); } };
    img.addEventListener("load", done, { once: true }); done();
  }), expectedUrl);
}
async function selected(page, flow, resource, { keyboard = false } = {}) {
  const button = row(page, flow, resource);
  if (keyboard) { await button.focus(); await button.press("Enter"); } else await button.click();
  const scope = detail(page, flow, resource);
  await scope.getByRole("heading", { name: resource.title, exact: true }).waitFor();
  assert.equal(await button.getAttribute("aria-pressed"), "true");
  if (FLOWS[flow].heading) await page.waitForFunction(id => document.activeElement?.id === id, FLOWS[flow].heading);
  return scope;
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(size)}`);
  return size;
}
async function fullPageShot(page, name) {
  // Reset only for the capture: a sticky global header must not be composited over the middle of a full-page image.
  await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
}
const browser = await chromium.launch({ headless: true });
try {
  for (const flow of Object.keys(FLOWS)) {
    const state = { infoRecovered: false, galleryRecovered: false, totalFailures: new Map(), holdId: null, arrived: null, release: null, completed: null };
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR" });
    try {
      await mockMapTiles(context);
      await context.route(url => P.some(image => image.url === url.href), async route => {
        const url = route.request().url(), index = P.findIndex(image => image.url === url);
        report.imageRequests.push({ flow, fixture: index + 1, status: index === 3 ? 404 : 200 });
        if (index === 3) return route.fulfill({ status: 404, contentType: "text/plain", body: "Controlled image failure" });
        return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${["#b7d1c1", "#d3c7a1", "#adbed3"][index % 3]}"/><text x="24" y="175" font-size="29" fill="#23372e">CONTROLLED PHOTO FIXTURE ${index + 1}</text></svg>` });
      });
      await context.route(url => url.origin === origin && ["/api/existing/resources", "/api/resources/detail", "/api/regions"].includes(url.pathname), async route => {
        const url = new URL(route.request().url()), params = url.searchParams;
        report.apiRequests.push({ flow, path: url.pathname, id: params.get("id") });
        if (url.pathname === "/api/resources/detail" && state.totalFailures.get(params.get("id")) === "network") return route.abort("failed");
        const held = url.pathname === "/api/resources/detail" && params.get("id") === state.holdId;
        if (held) {
          state.arrived.resolve(); await state.release.promise;
        }
        const json = url.pathname === "/api/existing/resources" ? listBody(params) : url.pathname === "/api/regions" ? regionBody(params) : detailBody(params, state);
        try { await route.fulfill({ json }); } catch { /* Switching selection may abort the deliberately delayed request. */ }
        finally { if (held) state.completed.resolve(); }
      });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      page.on("pageerror", error => report.browserErrors.push({ flow, message: error.message }));
      page.on("request", request => { const url = new URL(request.url()); if (url.origin === origin && url.pathname.startsWith("/api/") && request.method() !== "GET") report.appWrites.push(`${request.method()} ${url.pathname}`); });
      await page.addLocatorHandler(page.getByRole("button", { name: "모두 거부", exact: true }), button => button.click());
      await page.goto(`${base}${FLOWS[flow].path}`);
      await row(page, flow, A).waitFor();
      await loaded(row(page, flow, A).locator("img"), A.photo.url);
      assert.equal(await row(page, flow, B).locator("img").count(), 0, `${flow}: no invented list image for an absent photo`);
      const scope = await selected(page, flow, A, { keyboard: true });
      await loaded(mainImage(page, flow, A), P[0].url);
      await scope.getByText(intro(A), { exact: true }).waitFor();
      for (const fact of FACTS) await scope.getByText(fact.value, { exact: true }).waitFor();
      assert.equal(await mainImage(page, flow, A).evaluate(img => getComputedStyle(img).objectFit), "contain", "Type3 photos stay uncropped");
      await gallery(page, flow, A).getByRole("link", { name: "공공누리 제3유형", exact: true }).waitFor();
      await gallery(page, flow, A).getByText(P[0].title, { exact: true }).waitFor();
      assert.equal(await gallery(page, flow, A).getByRole("link", { name: "공공누리 제1유형", exact: true }).count(), 0,
        "current detail license takes precedence over older list metadata for the same URL");
      assert.equal(await gallery(page, flow, A).getByRole("link", { name: "원본 크기로 보기 ↗", exact: true }).getAttribute("href"), P[0].url);
      await next(page, A).focus(); await page.keyboard.press("Enter");
      await loaded(mainImage(page, flow, A), P[1].url);
      assert.equal(await next(page, A).evaluate(button => button === document.activeElement), true, "gallery navigation keeps the activating control focused");
      await previous(page, A).focus(); await page.keyboard.press("Space");
      await loaded(mainImage(page, flow, A), P[0].url);
      const lastThumb = page.getByRole("button", { name: `${A.title} 사진 3 보기`, exact: true });
      await lastThumb.focus(); await page.keyboard.press("Enter");
      await loaded(mainImage(page, flow, A), P[2].url);
      assert.equal(await lastThumb.getAttribute("aria-pressed"), "true");
      report.checks.push(`${flow}: representative-photo, authoritative-detail-license, original-photo-link, uncropped-gallery, practical-info, keyboard-controls`);

      for (const width of [390, 1440, 1920]) {
        await page.setViewportSize({ width, height: width === 390 ? 900 : 1000 });
        await loaded(mainImage(page, flow, A), P[2].url);
        const metrics = await noOverflow(page, `${flow} ${width}`);
        const image = await mainImage(page, flow, A).boundingBox();
        assert.ok(image.width > 100 && image.width <= width, `${flow} ${width}: usable photo size`);
        report.layouts.push({ flow, width, ...metrics, image });
        await scope.scrollIntoViewIfNeeded();
        await fullPageShot(page, `${flow}-gallery-${width}`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (flow !== "regions") {
        await scope.getByRole("button", { name: "상세 닫기", exact: true }).click();
        await page.waitForFunction(id => document.activeElement?.getAttribute("data-resource-id") === id, A.id);
        report.checks.push(`${flow}: detail-close-restores-selected-list-row-focus`);
      }

      const empty = await selected(page, flow, B);
      await empty.getByText(intro(B), { exact: true }).waitFor();
      assert.equal(await empty.locator("[data-resource-gallery]").count(), 0, `${flow}: confirmed absence omits the gallery`);
      assert.equal(await empty.locator("img").count(), 0, `${flow}: absent photo has no placeholder image`);
      assert.equal(await empty.getByText("등록된 사진이 없어요.", { exact: true }).count(), 0, `${flow}: no empty-photo announcement`);
      report.checks.push(`${flow}: absent-photo-omits-gallery-with-introduction-preserved`);

      const broken = await selected(page, flow, C);
      await broken.getByText("사진을 불러오지 못했어요.", { exact: false }).waitFor();
      await page.waitForFunction(() => ![...document.querySelectorAll('[data-resource-gallery] img, [data-resource-id="98003"] img')].some(img => img.complete && img.naturalWidth === 0));
      assert.equal(await row(page, flow, C).getAttribute("aria-pressed"), "true");
      await broken.getByText(intro(C), { exact: true }).waitFor();
      await noOverflow(page, `${flow} image404`);
      report.checks.push(`${flow}: image404-removes-broken-image-and-preserves-selection-and-intro`);

      const partial = await selected(page, flow, D);
      await partial.getByText("이용정보를 불러오지 못했어요.", { exact: false }).waitFor();
      await loaded(mainImage(page, flow, D), D.photo.url);
      await partial.getByText(intro(D), { exact: true }).waitFor();
      const listCalls = report.apiRequests.filter(call => call.flow === flow && call.path !== "/api/resources/detail").length;
      state.infoRecovered = true;
      await partial.getByRole("button", { name: `${D.title} 이용정보 다시 불러오기`, exact: true }).click();
      for (const fact of FACTS) await partial.getByText(fact.value, { exact: true }).waitFor();
      await loaded(mainImage(page, flow, D), D.photo.url);
      await partial.getByText(intro(D), { exact: true }).waitFor();
      assert.equal(report.apiRequests.filter(call => call.flow === flow && call.path !== "/api/resources/detail").length, listCalls, "information retry leaves list requests alone");
      assert.equal(await row(page, flow, D).getAttribute("aria-pressed"), "true");
      report.checks.push(`${flow}: information-failure-and-retry-preserve-photo-intro-selection-and-list`);

      const partialGallery = await selected(page, flow, E);
      await partialGallery.getByText("추가 사진을 불러오지 못했어요.", { exact: false }).waitFor();
      await loaded(mainImage(page, flow, E), E.photo.url);
      state.galleryRecovered = true;
      await partialGallery.getByRole("button", { name: `${E.title} 사진 목록 다시 불러오기`, exact: true }).click();
      await partialGallery.getByText("추가 사진을 불러오지 못했어요.", { exact: false }).waitFor({ state: "hidden" });
      await loaded(mainImage(page, flow, E), E.photo.url);
      report.checks.push(`${flow}: gallery-provider-failure-keeps-representative-photo-and-retries`);

      state.holdId = F.id; state.arrived = deferred(); state.release = deferred(); state.completed = deferred();
      await selected(page, flow, F);
      await within(state.arrived.promise, `${flow}: delayed selection request arrived`);
      const latest = await selected(page, flow, G);
      await loaded(mainImage(page, flow, G), G.photo.url);
      await latest.getByText(intro(G), { exact: true }).waitFor();
      state.release.resolve();
      // The server response is deliberately released only after G is fully rendered. AbortController may discard
      // the old fetch; in either case its route has completed before the selected state is examined again.
      await within(state.completed.promise, `${flow}: delayed selection response released`);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await loaded(mainImage(page, flow, G), G.photo.url);
      assert.equal(await latest.getByText(intro(F), { exact: true }).count(), 0);
      assert.equal(await row(page, flow, G).getAttribute("aria-pressed"), "true");
      assert.equal(await latest.locator(`img[src="${F.photo.url}"]`).count(), 0);
      report.checks.push(`${flow}: late-previous-selection-cannot-replace-current-photo-or-intro`);

      // Shared-detail regression: facts and photos were successfully obtained even though overview was empty.
      // A retry for unavailable additional photos must not erase these facts or mislabel them as newly verified
      // when either the whole provider answer or the network fails. One flow exercises the shared component.
      if (flow === "new") for (const [resource, failure] of [[H, "unavailable"], [I, "network"]]) {
        const retained = await selected(page, flow, resource);
        await loaded(mainImage(page, flow, resource), resource.photo.url);
        for (const fact of FACTS) await retained.getByText(fact.value, { exact: true }).waitFor();
        assert.equal(await retained.getByRole("region", { name: `${resource.title} 소개`, exact: true }).count(), 0);
        const galleryScope = gallery(page, flow, resource);
        await galleryScope.getByText("추가 사진을 불러오지 못했어요.", { exact: false }).waitFor();
        state.totalFailures.set(resource.id, failure);
        await galleryScope.getByRole("button", { name: `${resource.title} 사진 목록 다시 불러오기`, exact: true }).click();
        await galleryScope.getByText("사진 목록을 새로 확인하지 못했어요.", { exact: false }).waitFor();
        const photoFreshness = galleryScope.getByText(/에 확인한 사진 목록이에요\./);
        await photoFreshness.waitFor();
        assert.match(await photoFreshness.innerText(), /2026\. 9\. 19\./, "photo freshness uses its section collection date");
        const info = retained.getByRole("region", { name: `${resource.title} 이용정보`, exact: true });
        await info.getByText("이용정보를 새로 확인하지 못했어요.", { exact: false }).waitFor();
        const infoFreshness = info.getByText(/에 확인한 이용정보예요\./);
        await infoFreshness.waitFor();
        assert.match(await infoFreshness.innerText(), /2026\. 9\. 18\./, "practical information freshness uses its own collection date");
        await info.getByRole("button", { name: `${resource.title} 이용정보 다시 불러오기`, exact: true }).waitFor();
        await loaded(mainImage(page, flow, resource), resource.photo.url);
        for (const fact of FACTS) await info.getByText(fact.value, { exact: true }).waitFor();
        assert.equal(await retained.getByText("소개를 불러오지 못했어요.", { exact: false }).count(), 0,
          "confirmed empty overview stays omitted while photo and information freshness explain the actual failure");
        assert.equal(await row(page, flow, resource).getAttribute("aria-pressed"), "true");
        await noOverflow(page, `${flow} retained data after ${failure}`);
        await retained.scrollIntoViewIfNeeded();
        await fullPageShot(page, `${flow}-retained-media-${failure}`);
        report.checks.push(`${flow}: empty-overview-${failure}-refresh-keeps-photos-facts-with-freshness-and-own-retries`);
      }

      if (flow === "new") {
        const callsBeforeComparison = report.apiRequests.length;
        for (const resource of [A, G]) {
          const add = list(page, flow).getByRole("button", { name: `${resource.title} 함께 보기에 추가`, exact: true });
          await add.focus(); await page.keyboard.press("Enter");
        }
        const comparison = page.getByRole("region", { name: /^함께 보기 2\/2$/ });
        await comparison.waitFor();
        const comparisonCard = resource => comparison.getByRole("article", { name: resource.title, exact: true });
        for (const [resource, authoritativePhoto, facts, foreignFacts] of [[A, P[0], FACTS, G_FACTS], [G, P[7], G_FACTS, FACTS]]) {
          const card = comparisonCard(resource), cardGallery = card.locator("[data-resource-gallery]");
          await card.getByText(intro(resource), { exact: true }).waitFor();
          await loaded(cardGallery.locator("img[data-resource-photo]"), authoritativePhoto.url);
          await cardGallery.getByText(authoritativePhoto.title, { exact: true }).waitFor();
          await cardGallery.getByRole("link", { name: "공공누리 제3유형", exact: true }).waitFor();
          assert.equal(await cardGallery.getByRole("link", { name: "공공누리 제1유형", exact: true }).count(), 0,
            `${resource.title}: comparison uses current detail license instead of old list license`);
          const info = card.getByRole("region", { name: `${resource.title} 이용정보`, exact: true });
          for (const fact of facts) await info.getByText(fact.value, { exact: true }).waitFor();
          for (const fact of foreignFacts) assert.equal(await info.getByText(fact.value, { exact: true }).count(), 0,
            `${resource.title}: comparison facts belong to this candidate`);
          const freshCalls = report.apiRequests.slice(callsBeforeComparison).filter(call => call.path === "/api/resources/detail" && call.id === resource.id).length;
          assert.ok(freshCalls <= 1, `${resource.title}: comparison reuses cached detail or fetches it once, without separate media/introduction requests`);
          assert.ok(report.apiRequests.some(call => call.flow === flow && call.path === "/api/resources/detail" && call.id === resource.id),
            `${resource.title}: displayed authoritative data came from a detail response in this flow`);
        }
        // Gallery changes in one candidate must leave the other candidate's image and facts alone.
        const cardA = comparisonCard(A), cardG = comparisonCard(G);
        await cardA.getByRole("button", { name: `${A.title} 다음 사진`, exact: true }).focus();
        await page.keyboard.press("Enter");
        await loaded(cardA.locator("img[data-resource-photo]"), P[1].url);
        await loaded(cardG.locator("img[data-resource-photo]"), P[7].url);
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: width === 390 ? 900 : 1000 });
          await noOverflow(page, `new two candidates ${width}`);
          await fullPageShot(page, `new-two-candidates-${width}`);
        }
        await cardA.getByRole("button", { name: `${A.title} 상세 보기`, exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.id === "new-resource-detail-heading");
        await loaded(mainImage(page, flow, A), P[0].url);
        assert.equal(await row(page, flow, A).getAttribute("aria-pressed"), "true");
        await cardA.getByRole("button", { name: `${A.title} 함께 보기에서 빼기`, exact: true }).click();
        const remaining = page.getByRole("region", { name: /^함께 보기 1\/2$/ });
        await remaining.waitFor();
        assert.equal(await remaining.getByRole("article", { name: A.title, exact: true }).count(), 0);
        const remainingG = remaining.getByRole("article", { name: G.title, exact: true });
        await loaded(remainingG.locator("img[data-resource-photo]"), P[7].url);
        await remainingG.getByRole("button", { name: `${G.title} 상세 보기`, exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.id === "new-resource-detail-heading");
        await loaded(mainImage(page, flow, G), P[7].url);
        for (const fact of G_FACTS) await detail(page, flow, G).getByText(fact.value, { exact: true }).waitFor();
        assert.equal(await row(page, flow, G).getAttribute("aria-pressed"), "true");
        await remainingG.getByRole("button", { name: `${G.title} 함께 보기에서 빼기`, exact: true }).click();
        await page.getByRole("heading", { name: "함께 보기 0/2", exact: true }).waitFor();
        report.checks.push("new: two-candidate-authoritative-photos-and-distinct-facts-shared-request-or-cache-independent-gallery-detail-open-and-remove");
      }
    } finally { state.release?.resolve(); await context.close(); }
  }
  assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.appWrites, []);
  assert.ok(report.imageRequests.some(request => request.status === 404), "controlled failure image was requested");
  report.status = "passed";
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); throw error; }
finally { await browser.close(); writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report)); }
