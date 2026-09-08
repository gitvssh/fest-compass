---
schema_version: 1
project_id: fest-compass-evolution
revision: 12
status: active
next_actor: codex
last_actor: codex
current_question: "No open question recorded"
updated_at: "2026-09-08T03:02:05.279Z"
---

# Current state

## Summary

사용자의 공개 사례 조사 요청을 반영해 지자체 축제 준비·예산 요구·발주·집행·정산·다음 회차 개선을 조사했다. 핵심 5개 사례와 공식 출처 8건에서 보완안 8개를 도출하고 내부 traceboard에 게시했다. 예산 단계·재원·범위·사업 필요성·준비 담당/기한·결과 개선 연결이 핵심이다. 현재 SRS/UC/TS와 7개 와이어프레임은 v1이며 보완안은 검토 제안이다. 다음은 근거에 따라 요구·화면 문서를 함께 개정한 뒤 M1→M2→M3 구현이다. 제품 코드·모델·기존 수집은 유지했다.

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

## Open questions

- 공개 사례에 따른 보완안 8개를 검토하고 업무 흐름·자료 정의·기존 SRS/UC/TS·SCR-FC-004~007을 중심으로 함께 개정한다. 보완안 자체는 승인·구현 완료가 아니다.
- 실제 담당자의 사업설명서 작성·확정 예산 후 조정·다부서 비용·정산 후 재사용 업무 관찰은 미실시다. 단일 회차의 예산 의결→계약→지급·정산 연결도 추가 확인 대상이다.
- 기관·연도별 예산 분류 및 사전절차 적용은 별도 확인한다. 2027년도 기준을 과거 자료에 소급 적용하지 않으며 법정기한·금액 문턱의 자동 판단은 미제안이다.
- 지도 공급자·경계·좌표·지역 코드·지역별 가용성과 개인 파일 형식 검증은 구현 착수 시 진행한다. M1 지도→M2 비교→M3 기획 대안→M4~M6 연결 순서를 유지한다.
- API·실행 명세·Run·티켓 원천은 미연결, 추적 검사 4개 미평가, 신규 TS 8개 미실행이다. 모델 고정 계획·겨울 26건·기존 수집은 유지한다.

## Artifacts and durable documents

- docs/research/2026-09-municipal-festival-cases.md
- docs/research/2026-09-municipal-festival-sources.md
- docs/research/2026-09-municipal-requirement-proposals.md
- docs/research/evidence/2026-09-source-checks.json
- docs/validation/17-municipal-research-publication.md
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
