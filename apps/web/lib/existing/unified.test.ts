import test from "node:test";
import assert from "node:assert/strict";
import { combineArchiveStates, createArchiveLoader, scopedFreshness } from "./archive";
import { linkedArchiveId, regionByCode } from "./identity";
import { createExistingService, regionObservations } from "./server";
import { parseFestivalSearch, parseHistory } from "./request";
import type { TourCall } from "./tour";
import type { Dataset } from "../region/model";

const NOW = "2026-09-26T08:00:00.000Z";
const dataset = (code: string, name: string, value: number | null, at = NOW): Dataset => ({ snapshotId: "internal-secret-hash", collectedAt: at, source: "https://www.data.go.kr/data/15101972/openapi.do", region: { code, name }, points: [{ date: "2025-01-01", value, quality: value === null ? "missing" : "complete" }] });
const loader = (datasets: Dataset[]) => createArchiveLoader({ bundles: [], readRuntime: async () => ({ kind: "ok", datasets }), now: () => Date.parse(NOW) });
const tour: TourCall = async (op, p) => ({ total: 1, pageNo: 1, collectedAt: NOW, rows: op === "detailCommon2" ? [{contentid:p.contentId,contenttypeid:"15", title:"임실N치즈축제",lDongRegnCd:"52",lDongSignguCd:"750"}] : [{contentid:p.contentId,contenttypeid:"15", eventstartdate:"20261008", eventenddate:"20261011"}] });
const service = (archive: ReturnType<typeof loader>, override: Partial<Parameters<typeof createExistingService>[0]> = {}) => createExistingService({ archive, regionList: async () => { throw Error("unused"); }, tour, now: () => NOW, ...override });

test("a district never mentioned in festival code gets real monthly observations; failed other collector stays isolated", async () => {
  const national = loader([dataset("51150", "강릉시", 0)]);
  const failedForecast = createArchiveLoader({ bundles: [dataset("44230", "논산시", 30, "2026-09-20T00:00:00.000Z")], runtimeTargets: ["44230"], readRuntime: async () => { throw Error("failure"); } });
  const state = combineArchiveStates(await Promise.all([failedForecast(), national()]));
  assert.equal(scopedFreshness(state, ["51150"]).refresh.status, "ok");
  assert.equal(scopedFreshness(state, ["44230"]).refresh.status, "failed");
  const response = await service(async () => state).loadMonthly({ province: "51", district: "150", year: 2025 });
  assert.equal(response.daily[0].value, 0);
  assert.equal(response.daily[1].value, null);
  assert.equal(response.months[0].mean, null, "partial month is not a made-up mean");
  for (const internal of ["snapshotId", "internal-secret-hash", "byRegion"]) assert.ok(!JSON.stringify(response).includes(internal));
});

test("reviewed current identity returns archived periods inline while request keeps selected current id", async () => {
  const svc = service(loader([dataset("52750", "임실군", 50)]));
  const id = "current:52750:2031318";
  const found = await svc.loadFestivals(parseFestivalSearch(new URLSearchParams({id})));
  assert.equal(found.current.items[0].linkedArchiveId, "archive:imsil-cheese");
  assert.equal(found.archive.items[0].festivalId, "imsil-cheese");
  const history = await svc.loadHistory(parseHistory(new URLSearchParams({festival:id})));
  assert.equal(history.request.festival, id);
  assert.equal(history.festival.festivalId, "imsil-cheese");
  assert.ok(history.editions.every(e => e.editionId.startsWith("imsil-cheese-")));
});

test("ambiguous reviewed aliases and a different district never join", () => {
  const region = regionByCode("52750")!;
  const row = {archiveFestivalId:"held",contentId:"123",region:region.code,evidence:"review",verifiedAt:"2026-09-26",version:"1"};
  assert.equal(linkedArchiveId(region, "123", [row, {...row,archiveFestivalId:"other"}]), null);
  assert.equal(linkedArchiveId(regionByCode("44230")!, "123", [row]), null);
  assert.equal(linkedArchiveId(region, "123", [row,{...row,contentId:"124"}]), null);
});

test("refreshing a different month cannot relabel an older observation or replace a newer correction", () => {
  const national = dataset("44230", "논산시", 10);
  national.points[0].collectedAt = "2026-09-10T00:00:00.000Z";
  const correction = dataset("44230", "논산시", 20, "2026-09-20T00:00:00.000Z");
  const observed = regionObservations([correction,national],"44","230",{start:"2025-01-01",end:"2025-01-01"});
  assert.equal(observed[0].value,20);
  assert.equal(observed[0].collectedAt,correction.collectedAt);
});

test("unseen current festival projects only recorded dates and survives registration history failure", async () => {
  const id = "current:52750:99887766";
  const svc = service(loader([dataset("52750", "임실군", 50)]), { registrationPeriods: async (contentId, code) => {
    assert.equal(contentId,"99887766"); assert.equal(code,"52750");
    return [{id:"reg-99887766-20250301-20250303",start:"2025-03-01",end:"2025-03-03",collectedAt:NOW,contentId,regionCode:code,evidence:"must-not-leak"}];
  } });
  const found = await svc.loadFestivals(parseFestivalSearch(new URLSearchParams({id})));
  assert.equal(found.current.items[0].periods?.length, 1);
  assert.equal(found.current.items[0].linkedArchiveId, null);
  assert.ok(!JSON.stringify(found).includes("must-not-leak"));
  const failing = service(loader([dataset("52750", "임실군", 50)]), {registrationPeriods:async()=>{throw Error("store path");}});
  assert.equal((await failing.loadFestivals(parseFestivalSearch(new URLSearchParams({id})))).current.status,"complete");
});
