---
schema_version: 1
project_id: fest-compass-evolution
revision: 15
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-08T07:12:12.255Z"
---

# Current state

## Summary

M1의 첫 기능을 공개 서비스에서 사용할 수 있다. 남한 전국에서 시도→시군구를 선택해 현재 관광지·문화시설·기간 내 시작 행사를 지도/목록으로 조회하고, 논산 방문 추세와 출처를 확인해 당시 자료를 개인 근거로 보관한다. 공식 현행 조회 목록·세종 코드 예외를 검증했으며 모바일 선택창과 파일 보관/복원을 제공한다. 앱 단위 135건·배포 40건·headless 회귀와 공개 동선을 검증했다. 모델·겨울 계획과 기존 예측 2개는 유지한다. M2 독립 과거 회차 비교→M3 기획 후보→M4~M6 연결을 이어간다. 정식 행정경계·도로 지도, 전국 방문 이력·실무자 관찰과 정형 API/Spec/Run 연결은 후속이다. 실제 화면과 검수 안내를 내부 Traceboard에 게시하고 59개 파일 일치·그림 4개를 headless로 확인했다.

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
- 2026-09-08 사용자 추가 요청: 실제 지자체 담당자의 축제 준비·예산안 작성·집행을 반영하기 위해 공개 온라인 사례를 조사한다. 조사 근거와 설계 보완안을 문서화하며 실제 사용자 관찰로 표현하지 않는다.
- 2026-09-08 사용자 후속 승인: 공개 사례의 보완안 8개를 업무·자료·기존 요구/인수 기준과 7개 화면 v2에 반영하고 내부 traceboard 검수본을 갱신한다. 기능 구현·실무자 검증 완료로 확대하지 않는다.
- 2026-09-08 사용자 승인: 첫 지도는 남한 전국에서 시작해 시도→시군구로 좁히고, 우리 지역·이전 탐색은 명시적 바로가기로 제공한다. 실제 과거 자료의 확보 여부와 출처를 드러내며 그래프·파이/도넛·수치 표 중심으로 비교·기획 근거에 연결한다.
- 2026-09-08 사용자 요청: Playwright 등 브라우저 자동 검증은 headless로 수행한다. v3는 설계·내부 검수본 갱신이며 제품 기능 구현 완료로 확대하지 않는다.
- 2026-09-08 사용자가 시도→시군구 확장을 UI로 표현하고 다음 개발을 진행하도록 승인했다. M1 전국·지역 조회와 개인 근거 보관을 구현·공개하며 브라우저 검증은 계속 headless로 수행한다.

## Open questions

- M2에서 주변·현재 등록 행사와 독립적인 과거 회차의 출처·지표별 가용성을 연결하고 실제 자료 기반 비교 그래프를 구현한다. 현재 API 상세를 과거 보관본으로 취급하지 않는다.
- M1의 전국 방문 이력·정식 행정경계/도로 지도·지역 목록 자동 갱신과 개편 코드의 과거 자료 대응은 후속이다. 현재 지도 표식은 선택용이고 일반시/행정구를 합산하지 않는다.
- 개인 근거를 M3 후보·M4 비용·M5 기획안의 불변 버전에 연결한다. 이번 개인 사본 저장만으로 기획안·공식 승인·공동 저장 완료를 표시하지 않는다.
- 신규 GET API와 자동 시험은 구현됐지만 Traceboard 정형 OpenAPI/Spec/Run·티켓은 미연결이다. TS-FC-001/003 전체 인수와 실제 담당자 관찰은 미완료다.

## Artifacts and durable documents

- docs/validation/20-region-explorer.md
- docs/validation/evidence/2026-09-08-region-explorer-production.json
- docs/sdlc/2-design/region-explorer-implementation.md
- apps/web/app/regions/page.tsx
- apps/web/app/evidence/page.tsx
- apps/web/lib/region/
- apps/web/scripts/regions-e2e.mjs
- docs/design/07-region-planning-milestones.md
- docs/review/2026-09-planning-review.md
- docs/sdlc/2-design/data-visualization.md
- docs/research/2026-09-historical-comparison-review.md
- docs/research/2026-09-municipal-festival-sources.md
- traceboard.yaml
- docs/ops/forecast-automation.md
