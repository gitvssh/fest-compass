// Derive product data from reviewed facts, never from today's mutable festival detail.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = p => JSON.parse(readFileSync(root + p, "utf8"));
const fixture = read("docs/research/evidence/2026-09-visualization-fixture.json");
const checks = read("docs/validation/evidence/2026-09-07-source-checks.json").sources;
const source = (id, publishedAt = null, note = "확인한 회차 자료에서 추출. 당시 공개본 재현은 아님") => {
  const s = checks.find(s => s.id === id);
  if (!s?.sha256) throw new Error(`Missing reviewed source ${id}`);
  return { title: s.title, url: s.url, checkedAt: s.checkedAt, publishedAt, sha256: s.sha256, note };
};
const costSource = { title: "2025 논산딸기축제 주 무대설치 및 행사운영 용역 공고 · 2쪽", url: "https://www.nonsan.go.kr/cntf/html/sub05/0503.html?dlgt=N&file_id=184487&mode=D&no=2a5451006dff034d8a709772015d9b8d", checkedAt: "2026-09-08", publishedAt: "2025-02-17", sha256: "005a296055f006f0b2c4784212f9897cfcdfef6f33a860f1f9811c748901a1b4", note: "일부 무대·운영 용역의 입찰 기초금액. 전체 예산·계약·집행 아님" };
const editions = fixture.nonsan.map((e, i) => ({
  id: e.edition, festivalId: "nonsan-strawberry", name: "논산딸기축제", year: e.year,
  region: { province: "44", district: "230", name: "충청남도 논산시" }, origin: "archive", start: e.eventStart, end: e.eventEnd,
  status: i === 2 ? "일부 프로그램 변경" : "사후 발표 확인", statusNote: i === 2 ? "산불로 일부 체험 축소를 사후 기사에서 확인. 변경 당시 공지 시각은 미확인" : "논산시 사후 발표의 일정. 입장 계수·중복 제거 원자료 미확보",
  themes: ["농특산물"], address: "장소별 사용 조건 미확인", source: i === 2 ? costSource : source(`N${i + 1}`, i ? "2024-03-25" : "2023-03-13"),
  visits: { metric: "시군구 일별 외지인 방문", unit: "명 (통신 기반 추정)", method: "KTO-locgoRegnVisitrDDList-touDivCd2", regionCode: "44230", source: { title: "한국관광공사 지역별 방문자", url: fixture.historySource.url, checkedAt: fixture.historySource.collectedAt, publishedAt: null, sha256: fixture.historySource.sha256, note: "보관본에서 추출한 값. 행사장 입장객·축제 효과가 아님" }, snapshotId: fixture.historySource.snapshotId, collectedAt: fixture.historySource.collectedAt, points: e.points.map(p => ({ date: p.date, value: p.value })) },
  costs: i === 2 ? [{ id: "nonsan-2025-stage-tender", label: "주 무대·행사운영 용역 기초금액", amount: 110000000, unit: "KRW", year: 2025, stage: "입찰 기초", scopeId: "nonsan-2025-stage", scope: "주 무대설치 및 행사운영 일부 용역", department: "논산문화관광재단", vat: "포함", source: costSource, parts: null, complete: false }] : [],
  missing: ["행사장 입장 계수 원자료", "전체 축제 예산·결산", "시간별 혼잡"],
}));
editions[2].statusSource = source("N3", "2025-04-07", "공식 홈페이지의 언론 재게시. 사후 변경 설명이며 독립적인 원자료 검증은 아님");
for (const [i, year, start, end] of [[1, 2023, "10-06", "10-09"], [2, 2024, "10-03", "10-06"], [3, 2025, "10-08", "10-12"]]) editions.push({
  id: `imsil-cheese-${year}`, festivalId: "imsil-cheese", name: "임실N치즈축제", year, region: { province: "52", district: "750", name: "전북특별자치도 임실군" }, origin: "archive", start: `${year}-${start}`, end: `${year}-${end}`, status: "회차 일정 확인", statusNote: "제전위원회 연도별 홈페이지. 결과·취소 여부의 독립 검증은 미확인. 2023년 지역명·코드 개편 전후 이력은 별도 확인", themes: ["농특산물"], address: "장소별 사용 조건 미확인", source: source(`I${i}`), visits: null, costs: [], missing: ["연속 일별 방문 이력", "정의가 확인된 입장객", "전체 예산·결산"]
});
editions.push({ id: "baekje-gongju-2024", festivalId: "baekje-gongju", name: "백제문화제 · 공주", year: 2024, region: { province: "44", district: "150", name: "충청남도 공주시" }, origin: "archive", start: "2024-09-28", end: "2024-10-06", status: "결산 공시 일정 확인", statusNote: "공주 지역 공개 자료. 부여 회차 또는 두 지역의 합계로 사용하지 않음", themes: ["역사문화"], address: "공주시 · 세부 장소 사용 조건 미확인", source: source("B3", null, "2025년 8월 결산 재정공시 PDF 97쪽(인쇄 91쪽). 공주 2024 회차. 파일명 날짜를 게시일로 간주하지 않음"), visits: null, costs: [], missing: ["연속 일별 방문 이력", "입장객 측정 방법", "공통 기준의 비용 수치"] });
const w = fixture.wonju, ws = { title: w.document, url: w.sourceUrl, checkedAt: w.checkedAt, publishedAt: w.publishedAt, sha256: "564013dab4ef2015b74c862d0ac1e194dcf17ff8a4bc3762796f7fb56336b105", note: "검사일 2022-09-30. 사업기간 8/10~31은 축제 개최기간이 아님. 잔액·이자 원문 '-'는 미확인" };
editions.push({ id: "wonju-peach-2022-21", festivalId: "wonju-peach", name: "치악산복숭아 축제", year: 2022, region: { province: "51", district: "130", name: "강원특별자치도 원주시" }, origin: "archive", start: null, end: null, status: "지원사업 정산 확인", statusNote: "제21회. 사업기간과 축제 개최일을 분리하며 개최일은 미확인. 검색 지역은 현행 목록에 대응", themes: ["농특산물"], address: "개최 장소 미확인", source: ws, visits: null, costs: ["plan", "actual"].map(kind => ({ id: `wonju-2022-${kind}`, label: kind === "plan" ? "지원사업 계획액" : "지원사업 집행액", amount: w[kind].total, unit: "KRW", year: 2022, stage: kind === "plan" ? "계획" : "정산 검사서 기재 집행", scopeId: "wonju-2022-peach-support", scope: "제21회 치악산복숭아 축제 지원사업 · 전체 축제 원가 아님", department: "원주시 로컬푸드과", vat: "미확인", source: ws, parts: [{ label: "보조금", amount: w[kind].grant }, { label: "자부담", amount: w[kind].self }], complete: true })), missing: ["축제 개최일", "연속 일별 방문 이력", "전체 축제 원가", "세금 포함 기준", "잔액·이자"] });
writeFileSync(new URL("../data/festival-editions.json", import.meta.url), JSON.stringify({ version: 1, reviewedAt: "2026-09-08", note: "선정·공개 사례 조사에서 연결한 8회차. 전국 과거 전수 목록이 아니며 현재 API로 덮어쓰지 않음", editions }, null, 2) + "\n");
console.log(`Built ${editions.length} reviewed editions with ${fixture.nonsan.reduce((n,e) => n + e.points.length, 0)} observed values`);
