---
class: Current
owner: fest-compass
last_verified: 2026-09-08
summary: "남한 전국 시작·실제 과거 표본·그래프 중심 비교를 문서와 7개 v3 시안에 반영했습니다. 제품 기능은 개발 필요합니다."
---

# 전국 탐색·실자료 비교 화면 v3 검증

2026-09-08 KST. 사용자가 승인한 전국 시작·실자료·시각화 검토안을 문서와 시안에 반영했다.
브라우저 검증은 사용자 요청대로 headless로 수행했다. 지도·일반 과거 검색·새 기획 기능은 개발 전이다.

## 대상과 변경

| 항목 | 내용 |
|---|---|
| 기준 원천 | a11791f52a78eb4f9c93c2c077d9ef37594ff795 |
| v3 원천 | 387af0e87ec80db1c22f0d0de817ad79585428da |
| 변경 범위 | 44개 파일: 문서·설정·고정 자료 30개, Excalidraw/SVG 7쌍 |
| 보존 | 기존 v1·v2 28개 자산 바이트 동일. 화면·요구 ID 유지 |
| 제외 | apps·infra·.github·기존 모델/수집·원천 이력 변경 없음 |

- 전국→시도→시군구, 제주·도서 포함, 상위 복귀와 명시적 우리 지역/이전 탐색 이동.
- 지도 표시 범위와 통계 확보 범위 분리, 미확보/부분/오류/0 구분, 첫 페이지와 전수 조회 구분.
- 과거 회차의 독립 식별·일정·원문 보관. 현재 상세 응답이 과거 회차를 덮지 않는 계약.
- 논산 2023~2025년 실제 외지인 일별 표본 45개의 선그래프·실제 날짜 일정표·수치와 출처.
- 계획 재원 구성 파이와 미산정 지출 파이 보류. 원주 2022 지원사업의 실제 계획/집행 막대·재원 도넛.
- 차트 선택 구간과 당시 값·조건·누락·집계·출처를 근거로 담고 같은 버전으로 출력하는 계약.

[시각화 설계](../sdlc/2-design/data-visualization.md), [자료 점검·값 표](../research/2026-09-historical-comparison-review.md),
[고정 표본](../research/evidence/2026-09-visualization-fixture.json), [7개 시안](../sdlc/2-design/screens.md)이 상세 정본이다.
API 재조회 관찰은 직전 읽기 전용 검토에서 확인한 결과를 구분해 기록했다. 이번에 전국 자료를 새로 수집한 것으로 보고하지 않는다.

## 로컬 검증

| 검사 | 결과 |
|---|---|
| 문서 구조·diff | `.dev-standard/check_compliance.py --json` 위반 0, `git diff --check` 통과 |
| 요구 추적 | FR 23/NFR 6, UC 8, AC 54, TS 8, 화면 7. 누락·모순 0, 미평가 R3/R4/R5/R6 4개 유지 |
| 인수 기준 | 기존 44개 유지·10개 추가. UC frontmatter/본문과 TS 연결 54개 일치 |
| 실제 값 | 원천 SHA-256과 45개 날짜·값 일치. 비교 선그래프 3개의 모든 Y좌표를 실제 값·공통 축에 대조 |
| 비용 표본 | 원주 계획/집행의 재원별 합=각 총액, 원문 범위·단계·미확인 보존 |
| 자산 | Excalidraw 7개 필수 필드·참조 통과. SVG 두 번 렌더 SHA-256 7/7 일치 |
| 흐름도 | 화면 흐름 5·구조 1·업무 1·마일스톤 1, 총 8블록 파싱 통과 |
| 독자 사이트 | 문서 35개·그림 7개, HTML/CSS 상대 링크 누락 0 |
| headless 표시 | 7개 SVG 이미지 육안 확인, 날짜·금액 축 눈금 위치 보정 후 변경 2개 재확인 |
| headless 문서 동선 | 검수 안내의 v3 링크→화면설계, 지연 로딩 이미지 7/7 표시, 390px 문서 전체 가로 넘침 0 |

