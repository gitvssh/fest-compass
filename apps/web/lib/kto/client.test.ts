import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectCompletePages,
  mergeFestivalDetailParts,
  requiredRawFieldError,
  resolveKtoFetchTimeout,
  type KtoResult,
} from "./client";

test("KTO timeout은 운영 가능한 범위만 허용하고 나머지는 안전한 기본값을 쓴다", () => {
  assert.equal(resolveKtoFetchTimeout("1000"), 1000);
  assert.equal(resolveKtoFetchTimeout("30000"), 30000);
  assert.equal(resolveKtoFetchTimeout("999"), 10_000);
  assert.equal(resolveKtoFetchTimeout("30001"), 10_000);
  assert.equal(resolveKtoFetchTimeout("not-a-number"), 10_000);
});

function page<T>(data: T[], totalCount: number, pageNo: number): KtoResult<T[]> {
  return {
    ok: data.length > 0,
    kind: data.length ? "success" : "empty",
    status: 200,
    data: data.length ? data : null,
    summary: `${data.length}건`,
    fetchedAt: `2026-08-30T00:00:0${pageNo}.000Z`,
    urlMasked: `https://example.test?pageNo=${pageNo}&serviceKey=***`,
    totalCount,
  };
}

test("페이지네이터는 totalCount까지 완주한 경우에만 전체 데이터를 반환한다", async () => {
  const calls: Array<[number, number]> = [];
  const result = await collectCompletePages(async (pageNo, pageSize) => {
    calls.push([pageNo, pageSize]);
    return pageNo === 1 ? page([1, 2], 3, pageNo) : page([3], 3, pageNo);
  });

  assert.deepEqual(calls, [[1, 1000], [2, 1000]]);
  assert.equal(result.kind, "success");
  assert.deepEqual(result.data, [1, 2, 3]);
  assert.equal(result.totalCount, 3);
});

test("반복 페이지와 안전 상한에서는 부분 데이터를 폐기한다", async () => {
  const repeated = await collectCompletePages(
    async (pageNo) => page([1, 2], 4, pageNo),
  );
  assert.equal(repeated.kind, "error");
  assert.equal(repeated.data, null);
  assert.match(repeated.summary, /동일하게 반복/);

  const capped = await collectCompletePages(
    async (pageNo) => page([pageNo], 3, pageNo),
    { pageSize: 1, maxPages: 2 },
  );
  assert.equal(capped.kind, "error");
  assert.equal(capped.data, null);
  assert.match(capped.summary, /안전 상한/);
});

test("중간 페이지 실패와 totalCount 변경은 앞선 페이지를 노출하지 않는다", async () => {
  const failed = await collectCompletePages(async (pageNo) => {
    if (pageNo === 1) return page([1, 2], 4, pageNo);
    return {
      ...page<number>([], 4, pageNo),
      kind: "error" as const,
      summary: "network",
    };
  });
  assert.equal(failed.data, null);
  assert.match(failed.summary, /부분 데이터는 폐기/);

  const changed = await collectCompletePages(async (pageNo) =>
    page(pageNo === 1 ? [1, 2] : [3], pageNo === 1 ? 4 : 3, pageNo));
  assert.equal(changed.kind, "error");
  assert.equal(changed.data, null);
  assert.match(changed.summary, /totalCount/);
});

test("API별 필수 원시 필드는 모든 item에서 확인한다", () => {
  assert.equal(requiredRawFieldError([{ areaCd: "44" }], ["areaCd"]), null);
  assert.match(
    requiredRawFieldError([{ areaCd: "44" }, { areaNm: "충남" }], ["areaCd", "areaNm"]) ?? "",
    /1번째 item 필수 필드 누락: areaNm/,
  );
});

test("축제 상세는 common 식별정보와 intro 유효 일정을 모두 갖춰야 결합한다", () => {
  const merged = mergeFestivalDetailParts(
    { contentId: "123", title: "테스트 축제", overview: "설명" },
    { eventstartdate: "20261001", eventenddate: "20261003" },
  );
  assert.equal(merged?.contentId, "123");
  assert.equal(merged?.eventenddate, "20261003");

  assert.equal(mergeFestivalDetailParts(
    { contentId: "123", title: "테스트 축제" },
    { eventstartdate: "", eventenddate: "20261003" },
  ), null);
  assert.equal(mergeFestivalDetailParts(
    { contentId: "123", title: "테스트 축제" },
    { eventstartdate: "20261003", eventenddate: "20261001" },
  ), null);
  assert.equal(mergeFestivalDetailParts(
    { contentId: "123", title: "테스트 축제" },
    { eventstartdate: "20260230", eventenddate: "20260301" },
  ), null);
});
