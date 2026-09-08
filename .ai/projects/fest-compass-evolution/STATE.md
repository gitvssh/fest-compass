---
schema_version: 1
project_id: fest-compass-evolution
revision: 11
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-08T02:22:41.474Z"
---

# Current state

## Summary

개발보다 문서·시안을 먼저 검수하라는 사용자 지시를 반영해 D0 기획 검수본을 작성하고 내부 traceboard에 게시했다. 23개 기능 요구·6개 비기능 요구, 8개 UC/26개 AC/8개 TS와 7개 화면·와이어프레임을 연결했다. 현재 지도·비교·새 기획 기능은 개발 전이며 기존 논산 자료·개인 운영 기록만 사용 가능하다. 다음은 사용자의 문서·시안 피드백을 반영한 뒤 M1→M2→M3 구현이다. 모델 추가 연구·제품 코드·기존 수집과 배포는 유지한다.

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
- 2026-09-08 사용자 후속 승인: 바로 개발하지 않고 개정 기획·요구사항·기능목록·화면설계·와이어프레임을 먼저 작성하며 traceboard에도 배포해 검수한다.
- 검수용 문서·배치·기본값은 제안으로 표시하고 기존 내부 traceboard에만 게시한다. 지도·예산·위치 시안의 가상 자료를 실제 확보 데이터로 표현하지 않는다(위임된 문서·검수 게시 범위).

## Open questions

- 기획 검수 v1의 지역 탐색·비교 기준·근거 담기·두 후보·예산·기획안 구성에 대한 사용자 의견을 반영한다. 실제 담당자 인터뷰·과제 관찰은 아직 미실시다.
- 지도 공급자·행정경계·좌표·시군구 코드와 지역별 자료 보유 범위, 신규 개인 파일 형식의 용량·이전 버전 복원은 구현 착수 시 확인한다. 기존 키 발급 권한이나 공개 서버 쓰기 경계를 확장하지 않는다.
- 새 API·실행 명세·Run·티켓 원천은 미연결이다. traceboard 미평가 4개는 통과가 아니다. 개발 뒤 연결하고 TS 8개와 횡단 NFR을 실행한다.
- 문서 검수 후 M1 지역 지도→M2 주변/과거 비교→M3 기획 후보→M4~M6 연결 순서다. 모델 고정 계획·겨울 26건과 기존 수집은 유지한다.

## Artifacts and durable documents

- docs/review/2026-09-planning-review.md
- docs/sdlc/0-planning/product-plan.md
- docs/sdlc/1-analysis/srs.md
- docs/sdlc/1-analysis/data-contract.md
- docs/sdlc/1-analysis/business-flow.md
- docs/sdlc/1-analysis/usecases/
- docs/sdlc/2-design/screens.md
- docs/sdlc/2-design/flows.md
- docs/sdlc/2-design/ia.md
- docs/sdlc/2-design/architecture.md
- docs/sdlc/3-testing/acceptance-plan.md
- docs/sdlc/3-testing/scenarios/
- docs/assets/
- traceboard.yaml
- docs/validation/16-planning-review-publication.md
- docs/design/07-region-planning-milestones.md
- docs/validation/15-mvp-journey.md
- docs/ops/forecast-automation.md
