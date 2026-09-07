---
schema_version: 1
project_id: fest-compass-evolution
revision: 4
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-07T09:17:59.427Z"
---

# Current state

## Summary

논산시 2023~2025 연속 자료 1,096일과 실제 학습 회귀 모델·시간순 평가·/forecast 비교 화면 구현 완료. 지역 추세 전체 오차는 개선됐지만 축제 급증·예측 범위는 미흡하다. 다음은 2026년/지속 수집과 공개 시점·개정 이력 보존, 축제 효과 자료 확보·새 평가 구간 설계, 향후 회차 사전 예측 발행이다. 운영 적용·현장 검증·7단계 전체는 진행 중이다.

## Accepted decisions

- 공모전 완성도와 실무 활용성을 같은 비중으로 추진한다(2026-09-07 사용자 확인).
- 과거·현재·향후 예측·운영 결정·결과 기록·장기 재사용을 연결하고 실제 축제 한 곳으로 샘플을 구현한다(2026-09-07 사용자 확인).
- 승인된 7단계 계획에 따라 개발·필수 검증·일반 Git 게시를 진행한다(사용자 개발 착수 요청 및 저장소 게시 규약).
- 2026-09-07 사용자의 후보 비교·샘플 및 지표 선정 요청 범위에서 논산딸기축제를 개발 샘플로 선정한다. 2025 사례·2023~2024 비교를 사용하고 1차 예측 대상은 논산시 일별 외지인 방문 추세다(docs/validation/05~06). 축제 입장객·시간대별 혼잡과 구분한다.
- 2026-09-07 사용자가 과거 이력 기반 예측 모델 개발을 확인하고 후속 진행을 요청했다. 연속 자료 수집·실제 모델 학습·기준 비교·읽기 전용 실험 화면을 구현했다(docs/validation/08~09).

## Open questions

- 팀의 정확한 제출일·가용시간과 실무 자료 제공 가능 범위는 확인 필요. 실무자 연결은 미확인이다.
- 2023~2025 연속 수집은 완료했지만 당시 공개시각·개정 전 자료가 없다. 2026년 및 지속 수집으로 지연·개정 차이를 관찰하고 향후 회차 전에 예측을 저장해야 한다.
- 현재 모델은 축제 주말의 급증을 과소예측하고 명목 80% 구간의 시험 포함률도 부족하다. 일정의 당시 공개 증거·축제/공휴일 효과 자료·새 평가 구간이 필요하다. 열람한 2025년을 다음 모델의 새 미열람 시험으로 사용하지 않는다.
- 2026-08-01은 정상, 08-15·08-31·09-01·09-03은 empty다. 데이터랩의 갱신 안내와 API 제공 시점 차이의 원인은 미확정이다.
- 소비 강도·자원 수요의 기존 다월 empty 원인·제공 범위는 미확정이다. 첫 모델 필수 입력에서는 제외한다.
- 일별 축제 계수 정의·시간별 현장 자료·셔틀 119대의 집계 단위와 실제 운행/대기/비용은 미확보이며 운영 효과 검증에 필요하다.

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
- docs/validation/evidence/2026-09-07-kto-profile.json
- docs/validation/evidence/2026-09-07-kto-history-days.json
- docs/validation/evidence/2026-09-07-kto-history-availability.json
- docs/validation/evidence/2026-09-07-source-checks.json
- docs/validation/evidence/2026-09-07-nonsan-history.json
- docs/validation/evidence/2026-09-07-nonsan-forecast.json.gz
- apps/web/data/nonsan-forecast-summary.json
- docs/ops/wsl-development.md
