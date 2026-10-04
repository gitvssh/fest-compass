---
id: ADR-0003
type: implementation-policy
status: Accepted
date: 2026-10-04
deciders: [owner]
supersedes: []
superseded_by: []
aliases: []
scope: product
---

# ADR-0003: 데이터랩 웹사이트에서 내려받은 자료를 공개 화면에 쓰지 않는다

## Context and Problem Statement

한국관광 데이터랩 웹사이트의 축제·지역 화면에서 사람이 내려받은 CSV(문화관광축제 연도별 방문자 추이, 축제 방문자 특성(성·연령·목적지 검색순위),
지역 방문자 수 추이)를 가공해 공개 화면에 보여 왔다. 2026-10-04 확인 결과 이 자료에는 공공누리 표시가 없고 “Copyright 한국관광공사. All Rights Reserved.”만 있으며,
한국관광공사 저작권 정책은 공공누리가 없는 자료를 쓰려면 담당자와 사전 협의하라고 한다
([검토](../research/2026-10-datalab-download-automation.md)). 공모전 일정상 협의를 기다릴 수 없다.

## Considered Options

1. 한국관광공사에 재이용 허락·일괄 제공을 문의하고 회신까지 화면을 유지한다.
2. 데이터랩 웹사이트 내려받기 자료를 쓰는 화면을 공개 서비스에서 뺀다.
3. 화면은 두고 자료만 다른 출처로 바꾼다(같은 자료를 주는 공식 API·파일이 없음).

## Decision Outcome

선택: 2. 2026-10-04 사용자 결정(“공모전 시간이 촉박하니 데이터랩은 안쓰는걸로 할게. 만약 화면 배포되었다면 제거하는걸로 진행해줘”).
데이터랩 웹사이트에서 내려받은 자료와 그 가공물은 공개 화면·API 응답·앱 묶음에 넣지 않는다.

뺀 것: `/compare/annual`(개최연도별 방문 흐름), `/compare/scale`(문화관광축제 방문 규모), 기존 축제 방문 흐름의 개최지 방문 구성 블록,
임실 방문자 특성(성·연령·목적지 검색순위와 두 회차 비교), 새 축제 방문 흐름의 지역 연간 추세, 이들의 생성 스크립트·가공 자료·시험.
옛 주소 두 개는 축제 비교(`/compare`)로 영구 이동한다.

유지: 공공데이터포털로 받는 한국관광공사 DataLabService API(`locgoRegnVisitrDDList`, 이용허락범위 제한 없음)로 만든
시군구 일별·월별 방문 흐름, TourAPI 등록 정보·관광자원과 그 표시. 이것들은 데이터랩 웹사이트 내려받기 자료가 아니다.

Y-statement: 재이용 허락이 없는 데이터랩 웹사이트 자료 때문에 공개 서비스가 저작권 위험을 지지 않도록, 그 자료를 쓰는 화면을 빼고
이용 제한이 없는 공식 API 자료만 남긴다. 그 대가로 축제 단위 현지인·외지인 구성과 방문 규모 순위, 임실 방문자 특성을 잃는다.

## Consequences

- 목적별 축제 찾기에서 2단계 설계의 방문 규모 화면이 빠지고, 유형 칩·소개 글 표시·전국 모든 축제 목록(TourAPI)은 남는다.
- 공개 저장소에 남아 있는 원본 내려받기 파일(`docs/research/imported/hkjin-plan-03`, `datalab-imsil-2023~2025`)의 처리는 별도 결정이다(이 기록은 화면·앱 범위).
- 다시 쓰려면 한국관광공사 허락을 받은 뒤 새 결정 기록으로 이 기록을 대체한다.

## Confirmation

- `/compare/annual`·`/compare/scale`은 308로 `/compare`에 이동하고, 홈·축제 비교·축제 검색·사이트맵에 연결이 없다(`scripts/festival-discovery-e2e.mjs`).
- 앱 코드에 `lib/datalab`·`datalab-*.json` 참조가 없다(`lib/existing/existing.test.ts`의 정적 검사).
- 공개 배포 뒤 옛 주소 이동과 화면 부재를 공개 검사로 확인한다([검수47](../validation/47-festival-discovery.md)).
