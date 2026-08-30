import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  canonicalProvinceAreaCd,
  verifiedAdminCodesFromCurrentDetail,
} from "./refresh";

test("B/C 시도코드는 lDong이 아니라 KorService2 정본 매핑만 사용한다", () => {
  assert.equal(canonicalProvinceAreaCd("37", null), "52");
  assert.equal(canonicalProvinceAreaCd("37", "37"), "52");
  assert.equal(canonicalProvinceAreaCd("34", "37"), "52");
});

test("E/F 코드는 KTO provenance와 이번 detail contentId 일치가 모두 필요하다", () => {
  const base = {
    areaCode: "37",
    ldongRegnCd: "52",
    ldongSignguCd: "52750",
    contentId: "123",
    provenance: "kto",
  };
  const detail = {
    contentId: "123",
    areacode: "37",
    ldongRegnCd: "52",
    ldongSignguCd: "750",
  };

  assert.deepEqual(verifiedAdminCodesFromCurrentDetail(base, detail), {
    areaCd: "52",
    signguCd: "52750",
  });
  assert.equal(verifiedAdminCodesFromCurrentDetail({ ...base, provenance: "manual" }, detail), null);
  assert.equal(verifiedAdminCodesFromCurrentDetail(base, { ...detail, contentId: "999" }), null);
  assert.equal(verifiedAdminCodesFromCurrentDetail(base, null), null);
});

test("구 lDong 코드는 E/F 원문 쌍으로만 허용하고 B/C 현행 매핑에는 번지지 않는다", () => {
  const festival = {
    areaCode: "37",
    ldongRegnCd: null,
    ldongSignguCd: null,
    contentId: "123",
    provenance: "kto",
  };
  const admin = verifiedAdminCodesFromCurrentDetail(festival, {
    contentId: "123",
    areacode: "37",
    ldongRegnCd: "45",
    ldongSignguCd: "111",
  });
  assert.deepEqual(admin, { areaCd: "45", signguCd: "45111" });
  assert.equal(canonicalProvinceAreaCd(festival.areaCode, "37"), "52");
});

test("키 없음 반환보다 먼저 기존 observation을 stale 처리한다", () => {
  const source = readFileSync("lib/kto/refresh.ts", "utf8");
  const staleUpdate = source.indexOf("prisma.evidenceSnapshot.updateMany");
  const missingKeyReturn = source.indexOf("if (!hasTourKey())");
  assert.notEqual(staleUpdate, -1);
  assert.notEqual(missingKeyReturn, -1);
  assert.ok(staleUpdate < missingKeyReturn);
});
