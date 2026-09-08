---
schema_version: 1
project_id: fest-compass-evolution
revision: 14
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-08T05:51:26.649Z"
---

# Current state

## Summary

남한 전국 시작·실자료·그래프 중심 비교를 반영한 기획·화면 v3를 내부 Traceboard에서 검수할 수 있다. 논산 과거 일별 실제 값 45개와 원주 지원사업의 계획/집행·재원 구성을 시안에 연결하고 지표별 미확보·비교 보류를 표시했다. 기존 요구·화면 ID를 유지하며 인수 기준 54개와 7개 v3 시안을 검증했다. headless로 게시 53개 파일 일치·그림 7개·흐름 5개·390px 표시를 확인했다. 제품 지도·일반 과거 검색·기획 기능은 개발 필요이고 실무자 관찰·신규 TS는 미실행이다. 다음은 v3 검수 의견 반영 후 M1 전국→지역 조회·출처·근거 담기, M2 비교→M3 후보→M4~M6 연결이다. 모델 추가 연구는 후순위이며 기존 고정 계획·수집을 유지한다.

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

## Open questions

- v3 전국 진입·실제 표본·차트·근거 연결의 검수 의견을 반영한다. 다음 개발은 M1 전국 지도/지역 목록/자료 조회·출처·근거 담기다.
- 지도 공급자·행정경계·좌표·지역 코드 개편·전체 페이지 조회와 지역별 보유 범위는 구현 착수 때 검증한다. 전국 모든 과거 자료 확보를 M1의 선행 조건으로 만들지 않는다.
- 과거 회차의 독립 식별·원문/보관본과 지표별 가용성 연결은 개발 필요다. 현재 축제 상세만으로 연도별 과거 회차를 복원하지 않는다.
- 실제 담당자 관찰과 한 회차의 예산 의결→계약→지급/정산 전 과정 검증은 미실시다. 기관/연도별 분류·절차 적용을 자동 확정하지 않는다.
- API·실행 명세·Run·티켓 원천은 미연결, 추적 4개 미평가·신규 TS 8개 미실행. 공개 서버 읽기 전용·개인 저장·모델 고정 및 겨울 계획은 유지한다.

## Artifacts and durable documents

- docs/validation/19-national-comparison-v3.md
- docs/validation/evidence/2026-09-08-planning-v3-publication.json
- docs/sdlc/2-design/data-visualization.md
- docs/research/2026-09-historical-comparison-review.md
- docs/research/evidence/2026-09-visualization-fixture.json
- docs/review/2026-09-planning-review.md
- docs/sdlc/0-planning/product-plan.md
- docs/sdlc/1-analysis/srs.md
- docs/sdlc/1-analysis/data-contract.md
- docs/sdlc/1-analysis/usecases/
- docs/sdlc/2-design/screens.md
- docs/sdlc/2-design/flows.md
- docs/sdlc/2-design/ia.md
- docs/sdlc/3-testing/scenarios/
- docs/assets/
- traceboard.yaml
- docs/design/07-region-planning-milestones.md
- docs/validation/18-municipal-planning-v2.md
- docs/research/2026-09-municipal-festival-sources.md
- docs/ops/forecast-automation.md