도구: traceboard 53fb6aabbbb9cf704960b648eb2cb076df334a4e의 `tools/excalidraw/`, `trace_build.py`, `trace_lint.py`, `trace_site.py`.
Node 24.15.0·Python 3·로컬 Chromium을 사용했다. Playwright CLI 설정은 `launchOptions.headless=true`이며 렌더·접근성 도구의 Chromium도 기본 headless다.
직접 SVG 문서 캡처는 대기 시간 초과가 있어 실제 사이트와 같은 HTML 이미지 방식으로 7개 모두 캡처했다. 지연 로딩 이미지는 스크롤·decode 후 판정했다.
시안·문서 표시 검증을 신규 제품 TS나 실제 공무원 사용성 시험 통과로 환산하지 않는다. 앱 코드 변경이 없어 앱 테스트·빌드는 재실행하지 않았다.

## 내부 게시

[검수 안내 v3](https://traceboard.homelab.damecasol.com/portfolio/fest-compass/site/pages/docs-review-2026-09-planning-review.html)와
[7개 화면 v3](https://traceboard.homelab.damecasol.com/portfolio/fest-compass/site/pages/docs-sdlc-2-design-screens.html)를 기존 내부 접근 환경에서 검수할 수 있다.

| 항목 | 결과 |
|---|---|
| 게시 커밋 | 6a19ba87b85837b54809a5bdd29aa0696bd9435c |
| 이미지 | registry.damecasol.com/traceboard/site@sha256:a4fd38ded522fafa6ee47a65ebcdb9c9e14edbdf42362bb66c886d173a9b1e6f |
| 발행 게이트 | `publish-site.sh --profile internal`: 1,576페이지/보기 검사 조합, 라이트·다크×시스템·수동, 위반 0·미평가 0 |
| 배포 | traceboard-dev가 위 커밋 Succeeded / Synced / Healthy |
| 실행 | traceboard namespace의 Deployment 이미지 일치, available=1 / updated=1 |
| 실제 HTTPS | 53개 파일(HTML 36개: 문서 35+진입 1) 응답 200·SHA-256 53/53 일치 |
| 실제 headless 브라우저 | 검수 안내 v3→화면설계, v3 그림 7/7 표시, 흐름도 5/5 렌더, 390px 문서 가로 넘침 0 |
| 변경 경계 | 기존 내부 이미지 digest·발행 이력 2파일. 렌더 10객체, 이미지 외 배포 선언 동일. 공개 프로파일·등록·권한 변경 없음 |

최초 게시 push는 다른 프로젝트 게시 e583307f908caa781c88b76145a2c18ecef158f7의 선행 반영으로 fast-forward가 거부됐다.
후속 병합에서 원격 이력 전체를 보존하고 이번 발행 도구가 생성한 행만 뒤에 덧붙였다. 수치·기록 시각을 손으로 수정하지 않았다.
검증한 이미지에는 선행 게시의 Company 원천 9e11a6e54c42e9ca33860e0899166d38ae766a7e가 이미 포함돼 있었다.
전체 포트폴리오의 원천 커밋을 대조해 다른 차이는 FEST v3와 선행 게시보다 최신인 sh-agent-lab 원천뿐임을 확인했다.
sh-agent-lab의 선행 081b40072e4042fb27e73e7248955ccdd5a0aaef가 수록 원천 e0d0986f7a9a720f077621d576fd440261504c48의 조상임을 확인해 다른 프로젝트의 수정이 되돌아가지 않게 했다.
동일하게 검증한 이미지와 원천 53fb6aa 시점의 빌드 증거를 재사용했으며, 병합 후 배포 선언·이력·실제 실행·HTTPS를 확인했다.
1,576은 고유 문서 수가 아닌 검사 조합 수다. 필수 도구·원본 검증과 접근성 게이트를 생략하지 않았다.

파일별 SHA-256과 배포 확인 요약은 [게시 검증 기록](evidence/2026-09-08-planning-v3-publication.json)에 보존했다.

## 남은 작업

v3 재검수 의견을 반영하고 M1 전국 지도·지역 목록·조회·출처·근거 담기부터 구현한다.
실제 지도 공급자·행정경계·코드·좌표·지역별 자료 보유·페이지 전수 조회를 개발 때 검증한다.
이어 M2 과거 비교→M3 후보→M4~M6 예산·기획안·결과를 연결한다. 모델 추가 연구는 선행하지 않는다.
전국 과거 회차 완비·실무자 관찰·신규 TS 8개 실행은 완료하지 않았다.
