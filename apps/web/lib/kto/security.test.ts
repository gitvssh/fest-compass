import assert from "node:assert/strict";
import { test } from "node:test";
import { maskServiceKeyUrl, scrubSecret } from "./security";

test("진단 문구에서 원문·URL 인코딩 키를 모두 제거한다", () => {
  const key = "Ab+c/12==";
  const encoded = encodeURIComponent(key);
  assert.equal(scrubSecret(`raw=${key} encoded=${encoded}`, key), "raw=*** encoded=***");
});

test("URL에서 serviceKey 값만 마스킹한다", () => {
  const url = "https://example.test/api?serviceKey=secret%2Bkey&MobileOS=ETC";
  assert.equal(maskServiceKeyUrl(url), "https://example.test/api?serviceKey=***&MobileOS=ETC");
});
