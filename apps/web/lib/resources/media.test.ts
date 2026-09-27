import test from "node:test";
import assert from "node:assert/strict";
import { createExistingService } from "../existing/server";
import { createTourCall, type TourCall, type TourOperation, type TourPage } from "../existing/tour";
import type { ResourceKind } from "../existing/types";
import { loadResourceDetail } from "../new-festival/detail";
import { mapResource } from "../region/model";
import { resourceInfoText, resourceIntro, resourceWebsite } from "./info";
import { RESOURCE_GALLERY_LIMIT, resourceImageUrl, resourcePhoto, resourcePhotos } from "./media";

const AT = "2026-09-27T02:00:00.000Z";
const req = { province: "51", district: "150", kind: "12" as ResourceKind, id: "2775508" };
const image = (n = 1) => `https://tong.visitkorea.or.kr/cms/resource/08/2775508_image${n}_1.jpg`;
const common = (extra: Record<string, unknown> = {}) => ({ contentid: req.id, contenttypeid: req.kind, lDongRegnCd: req.province, lDongSignguCd: req.district,
  title: "순포습지", overview: "<p>습지 산책로</p>", firstimage: image(), firstimage2: image().replace("_1.jpg", "_2.jpg"), cpyrhtDivCd: "Type3", ...extra });
const galleryRow = (extra: Record<string, unknown> = {}) => ({ contentid: req.id, imgname: "습지 풍경", originimgurl: image(2), smallimageurl: image(2).replace("_1.jpg", "_2.jpg"), cpyrhtDivCd: "Type1", ...extra });
const introRow = (extra: Record<string, unknown> = {}) => ({ contentid: req.id, contenttypeid: req.kind, usetime: "상시 개방", restdate: "연중무휴", infocenter: "033-123-4567", ...extra });
const page = (rows: Record<string, unknown>[], extra: Partial<TourPage> = {}): TourPage => ({ total: rows.length, pageNo: 1, rows, collectedAt: AT, ...extra });
function fixture(overrides: Partial<Record<TourOperation, TourPage | Error>> = {}) {
  const calls: [TourOperation, Record<string, string>][] = [];
  const values: Partial<Record<TourOperation, TourPage | Error>> = { detailCommon2: page([common()]), detailImage2: page([galleryRow()]), detailIntro2: page([introRow()]), ...overrides };
  const call: TourCall = async (op, params) => { calls.push([op, params]); const value = values[op]; if (!value || value instanceof Error) throw value ?? new Error("unexpected"); return value; };
  return { call, calls };
}
const load = (f: ReturnType<typeof fixture>, kind = req.kind) => loadResourceDetail(f.call, { ...req, kind }, () => AT);

test("resource photos allow only licensed provider bitmaps and normalize HTTP before deduplication", () => {
  const photo = resourcePhoto(common({ title: "<b>습지</b><script>private()</script>\u0000 풍경" }), "common")!;
  assert.deepEqual([photo.url, photo.license, photo.title], [image(), "Type3", "습지 풍경"]);
  assert.ok(photo.sourceUrl.startsWith("https://www.data.go.kr/"));
  assert.equal(resourceImageUrl(image().replace("https:", "http:")), image());
  assert.equal(resourcePhotos([photo, resourcePhoto(common({ firstimage: image().replace("https:", "http:") }), "common")]).length, 1);
  for (const license of [undefined, null, "", "Type2", "Type4", "Type5", "type1", 1]) assert.equal(resourcePhoto(common({ cpyrhtDivCd: license }), "common"), null);
  assert.equal(resourcePhoto(common({ firstimage: "javascript:x()", firstimage2: image() }), "common")?.url, image());
  assert.equal(resourcePhoto(galleryRow({ cpyrhtDivCd: undefined }), "gallery"), null, "gallery license must be present on its own row");
});

test("resource image URLs reject alternate hosts, path escapes, credentials, URL parameters and active content", () => {
  const invalid = [undefined, 12, "", "//tong.visitkorea.or.kr/cms/resource/a.jpg", "data:image/svg+xml,x", image().replace("https:", "ftp:"),
    image().replace("tong.visitkorea.or.kr", "tong.visitkorea.or.kr.evil.test"), image().replace("tong.visitkorea.or.kr", "evil.tong.visitkorea.or.kr"),
    image().replace("https://", "https://name:secret@"), image().replace(".kr/", ".kr:444/"), image().replace("/cms/resource/", "/other/"),
    image().replace(".jpg", ".svg"), `${image()}?size=10`, `${image()}?`, `${image()}#part`, image().replace("/08/", "/08/../08/"),
    image().replace("/08/", "/%30%38/"), image().replace("/08/", "/08\\"), image().replace("tong.", "tong.\n"), `${image()}/fake.png`];
  for (const url of invalid) assert.equal(resourceImageUrl(url), null, String(url));
});

