import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("E2E_BASE_URL required");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], writes = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("request", r => {
  const url = new URL(r.url());
  // Cloudflare owns the consent transport; all application writes remain forbidden.
  if (r.method() !== "GET" && url.origin === new URL(base).origin && !url.pathname.startsWith("/cdn-cgi/zaraz/")) writes.push(r.url());
});
async function visible(locator) { await locator.waitFor({ state: "visible" }); }
const step = name => page.getByRole("navigation", { name: "축제 준비 단계" }).getByRole("button", { name: new RegExp(name) }).click();
try {
  await page.goto(`${base}/workspace`);
  if (process.env.E2E_REJECT_ANALYTICS === "1") {
    await page.getByRole("button", { name: "Reject All", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  await page.getByRole("button", { name: "논산 샘플로 시작" }).click();
  await page.getByLabel("행사 전체 예상 입장 건수 (건)", { exact: true }).fill("10000");
  await page.getByLabel("가정의 근거와 집계 기준").fill("입구 계수기 · 재입장 포함 · 행사 전체");
  await step("운영안 비교");
  for (const i of [1, 2]) {
    const plan = page.getByRole("region", { name: `운영안 ${i}`, exact: true });
    for (const [label, value] of [["배치 인원 (명)", String(i * 10)], ["셔틀 차량 (대)", "0"], ["운영 회차 (회)", "4"], ["전체 예산 (원)", String(i * 1000000)]]) await plan.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByLabel("선택 이유", { exact: true }).fill("예산과 확보 인원에 맞는 안");
  await page.getByLabel("기록 담당자", { exact: true }).fill("운영팀");
  await page.getByRole("button", { name: "운영안 1로 결정 기록" }).click();
  await visible(page.getByText("선택 당시 가정: 10,000건 · 예산 1,000,000원", { exact: true }));
  await page.getByLabel("대응이 필요한 상황").fill("대기열이 표시선을 넘음");
  await page.getByLabel("대응 내용", { exact: true }).fill("입구 안내 인력 보강");
  await page.getByLabel("대응 담당자").fill("안내팀");
  await page.getByRole("button", { name: "현장 대응 추가" }).click();
  await page.getByRole("checkbox").check();
  await step("자료·준비");
  await page.getByLabel("행사 전체 예상 입장 건수 (건)", { exact: true }).fill("20000");
  await step("결정·현장 기록");
  await visible(page.getByText(/결정 이후 준비 정보가 바뀌었습니다/));
  await step("결과 비교");
  await page.getByLabel("행사 전체 실제 입장 건수 (건)", { exact: true }).fill("0");
  await visible(page.getByText(/실제 값과 출처·측정 방법을 모두 입력하면/));
  await page.getByLabel("실측 자료 출처").fill("입구 집계 기록");
  await page.getByLabel("측정 방법·누락·재입장 처리").fill("행사 전체 입장 건수·재입장 포함");
  await page.getByLabel("다음 축제에서 바꿀 점").fill("입구 집계 기준을 사전에 공유");
  await visible(page.getByText("계획 대비 -10,000건", { exact: true }));
  await page.reload();
  await step("보고·다음 회차");
  await visible(page.getByRole("heading", { name: "논산딸기축제 · 운영 연습 결과 보고서" }));
  mkdirSync("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/16-workspace-report-desktop.png", fullPage: true });
  const exportWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "작업 파일 내보내기" }).click();
  const exported = await exportWait;
  const data = readFileSync(await exported.path());
  const saved = JSON.parse(data.toString());
  assert.equal(saved.drafts[0].decisions[0].expected, 10000);
  assert.equal(saved.drafts[0].expected, 20000);
  assert.equal(saved.drafts[0].records[0].done, true);
  await page.getByRole("button", { name: "다음 회차 만들기" }).click();
  assert.equal(await page.getByLabel("시작일", { exact: true }).inputValue(), "");
  await step("결정·현장 기록");
  await visible(page.getByText(/아직 선택한 운영안이 없습니다/));
  await page.getByLabel("작업 파일 가져오기", { exact: true }).setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await visible(page.getByRole("alert").filter({ hasText: "지원하지 않거나 손상된 작업 파일" }));
  assert.equal(await page.getByLabel("작업 중인 회차").locator("option").count(), 2);
  await page.getByLabel("작업 파일 가져오기", { exact: true }).setInputFiles({ name: "saved.json", mimeType: "application/json", buffer: data });
  await page.getByRole("button", { name: "이 파일로 작업 목록 교체" }).click();
  assert.equal(await page.getByLabel("작업 중인 회차").locator("option").count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["자료·준비", "운영안 비교", "결정·현장 기록", "결과 비교", "보고·다음 회차"]) {
    await step(name);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: mobile overflow`);
  }
  await page.screenshot({ path: "output/playwright/17-workspace-report-mobile.png", fullPage: true });
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: "output/playwright/workspace-report.pdf", format: "A4", printBackground: true });
  await page.emulateMedia({ media: "screen" });
  const second = await page.context().newPage();
  await second.goto(`${base}/workspace`);
  await second.getByLabel("장소", { exact: true }).fill("다른 탭에서 수정한 장소");
  await visible(page.getByText(/다른 탭의 변경을 발견했습니다/));
  await second.close();
  assert.deepEqual(writes, [], "personal drafts must not send writes to the server");
  assert.deepEqual(errors, []);
  console.log("workspace e2e ok: public browser-only full journey, persistence, immutable decision, zero/missing, import/export, clone, mobile, print, tab conflict");
} finally { await browser.close(); }
