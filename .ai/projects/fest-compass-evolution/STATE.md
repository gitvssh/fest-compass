---
schema_version: 1
project_id: fest-compass-evolution
revision: 9
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-08T00:43:44.771Z"
---

# Current state

## Summary

모델 추가 개선을 미루고 MVP 전체 개인 작업 흐름을 먼저 공개했다. /workspace에서 자료·준비→운영안→결정·현장→결과→보고·다음 회차를 사용할 수 있다. 브라우저 저장·JSON 복원·모바일·보고서와 공개 E2E 통과, 앱 127개·배포 40개 검사 및 CI 성공. 승인된 구 이미지 4개 정리·자동 정책 연결·이전 이력 화면 배포도 완료했다. 기존 수집·예측·겨울 시험은 보존했다. 공동 편집·공식 승인과 실제 사용자 검증은 후속이며 7단계 전체는 진행 중이다.

## Accepted decisions

- 공모전 완성도와 실무 활용성을 같은 비중으로 추진하고 과거·현재·예측·운영 결정·결과·다음 회차를 연결한다(2026-09-07 사용자 확인).
- 승인된 7단계 범위의 개발·검증·일반 Git 게시·등록 앱 sync와 전용 worktree 정리를 진행한다(사용자 요청·저장소 규약).
- 논산딸기축제를 개발 샘플, 논산시 일별 외지인 방문 추세를 1차 예측 지표로 삼는다. 축제장 입장 건수·시간별 혼잡과 구분한다(docs/validation/05~06).
- 과거 이력 학습·사전 예측·일일 자동 수집·공휴일 후보 겨울 시험을 구현했다. 발행 당시 입력과 겨울 계획·코드 14개는 고정하며 개발 결과를 미래 검증으로 표현하지 않는다(docs/validation/08~14).
- 2026-09-07 사용자가 docs/ops/forecast-history-release.md의 구 이미지 4개 정리와 현재/복구본 보호·선언된 매일 자동 정리 연결을 승인했다. 동일 범위로 실행·배포 복구 완료, quota·권한·전역 GC 변경 없음.
- 2026-09-07 사용자는 모델 정확도 개선보다 화면 구성·기능 개발과 MVP 전체 흐름을 우선한다고 명시했고 2026-09-08 재개를 요청했다. 기존 예측을 유지하고 /workspace 개인 작업을 공개했다(docs/design/06-mvp-workspace.md).
- 공개 서버의 쓰기 차단은 유지한다. 개인 입력은 브라우저에만 저장하고 공동 저장·공식 승인·실측 검증을 이미 제공하는 것처럼 표현하지 않는다(기존 ADR-0001 및 위임된 MVP 구현 범위).

## Open questions

- 다음 우선순위는 docs/design/06-mvp-workspace.md의 다섯 사용자 과제로 입력 부담·완료시간·수치 이해를 확인하고 화면·기능을 보완하는 것이다. 실제 사용자 관찰은 미실시이며 제출일·실무자 연결은 미확보다.
- 공동 저장·인증·공식 승인, CSV와 시간·구역 실측의 개인 작업 연결, 다른 지역 자료 연결은 개발 필요다. 기존 편집 모드의 시간·구역 실측은 유지된다.
- 모델 회차별 오차 원인과 추가 비교 표본 검토는 MVP 사용 피드백 이후로 미룬다. 셔틀·인력 효과와 현장 대기·비용·수용량은 필요한 운영 자료·검증이 없다.
- 겨울 시험 26건은 첫 발행 2026-10-08, 첫 60일 결과 2027-01-04, 마지막 60일/90일 결과 4/1·5/1을 기다린다. 기존 계획을 뒤늦게 바꾸지 않는다.
- 2026-09-08 09시 수집은 새 하루를 확보했다. 최신 자료 2026-08-09·누락 29일이며 실제 공개 지연은 아직 미확정이다. 9월·10월 발행 예측 2건의 실제 사후 결과와 9/28 추가 발행은 미래다.
- 2027년 24일 딸기산업엑스포는 기존 4일 축제와 다른 대상이다. 일정·동일성·별도 평가 계약을 정하기 전 자동 등록하지 않는다.

## Artifacts and durable documents

- docs/validation/00-plan.md
- docs/validation/05-festival-selection.md
- docs/validation/06-forecast-contract.md
- docs/validation/09-model-validation.md
- docs/validation/10-prospective-records.md
- docs/validation/11-daily-automation.md
- docs/validation/13-calendar-experiment.md
- docs/validation/14-festival-history.md
- docs/validation/15-mvp-journey.md
- docs/design/06-mvp-workspace.md
- docs/ops/forecast-automation.md
- docs/ops/forecast-history-release.md
- docs/validation/evidence/2026-09-07-festival-history-release.json
- docs/validation/evidence/2026-09-08-mvp-production.json
- apps/web/app/workspace/page.tsx
- apps/web/components/PersonalWorkspace.tsx
- apps/web/lib/workspace.ts
- apps/web/scripts/workspace-e2e.mjs
- apps/web/data/calendar-trial-plan.json
