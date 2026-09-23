import test from "node:test";
import assert from "node:assert/strict";
import { buildEventCsv, comparisonCondition, csvCell, csvFileName, exportReady, koreaTime, modifiedLabel, REGION_EVENT_CONDITION, type CsvRegion } from "./events-csv";
import type { RegionResult, Resource } from "../region/types";

const SOURCE = "https://www.data.go.kr/data/15101578/openapi.do";
const event = (id: string, title: string, extra: Partial<Resource> = {}): Resource => ({ id, title, address: "충남 논산시", longitude: 127.1, latitude: 36.2, start: "2026-03-30", end: "2026-04-02", modifiedAt: "20260901123456", ...extra });
function result(district: string, status: RegionResult["resources"]["status"], items: Resource[] = []): RegionResult {
  return { query: { province: "44", district, start: "2026-02-15", end: "2026-04-10", kind: "15" }, region: { provinceCode: "44", provinceName: "충청남도", districtCode: district, districtName: district === "230" ? "논산시" : "공주시" },
    resources: { status, message: "", items, total: status === "unavailable" ? null : items.length, pages: 1, collectedAt: "2026-09-08T00:00:00Z", source: SOURCE },
    history: { status: "unavailable", message: "", source: "", unit: "", metric: "", points: [] } };
}
const parse = (raw: string) => raw.replace(/^﻿/, "").trimEnd().split("\r\n");

test("cells neutralise formulas, control characters and quotes", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  for (const v of ["+1", "-1", "@SUM(A1)", "  =1", "　=1", "\u0001=1", "\t1", "＝1", "\n=1"]) assert.match(csvCell(v), /^"'/, v);
  assert.equal(csvCell("2026-03-30"), '"2026-03-30"');
  assert.equal(csvCell("a\r\nb\rc"), '"a\nb\nc"');
  assert.equal(csvCell("x\u0000y\u007f"), '"xy"');
  assert.equal(csvCell(-12.5), '"-12.5"');
  assert.equal(csvCell(null), '""'); assert.equal(csvCell(undefined), '""'); assert.equal(csvCell(Number.NaN), '""'); assert.equal(csvCell(""), '""');
});

test("an event file keeps original schedules, a BOM, CRLF endings and no API debug columns", () => {
  const items = [event("1", 'A "딸기"\n축제', { start: "2026-01-28", end: "2026-02-20" }), event("2", "=HYPERLINK(\"x\")", { address: "", longitude: null, latitude: null, modifiedAt: null })];
  const regions: CsvRegion[] = [{ key: "44/230", name: "충청남도 논산시", result: result("230", "complete", items) }];
  const raw = buildEventCsv({ start: "2026-02-15", end: "2026-04-10", condition: REGION_EVENT_CONDITION, regions, events: items.map(resource => ({ resource, regionKey: "44/230" })) });
  assert.ok(raw.startsWith("﻿\"구분\""));
  assert.ok(raw.endsWith("\r\n"));
  const header = parse(raw)[0];
  for (const hidden of ["페이지", "전체 건수", "ID", "번호", "예상", "규모"]) assert.equal(header.includes(hidden), false, hidden);
  assert.ok(raw.includes('"A ""딸기""\n축제"'));
  assert.ok(raw.includes('"2026-01-28","2026-02-20"'));
  assert.ok(raw.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(raw.includes('"","","","2026-02-15 ~ 2026-04-10"'), "missing address and coordinates stay blank, not 0");
  assert.ok(raw.includes('"2026-09-08 09:00:00","2026-09-01 12:34:56"'), "query time and source modification are separate");
  assert.equal(raw.includes('"0"'), false);
});

test("regions without events keep their own state instead of a zero", () => {
  const found = event("7", "공주 행사");
  const regions: CsvRegion[] = [
    { key: "44/230", name: "충청남도 논산시", result: result("230", "empty") },
    { key: "44/150", name: "충청남도 공주시", result: null },
    { key: "44/760", name: "충청남도 부여군", result: result("760", "unavailable") },
    { key: "44/250", name: "충청남도 계룡시", result: result("250", "complete", [found]) },
    { key: "44/800", name: "충청남도 홍성군", result: result("800", "complete", [event("8", "다른 이름")]) },
  ];
  const lines = parse(buildEventCsv({ start: "2026-02-15", end: "2026-04-10", condition: "이름: 공주", regions, events: [{ resource: found, regionKey: "44/250" }] }));
  assert.equal(lines.length, 6);
  assert.match(lines[1], /^"행사","공주 행사","충청남도 계룡시"/);
  assert.match(lines[2], /"지역 조회 상태","","충청남도 논산시".*"등록 결과 없음"/);
  assert.match(lines[3], /"충청남도 공주시".*"불러오지 못함","",""/);
  assert.match(lines[4], /"충청남도 부여군".*"불러오지 못함"/);
  assert.match(lines[5], /"충청남도 홍성군".*"조건에 맞는 행사 없음"/);
});

test("export waits for every region and refuses when none was checked", () => {
  const ok: CsvRegion = { key: "44/230", name: "논산", result: result("230", "empty") }, failed: CsvRegion = { key: "44/150", name: "공주", result: null };
  assert.equal(exportReady([ok, failed], true), false);
  assert.equal(exportReady([ok, failed], false), true);
  assert.equal(exportReady([failed, { ...failed, result: result("150", "unavailable") }], false), false);
  assert.equal(exportReady([], false), false);
});

test("file names use only validated codes and dates", () => {
  assert.equal(csvFileName(["44/230", "44/150"], "2026-02-15", "2026-04-10"), "pickDday-events_44-230_44-150_2026-02-15_2026-04-10.csv");
  assert.equal(csvFileName(["../x y/한"], "2026", "<>"), "pickDday-events_..-xy_2026_.csv");
});

test("labels and comparison conditions", () => {
  assert.equal(koreaTime("bad"), ""); assert.equal(modifiedLabel("2026"), ""); assert.equal(modifiedLabel(null), "");
  assert.equal(comparisonCondition({ dateRule: "overlap", keyword: " ", distance: undefined }), "일정: 기간 겹침 · 이름: 전체 · 거리: 제한 없음");
  const anchor = { editionId: "e", name: "논산딸기축제", point: { latitude: 36.2, longitude: 127.1 }, source: { title: "", url: "", checkedAt: "", publishedAt: null, sha256: null, note: "" } };
  assert.equal(comparisonCondition({ dateRule: "starts-within", keyword: "딸기", distance: { method: "haversine-v1", anchor, radiusKm: 20 } }), "일정: 기간 안 시작 · 이름: 딸기 · 거리: 논산딸기축제 기준 20km 이내(좌표 없는 행사 포함)");
  assert.match(comparisonCondition({ dateRule: "overlap", keyword: "", distance: { method: "haversine-v1", anchor, radiusKm: null } }), /반경 제한 없음/);
});
