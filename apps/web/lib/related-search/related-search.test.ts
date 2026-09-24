import test from "node:test";
import assert from "node:assert/strict";
import type { ArchiveEditionRef, ArchiveFestival, CurrentFestival, RegionRef } from "../existing/types";
import { buildQuery, editionYearOptions, normalizeQuery, QUERY_MAX, searchUrl, selectedEditionYear } from "./query";

const NONSAN: RegionRef = { province: "충청남도", district: "논산시", code: "44230", name: "충청남도 논산시", districtName: "논산시" };
const JUNG: RegionRef = { province: "서울특별시", district: "중구", code: "11140", name: "서울특별시 중구", districtName: "중구" };

const edition = (editionId: string, year: number): ArchiveEditionRef => ({
  editionId, year, start: `${year}-03-01`, end: `${year}-03-05`, days: 5, status: "개최", cancelled: false, comparable: true,
  source: { title: "출처", url: "https://example.test/", checkedAt: null, publishedAt: null },
});
const archive = (editions: ArchiveEditionRef[], defaults: string[]): ArchiveFestival => ({
  id: "archive:nonsan-strawberry", source: "archive", festivalId: "nonsan-strawberry", name: "논산딸기축제", region: NONSAN,
  editions, defaultEditionIds: defaults, hasDates: true, hasHistory: true,
});
const current = (start: string | null, datesVerified: boolean): CurrentFestival => ({
  id: "current:1", source: "current", contentId: "1", name: "새 축제", region: NONSAN, start, end: start, datesVerified,
  address: "주소", point: null, modifiedAt: null, linkedArchiveId: null,
  provenance: { title: "출처", url: "https://example.test/", checkedAt: null, publishedAt: null, collectedAt: null },
});
const E = [edition("ns-2025", 2025), edition("ns-2024", 2024), edition("ns-2023", 2023), edition("ns-2023b", 2023)];
const params = (query: string) => new URLSearchParams(query);

test("query uses subject, full region name, year and topic in order", () => {
  assert.equal(buildQuery({ subject: "논산딸기축제", region: NONSAN, year: 2025, topic: "프로그램" }), "논산딸기축제 충청남도 논산시 2025 프로그램");
  assert.equal(buildQuery({ subject: "논산딸기축제", region: NONSAN }), "논산딸기축제 충청남도 논산시");
  assert.equal(buildQuery({ subject: "명동", region: JUNG, year: null, topic: null }), "명동 서울특별시 중구");
});

test("a region searched for itself is named once", () => {
  assert.equal(buildQuery({ region: NONSAN, topic: "관광사업" }), "충청남도 논산시 관광사업");
  assert.equal(buildQuery({ subject: "충청남도 논산시", region: NONSAN, topic: "축제 사례" }), "충청남도 논산시 축제 사례");
  assert.equal(buildQuery({ subject: null, region: NONSAN }), "충청남도 논산시");
});

test("normalization flattens control characters and caps length", () => {
  assert.equal(normalizeQuery("  a\tb\n\u0000c d  "), "a b c d");
  assert.equal(normalizeQuery("가"), "가"); // NFC
  const long = normalizeQuery("가".repeat(QUERY_MAX + 50));
  assert.equal(Array.from(long).length, QUERY_MAX);
  const emoji = normalizeQuery("😀".repeat(QUERY_MAX + 1));
  assert.equal(Array.from(emoji).length, QUERY_MAX, "counts characters, never splits a surrogate pair");
  assert.equal(normalizeQuery(`${"a".repeat(QUERY_MAX - 1)} b`), "a".repeat(QUERY_MAX - 1), "no trailing space after the cut");
  assert.equal(buildQuery({ subject: "  축제\n", region: NONSAN, topic: "  " }), "축제 충청남도 논산시");
});

test("search link carries only q and round-trips the query", () => {
  for (const q of ["논산딸기축제 충청남도 논산시 2025 보도자료", `a&b=c #d +e "f" ?g /h %20`]) {
    const url = new URL(searchUrl(q)!);
    assert.equal(url.origin + url.pathname, "https://duckduckgo.com/");
    assert.deepEqual([...url.searchParams.keys()], ["q"]);
    assert.equal(url.searchParams.get("q"), q);
    assert.equal(url.hash, "");
  }
  assert.equal(new URL(searchUrl(" a\n b ")!).searchParams.get("q"), "a b");
});

test("blank query has no link", () => {
  for (const q of ["", "   ", "\n\t", "\u0000"]) assert.equal(searchUrl(q), null);
});

test("year options come from confirmed editions or a verified current start only", () => {
  assert.deepEqual(editionYearOptions(archive([edition("a", 2023), edition("b", 2025), edition("c", 2023)], [])), [2025, 2023]);
  assert.deepEqual(editionYearOptions(current("2026-10-01", true)), [2026]);
  assert.deepEqual(editionYearOptions(current("2026-10-01", false)), []);
  assert.deepEqual(editionYearOptions(current(null, true)), []);
  assert.deepEqual(editionYearOptions(current("unknown", true)), []);
  assert.deepEqual(editionYearOptions(null), []);
});

test("selected year follows the one applied visits edition", () => {
  const f = archive(E, ["ns-2025", "ns-2024"]);
  assert.equal(selectedEditionYear(f, params("editions=ns-2024"), true), 2024);
  assert.equal(selectedEditionYear(f, params("editions=ns-2024,ns-2024"), true), 2024, "a repeated id is one edition");
  assert.equal(selectedEditionYear(f, params("editions=%20ns-2023b%20"), true), 2023);
  assert.equal(selectedEditionYear(f, params("editions=ns-2025,ns-2024"), true), null, "comparison");
});

test("selected year uses the actual defaults when the address has no editions", () => {
  assert.equal(selectedEditionYear(archive(E, ["ns-2025", "ns-2024"]), params(""), true), null, "two defaults compare");
  assert.equal(selectedEditionYear(archive(E, ["ns-2024"]), params(""), true), 2024);
  assert.equal(selectedEditionYear(archive(E, ["ns-2024"]), params("editions="), true), 2024, "empty value is absent");
  assert.equal(selectedEditionYear(archive(E, []), params(""), true), 2025, "no comparable edition falls back to the first");
  assert.equal(selectedEditionYear(archive([], []), params(""), true), null);
});

test("selected year never guesses from an invalid or foreign address", () => {
  const f = archive(E, ["ns-2024"]);
  assert.equal(selectedEditionYear(f, params("editions=unknown"), true), null);
  assert.equal(selectedEditionYear(f, params("editions=ns-2024,unknown"), true), null, "mixed valid and invalid");
  assert.equal(selectedEditionYear(f, params("editions=ns-2024&editions=ns-2024"), true), null, "duplicate parameters");
  assert.equal(selectedEditionYear(f, params("editions=ns-2024&editions="), true), null);
  assert.equal(selectedEditionYear(f, params("editions=ns-2024"), false), null, "other views");
  assert.equal(selectedEditionYear(f, params("year=2019&month=2019-05"), false), null, "timing observation year is not an edition");
  assert.equal(selectedEditionYear(null, params("editions=ns-2024"), true), null);
});
