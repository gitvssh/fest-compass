import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3116", key = "fest-compass.planning.v1";
const source = JSON.parse(readFileSync("output/playwright/proposal-sample.json", "utf8"));
const sample = structuredClone(source), proposal = sample.revisions.find(r => r.proposal), o = proposal.draft.options.find(o => o.decision === "selected");
sample.revisions = [proposal]; sample.version = 3; delete sample.outcomes;
proposal.draft.title = "가상 검수 축제"; proposal.draft.year = 2027; proposal.draft.regionKey = "44/230"; proposal.id = "outcome-e2e-proposal";
const b = o.budget; b.basis = JSON.stringify({ optionId: o.id, year: proposal.draft.year, regionKey: proposal.draft.regionKey, department: proposal.draft.department, venue: o.venue, item: o.item, audience: o.audience, periods: o.periods });
Object.assign(b, { fundingUnique: true, fundingComplete: true, fundingVat: "included", baselineRevision: "", baselineOption: "", scope: { kind: "partial", name: "가상 지원사업", includes: "가상 프로그램", excludes: "그 외", departments: "관광부서", departmentsKnown: true } });
b.funds = [{ id: "subsidy", name: "보조금", amount: "30000000" }, { id: "self", name: "자부담", amount: "5000000" }].map(f => ({ ...f, provider: "검수 기관", relation: "가상", sourceId: f.id, parentId: "", included: true, status: "planned", reference: "가상 계획", date: "" }));
sample.draft = structuredClone(proposal.draft);
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
const errors = [], writes = [], passed = [];
page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); page.on("request", r => { if (r.url().startsWith(base) && !["GET", "HEAD"].includes(r.method()) && !new URL(r.url()).pathname.startsWith("/cdn-cgi/")) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
const btn = name => page.getByRole("button", { name, exact: true }), f = name => page.getByLabel(name, { exact: true }).filter({ visible: true });
const visible = l => l.first().waitFor({ state: "visible" }), data = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const save = async () => { await btn("초안 저장").click(); await visible(page.getByText("이 브라우저에 초안을 저장했습니다.", { exact: true })); };
const report = () => page.locator(".outcome-report");
async function openSummary(text) { await page.locator("summary").filter({ hasText: text }).first().click(); }
async function actual(v) { await f("실제 사용액(원) 값").fill(v); await f("실제 사용액(원) 출처 구분").selectOption("manual"); await f("실제 사용액(원) 출처·문서·쪽 참조").fill("가상 지급 기록 · 검수 전용"); }
try {
  mkdirSync("output/playwright", { recursive: true }); await page.goto(`${base}/planning/outcomes`);
  // The public edge asks for analytics consent in a fresh browser. Exercise the
  // visible refusal action before testing the app; never bypass the overlay.
  if (new URL(base).hostname === "kto.damecasol.com") {
    await btn("Reject All").waitFor({ state: "visible", timeout: 15000 });
    await btn("Reject All").click();
    await btn("Reject All").waitFor({ state: "hidden" });
  }
  await visible(page.getByRole("heading", { name: "비용·결과와 다음 회차", exact: true }));
  await f("공개 사례·개인 회차 검색어").fill("복숭아"); assert.match(await page.locator("main").innerText(), /35,118,200/); assert.match(await page.locator("main").innerText(), /전체 축제 원가 아님/);
  assert.ok(await page.getByRole("img").filter({ hasText: "" }).count() >= 2); await page.evaluate(() => window.scrollTo(0,0)); await page.screenshot({ path: "output/playwright/outcome-public.png", fullPage: true }); passed.push("public-original-costs-and-composition-scope");
  await f("공개 사례·개인 회차 검색어").fill("딸기"); assert.match(await page.locator("main").innerText(), /입찰 기초/); assert.match(await page.locator("main").innerText(), /실제 비용 자료 미확보/); passed.push("tender-and-missing-not-actual-spending");
  await btn("내 행사 결과 입력").click(); assert.ok(await btn("이 기획안으로 결과 초안 시작").isDisabled()); passed.push("missing-proposal-guides-to-planning");
  await btn("보관본 0개").click(); await page.getByLabel("기획 파일을 새 초안으로 가져오기", { exact: true }).setInputFiles({ name: "fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(sample)) }); await visible(page.getByText(/가져오기 전 초안과 기존 보관본/));
  await btn("비용·결과·다음 회차").click(); await btn("내 행사 결과 입력").click(); await btn("이 기획안으로 결과 초안 시작").click(); await visible(page.getByText(/기준 기획안의 결과 초안을 열었습니다/));
  const originalPlan = JSON.stringify((await data()).revisions.find(r => r.id === proposal.id));
  await btn("성과 지표 추가").click(); await openSummary(/^지표 1/);
  for (const [label, v] of [["성과 지표 이름", "가상 입장 건수"], ["계획값", "100"], ["계획값 근거·기획안 참조", "가상 P1 측정 계획"], ["계획 지표 정의", "입장 건수"], ["실측 지표 정의", "지역 방문자"], ["계획 단위", "건"], ["실측 단위", "명"], ["비교 대상 시작일", "2027-01-01"], ["비교 대상 종료일", "2027-01-02"], ["실측 값", "120"], ["실측 출처·문서·쪽 참조", "가상 계수기"]]) await f(label).fill(v);
  await f("실측 출처 구분").selectOption("manual"); assert.match(await page.locator("main").innerText(), /지표 정의·단위 미입력 또는 불일치/);
  await f("실측 지표 정의").fill("입장 건수"); await f("실측 단위").fill("건"); await visible(page.getByRole("img", { name: "가상 입장 건수 계획·결과 막대", exact: true })); assert.match(await page.locator("main").innerText(), /20%/);
  await f("계획값").fill("0"); assert.match(await page.locator("main").innerText(), /계획 0 · 비율 미산정/); await f("계획값").fill("100"); passed.push("metric-definitions-units-periods-zero-gates"); await openSummary(/^지표 1/);
  for (const [name, v] of [["보조금", "30000000"], ["자부담", "5118200"]]) {
    await openSummary(new RegExp(`^재원 · ${name}$`)); await f("실제 사용액 단계").selectOption("payment"); await f("실제 사용액 세금 기준").selectOption("included"); await f("실제 사용 사업·포함 범위").fill("가상 지원사업 프로그램"); await page.getByRole("checkbox", { name: /기준 기획안과 같은 재원/ }).check(); await actual(v);
    if (name === "보조금") { await f("이자(원) 값").fill("0"); await f("이자(원) 출처 구분").selectOption("manual"); await f("이자(원) 출처·문서·쪽 참조").fill("가상 이자 확인서"); }
    await openSummary(new RegExp(`^재원 · ${name}$`));
  }
  await visible(page.getByRole("img", { name: "동일 범위 재원 합계 계획·결과 막대", exact: true })); assert.match(await page.locator("main").innerText(), /35,118,200/); passed.push("fund-totals-35000000-35118200-and-unknown-versus-zero");
  await btn("증빙 확인 기록 추가").click(); await openSummary(/^증빙 1/); await f("증빙 종류").selectOption("contract"); await f("증빙 적용 범위·항목").fill("임차 항목"); await f("증빙 참조").fill("가상 계약서"); await openSummary(/^증빙 1/);
  await btn("개선 기록 추가").click(); await openSummary(/^개선 1/); for (const [label,v] of [["발견한 문제","홍보 부족"],["개선 조치","안내 개선"],["차기 준비 과제","홍보 자료 준비"],["차기 예산 검토 항목","홍보비 재검토"],["개선 근거 참조","가상 설문"]]) await f(label).fill(v);
  await f("현장 조치·운영 기록").fill("가상 기록: 안내 위치 보완"); await save(); await page.reload(); await btn("내 행사 결과 입력").click(); assert.equal(await f("현장 조치·운영 기록").inputValue(), "가상 기록: 안내 위치 보완"); passed.push("draft-reload-preserves-sources-and-improvements");
  await f("결과 버전 보관 메모").fill("R1 검수용"); await btn("현재 결과를 새 버전으로 보관").click(); await visible(report());
  let p = await data(); const r1 = p.outcomes.revisions.at(-1), r1raw = JSON.stringify(r1); assert.equal(p.version,4); assert.equal(r1.draft.evidence[0].status,"unknown"); assert.equal(r1.draft.funds[0].balance.value,""); assert.equal(r1.draft.funds[0].interest.value,"0"); passed.push("contract-reference-is-not-settlement-approval");
  await page.evaluate(() => window.scrollTo(0,0)); await page.screenshot({ path: "output/playwright/outcome-result.png", fullPage: true });
  const pdf = async name => { await page.evaluate(() => { window.outcomePrintCheck = null; window.addEventListener("beforeprint", () => { window.outcomePrintCheck = { closed: document.querySelectorAll(".outcome-report details:not([open])").length, text: document.querySelector(".outcome-report").innerText }; }, { once: true }); }); await page.pdf({ path: `output/playwright/outcome-${name}.pdf`, format: "A4", printBackground: true }); const v = await page.evaluate(() => window.outcomePrintCheck); assert.equal(v.closed,0); assert.match(v.text,/홍보비 재검토/); assert.match(v.text,/35,118,200/); assert.ok(v.text.includes(r1.id)); return v.text; };
  const pdfText = await pdf("r1"); assert.ok(pdfText.includes(proposal.id)); assert.match(pdfText,/52,671.5/); passed.push("fixed-plan-result-pdf-with-original-evidence");
  await page.setViewportSize({ width:390,height:844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),390); await page.evaluate(() => window.scrollTo(0,0)); await page.screenshot({ path: "output/playwright/outcome-mobile.png", fullPage:true }); await page.setViewportSize({ width:1440,height:1000 }); passed.push("390px-result-no-overflow");
  await btn("이 결과를 수정 초안으로 열기").click(); await visible(page.getByText(/이전 결과를 수정 초안으로/)); await openSummary(/^재원 · 자부담$/); await actual("6000000"); await f("결과 버전 보관 메모").fill("R2 검수용"); await btn("현재 결과를 새 버전으로 보관").click(); await visible(report());
  p = await data(); assert.equal(JSON.stringify(p.outcomes.revisions.find(r=>r.id===r1.id)),r1raw); assert.equal(JSON.stringify(p.revisions.find(r=>r.id===proposal.id)),originalPlan); assert.match(await report().innerText(),/36,000,000/);
  await f("출력할 결과 버전").selectOption(r1.id); assert.match(await report().innerText(),/35,118,200/); passed.push("r2-changes-never-change-p1-r1");
  await f("공개 사례·개인 회차 검색어").fill("가상 검수"); await f("결과 조회 지역").selectOption("44/230"); await f("결과 조회 사업연도").fill("2027"); assert.ok(await report().count()); await f("결과 조회 사업연도").fill("2026"); assert.equal(await report().count(),0); await f("결과 조회 사업연도").fill("2027"); passed.push("personal-edition-search-is-local-and-separate");
  await f("출력할 결과 버전").selectOption(r1.id); await f("다음 회차 사업연도").fill("2028"); await btn("이 결과에서 다음 회차 기획 만들기").click(); await visible(page.getByText(/다음 회차 초안을 만들었습니다/));
  p = await data(); assert.equal(p.draft.year,2028); assert.equal(p.draft.previousOutcomeId,r1.id); assert.equal(p.outcomes.draft,null); assert.ok(p.draft.options.every(o=>o.decision==="undecided"&&!o.reason&&!o.periods.event.start&&!o.venueChecks.length)); assert.ok(p.draft.options[0].tasks.some(t=>t.title==="홍보 자료 준비"&&t.needed.includes("홍보비 재검토"))); assert.ok(p.draft.options[0].tasks.every(t=>!t.due&&t.progress==="todo"&&!t.reviews.length)); assert.equal(JSON.stringify(p.outcomes.revisions.find(r=>r.id===r1.id)),r1raw); passed.push("next-edition-resets-and-links-improvements");
  await page.evaluate(() => window.scrollTo(0,0)); await page.screenshot({ path: "output/playwright/outcome-next.png", fullPage:true });
  const download = page.waitForEvent("download"); await btn("기획 입력 파일 보관").click(); const raw = readFileSync(await (await download).path(),"utf8");
  await btn(`보관본 ${p.revisions.length}개`).click(); await page.getByLabel("기획 파일을 새 초안으로 가져오기", {exact:true}).setInputFiles({name:"roundtrip.json",mimeType:"application/json",buffer:Buffer.from(raw)}); await visible(page.getByText(/가져오기 전 초안과 기존 보관본/)); assert.equal(JSON.stringify((await data()).outcomes.revisions.find(r=>r.id===r1.id)),r1raw); passed.push("v4-file-roundtrip-keeps-lineage-and-results");
  const bad = JSON.parse(raw); bad.outcomes.revisions.find(r=>r.id===r1.id).note="변조"; const before=JSON.stringify(await data()); await page.getByLabel("기획 파일을 새 초안으로 가져오기", {exact:true}).setInputFiles({name:"bad.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(bad))}); await visible(page.getByRole("alert").filter({hasText:/같은 결과 보관본/})); assert.equal(JSON.stringify(await data()),before); passed.push("conflicting-result-import-preserves-data");
  assert.deepEqual(errors,[]); assert.deepEqual(writes,[]); writeFileSync("output/playwright/outcome-sample.json",JSON.stringify(await data(),null,2)); const result={headless:true,passed,browserErrors:errors,appWrites:writes}; writeFileSync("output/playwright/outcome-result.json",JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
