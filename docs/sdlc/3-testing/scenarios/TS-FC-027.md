---
class: Current
owner: pickDday
last_verified: 2026-10-05
id: TS-FC-027
version: v1
status: active
summary: "데이터랩 지역 4곳(논산·공주·원주·대구 달서구)의 해마다 관광소비·외지인 방문 카드와 새 축제 연도별 방문 합계 연결의 인수 기준입니다."
usecase: null
covers_ac: ["T1", "T2", "T3", "T4", "T5"]
apis: ["/api/datalab/festival", "/api/new/visits"]
specs: []
---

# TS-FC-027 · 해마다 합계만 있는 지역 카드

[설계30](../../../design/30-datalab-region-trends.md)의 인수 기준이다. 실행 결과는 [검수52](../../../validation/52-datalab-region-trends.md)에 기록한다.
자동 시험은 `scripts/datalab-region-trends.test.mjs`(생성), `lib/datalab/region-trends.test.ts`·`lib/new-festival/new-festival.test.ts`(읽기·응답),
`scripts/annual-trend-e2e.mjs`·`new-festival-e2e.mjs`·`visitor-context-e2e.mjs`(화면)다.

| 기준 | 확인할 결과 | 수단 |
|---|---|---|
| T1 | 공식 ZIP 9개가 소유자 목록의 SHA-256과 같고 풀어 둔 CSV 20개가 ZIP 항목·목록 해시·행 수와 같다. 목록 밖 파일·바뀐 바이트·사용 표시 변경이 있으면 생성이 멈춘다 | 생성 단위 |
| T2 | 관광소비는 해마다 업종 합 = 전체, 내국인 = 현지인 + 외지인. 외지인 방문은 2019부터 빈 해 없이, 전년 값·증감률이 앞 행과 맞는다. 논산·공주 2023~2025 값은 일별 외지인의 연간 합계와 같다 | 생성 단위 |
| T3 | 축제는 목적지 순위로 정한 지역이 검토표 지역과 같을 때만 잇고, 처음 26곳 지역과 겹쳐 잇지 않는다. 논산딸기·강경젓갈 → 논산, 대구치맥 → 달서구 | 생성·읽기 단위 |
| T4 | 축제별 방문 자료의 개최지 카드: 요약 줄(외지인·현지인 비율, 최근 해 외지인과 전년 대비), 해마다 막대·업종 비율·표, 기준 팝업. 같은 시도 순위·읍면동은 보이지 않는다. 응답에 경로·해시가 없다 | 읽기 단위, headless |
| T5 | 새 축제 방문 흐름: 4곳은 연도별 방문 합계에 외지인만(현지인·내국인 전체 열 없음), 아래 관광 소비 카드만. 처음 26곳(임실)은 그대로, 자료 없는 지역(종로)은 카드 없음 | 응답 단위, headless |
