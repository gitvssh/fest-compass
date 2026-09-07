---
schema_version: 1
project_id: fest-compass-evolution
revision: 6
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-07T11:26:28.881Z"
---

# Current state

## Summary

매일 09시 논산 자료 수집·사전 발행·사후 확인을 운영 서비스에 연결했다. 첫 7회 조회와 공개 /forecast/records의 실제 요약 갱신을 확인했으며 1,316일·누락 29일·기존 예측 2건을 보존했다. 다음은 공식 전체 달력 입력 검증과 축제/공휴일 모델 후보 개발, 10/8 이전 향후 시험 등록이다. 2027년 24일 엑스포는 별도 대상 계약이 필요하다. 예측 결과 도착·현장 검증·7단계 전체는 진행 중이다.

## Accepted decisions

- 공모전 완성도와 실무 활용성을 같은 비중으로 추진한다(2026-09-07 사용자 확인).
- 과거·현재·향후 예측·운영 결정·결과 기록·장기 재사용을 연결하고 실제 축제 한 곳으로 샘플을 구현한다(2026-09-07 사용자 확인).
- 승인된 7단계 계획에 따라 개발·필수 검증·일반 Git 게시를 진행한다(사용자 개발 착수 요청 및 저장소 게시 규약).
- 2026-09-07 사용자의 후보 비교·샘플 및 지표 선정 요청 범위에서 논산딸기축제를 개발 샘플로 선정한다. 2025 사례·2023~2024 비교를 사용하고 1차 예측 대상은 논산시 일별 외지인 방문 추세다(docs/validation/05~06). 축제 입장객·시간대별 혼잡과 구분한다.
- 2026-09-07 사용자가 과거 이력 기반 예측 모델 개발을 확인하고 후속 진행을 요청했다. 연속 자료 수집·실제 모델 학습·기준 비교·읽기 전용 실험 화면을 구현했다(docs/validation/08~09).
- 2026-09-07 추가 후속 진행 요청의 개발 범위에서 2026년 수집본·시점별 보존·일반 날짜 사전 예측 발행·사후 비교 기능을 구현했다(docs/validation/10).
- 2026-09-07 사용자의 다음 단계 개발 요청과 일반 게시·등록 앱 sync 위임 범위에서 매일 수집·발행·결과 확인을 기존 운영 서비스에 연결했다. 공휴일/축제 자료와 향후 평가 계획을 정리하되 v1 설정·기존 예측은 유지한다(docs/validation/11~12).

## Open questions

- 자동 처리 첫 실행은 확인했다. 이후 매일 09시 실행·실제 제공 전환·개정·장기 저장량과 관측 결과 도착은 계속 확인해야 한다. 현재 최신 관측은 2026-08-08, 이후 29일 누락이며 공개 지연은 미확정이다.
- 축제/공휴일 효과 모델은 개발 필요다. 2023~2026 전체 달력과 당시 일정 근거를 검증하고 후보 개발·시간순 비교 후, 2026-10-08 전에 11/5~2027-01-31 목~일 13개 창의 사전 시험 코드를 고정·등록한다(docs/validation/12). 이미 본 2025/2026 관측을 새 미열람 시험으로 주장하지 않는다.
- 9월·10월 기존 예측 2건은 사후 관측 0일이다. 9월 28일의 10월 D-7은 등록됐지만 아직 미래 발행이다. 80% 구간 보정·포함률 재검증도 남아 있다.
- 2027년 딸기산업엑스포의 최신 공식 계획은 24일 행사다. 기존 1~4일 계약으로 자동 등록하지 않는다. 원문 확보·최신 일정 재확인·행사 동일성·별도 발행/평가 설계가 필요하다.
- 소비 강도·자원 수요의 기존 다월 empty 원인·제공 범위는 미확정이며 첫 모델 필수 입력에서 제외한다.
- 제출일·가용시간·실무자 연결, 행사장 일별/시간별 계수·셔틀 119대 집계 단위·운행/대기/비용 자료는 미확보이며 운영 효과 검증에 필요하다.

## Artifacts and durable documents

- docs/validation/00-plan.md
- docs/validation/01-baseline.md
- docs/validation/02-data-profiling.md
- docs/validation/03-first-data-review.md
- docs/validation/04-wsl-validation.md
- docs/validation/05-festival-selection.md
- docs/validation/06-forecast-contract.md
- docs/validation/07-selection-validation.md
- docs/validation/08-model-experiment.md
- docs/validation/09-model-validation.md
- docs/validation/10-prospective-records.md
- docs/validation/evidence/2026-09-07-nonsan-history.json
- docs/validation/evidence/2026-09-07-nonsan-current-history.json
- docs/validation/evidence/2026-09-07-nonsan-forecast.json.gz
- docs/validation/evidence/prospective/
- docs/validation/evidence/targets/
- apps/web/data/nonsan-forecast-summary.json
- apps/web/data/nonsan-prospective-summary.json
- docs/ops/wsl-development.md
- docs/validation/11-daily-automation.md
- docs/validation/12-calendar-model-plan.md
- docs/validation/evidence/2026-09-07-nonsan-daily-production.json
- docs/validation/evidence/2026-09-07-daily-production-result.json
- docs/ops/forecast-automation.md
- apps/web/data/forecast-plan.json
- apps/web/data/forecast-seed.json.gz
