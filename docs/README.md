---
class: Current
doc_class: current
doc_kind: map
authority: canonical
owner: fest-compass
last_verified: 2026-09-07
---

# Documentation map

## Product

- [실데이터 기반 고도화 계획](validation/00-plan.md) — 2026-09-07 사용자 승인 범위와 단계별 완료 기준
- [착수 시점 점검](validation/01-baseline.md) — 현재 구현과 검증할 가설
- [관광데이터 조사 도구](validation/02-data-profiling.md)
- [첫 실제 데이터 조사](validation/03-first-data-review.md) — 후보 3곳·28회 조회 결과와 한계
- [WSL 이전 검증](validation/04-wsl-validation.md)
- [샘플 축제 선정](validation/05-festival-selection.md) — 후보 3곳의 2023~2025 자료 비교, 논산 선정
- [예측 지표·평가 계약](validation/06-forecast-contract.md) — 일별 외지인 추세, 발행시점·정답·검증 범위
- [샘플 선정 변경 검증](validation/07-selection-validation.md)
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
