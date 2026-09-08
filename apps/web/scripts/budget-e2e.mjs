import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

// The preceding M3 browser flow exports this source-backed, fictional planning fixture.
const sample = JSON.parse(readFileSync("output/playwright/planning-sample.json", "utf8"));
sample.version = 1;
sample.draft.options = [sample.draft.options[0]];
sample.draft.title = "2027 예산 검수용 기획";
const legacy = JSON.stringify(sample.revisions[0]), legacyId = sample.revisions[0].id;
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3113", key = "fest-compass.planning.v1";
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
const errors = [], writes = [], passed = [];
const watch = p => { p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); p.on("request", r => { if (r.url().startsWith(base) && r.method() !== "GET") writes.push(r.method()); }); };
watch(page);
const btn = name => page.getByRole("button", { name, exact: true });
const f = label => page.getByLabel(label, { exact: true }).filter({ visible: true });
const visible = locator => locator.waitFor({ state: "visible" });
const data = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const save = async () => { await btn("초안 저장").click(); await visible(page.getByText("이 브라우저에 초안을 저장했습니다.", { exact: true })); };
const details = async text => { const summary = page.locator("summary").filter({ hasText: text }).filter({ visible: true }).first(); if (!(await summary.locator("..").getAttribute("open"))) { if (await summary.locator("..").getAttribute("open") === null) await summary.click(); } };
const line = async index => { await details(new RegExp(`^지출 ${index} ·`)); };
const fill = async pairs => { for (const [label, value] of pairs) await f(label).fill(value); };
const confirmExpenses = async () => { await f("지출 항목의 중복이 없음을 확인했습니다").check(); await f("선택한 범위의 지출 항목을 모두 입력했습니다").check(); };
try {
  await page.goto(`${base}/planning/budget`); await visible(page.getByRole("heading", { name: "예산·준비 규모 비교", exact: true }));
  await btn("보관본 0개").click(); await page.getByLabel("기획 파일을 새 초안으로 가져오기", { exact: true }).setInputFiles({ name: "legacy-v1.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(sample)) });
  await visible(page.getByText(/가져오기 전 초안과 기존 보관본/)); await btn("예산·준비 규모").click();
  await btn("이 후보 예산 작성 시작").click();
  await f("산출 비교 단계").selectOption("request"); await fill([["예산 한도(원)", "450000"], ["범위 기준 이름", "행사 운영"], ["포함 항목", "프로그램·시설·홍보"], ["포함 부서", "관광부서"]]);
  await f("비용 범위").selectOption("whole"); await f("한도 세금 기준").selectOption("included"); await f("관련 부서의 포함·제외 범위를 확인했습니다").check();
  for (const [name, quantity, rate, unit] of [["프로그램", "2", "100000", "회"], ["시설", "1", "300000", "식"], ["홍보", "1", "", "식"]]) {
    await btn("지출 항목 추가").click(); await fill([["지출 항목 이름", name], ["수량", quantity], ["수량 단위", unit], ["단가(원)", rate], ["단가 출처·가정 이유", "검수용 가상 산출"]]);
    await f("산출 방식").selectOption("quantity"); await f("항목 세금 기준").selectOption("included"); await f("단가 자료 성격").selectOption("assumption");
    if (name === "시설") await fill([["기간 수", "2"], ["기간 단위", "일"], ["견적에 포함된 기간·조건", "검수용 2일 포함 견적"]]);
  }
  await confirmExpenses(); await save(); assert.equal((await data()).version, 2); assert.equal(JSON.stringify((await data()).revisions.find(r => r.id === legacyId)), legacy);
  await visible(page.getByText(/최소 초과액: 50,000원/)); assert.equal(await page.getByRole("img", { name: /^지출 산출 구성 도넛/ }).count(), 0);
  passed.push("legacy-v1-keeps-immutable-history", "quantity-and-included-duration", "missing-budget-and-minimum-excess");
  await details(/^재원 입력/);
  for (const [name, source, amount, status] of [["시군비", "시군-2027", "300000", "confirmed"], ["예정 재원", "예정-2027", "200000", "planned"]]) {
    await btn("재원 추가").click(); const group = page.getByRole("group", { name: `재원 ${name === "시군비" ? 1 : 2}`, exact: true });
    for (const [label, value] of [["재원 이름", name], ["재원 제공 주체", "검수용 제공 주체"], ["재원 식별 메모", source], ["계획 재원액(원)", amount], ["재원 확인 근거", "검수용 확인 메모"], ["재원 확인일", "2026-09-09"]]) await group.getByLabel(label, { exact: true }).fill(value);
    await group.getByLabel("재원 확보 상태", { exact: true }).selectOption(status);
  }
  await f("같은 지원금·상하위 재원의 중복을 확인했습니다").check(); await f("선택한 범위의 계획 재원을 모두 입력했습니다").check(); await f("재원 대조 세금 기준").selectOption("included"); await f("이 재원이 위 지출과 같은 포함·제외 범위를 충당함을 확인했습니다").check();
  await visible(page.getByRole("img", { name: /^계획 재원 구성 도넛/ })); await visible(page.getByText(/최소 부족액\(미산정 포함\): 200,000원/));
  passed.push("planned-funds-not-secured", "complete-funding-donut-with-incomplete-costs");
  const secondFund = page.getByRole("group", { name: "재원 2", exact: true }); await secondFund.getByLabel("재원 식별 메모", { exact: true }).fill("시군-2027");
  await visible(page.getByText(/같은 재원 식별 메모가 중복/)); assert.equal(await page.getByRole("img", { name: /^계획 재원 구성 도넛/ }).count(), 0);
  await secondFund.getByLabel("재원 식별 메모", { exact: true }).fill("예정-2027"); await secondFund.getByLabel("재원 확보 상태", { exact: true }).selectOption("planned");
  const firstId = (await data()).draft.options[0].id; // Stable M3 option identity.
  await line(3); await f("단가(원)").fill("0"); await visible(page.getByRole("img", { name: /^지출 산출 구성 도넛/ })); await f("단가(원)").fill(""); assert.equal(await page.getByRole("img", { name: /^지출 산출 구성 도넛/ }).count(), 0); await f("단가(원)").fill("0");
  passed.push("duplicate-funding-blocks-composition", "zero-is-distinct-from-missing");
  await line(1); await f("수량").fill("1.5"); await f("단가(원)").fill("1001"); await visible(page.getByText(/항목 계산: 1,502원/));
  await f("수량").fill("2"); await f("단가(원)").fill("100000"); await save(); const beforeInvalid = JSON.stringify(await data());
  await f("수량").fill("-1"); await btn("초안 저장").click(); assert.equal(await f("수량").inputValue(), "-1"); assert.equal(JSON.stringify(await data()), beforeInvalid); await f("수량").fill("2");
  await f("항목 세금 기준").selectOption("unknown"); assert.equal(await page.getByRole("img", { name: /^지출 산출 구성 도넛/ }).count(), 0); await visible(page.getByText(/세금 기준 혼재·미확인/)); await f("항목 세금 기준").selectOption("included");
  await details(/^보관 근거·준비 과제 연결$/); await page.getByRole("checkbox", { name: /^근거: / }).first().check(); await page.getByRole("checkbox", { name: /^준비 과제: / }).first().check(); await save();
  assert.equal((await data()).draft.options[0].budget.lines[0].evidenceKeys.length, 1); assert.equal((await data()).draft.options[0].budget.lines[0].taskIds.length, 1);
  passed.push("exact-per-line-rounding", "invalid-input-keeps-prior-save", "unknown-tax-blocks-total", "source-and-preparation-links");
  await line(1); await f("수량").fill("1"); await f("예산 보관 메모").fill("기준 40만원"); await btn("예산·근거를 보관본으로 남기기").click(); await visible(page.getByText("예산·근거·준비 상태를 보관본으로 남겼습니다.", { exact: true }));
  const baselineId = (await data()).revisions.at(-1).id; await f("수량").fill("2"); await details(/^이전 보관본과 변경 이유$/); await f("예산 기준 보관본").selectOption(baselineId); await f("수량 변경 이유").fill("해설 프로그램 1회 추가");
  await visible(page.getByText(/기준 버전 대비 \+100,000원/)); await f("관련 부서의 포함·제외 범위를 확인했습니다").uncheck(); await visible(page.getByText(/기준 버전 대비 차액 보류/));
  await f("관련 부서의 포함·제외 범위를 확인했습니다").check(); await confirmExpenses();
  await f("같은 지원금·상하위 재원의 중복을 확인했습니다").check(); await f("선택한 범위의 계획 재원을 모두 입력했습니다").check(); await f("이 재원이 위 지출과 같은 포함·제외 범위를 충당함을 확인했습니다").check();
  const fg = page.getByRole("group", { name: "재원 1", exact: true }); await fg.getByLabel("재원 확인일", { exact: true }).fill("2026-09-09"); await fg.getByLabel("재원 확보 상태", { exact: true }).selectOption("confirmed");
  await secondFund.getByLabel("재원 확보 상태", { exact: true }).selectOption("planned");
  passed.push("immutable-budget-baseline-difference", "department-scope-blocks-comparison");
  await details(/^단계별 원문 금액/); await btn("새 원문 기록 작성").click(); await f("원문 금액 표기").fill("작성 중 원문"); await save(); await btn("후보 작성").click(); await btn("예산·준비 규모").click(); await details(/^단계별 원문 금액/); assert.equal(await f("원문 금액 표기").inputValue(), "작성 중 원문");
  await btn("원문 금액 기록 추가").click(); await visible(page.getByRole("alert").filter({ hasText: "이름·출처·기준일" }));
  for (const [i, stage, amount] of [[0, "request", "500000"], [1, "contract", "480000"], [2, "payment", "300000"]]) {
    if (i > 0) await btn("새 원문 기록 작성").click(); await fill([["금액 기록 이름", `검수용 원문 ${i + 1}`], ["원문 금액 표기", amount], ["원문 출처·문서", "검수용 가상 문서"], ["원문 기준일", "2026-09-09"]]); await f("원문 금액 단계").selectOption(stage); await f("원문 금액 단위").selectOption("won"); await btn("원문 금액 기록 추가").click();
  }
  await save(); assert.deepEqual((await data()).draft.options[0].budget.records.map(r => r.original), ["500000", "480000", "300000"]);
  passed.push("unfinished-source-record-survives-navigation", "source-record-needs-reference", "amount-stages-not-added-or-overwritten");
  await btn("후보 작성").click(); await btn("현재 후보 복사").click(); await f("후보 이름").fill("먹거리 체험(검수용)"); await btn("예산·준비 규모").click();
  await save(); const duplicate = (await data()).draft.options[1]; assert.equal(duplicate.budget.records.length, 0); assert.equal(duplicate.budget.funds[0].status, "unknown"); assert.equal(duplicate.budget.lines[0].taskIds[0], duplicate.tasks[0].id);
  await confirmExpenses(); await line(1); await f("수량").fill("3"); await save(); await visible(page.getByRole("img", { name: "0원 기준 후보별 금액 막대", exact: true }));
  await f("예산 편집 후보").selectOption(firstId); await f("예산 보관 메모").fill("두 후보 예산·근거 비교"); await btn("예산·근거를 보관본으로 남기기").click(); await visible(page.getByText("예산·근거·준비 상태를 보관본으로 남겼습니다.", { exact: true }));
  mkdirSync("output/playwright", { recursive: true }); writeFileSync("output/playwright/budget-sample.json", JSON.stringify(await data(), null, 2));
  passed.push("copy-resets-funding-and-records", "comparable-candidates-zero-axis-and-total-labels", "whole-planning-and-budget-snapshot");
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390); await page.screenshot({ path: "output/playwright/budget-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 }); await btn("후보 작성").click(); await f("사업연도").fill("2028"); await btn("예산·준비 규모").click(); await visible(page.getByText(/기획 조건 변경 · 예산·재원 재확인 필요/));
  await btn("이전 예산 보관 후 현재 조건으로 재검토").click(); await visible(page.getByText(/이전 예산을 보관하고 현재 조건/));
  let p = await data(); assert.equal(p.draft.options[0].budget.funds[0].status, "unknown"); assert.equal(p.draft.options[0].budget.lines[0].classification.year, "2027"); assert.equal(p.draft.options[0].budget.lines[0].classification.status, "unknown");
  passed.push("390px-no-page-overflow", "new-year-rechecks-funding-and-classification");
  const revisionCount = p.revisions.length; await btn(`보관본 ${revisionCount}개`).click(); const pending = page.waitForEvent("download"); await btn("기획 입력 파일 보관").click(); const exported = readFileSync(await (await pending).path(), "utf8"); await page.getByLabel("기획 파일을 새 초안으로 가져오기", { exact: true }).setInputFiles({ name: "budget.json", mimeType: "application/json", buffer: Buffer.from(exported) }); await visible(page.getByText(/가져오기 전 초안과 기존 보관본/));
  p = await data(); assert.ok(p.revisions.length > revisionCount); assert.equal(JSON.stringify(p.revisions.find(r => r.id === legacyId)), legacy); assert.deepEqual(p.draft.options[0].budget.records.map(r => r.original), ["500000", "480000", "300000"]);
  const beforeBad = JSON.stringify(p); await page.getByLabel("기획 파일을 새 초안으로 가져오기", { exact: true }).setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{}") }); await visible(page.getByRole("alert").filter({ hasText: "기획을 읽지 못했습니다" })); assert.equal(JSON.stringify(await data()), beforeBad);
  passed.push("budget-file-roundtrip-keeps-all-history", "invalid-file-keeps-budget");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []); console.log(JSON.stringify({ headless: true, passed, browserErrors: errors.length, clientWrites: writes.length }));
} finally { await browser.close(); }