test("list media reaches the shared resource response while unusable photos do not discard a valid place", async () => {
  const q = { ...req, start: "2026-09-27", end: "2026-09-27" };
  const item = mapResource(common(), q);
  assert.equal(item.photo?.url, image());
  const missing = mapResource(common({ cpyrhtDivCd: "Type4" }), q);
  assert.deepEqual([missing.id, missing.photo], [req.id, null]);
  assert.throws(() => mapResource(common({ lDongSignguCd: "130" }), q));
  const service = createExistingService({ archive: async () => { throw new Error("not used"); }, tour: fixture().call, now: () => AT,
    regionList: async () => ({ status: "complete", message: "", items: [item, missing], total: 2, pages: 1, collectedAt: AT, source: "" }) });
  const result = await service.loadResources({ province: req.province, district: req.district, types: [req.kind] });
  assert.equal(result.byType[0].items[0].photo?.url, image());
  assert.equal(result.byType[0].items[1].photo, null);
});

test("practical fields use the resource kind, preserve reported values and strip provider markup", () => {
  const cases: [ResourceKind, string, string, string][] = [["12", "usetime", "이용시간", "infocenter"], ["14", "usefee", "이용요금", "infocenterculture"], ["39", "firstmenu", "대표 메뉴", "infocenterfood"], ["32", "checkintime", "체크인", "infocenterlodging"]];
  for (const [kind, field, label, phoneField] of cases) {
    const info = resourceIntro({ [field]: "<p>제공 값 &amp; 안내</p><script>secret()</script>", [phoneField]: "033-111-2222", irrelevant: "숨김" }, kind);
    assert.deepEqual(info, { facts: [{ label, value: "제공 값 & 안내" }], phone: "033-111-2222" });
  }
  assert.deepEqual(resourceIntro({ usetime: "", restdate: undefined, parking: null, chkbabycarriage: 0 }, "12"), { facts: [], phone: null });
  assert.equal(resourceInfoText("<script>hidden</script>"), null);
  assert.equal(Array.from(resourceInfoText("😀".repeat(1001))!).length, 1000);
});

test("homepage links accept plain URLs and provider anchors but never scripts, hidden targets or credentials", () => {
  assert.equal(resourceWebsite('<a href="https://example.org/info?a=1&amp;b=2" target="_blank">홈페이지</a>'), "https://example.org/info?a=1&b=2");
  assert.equal(resourceWebsite("http://example.org/"), "http://example.org/");
  for (const value of [null, "홈페이지", "javascript:alert(1)", '<a href="&#106;avascript:alert(1)">보기</a>', "data:text/html,x", "https://user:password@example.org/",
    '<script><a href="https://example.org/">hidden</a></script>', '<!-- <a href="https://example.org/">hidden</a> -->', "https://localhost/", "https://example.org/\nx"]) assert.equal(resourceWebsite(value), null, String(value));
});

test("verified details request one bounded gallery and matching intro, retaining per-image licenses", async () => {
  const f = fixture(), r = await load(f);
  assert.equal(r.status, "complete");
  assert.deepEqual(f.calls, [["detailCommon2", { contentId: req.id }], ["detailImage2", { contentId: req.id, numOfRows: "20", pageNo: "1" }], ["detailIntro2", { contentId: req.id, contentTypeId: "12" }]]);
  assert.deepEqual(r.detail?.photos.map(p => [p.url, p.license]), [[image(), "Type3"], [image(2), "Type1"]]);
  assert.deepEqual([r.detail?.galleryStatus, r.detail?.infoStatus, r.detail?.phone], ["complete", "complete", "033-123-4567"]);
  assert.deepEqual(r.detail?.facts.map(f => f.label), ["이용시간", "휴무일"]);
});

test("each verified optional section preserves its own collection time instead of inheriting the common timestamp", async () => {
  const galleryAt = "2026-09-27T04:00:00.000Z", introAt = "2026-09-27T03:00:00.000Z";
  const response = await load(fixture({ detailImage2: page([galleryRow()], { collectedAt: galleryAt }), detailIntro2: page([introRow()], { collectedAt: introAt }) }));
  assert.deepEqual([response.source?.collectedAt, response.detail?.galleryCollectedAt, response.detail?.infoCollectedAt], [AT, galleryAt, introAt]);
  const empty = await load(fixture({ detailImage2: page([], { collectedAt: galleryAt }), detailIntro2: page([], { collectedAt: introAt }) }));
  assert.deepEqual([empty.detail?.galleryStatus, empty.detail?.galleryCollectedAt, empty.detail?.infoStatus, empty.detail?.infoCollectedAt], ["empty", galleryAt, "empty", introAt]);
  for (const failed of [fixture({ detailImage2: new Error("down"), detailIntro2: new Error("down") }),
    fixture({ detailImage2: page([galleryRow({ contentid: "1" })], { collectedAt: galleryAt }), detailIntro2: page([introRow({ contentid: "1" })], { collectedAt: introAt }) })]) {
    const r = await load(failed);
    assert.deepEqual([r.source?.collectedAt, r.detail?.galleryCollectedAt, r.detail?.infoCollectedAt], [AT, null, null]);
  }
});

