import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import prospectiveSummary from "../data/nonsan-prospective-summary.json" with { type: "json" };
import calendarSummary from "../data/nonsan-calendar-summary.json" with { type: "json" };
import historySummary from "../data/nonsan-festival-history-summary.json" with { type: "json" };

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "output", "playwright");
mkdirSync(outputDir, { recursive: true });

// Playwright's bundled Chromium, not a system channel such as `msedge`, so the
// suite runs the same way on every platform a clone lands on. `pretest:e2e`
// downloads it on demand and is a no-op once it is present.
const browser = await chromium.launch({ headless: true });
const browserErrors = [];

function attachDiagnostics(page, label) {
  page.on("pageerror", (error) => browserErrors.push(`${label} pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      browserErrors.push(`${label} console: ${message.text()} · ${location.url || "unknown URL"}:${location.lineNumber}`);
    }
  });
}

async function expectVisible(locator, message) {
  await locator.first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => {
    throw new Error(message);
  });
}

async function shot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(outputDir, `${name}.png`), fullPage: true });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachDiagnostics(page, "desktop");

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await expectVisible(page.getByText("○○군 봄꽃축제"), "home missing seed festival");
  await expectVisible(page.getByText("L1 총계 실측"), "home missing label maturity badge");
  await shot(page, "01-home-desktop");

  await page.getByRole("link", { name: /논산딸기축제 방문 추세 비교/ }).click();
  await page.waitForURL("**/forecast");
  await expectVisible(page.getByRole("heading", { name: "논산딸기축제 방문 추세 예측" }), "forecast sample missing");
  await expectVisible(page.getByText("실험 결과 사용 가능 · 축제 운영 적용은 검증 필요"), "forecast limitations missing");
  await expectVisible(page.getByText(/마지막 입력 관측일 2025-01-23/), "forecast as-of cutoff missing");
  await page.getByLabel("예측을 준비하는 시점").selectOption("7");
  await page.getByRole("button", { name: "비교 보기" }).click();
  await page.waitForURL("**/forecast?horizon=7&lag=35");
  await expectVisible(page.getByText(/마지막 입력 관측일 2025-02-13/), "forecast horizon did not change inputs");
  await expectVisible(page.getByRole("img", { name: /지역 방문 추세/ }), "forecast comparison chart missing");
  await shot(page, "08-forecast-desktop");
  await page.getByRole("link", { name: "수집 자료와 사전 예측 기록 →" }).click();
  await page.waitForURL("**/forecast/records");
  await expectVisible(page.getByRole("heading", { name: "수집 자료와 사전 예측 기록", exact: true }), "prospective records missing");
  const { coverage } = prospectiveSummary.monitor;
  await expectVisible(page.getByText(coverage.latestObservation, { exact: true }), "latest actual data date missing");
  await expectVisible(page.getByText(`${coverage.missingDates.length}일`, { exact: true }), "missing dates disguised as zero");
  if (prospectiveSummary.records.some((r) => r.assessment?.rows.some((row) => row.status === "not-yet-occurred"))) {
    await expectVisible(page.getByText("대상일 전", { exact: true }), "future targets presented as scored outcomes");
  }
  await page.getByText("누락 날짜와 수집 시각", { exact: true }).click();
  await expectVisible(page.getByText(`누락: ${coverage.missingDates.length ? coverage.missingDates.join(", ") : "없음"}`, { exact: true }), "missing-date details inaccessible");
  await page.getByText("발행 당시 자료·모델 확인", { exact: true }).first().click();
  await expectVisible(page.getByText(/모델: nonsan-direct-ridge-v1/), "immutable model reference missing");
  await shot(page, "10-prospective-desktop");
  await page.getByRole("link", { name: "공휴일·축제 모델 비교와 겨울 시험 →" }).click();
  await page.waitForURL("**/forecast/calendar");
  await expectVisible(page.getByRole("heading", { name: "공휴일과 축제를 반영하면 예측이 나아질까?" }), "calendar model comparison missing");
  const improvement = (h) => `${(calendarSummary.runs.find((r) => r.horizonDays === h).selection.relativeMAEImprovement * 100).toFixed(1)}%`;
  await expectVisible(page.getByText(improvement(28), { exact: true }), "D-28 calendar improvement differs from evidence");
  await page.getByRole("link", { name: "시작 7일 전 예측", exact: true }).click();
  await page.waitForURL("**/forecast/calendar?horizon=7");
  await expectVisible(page.getByText(improvement(7), { exact: true }), "D-7 calendar comparison did not change");
  await expectVisible(page.getByText(/발행 0\/26건/), "future trial falsely presented as issued");
  await page.getByText("7일 전 발행 일정과 저장 결과", { exact: true }).click();
  await expectVisible(page.getByText("2026-11-05 시작 · 2026-10-29 발행 · 발행 예정", { exact: true }), "future issuance dates missing");
  await shot(page, "12-calendar-desktop");
  await page.getByRole("link", { name: "2022년 이력을 보강한 축제 예측 비교 →" }).click();
  await page.waitForURL("**/forecast/history");
  await expectVisible(page.getByRole("heading", { name: "축제 이력을 보강한 예측 비교", exact: true }), "history study missing");
  const historyImprovement = (h) => { const m = historySummary.runs.find((r) => r.horizonDays === h).comparison.methods;
    return `${((1 - m.extended.mae / m.original.mae) * 100).toFixed(1)}%`; };
  await expectVisible(page.getByText(historyImprovement(28), { exact: true }), "D-28 history comparison differs from evidence");
  await page.getByRole("link", { name: "시작 7일 전 예측", exact: true }).click();
  await page.waitForURL("**/forecast/history?horizon=7");
  await expectVisible(page.getByText(historyImprovement(7), { exact: true }), "D-7 history comparison did not change");
  await expectVisible(page.getByText("2024년 개선, 2025·2026년 축제일 악화", { exact: true }), "later festival degradation hidden");
  await expectVisible(page.getByRole("cell", { name: "13일", exact: true }), "added festival training labels missing");
  if (await page.getByRole("cell", { name: "오차 증가", exact: true }).count() !== 2) throw new Error("history study must show both degraded editions");
  await shot(page, "14-history-desktop");
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

  await page.getByRole("link", { name: "○○군 봄꽃축제" }).click();
  await page.waitForURL("**/evidence");
  const originalEvidenceUrl = page.url();
  const originalFestivalPath = new URL(originalEvidenceUrl).pathname.replace(/\/evidence$/, "");
  await expectVisible(page.getByText("행사장 입장객이 아닙니다"), "evidence missing visitor guardrail");
  await expectVisible(page.getByText("출처: 담당자 직접 입력"), "manual provenance is not explicit");
  await expectVisible(page.getByRole("columnheader", { name: "구간" }), "evidence missing visitor window column");
  await expectVisible(page.getByText("연관 관광지"), "evidence missing related-place section");
  if (await page.getByText("예측 정확도").count()) throw new Error("forbidden phrase on evidence");

  await page.getByLabel("최소", { exact: true }).fill("9000");
  await page.getByLabel("기준", { exact: true }).fill("7000");
  await page.getByLabel("최대", { exact: true }).fill("8000");
  await page.getByRole("button", { name: /가정 세트 v\d+ 저장/ }).click();
  await expectVisible(page.getByText("최소 ≤ 기준 ≤ 최대 순서여야 합니다.").first(), "assumption order error missing");
  if ((await page.locator('input[name="inflowMin"]').inputValue()) !== "9000") {
    throw new Error("invalid assumption input was not retained");
  }

  await page.getByLabel("승인 수용량(명)").fill("-1");
  await page.getByRole("button", { name: "수용량 저장" }).click();
  await expectVisible(
    page.getByText("승인 수용량은 비워 두거나 0보다 커야 합니다."),
    "capacity validation error missing",
  );
  if ((await page.locator('input[name="approvedCapacity"]').inputValue()) !== "-1") {
    throw new Error("invalid capacity input was not retained");
  }
  await shot(page, "02-evidence-validation-desktop");

  await page.getByRole("link", { name: "시나리오" }).click();
  await page.waitForURL("**/scenarios");
  await expectVisible(
    page.getByRole("heading", { name: "운영자원 × 유입 가정 매트릭스" }),
    "scenario matrix missing",
  );
  await expectVisible(page.getByText(/구역 .* ·/).first(), "scenario zone is not shown");
  const expandedCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "확대안" }) });
  await expandedCard.getByRole("button", { name: "이 안으로 결정" }).click();
  await expectVisible(page.getByText("운영안 결정을 기록했습니다."), "decision success feedback missing");
  await expectVisible(page.getByRole("heading", { name: "기록된 결정" }), "decision not recorded");
  await shot(page, "03-scenarios-desktop");

  await page.getByRole("link", { name: "결정·성과" }).click();
  await page.waitForURL("**/ledger");
  await expectVisible(page.getByRole("heading", { name: "대응 트리거" }), "ledger missing trigger section");
  await expectVisible(page.getByText("우회 동선 개방"), "ledger missing seeded field action");

  const outcomeForm = page.locator("form").filter({ has: page.getByRole("button", { name: "실측 추가" }) });
  await outcomeForm.locator('input[name="metric"]').fill("시간대 유입 실측");
  await outcomeForm.locator('input[name="actualValue"]').fill("420");
  await outcomeForm.locator('input[name="unit"]').fill("명");
  await outcomeForm.locator('input[name="source"]').fill("현장 계수기");
  await outcomeForm.locator('input[name="measureMethod"]').fill("게이트 수기 집계");
  await outcomeForm.locator('input[name="bucketLabel"]').fill("13:00–14:00");
  await outcomeForm.locator('select[name="granularity"]').selectOption("hourly");
  await outcomeForm.getByRole("button", { name: "실측 추가" }).click();
  await expectVisible(page.getByText("실측값을 기록했습니다."), "outcome success feedback missing");
  await expectVisible(page.getByRole("heading", { name: "피크 시간대·구역 실측" }), "L2 reproduction section missing");
  await expectVisible(page.getByText("피크 시간대", { exact: true }), "peak-hour badge missing");
  await expectVisible(page.getByText("13:00–14:00"), "outcome bucket is not reproduced");
  await shot(page, "04-ledger-l2-desktop");

  await page.getByRole("link", { name: "사후보고서 보기" }).click();
  await page.waitForURL("**/report");
  await expectVisible(
    page.getByText("계산 결과는 아래 입력 스냅샷과 공식으로 재현할 수 있습니다."),
    "report reproducibility copy missing",
  );
  await expectVisible(page.getByText("13:00–14:00"), "report missing granular outcome bucket");
  await expectVisible(page.getByText(/최대 유입 기준 점유율/), "report missing maximum-inflow result");
  await expectVisible(page.getByRole("button", { name: "인쇄·PDF 저장" }), "report missing print action");
  await shot(page, "05-report-desktop");

  await page.getByRole("link", { name: "결정·성과" }).click();
  await page.getByRole("button", { name: "다음 행사로 복제" }).click();
  await page.waitForURL("**/evidence", { timeout: 15_000 });
  await expectVisible(page.getByRole("heading", { name: /2027/ }), "clone did not open next-year workspace");
  await expectVisible(page.getByText("이전 행사 원장에서 복제된 담당자 입력"), "clone provenance is not explicit");
  await expectVisible(page.getByText("가정 세트 v1 저장됨"), "clone did not reset assumption version");
  await expectVisible(page.getByText("L0 · 라벨 없음"), "clone did not reset label maturity");

  await page.getByRole("link", { name: "호출 로그" }).click();
  await page.waitForURL("**/logs");
  await expectVisible(page.getByText("seed-placeholder"), "logs missing seed row");
  await expectVisible(page.getByRole("columnheader", { name: "소요" }), "logs missing duration column");
  for (const label of ["전체", "정상", "빈결과", "오류"]) {
    await expectVisible(page.getByRole("link", { name: label, exact: true }), `logs missing ${label} filter`);
  }
  await shot(page, "06-logs-desktop");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  attachDiagnostics(mobile, "mobile");
  for (const [name, route] of [
    ["home", "/"],
    ["evidence", `${originalFestivalPath}/evidence`],
    ["scenarios", `${originalFestivalPath}/scenarios`],
    ["ledger", `${originalFestivalPath}/ledger`],
    ["report", `${originalFestivalPath}/report`],
    ["logs", "/logs"],
    ["forecast", "/forecast"],
    ["prospective", "/forecast/records"],
    ["calendar", "/forecast/calendar"],
    ["history", "/forecast/history"],
  ]) {
    await mobile.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    const dimensions = await mobile.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    if (dimensions.scrollWidth > dimensions.innerWidth + 1) {
      throw new Error(`${name} mobile document overflow: ${dimensions.scrollWidth}px > ${dimensions.innerWidth}px`);
    }
  }
  await mobile.goto(`${baseUrl}${originalFestivalPath}/report`, { waitUntil: "networkidle" });
  await shot(mobile, "07-report-mobile");
  await mobile.goto(`${baseUrl}/forecast`, { waitUntil: "networkidle" });
  await shot(mobile, "09-forecast-mobile");
  await mobile.goto(`${baseUrl}/forecast/records`, { waitUntil: "networkidle" });
  await shot(mobile, "11-prospective-mobile");
  await mobile.goto(`${baseUrl}/forecast/calendar?horizon=7`, { waitUntil: "networkidle" });
  await shot(mobile, "13-calendar-mobile");
  await mobile.goto(`${baseUrl}/forecast/history?horizon=7`, { waitUntil: "networkidle" });
  await shot(mobile, "15-history-mobile");
  await mobile.close();

  if (browserErrors.length) throw new Error(`browser diagnostics failed:\n${browserErrors.join("\n")}`);
  console.log(`e2e ok: ${baseUrl}`);
} finally {
  await browser.close();
}
