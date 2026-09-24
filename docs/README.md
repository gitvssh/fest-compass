---
class: Current
doc_class: current
doc_kind: map
authority: canonical
owner: pickDday
last_verified: 2026-09-23
summary: "pickDday의 제품 기준, 두 축제 흐름, 데이터 연결과 구현·검증 기록을 안내합니다."
---

# Documentation map

## 현재 기획 기준

- [관련 자료 검색·원문 연결](validation/36-related-material-search.md) — 축제·회차·지역·자원의 검색 연결 설계와 검수 상태
- [pickDday 이름·새 축제 흐름](validation/35-pickdday-new-festival.md) — 이번 구현·검증의 현재 상태와 실제 화면
- [기존 축제 개선 흐름](validation/34-existing-festival-journey.md) — 검색·과거 방문·관광자원·개최 시기 구현과 공개 확인
- [관광 의사결정 지원 기획 기준](product/planning-principles.md) — 2026-09-22 사용자 확정: 관광 활성화, 기존 축제 개선·새 축제 기획, 목적에 맞춘 공공데이터 활용, 선택적 사용자 기록. 이후 기획·설계는 이 기준을 우선하며 아래 구현·검증 이력과 구분한다.
- [현행 기능·문서·데이터 점검](review/2026-09-current-state.md) — 2026-09-22 코드 대조: 실제 화면·기록 조건·작업공간 연결과 다음 설계의 시작점
- [활용 데이터 현황](research/2026-09-data-inventory.md) — 앱 소비·보관 CSV·Foundry 실보유·공식 추가 후보, 기준일·단위·연결 제한
- [저장소 통합 보고](ops/repository-consolidation.md) — 2026-09-23 pick-d-day에서 최신 문서·시안과 데이터랩 원자료를 선별 통합. 연도별 방문 화면(`/compare/annual`, 26개 축제)은 공개 반영 완료. 이후 두 목적 흐름의 상태는 위 최신 검증 기록 참조
- [축제 담당자 인터뷰 질문지](research/festival-officer-interview.md) — 예정 질문. 아직 인터뷰하지 않음

## 올해 축제 기획 검수

- [검수 시작](review/2026-09-planning-review.md) — 문서·시안과 현재 기능의 차이, 읽는 순서
- [개정 기획서](sdlc/0-planning/product-plan.md)
- [요구사항·기능목록](sdlc/1-analysis/srs.md) · [자료 정의](sdlc/1-analysis/data-contract.md)
- [정보구조](sdlc/2-design/ia.md) · [화면 흐름](sdlc/2-design/flows.md) · [화면·와이어프레임](sdlc/2-design/screens.md)
- [인수 검증 계획](sdlc/3-testing/acceptance-plan.md)

## Product

- [실데이터 기반 고도화 계획](validation/00-plan.md) — 2026-09-07 사용자 승인 범위와 단계별 완료 기준
- [착수 시점 점검](validation/01-baseline.md) — 2026-09-07 당시 구현과 검증할 가설. 최신 현행은 위 9월 22일 점검을 따름
- [관광데이터 조사 도구](validation/02-data-profiling.md)
- [첫 실제 데이터 조사](validation/03-first-data-review.md) — 후보 3곳·28회 조회 결과와 한계
- [WSL 이전 검증](validation/04-wsl-validation.md)
- [샘플 축제 선정](validation/05-festival-selection.md) — 후보 3곳의 2023~2025 자료 비교, 논산 선정
- [예측 지표·평가 계약](validation/06-forecast-contract.md) — 일별 외지인 추세, 발행시점·정답·검증 범위
- [샘플 선정 변경 검증](validation/07-selection-validation.md)
- [첫 예측 모델 실험 설계](validation/08-model-experiment.md) — 학습 입력·시간 분리·선정 규칙
- [첫 모델 결과·검증](validation/09-model-validation.md) — 1,096일 수집, 실제 오차와 한계, 재현 명령
- [최신 자료·사전 예측 기록](validation/10-prospective-records.md) — 2026년 누락, 시점별 보존·발행·사후 비교·재수집 절차
- [매일 수집·결과 확인 연결](validation/11-daily-automation.md) — 운영 배포·첫 실제 실행·공개 화면 검증
- [축제·공휴일 모델 평가 계획](validation/12-calendar-model-plan.md) — 공식 일정 근거·향후 시험·개발할 입력
- [자동 처리 운영 절차](ops/forecast-automation.md) — 일정·호출 상한·중복 방지·실패·저장공간 점검
- [프로젝트 실행 상태](../.ai/projects/fest-compass-evolution/STATE.md)

- [Vision and scope](product/vision-scope.md)
- [Non-goals](product/non-goals.md)

## Design

- [Design index](design/00_INDEX.md) — canonical entry point for use cases, flows, screens, calculations, and API contracts
- [MVP review](2026-08-30_기획_데이터_MVP_점검리포트.md) — dated review evidence, not a replacement for current design

## Operations

- [WSL 개발환경](ops/wsl-development.md)

- [Analytics and search connection runbook](ops/seo-analytics-connection.md) — the console steps that remain after deployment; the app carries no measurement or consent-purpose ID

## Decisions

- [Decision index](decisions/README.md)
- [ADR-0001: public production safety boundary](decisions/0001-public-readonly-sqlite-boundary.md)
- [ADR-0002: homelab delivery ownership](decisions/0002-homelab-delivery-ownership.md)

When prose conflicts, executable tests and rendered deployment declarations win, followed by accepted decisions and the design index.