test("common identity faults never trigger optional requests or expose any resource content", async () => {
  for (const commonPage of [page([common({ contentid: "1" })]), page([common({ contenttypeid: "14" })]), page([common({ lDongSignguCd: "130" })]),
    page([common({ contentid: undefined })]), page([common(), common()]), page([common()], { total: 2 }), page([]), new Error("provider secret")]) {
    const f = fixture({ detailCommon2: commonPage }), r = await load(f);
    assert.deepEqual(f.calls.map(([op]) => op), ["detailCommon2"]);
    assert.equal(r.detail, null);
    assert.ok(!JSON.stringify(r).includes("provider secret"));
  }
});

test("independent optional failures preserve overview, representative photo, safe homepage and other successful content", async () => {
  const commonPage = page([common({ tel: "033-999-0000", homepage: '<a href="https://example.org/">홈페이지</a>' })]);
  const galleryFails = await load(fixture({ detailCommon2: commonPage, detailImage2: new Error("private gallery failure") }));
  assert.deepEqual([galleryFails.status, galleryFails.detail?.overview, galleryFails.detail?.galleryStatus, galleryFails.detail?.infoStatus], ["complete", "습지 산책로", "unavailable", "complete"]);
  assert.equal(galleryFails.detail?.photos.length, 1);
  assert.equal(galleryFails.detail?.phone, "033-999-0000");
  assert.equal(galleryFails.detail?.website, "https://example.org/");
  const introFails = await load(fixture({ detailCommon2: commonPage, detailIntro2: new Error("private intro failure") }));
  assert.deepEqual([introFails.detail?.photos.length, introFails.detail?.galleryStatus, introFails.detail?.infoStatus, introFails.detail?.facts], [2, "complete", "unavailable", []]);
  assert.equal(introFails.detail?.phone, "033-999-0000");
  const bothFail = await load(fixture({ detailCommon2: commonPage, detailImage2: new Error("private"), detailIntro2: new Error("private") }));
  assert.deepEqual([bothFail.status, bothFail.detail?.photos.length, bothFail.detail?.galleryStatus, bothFail.detail?.infoStatus], ["complete", 1, "unavailable", "unavailable"]);
  for (const response of [galleryFails, introFails, bothFail]) assert.ok(!JSON.stringify(response).includes("private"));
});

test("gallery validates every content id and page shape while retaining verified common photos", async () => {
  for (const bad of [page([galleryRow({ contentid: "1" })]), page([galleryRow({ contentid: undefined })]), page([galleryRow(), galleryRow({ contentid: "1" })]),
    page([], { total: 1 }), page([galleryRow()], { pageNo: 2 }), page([galleryRow()], { total: 0 }), page([galleryRow()], { total: 21 })]) {
    const r = await load(fixture({ detailImage2: bad }));
    assert.deepEqual([r.detail?.galleryStatus, r.detail?.photos.map(p => p.url), r.detail?.infoStatus], ["unavailable", [image()], "complete"]);
  }
  const unlicensed = await load(fixture({ detailImage2: page([galleryRow({ cpyrhtDivCd: "Type4" }), galleryRow({ originimgurl: "https://evil.test/a.jpg", smallimageurl: "" })]) }));
  assert.deepEqual([unlicensed.detail?.galleryStatus, unlicensed.detail?.photos.length], ["empty", 1]);
});

test("conflicting gallery licenses remove the same common photo while preserving unrelated allowed photos", async () => {
  for (const license of ["Type4", "Type2", "", undefined]) {
    const response = await load(fixture({ detailCommon2: page([common({ cpyrhtDivCd: "Type1" })]),
      detailImage2: page([galleryRow({ originimgurl: image().replace("https:", "http:"), smallimageurl: "", cpyrhtDivCd: license }), galleryRow({ originimgurl: image(3) })]) }));
    assert.deepEqual(response.detail?.photos.map(p => p.url), [image(3)], String(license));
  }
  const duplicateConflict = await load(fixture({ detailImage2: page([galleryRow(), galleryRow({ cpyrhtDivCd: "Type4" })]) }));
  assert.deepEqual(duplicateConflict.detail?.photos.map(p => p.url), [image()]);
  const stricter = await load(fixture({ detailCommon2: page([common({ cpyrhtDivCd: "Type1" })]),
    detailImage2: page([galleryRow({ originimgurl: image(), cpyrhtDivCd: "Type3" })]) }));
  assert.deepEqual(stricter.detail?.photos.map(p => [p.url, p.license]), [[image(), "Type3"]]);
});

