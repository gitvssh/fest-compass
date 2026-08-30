import assert from "node:assert/strict";
import { test } from "node:test";
import {
  areaCodeCandidatesForStd,
  isCompatibleAdminAreaCode,
  normalizeAdminCodes,
  toStdAreaCd,
} from "./areacode";

test("KorService2 코드를 행정표준 시도코드로 변환한다", () => {
  assert.equal(toStdAreaCd("34"), "44");
  assert.equal(toStdAreaCd("037"), "52");
  assert.equal(toStdAreaCd("999"), null);
});

test("특별자치도 방문자 응답 필터는 현행·구 코드를 모두 인정한다", () => {
  assert.deepEqual(areaCodeCandidatesForStd("52"), ["52", "45"]);
  assert.equal(isCompatibleAdminAreaCode("37", "52"), true);
  assert.equal(isCompatibleAdminAreaCode("37", "45"), true);
  assert.equal(isCompatibleAdminAreaCode("37", "44"), false);
});

test("KorService2 법정동 시군구 3자리 접미부를 API용 5자리로 정규화한다", () => {
  assert.deepEqual(normalizeAdminCodes("52", "750"), { areaCd: "52", signguCd: "52750" });
  assert.deepEqual(normalizeAdminCodes("44", "44230"), { areaCd: "44", signguCd: "44230" });
  assert.equal(normalizeAdminCodes("44", "52750"), null);
  assert.equal(normalizeAdminCodes("44", "23"), null);
});
