import assert from "node:assert/strict";
import { test } from "node:test";
import { isKtoSuccessCode, parseKtoWire } from "./wire";

test("response 봉투의 단일 item을 배열로 정규화한다", () => {
  const parsed = parseKtoWire(JSON.stringify({
    response: {
      header: { resultCode: "0000", resultMsg: "OK" },
      body: { totalCount: 1, pageNo: 1, numOfRows: 10, items: { item: { baseYm: "202501" } } },
    },
  }));
  assert.equal(parsed.format, "json");
  assert.equal(parsed.resultCode, "0000");
  assert.equal(parsed.totalCount, 1);
  assert.deepEqual(parsed.items, [{ baseYm: "202501" }]);
  assert.equal(parsed.contractError, null);
});

test("최상위 header/body JSON과 인가된 빈 결과를 허용한다", () => {
  const parsed = parseKtoWire(JSON.stringify({
    header: { resultCode: "0000", resultMsg: "NORMAL SERVICE" },
    body: { totalCount: 0, items: "" },
  }));
  assert.equal(parsed.resultCode, "0000");
  assert.equal(parsed.items.length, 0);
  assert.equal(parsed.contractError, null);
  assert.equal(isKtoSuccessCode(parsed.resultCode), true);
});

test("필수 파라미터 누락의 최상위 resultCode 오류 봉투를 파싱한다", () => {
  const parsed = parseKtoWire(JSON.stringify({
    responseTime: "2026-08-30T00:00:00",
    resultCode: "03",
    resultMsg: "필수 요청 파라미터가 없습니다.",
  }));
  assert.equal(parsed.contractError, null);
  assert.equal(parsed.resultCode, "03");
  assert.equal(parsed.items.length, 0);
});

test("body 없는 최상위 성공 코드는 계약 오류로 거부한다", () => {
  const parsed = parseKtoWire(JSON.stringify({ resultCode: "0000", resultMsg: "OK" }));
  assert.match(parsed.contractError ?? "", /header\/body/);
  assert.equal(parsed.items.length, 0);
});

test("양수 totalCount의 누락·비객체 item을 정상 empty로 내리지 않는다", () => {
  const missing = parseKtoWire(JSON.stringify({
    response: {
      header: { resultCode: "0000", resultMsg: "OK" },
      body: { totalCount: 1, items: "" },
    },
  }));
  assert.match(missing.contractError ?? "", /양수/);

  const malformed = parseKtoWire(JSON.stringify({
    response: {
      header: { resultCode: "0000", resultMsg: "OK" },
      body: { totalCount: 1, items: { item: "not-an-object" } },
    },
  }));
  assert.match(malformed.contractError ?? "", /객체가 아닌/);
});

test("totalCount=0과 item 존재가 충돌하면 계약 오류로 거부한다", () => {
  const parsed = parseKtoWire(JSON.stringify({
    header: { resultCode: "0000", resultMsg: "OK" },
    body: { totalCount: 0, items: { item: { baseYm: "202501" } } },
  }));
  assert.match(parsed.contractError ?? "", /totalCount=0/);
});

test("JSON 게이트웨이 code 30을 빈 결과로 오인하지 않는다", () => {
  const parsed = parseKtoWire(JSON.stringify({
    OpenAPI_ServiceResponse: {
      cmmMsgHeader: { returnReasonCode: "30", returnAuthMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" },
    },
  }));
  assert.equal(parsed.gatewayCode, "30");
  assert.equal(parsed.resultCode, null);
});

test("XML 정상 응답의 header, body, item을 읽는다", () => {
  const parsed = parseKtoWire(`<?xml version="1.0"?><response><header><resultCode>0000</resultCode><resultMsg>OK</resultMsg></header><body><items><item><areaCode>44</areaCode><areaNm>충남</areaNm><touNum>1,234</touNum></item></items><numOfRows>10</numOfRows><pageNo>1</pageNo><totalCount>1</totalCount></body></response>`);
  assert.equal(parsed.format, "xml");
  assert.equal(parsed.resultCode, "0000");
  assert.equal(parsed.totalCount, 1);
  assert.deepEqual(parsed.items, [{ areaCode: "44", areaNm: "충남", touNum: "1,234" }]);
});

test("XML 게이트웨이 오류를 감지한다", () => {
  const parsed = parseKtoWire(`<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30</returnReasonCode><returnAuthMsg>NOT_REGISTERED</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`);
  assert.equal(parsed.gatewayCode, "30");
  assert.equal(parsed.format, "xml");
});
