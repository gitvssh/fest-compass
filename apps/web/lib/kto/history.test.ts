import assert from "node:assert/strict";
import test from "node:test";
import { daysBetween, fetchHistoryPage, makeHistoryDataset, monthWindows, validateHistoryWindow, type HistoryPage } from "./history";

const rows = ["2024-02-28", "2024-02-29"].flatMap((date) => ["1", "2", "3"].map((type) => ({
  baseYmd: date.replaceAll("-", ""), signguCode: "44230", signguNm: "논산시", touDivCd: type,
  touDivNm: { "1": "현지인(a)", "2": "외지인(b)", "3": "외국인(c)" }[type], touNum: type === "2" ? "0" : "12.5",
})));
const request = { start: "2024-02-28", end: "2024-02-29", pageSize: 4, pageNo: 1 };
function responder(items: Record<string, unknown>[], total = 6, pageNo = 1, size = 4): typeof fetch {
  return async () => new Response(JSON.stringify({ response: { header: { resultCode: "00" },
    body: { totalCount: total, pageNo, numOfRows: size, items: { item: items } } } }));
}
async function completePages(): Promise<HistoryPage[]> {
  return [await fetchHistoryPage(request, "test-key", responder(rows.slice(0, 4))),
    await fetchHistoryPage({ ...request, pageNo: 2 }, "test-key", responder(rows.slice(4), 6, 2))];
}
test("calendar windows include leap day and partial months", () => {
  assert.equal(daysBetween("2023-01-01", "2025-12-31").length, 1096);
  assert.deepEqual(monthWindows("2024-02-28", "2024-03-01"), [{ start: "2024-02-28", end: "2024-02-29" }, { start: "2024-03-01", end: "2024-03-01" }]);
  assert.throws(() => daysBetween("2023-02-29", "2023-03-01"));
});
test("full pagination preserves fractional estimates, real zero, provenance and absent dates", async () => {
  const pages = await completePages(), dataset = makeHistoryDataset(pages, request.start, request.end);
  assert.equal(dataset.quality.completeDays, 2);
  assert.equal(dataset.days[0].values["2"], 0);
  assert.equal(dataset.days[0].values["3"], 12.5);
  assert.equal(dataset.days[1].sourcePages.length, 2);
  assert.equal(dataset.sourcePublishedAt, null);
  assert.equal(dataset.snapshotId, makeHistoryDataset(pages, request.start, request.end).snapshotId);
  const empty = await fetchHistoryPage(request, "test-key", responder([], 0));
  const missing = makeHistoryDataset([empty], request.start, request.end);
  assert.equal(missing.quality.completeDays, 0);
  assert.deepEqual(missing.quality.missingDates, ["2024-02-28", "2024-02-29"]);
  assert.equal(missing.days[0].values["2"], null);
  const zeroSizedEmpty = await fetchHistoryPage(request, "test-key", responder([], 0, 1, 0));
  assert.equal(makeHistoryDataset([zeroSizedEmpty], request.start, request.end).quality.missingDates.length, 2);
});
test("partial or drifting pagination and repeated rows cannot form a dataset", async () => {
  const pages = await completePages();
  assert.throws(() => validateHistoryWindow(pages.slice(0, 1), request.start, request.end), /incomplete/);
  assert.throws(() => validateHistoryWindow([pages[0], { ...pages[1], totalCount: 7 }], request.start, request.end), /incomplete/);
  assert.throws(() => validateHistoryWindow([pages[0], { ...pages[1], keys: pages[0].keys.slice(0, 2) }], request.start, request.end), /duplicate/);
  await assert.rejects(fetchHistoryPage(request, "test-key", responder(rows.slice(0, 3))), /pagination/);
  await assert.rejects(fetchHistoryPage(request, "test-key", responder(rows.slice(0, 4), 6, 2)), /pagination/);
});
test("the provider may report actual final-page rows without changing the pagination stride", async () => {
  const first = await fetchHistoryPage(request, "test-key", responder(rows.slice(0, 4)));
  const last = await fetchHistoryPage({ ...request, pageNo: 2 }, "test-key", responder(rows.slice(4), 6, 2, 2));
  assert.equal(makeHistoryDataset([first, last], request.start, request.end).quality.completeDays, 2);
});
test("bad region labels, missing types and invalid values quarantine the day", async () => {
  const pages = await completePages();
  pages[0].selected[1] = { ...pages[0].selected[1], touNum: "", signguNm: "다른 지역" };
  const dataset = makeHistoryDataset(pages, request.start, request.end);
  assert.deepEqual(dataset.quality.invalidDates, ["2024-02-28"]);
  assert.equal(dataset.days[0].values["2"], null);
});
test("access limits and unsafe provider messages stop without revealing credentials", async () => {
  await assert.rejects(fetchHistoryPage(request, "secret-key", async () => new Response("secret-key", { status: 429 })), /^Error: history-access-or-quota-stop$/);
  await assert.rejects(fetchHistoryPage(request, "secret-key", async () => { throw new Error("https://example.invalid?serviceKey=secret-key"); }), /^Error: history-network-error$/);
});