test("intro rejects missing or mismatched identities, ambiguous rows and inconsistent totals", async () => {
  for (const bad of [page([introRow({ contentid: "1" })]), page([introRow({ contentid: undefined })]), page([introRow({ contenttypeid: "14" })]),
    page([introRow({ contenttypeid: null })]), page([introRow(), introRow()]), page([], { total: 1 }), page([introRow()], { total: 0 })]) {
    const r = await load(fixture({ detailIntro2: bad }));
    assert.deepEqual([r.detail?.infoStatus, r.detail?.facts, r.detail?.phone, r.detail?.galleryStatus], ["unavailable", [], null, "complete"]);
  }
});

test("absence of overview does not suppress photos or facts and unconfirmed sections never become confirmed empty", async () => {
  const noContent = page([common({ overview: "", firstimage: "", firstimage2: "" })]);
  const imagesOnly = await load(fixture({ detailCommon2: noContent, detailIntro2: page([]) }));
  assert.deepEqual([imagesOnly.status, imagesOnly.detail?.overview, imagesOnly.detail?.photos.length], ["complete", "", 1]);
  const factsOnly = await load(fixture({ detailCommon2: noContent, detailImage2: page([]) }));
  assert.deepEqual([factsOnly.status, factsOnly.detail?.facts.length], ["complete", 2]);
  const empty = await load(fixture({ detailCommon2: noContent, detailImage2: page([]), detailIntro2: page([]) }));
  assert.deepEqual([empty.status, empty.detail], ["empty", null]);
  const unknown = await load(fixture({ detailCommon2: noContent, detailImage2: new Error("down"), detailIntro2: page([]) }));
  assert.deepEqual([unknown.status, unknown.detail?.galleryStatus, unknown.detail?.infoStatus], ["complete", "unavailable", "empty"]);
});

test("gallery is bounded to one page and at most twenty distinct public photos", async () => {
  const f = fixture({ detailImage2: page(Array.from({ length: RESOURCE_GALLERY_LIMIT }, (_, i) => galleryRow({ originimgurl: image(i + 2) })), { total: 100 }) });
  const r = await load(f);
  assert.equal(r.detail?.photos.length, 20);
  assert.equal(new Set(r.detail?.photos.map(p => p.url)).size, 20);
  assert.equal(f.calls.filter(([op]) => op === "detailImage2").length, 1);
  assert.equal(r.detail?.galleryStatus, "complete");
});

test("gallery adapter caches and deduplicates successful requests with the same bounded params", async () => {
  let time = 0, calls = 0;
  const call = createTourCall({ key: () => "private-test-key", now: () => time, fetch: (async () => {
    calls++;
    return new Response(JSON.stringify({ response: { header: { resultCode: "0000" }, body: { totalCount: 0, pageNo: 1, items: "" } } }));
  }) as typeof fetch });
  const params = { contentId: req.id, numOfRows: "20", pageNo: "1" };
  await Promise.all([call("detailImage2", params), call("detailImage2", params)]);
  assert.equal(calls, 1);
  time = 3_599_999;
  await call("detailImage2", params); assert.equal(calls, 1);
  time = 3_600_001;
  await call("detailImage2", params); assert.equal(calls, 2);
});

test("two simultaneous place details stay within the shared adapter concurrency limit", async () => {
  let active = 0, peak = 0, calls = 0;
  const call = createTourCall({ key: () => "private-test-key", fetch: (async (input: URL | RequestInfo) => {
    const url = new URL(String(input)), contentid = url.searchParams.get("contentId")!;
    active++; peak = Math.max(peak, active); calls++;
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    const row = url.pathname.endsWith("/detailCommon2") ? common({ contentid }) : url.pathname.endsWith("/detailImage2") ? galleryRow({ contentid }) : introRow({ contentid });
    return new Response(JSON.stringify({ response: { header: { resultCode: "0000" }, body: { totalCount: 1, pageNo: 1, items: { item: [row] } } } }));
  }) as typeof fetch });
  const responses = await Promise.all([loadResourceDetail(call, req, () => AT), loadResourceDetail(call, { ...req, id: "2774692" }, () => AT)]);
  assert.deepEqual(responses.map(r => [r.status, r.detail?.galleryStatus, r.detail?.infoStatus]), [["complete", "complete", "complete"], ["complete", "complete", "complete"]]);
  assert.equal(calls, 6);
  assert.ok(peak <= 2);
});
