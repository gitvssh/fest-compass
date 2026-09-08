---
schema_version: 1
project_id: fest-compass-evolution
revision: 10
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-08T00:59:39.402Z"
---

# Current state

## Summary

사용자가 지자체 담당자의 지도 기반 축제 기획을 핵심 목표로 명확히 했다. 내 지자체 관광정보가 1차, 주변 현재·과거 축제 비교검색이 2차 정보 수요다. 올해 아이템·장소·시기·예산·준비 규모를 근거로 결정하는 M1~M6를 문서에 반영했다. 현재 사용 가능한 것은 논산 데이터·예측과 개인 운영 기록의 기반이며 전체 기획 MVP는 미완성이다. 다음은 M1 내 지자체 지도, M2 비교검색, M3 기획 대안이다. 모델 추가 개선은 뒤로 미루고 기존 배포·수집·겨울 시험을 유지한다.

## Accepted decisions

- 공모전 완성도와 실무 활용성을 같은 비중으로 추진하고 과거·현재·예측·기획 결정·결과·다음 회차를 연결한다(2026-09-07 사용자 확인).
- 승인된 개발·검증·일반 Git 게시·등록 앱 sync·전용 worktree 정리는 재승인 없이 진행한다(사용자 요청·저장소 규약).
- 논산딸기축제를 개발 샘플, 논산시 일별 외지인 방문 추세를 1차 예측 지표로 삼는다. 행사장 입장·시간별 혼잡과 구분하며 다른 지자체에 자동 일반화하지 않는다(docs/validation/05~06).
- 과거 이력 학습·사전 예측·매일 수집·겨울 공휴일 후보 시험을 구현했다. 발행 입력과 겨울 계획·코드 14개는 고정한다. 승인된 구 이미지 4개 정리·자동 정책 연결·배포 복구도 완료했다(docs/validation/08~15).
- 2026-09-07 사용자는 모델 정확도보다 화면·기능과 빠른 MVP 피드백을 우선했다. 현재 /workspace는 개인 운영 계획·기록의 사용 가능한 기반이며 제품 전체 MVP 완료를 뜻하지 않는다(2026-09-08 목표 명확화).
- 2026-09-08 사용자 명시: 주 타겟은 지자체 담당자, 자기 지자체 관광정보가 1차 요구다. 주변 다른 현재 축제와 과거 기록의 비교검색을 2차 정보 수요 가설로 삼는다.
- 2026-09-08 사용자 명시: 지역 관광데이터를 지도에서 시각화·조건 조회하고 이를 근거로 올해 어떤 축제를 어떤 아이템·위치·예산·준비 규모로 기획할지 판단하는 것이 목표다. 이 목표의 실행 순서를 docs/design/07-region-planning-milestones.md의 M1~M6로 구체화했다.
- 지도에서 선택한 자료·조회 조건과 기획안의 판단 근거를 연결하고, 기존 운영 기록·보고서·다음 회차 기능을 M4~M6에 재사용한다(위임된 목표·마일스톤 정리 범위).
- 공개 서버 쓰기 차단·개인 브라우저 저장 경계는 유지한다. 공동 편집·공식 승인과 실제 현장 효과는 후속 개발·검증이며 이미 제공하는 것처럼 표현하지 않는다(ADR-0001).

## Open questions

- 다음 착수는 M1 내 지자체 관광지도다. 지역 선택·기간·지도/목록/차트 연동·상세/출처·기획 근거 담기까지 한 동선으로 구현하고 M2 주변/과거 비교검색에 연결한다. 지도 서비스·행정경계·좌표 품질·자원 분류·지역별 보유 범위는 구현 시 확인한다.
- 주변 지자체·거리·기간·주제 비교와 축제/회차 식별, 과거 일정·예산·성과 자료의 비교 가능 범위는 개발·검증 필요다. 현재 등록 정보를 실시간 현장 상태나 모든 과거 기록으로 해석하지 않는다.
- M3 기획 후보와 M4 항목별 예산·수량/단가·제약 비교, M5 근거가 연결된 기획안, M6 과거 결과 재검색은 연결 개발 필요다. API에 없는 예산·현장 효과는 자료 확보 또는 사용자 가정으로 구분한다.
- 실제 지자체 담당자의 1차/2차 정보 수요와 기획 과제를 관찰해야 한다. 사용자 인터뷰·제출일·가용시간·실무 자료는 미확보이며 제품 개발을 막는 승인 대기는 아니다.
- 모델 추가 개선은 지도·조회·기획 동선보다 뒤다. 기존 겨울 26건의 첫 발행 2026-10-08과 향후 결과를 기다리며 고정 계획은 유지한다. 2026-09-08 최신 관측은 8/9, 누락 29일, 기존 예측 2건의 사후 결과는 대기 중이다.
- 공동 저장·인증·공식 승인, CSV/시간·구역 실측 연결과 2027년 24일 엑스포의 별도 발행·평가 계약은 후속이다. 기존 4일 축제 계약을 그대로 적용하지 않는다.

## Artifacts and durable documents

- docs/design/07-region-planning-milestones.md
- docs/design/00_INDEX.md
- docs/validation/00-plan.md
- docs/design/06-mvp-workspace.md
- docs/validation/15-mvp-journey.md
- docs/validation/evidence/2026-09-08-mvp-production.json
- docs/validation/05-festival-selection.md
- docs/validation/06-forecast-contract.md
- docs/validation/09-model-validation.md
- docs/validation/10-prospective-records.md
- docs/validation/11-daily-automation.md
- docs/validation/13-calendar-experiment.md
- docs/validation/14-festival-history.md
- docs/ops/forecast-automation.md
- docs/ops/forecast-history-release.md
- apps/web/app/workspace/page.tsx
- apps/web/components/PersonalWorkspace.tsx
- apps/web/lib/workspace.ts
- apps/web/data/calendar-trial-plan.json
