---
schema_version: 1
project_id: fest-compass-evolution
revision: 8
status: active
next_actor: codex
last_actor: codex
current_question: "현재/직전 복구 이미지를 보존하고 docs/ops/forecast-history-release.md의 미사용 이미지 4개 정리와 기존 매일 자동 정리 정책 연결을 승인할지 사용자 답변이 필요하다."
updated_at: "2026-09-07T13:37:39.042Z"
---

# Current state

## Summary

2022년 방문 이력 365일을 확보해 총 1,681일로 보강했고, 2023년 축제 정답 5일까지 학습했다. 기존 결합 모델 대비 공통 날짜 MAE는 3.7~5.7% 감소했지만 2025·2026년 축제일은 악화됐다. /forecast/history 구현·전체 재계산·120개 테스트·E2E와 main 게시 완료. Harbor 1GiB 한도 초과로 이미지 push가 실패해 새 화면은 운영 반영 대기다. 현재/복구본을 보존한 구 이미지 4개 정리·선언된 자동 정리 연결 승인을 요청했다. 기존 겨울 시험·운영 예측은 정상이며 7단계 전체는 진행 중이다.

## Accepted decisions

- 공모전 완성도와 실무 활용성을 같은 비중으로 추진한다(2026-09-07 사용자 확인).
- 과거·현재·향후 예측·운영 결정·결과 기록·장기 재사용을 연결하고 실제 축제 한 곳으로 샘플을 구현한다(2026-09-07 사용자 확인).
- 승인된 7단계 계획에 따라 개발·필수 검증·일반 Git 게시를 진행한다(사용자 개발 착수 요청 및 저장소 게시 규약).
- 2026-09-07 사용자의 후보 비교·샘플 및 지표 선정 요청 범위에서 논산딸기축제를 개발 샘플로 선정한다. 2025 사례·2023~2024 비교를 사용하고 1차 예측 대상은 논산시 일별 외지인 방문 추세다(docs/validation/05~06). 축제 입장객·시간대별 혼잡과 구분한다.
- 2026-09-07 사용자가 과거 이력 기반 예측 모델 개발을 확인하고 후속 진행을 요청했다. 연속 자료 수집·실제 모델 학습·기준 비교·읽기 전용 실험 화면을 구현했다(docs/validation/08~09).
- 2026-09-07 추가 후속 진행 요청의 개발 범위에서 2026년 수집본·시점별 보존·일반 날짜 사전 예측 발행·사후 비교 기능을 구현했다(docs/validation/10).
- 2026-09-07 사용자의 다음 단계 개발 요청과 일반 게시·등록 앱 sync 위임 범위에서 매일 수집·발행·결과 확인을 기존 운영 서비스에 연결했다. 공휴일/축제 자료와 향후 평가 계획을 정리하되 v1 설정·기존 예측은 유지한다(docs/validation/11~12).
- 2026-09-07 사용자의 후속 진행 요청과 개발·일반 게시 위임 범위에서 공식 달력 15개 근거를 검증하고 네 후보를 학습했다. 공휴일 모델을 겨울 사전 시험 후보, v1을 비교 기준으로 선정해 26건을 운영 등록했다. 개발 성능을 향후 검증으로 간주하거나 기존 v1 발행을 바꾸지 않는다(docs/validation/13).
- 2026-09-07 사용자의 계속 개발 요청 범위에서 2022년 선행 이력 수집·2023년 회차 학습·동일 날짜 및 2023년 제외 비교를 구현했다. 2022년 비대면 중심 행사를 현장 축제 정답으로 합치지 않으며 기존 겨울 시험·운영 입력은 유지한다(docs/validation/14). 이미지 삭제·정리 스케줄 활성화는 아직 승인받지 않았다.

## Open questions

- 운영 배포만 이미지 정리 승인 대기다. main 소스 6dce3c6의 CI 34126770861은 검증 통과 후 Harbor 1GiB quota 초과로 push 실패했다. 실제 retention ID null이며 docs/ops/forecast-history-release.md의 current/rollback 2개 보존·구 artifact 4개 정리·선언된 매일 정책 연결을 사용자에게 요청했다. 응답 전 삭제·스케줄 활성화·quota 증액을 실행하지 않는다. 승인 시 exact 목록 재확인→scoped plan/apply/dry-run/execute→동일 CI 재실행→검증 digest 게시/sync/공개 확인까지 재개한다.
- 겨울 시험은 2026-11-05~2027-01-31 목~일 13개 창, D-28/D-7 26건이 등록됐다. 첫 발행 10/8, 첫 60일 결과 2027-01-04, 마지막 60일/90일 결과 4/1·5/1이다. 실제 발행·결과 도착을 확인해야 하며 고정 계획을 뒤늦게 바꾸지 않는다.
- 2023년 축제 누락은 2022년 선행 자료로 보완했다. 평균 개선은 2024년에 집중됐고 2025·2026년 축제일 MAE는 악화됐다. 다음 독립 작업은 회차별 기간·요일·발표 시점·방문 형태에 따른 오차 원인과 비교 가능한 축제 표본의 제공 범위를 검토하는 것이다. 새 회차 예측력·현장 효과는 미검증이다.
- 매일 09시 실제 제공 전환·개정·장기 저장량을 계속 확인한다. 최신 관측은 2026-08-08, 이후 29일 누락이며 실제 공개 지연은 미확정이다.
- 기존 9월·10월 예측 2건은 사후 관측 0일이다. 9/28의 10월 D-7은 미래 발행이다. 80% 구간 보정·포함률 검증은 별도의 뒤쪽 기간이 필요하다.
- 2027년 딸기산업엑스포의 24일 일정은 공식 본문으로 확인했지만 기존 4일 축제와 다른 대상이다. 최신 변경·행사 동일성·별도 발행 및 평가 계약을 정하기 전 자동 등록하지 않는다.
- 소비 강도·자원 수요의 다월 empty 원인과 제공 범위, 제출일·가용시간·실무자 연결, 행사장 일별/시간별 계수·셔틀 119대 집계 단위·운행/대기/비용 자료는 미확보이며 운영 효과 검증에 필요하다.

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
- docs/validation/13-calendar-experiment.md
- docs/validation/evidence/2026-09-07-nonsan-calendar.json.gz
- docs/validation/evidence/2026-09-07-calendar-production.json
- apps/web/data/nonsan-calendar.json
- apps/web/data/nonsan-calendar-summary.json
- apps/web/data/calendar-trial-plan.json
- docs/validation/14-festival-history.md
- docs/validation/evidence/2026-09-07-nonsan-2022-history.json
- docs/validation/evidence/2026-09-07-nonsan-festival-history.json.gz
- apps/web/data/nonsan-festival-history-summary.json
- apps/web/data/nonsan-history-sources.json
- docs/ops/forecast-history-release.md
- docs/validation/evidence/2026-09-07-festival-history-release.json
