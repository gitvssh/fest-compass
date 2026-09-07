---
schema_version: 1
project_id: fest-compass-evolution
revision: 5
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-07T09:54:50.693Z"
---

# Current state

## Summary

논산시 2023~2026-08-08의 1,316일을 확보했다. 기존 학습·평가 화면에 시점별 자료 보존·실제 사전 발행·사후 비교와 /forecast/records를 추가했다. 일반 날짜 2개 창의 예측은 저장됐으나 결과는 아직 없다. 다음은 예약 수집·결과 확인 연결, 축제/공휴일 효과 자료와 새 평가 계획, 다음 축제 회차 사전 발행이다. 현장 운영 적용과 7단계 전체는 진행 중이다.

## Accepted decisions

- 공모전 완성도와 실무 활용성을 같은 비중으로 추진한다(2026-09-07 사용자 확인).
- 과거·현재·향후 예측·운영 결정·결과 기록·장기 재사용을 연결하고 실제 축제 한 곳으로 샘플을 구현한다(2026-09-07 사용자 확인).
- 승인된 7단계 계획에 따라 개발·필수 검증·일반 Git 게시를 진행한다(사용자 개발 착수 요청 및 저장소 게시 규약).
- 2026-09-07 사용자의 후보 비교·샘플 및 지표 선정 요청 범위에서 논산딸기축제를 개발 샘플로 선정한다. 2025 사례·2023~2024 비교를 사용하고 1차 예측 대상은 논산시 일별 외지인 방문 추세다(docs/validation/05~06). 축제 입장객·시간대별 혼잡과 구분한다.
- 2026-09-07 사용자가 과거 이력 기반 예측 모델 개발을 확인하고 후속 진행을 요청했다. 연속 자료 수집·실제 모델 학습·기준 비교·읽기 전용 실험 화면을 구현했다(docs/validation/08~09).
- 2026-09-07 추가 후속 진행 요청의 개발 범위에서 2026년 수집본·시점별 보존·일반 날짜 사전 예측 발행·사후 비교 기능을 구현했다(docs/validation/10).

## Open questions

- 수집·발행·사후 비교 명령은 사용 가능하지만 예약 실행 환경은 미연결이다. 공개 화면은 보존된 요약이며 자동 갱신되지 않는다.
- 2026-08-09~09-06 29일이 정상 조회에서 누락됐다. 같은 날 겹친 31일은 변경 0건이며 공개 시각·장기 개정 이력·제공 전환은 계속 관찰해야 한다.
- 첫 모델의 축제 급증 과소예측·구간 포함률 부족은 남아 있다. 축제/공휴일 일정 근거와 새 평가 구간이 필요하다. 이미 열람한 2025년 및 2026년 수집·재학습 구간을 새 미열람 시험으로 주장하지 않는다.
- 9월 14~17일 D-7과 10월 5~8일 D-28은 일반 날짜 사전 검증이다. 10월 창의 D-7 발행일은 9월 28일이며 실제 날짜에 새 ID로 발행해야 한다. 다음 논산딸기축제 일정 근거와 해당 회차 발행 등록은 미확보다.
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
