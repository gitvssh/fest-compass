import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const sample = JSON.parse(readFileSync("output/playwright/budget-sample.json", "utf8"));
sample.draft.title = "2027 기획안 검수용 가상 기획";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3113", key = "fest-compass.planning.v1";
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
const errors = [], writes = [], passed = [];
page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("request", r => { if (r.url().startsWith(base) && r.method() !== "GET") writes.push(r.method()); });
const btn = name => page.getByRole("button", { name, exact: true });
const f = label => page.getByLabel(label, { exact: true }).filter({ visible: true });
const data = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const visible = locator => locator.first().waitFor({ state: "visible" });
const report = () => page.locator(".proposal-report");
const save = async () => { await btn("초안 저장").click(); await visible(page.getByText("이 브라우저에 초안을 저장했습니다.", { exact: true })); };
async function importFile(value) {
  await btn(`보관본 ${(await data())?.revisions.length ?? 0}개`).click();
  await page.getByLabel("기획 파일을 새 초안으로 가져오기", { exact: true }).setInputFiles({ name: "proposal.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });
  await visible(page.getByText(/가져오기 전 초안과 기존 보관본/));
}
async function print(kind) {
  const closed = await report().locator("details:not([open])").count(); assert.ok(closed > 0);
  await page.evaluate(() => { window.proposalPrintCheck = null; window.addEventListener("beforeprint", () => { window.proposalPrintCheck = { closed: document.querySelectorAll(".proposal-report details:not([open])").length, text: document.querySelector(".proposal-report").innerText }; }, { once: true }); });
  await page.pdf({ path: `output/playwright/proposal-${kind}.pdf`, format: "A4", printBackground: true });
  const check = await page.evaluate(() => window.proposalPrintCheck);
  assert.equal(check.closed, 0); assert.match(check.text, /선행 과제/); assert.match(check.text, /52,671.5/); assert.match(check.text, /수량 변경: 해설 프로그램 1회 추가/); assert.match(check.text, /미산정 지출/); assert.match(check.text, /보관 시각/);
  assert.equal(await report().locator("details:not([open])").count(), closed);
  return check.text;
}
try {
  mkdirSync("output/playwright", { recursive: true });
  await page.goto(`${base}/planning/proposal`); await visible(page.getByRole("heading", { name: "기획안 보관·출력", exact: true }));
  assert.ok(await btn("현재 초안을 기획안으로 보관").isDisabled()); await save();
  assert.equal((await data()).revisions.length, 0); passed.push("single-candidate-blocks-proposal-but-saves-draft");
  await importFile(sample); const legacy = (await data()).revisions.map(r => JSON.stringify(r));
  await btn("후보 작성").click(); await f("후보 판단").selectOption("selected"); await f("선택·제외 이유").fill(" ");
  await btn("기획안 보관·출력").click(); assert.ok(await btn("현재 초안을 기획안으로 보관").isDisabled()); passed.push("blank-selection-reason-blocks-proposal");
  await btn("후보·선택 이유 편집").click(); await f("선택·제외 이유").fill("검수용 가정: 가족 참여와 준비 규모를 비교해 우선 선택");
  await btn("예산·준비 규모").click(); await page.locator("summary").filter({ hasText: /^지출 3 ·/ }).click(); await f("단가(원)").fill("");
  await btn("기획안 보관·출력").click(); await f("측정 계획").fill("외지인 방문 추세(명) · 행사 전후 7일 · 공공데이터 일별 조회 · 관광부서 / 입장객 별도 조사"); await save(); await page.reload();
  assert.match(await f("측정 계획").inputValue(), /입장객 별도 조사/); passed.push("measurement-plan-survives-reload");
  await f("기획안 보관 메모").fill("P1 · 미산정 비용과 미확인 사항 포함"); await btn("현재 초안을 기획안으로 보관").click(); await visible(page.getByText(/기획안을 새 버전으로 보관했습니다/));
  let p = await data(); const p1 = p.revisions.at(-1), p1raw = JSON.stringify(p1); assert.equal(p.version, 3); assert.equal(p1.proposal.format, 1);
  assert.equal(p1.draft.options[0].budget.lines[2].rate, ""); assert.match(await report().innerText(), /전체 총액 미확정/); assert.match(await report().innerText(), /공식 결재/);
  passed.push("source-budget-preparation-archived-together", "missing-cost-does-not-become-zero-or-approval");
  await page.screenshot({ path: "output/playwright/proposal-desktop.png", fullPage: true });
  const business = await print("business"); await f("출력 자료 종류").selectOption("preparation"); const preparation = await print("preparation");
  for (const text of [business, preparation]) { assert.ok(text.includes(p1.id)); assert.ok(text.includes(p1.savedAt)); assert.match(text, /담당 부서/); assert.match(text, /준비 과제/); assert.match(text, /당시 조회/); }
  passed.push("same-version-business-and-preparation-pdf", "closed-records-and-sources-print-and-restore", "real-source-d0-and-query-preserved");
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.screenshot({ path: "output/playwright/proposal-mobile.png", fullPage: true }); passed.push("390px-no-page-overflow"); await page.setViewportSize({ width: 1440, height: 1000 });
  await btn("이 기획안에서 새 초안 작성").click(); await visible(page.getByText(/보관된 기획안을 새 초안으로/));
  await f("제약·미확인 사항").fill("P2 검수 기록: 장소 담당 부서 재확인 예정"); await btn("예산·준비 규모").click(); await page.locator("summary").filter({ hasText: /^지출 1 ·/ }).click(); await f("수량").fill("3");
  await btn("기획안 보관·출력").click(); await f("기획안 보관 메모").fill("P2 · 프로그램 1회 추가"); await btn("현재 초안을 기획안으로 보관").click(); await visible(page.getByText(/기획안을 새 버전으로 보관했습니다/));
  p = await data(); const p2 = p.revisions.at(-1); assert.equal(p2.draft.options[0].budget.lines[0].quantity, "3"); assert.equal(JSON.stringify(p.revisions.find(r => r.id === p1.id)), p1raw);
  for (const r of legacy) assert.ok(p.revisions.some(n => JSON.stringify(n) === r));
  passed.push("new-draft-preserves-previous-draft-and-all-legacy-revisions", "p2-changes-never-change-p1");
  await f("출력할 기획안 버전").selectOption(p1.id); assert.ok(!(await report().innerText()).includes("P2 검수 기록"));
  await page.locator("summary").filter({ hasText: /^보관한 자료:/ }).first().click();
  assert.equal(await report().getByLabel("그래프 날짜 기준").filter({ visible: true }).count(), 0); assert.equal(await report().getByLabel("선택 시작", { exact: true }).filter({ visible: true }).count(), 0);
  assert.ok(await report().getByRole("img").count() > 0); passed.push("archived-chart-selection-is-read-only");
  await page.screenshot({ path: "output/playwright/proposal-evidence.png", fullPage: true });
  const pending = page.waitForEvent("download"); await btn("기획 입력 파일 보관").click(); const raw = readFileSync(await (await pending).path(), "utf8");
  await importFile(JSON.parse(raw)); assert.equal(JSON.stringify((await data()).revisions.find(r => r.id === p1.id)), p1raw); passed.push("v3-file-roundtrip-keeps-proposals");
  writeFileSync("output/playwright/proposal-sample.json", JSON.stringify(await data(), null, 2));
  await btn("기획안 보관·출력").click(); await f("출력할 기획안 버전").selectOption(p1.id);
  const before = JSON.stringify(await data()), bad = JSON.parse(raw); bad.revisions.find(r => r.id === p1.id).draft.purpose = "변조";
  await btn(`보관본 ${(await data()).revisions.length}개`).click(); await page.getByLabel("기획 파일을 새 초안으로 가져오기", { exact: true }).setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bad)) });
  await visible(page.getByRole("alert").filter({ hasText: /같은 보관본 식별자/ })); assert.equal(JSON.stringify(await data()), before); passed.push("conflicting-proposal-import-keeps-stored-data");
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  const result = { headless: true, passed, browserErrors: errors.length, clientWrites: writes.length };
  writeFileSync("output/playwright/proposal-result.json", JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
