---
class: Current
owner: pickDday
last_verified: 2026-10-05
id: TS-FC-026
version: v1
status: active
summary: "데이터랩 문화관광축제 92곳 확장(원본 보관·축제 지역 표시·고른 축제만 받기·시도별 순위·논산딸기축제 연결)의 인수 기준입니다."
usecase: null
covers_ac: ["N1", "N2", "N3", "N4", "N5", "N6", "N7"]
apis: ["/api/datalab/festival"]
specs: []
---

# TS-FC-026 · 데이터랩 문화관광축제 92곳

[설계29](../../../design/29-datalab-festivals-92.md)의 인수 기준이다. 실행 결과는 [검수51](../../../validation/51-datalab-festivals-92.md)에 기록한다.
자동 시험은 `scripts/datalab-festival-trend.test.mjs`·`datalab-festival-profiles.test.mjs`·`datalab-region-profiles.test.mjs`(생성),
`lib/datalab/*.test.ts`(읽기), `scripts/annual-trend-e2e.mjs`·`festival-discovery-e2e.mjs`·`visitor-context-e2e.mjs`(화면)다.

| 기준 | 확인할 결과 | 수단 |
|---|---|---|
| N1 | 공식 ZIP 92개가 소유자 목록의 SHA-256과 같고, 풀어 둔 CSV 367개가 ZIP 항목과 바이트까지 같으며, 목록 밖 파일·바뀐 바이트·바뀐 목록이 있으면 생성이 멈춘다. 처음 가져오기와 겹치는 26곳 표는 같거나(101) 같은 순위 안 순서만 다르다(3) | 생성 단위 |
| N2 | 축제 92곳·447개 연도 행. 처음 26곳의 값은 바뀌지 않는다. 방문 추이가 없는 해는 방문 지표가 0이어야 하며 보이지 않고, 값이 1을 넘는 해는 그해 비교 전체를 빼고 이유를 적는다. 목적지 순위가 없는 세종축제는 그렇다고 적는다 | 생성·읽기 단위, headless |
| N3 | 지역 표시는 목적지 순위 주소의 시도·시군구(10% 이상)이고 순위 없는 축제만 검토 값이다. 축제 찾기는 이름·별칭·지역으로 찾는다(`논산` → 2곳) | 생성·읽기 단위, headless |
| N4 | 축제별 방문 자료의 첫 화면에는 모든 축제의 이름·지역·연도 수만 있고, 축제를 고르면 그 축제 자료만 받는다. 공유 주소의 축제는 화면과 함께 온다. 받기 실패는 그 이름의 다시 불러오기로 회복한다. 응답에 경로·해시가 없다 | 읽기 단위, headless |
| N5 | 방문 규모는 상위 20곳과 모두 보기, 시도별 순위(주소 `province`, 새로고침 복원, 모르는 값은 전국), 접힌 `자료 없음 N곳`. 순서·값은 원문과 같다 | 읽기 단위, headless |
| N6 | 기존 축제 방문 흐름에서 논산딸기축제 2024·2025 회차는 개최지 방문 구성을 보이고(원문 CSV 값), 2023 회차는 보이지 않는다. 공주는 계속 없다 | 단위, headless |
| N7 | 대구약령시한방문화축제·평창효석문화제는 개최 행정동이 받은 지역 읍면동에 있어 지역 카드가 이어지고, 그 조건이 깨지면 생성이 멈춘다 | 생성 단위, headless |
