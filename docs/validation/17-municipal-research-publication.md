---
class: Current
owner: fest-compass
last_verified: 2026-09-08
summary: "지자체 축제 업무 조사와 요구사항 보완안을 내부 검수 사이트에 게시했습니다. 공개 원문·문서 연결·실제 게시본을 확인했고 제품 코드는 변경하지 않았습니다."
---

# 공개 사례 조사와 검수본 게시 검증

2026-09-08 KST 확인. [조사 보고서](https://traceboard.homelab.damecasol.com/portfolio/fest-compass/site/pages/docs-research-2026-09-municipal-festival-cases.html)와
[요구사항 보완안](https://traceboard.homelab.damecasol.com/portfolio/fest-compass/site/pages/docs-research-2026-09-municipal-requirement-proposals.html)을
기존 내부 검수 환경에서 읽을 수 있다.

## 대상과 변경

| 구분 | 확인 대상 |
|---|---|
| FEST 문서 원천 | 51d2f55309c5b0bcc1245457719bd72fa60ae513 |
| traceboard 빌드 도구 | 86a458577ce767f0441d07839d7d8741e60efd67 |
| 게시 커밋 | 5ea684a16fee72ae7edc791566423736ddf7cd68 |
| 게시 이미지 | registry.damecasol.com/traceboard/site@sha256:cb5d79ab0f8277d843730d56b6ed986b7107e778139bd3b8444e35c93393992f |
| 배포 확인 | traceboard-dev: 위 커밋에서 Succeeded / Synced / Healthy |
| 실행 상태 | traceboard Deployment의 위 이미지 일치, available=1 / updated=1 |

FEST는 조사·출처·보완안 3개 문서, 원본 해시 대장, 검수 안내·업무 흐름의 참조와 traceboard 설정을 변경했다.
33a7de3→51d2f55의 apps·infra·.github 변경은 없다.
기존 SRS·UC/TS·7개 와이어프레임은 v1이며 보완안이 구현·사용자 승인 완료된 것은 아니다.
traceboard는 기존 내부 이미지 digest와 발행 이력만 변경했다.

## 확인 결과

| 검사 | 결과와 한계 |
|---|---|
| 공개자료 | 핵심 5개 사례. 출처 대장 8건 중 내려받은 원본 5개는 본문과 PDF 렌더/HWP 내장 이미지 대조. 나머지는 HTML 회의록, 공표 목록, 직접 접근이 실패한 보조 자료로 구분 |
| 원본 식별 | [해시 대장](../research/evidence/2026-09-source-checks.json)에 5개 파일의 크기·SHA-256 기록. 외부 문서 전문 미게시 |
| 금액 | 광주 요구액 분해와 원주 재원별 계획·집행 합계 검산. 요청·확정·집행의 다른 단계를 혼합하지 않음 |
| 문서 구조 | `.dev-standard/check_compliance.py --json`: 위반 0 |
| 추적 | `trace_build.py`→`trace_lint.py`: 기능 FR 23/NFR 6/UC 8/AC 26/TS 8 유지. 위반 0, R3·R4·R5·R6 미평가 4 |
| 사이트 | `trace_site.py --no-remote`: 문서 33개·그림 7개. 게시 대상의 상대 링크 누락 0 |
| 흐름도 | `validate-mermaid.mjs`: 조사·업무 흐름 2개 블록 파싱 통과 |
| 브라우저 | 조사 보고서 흐름도 1개 렌더, 보완안 8행 확인. 보완안 390px 화면에서 문서 폭 375px, 페이지 가로 넘침 없음 |
| 발행 게이트 | `publish-site.sh --profile internal`: 라이트/다크 × 시스템/수동, 1,560페이지 검사 조합에서 위반 0·미평가 0 |
| HTTPS 내용 일치 | 게시 사이트 51개 파일(HTML 34개: 문서 33+진입 1)을 받아 빌드 원본과 SHA-256 비교, 51/51 일치 |
| 실제 주소 탐색 | 실제 보고서에서 보완안 링크 이동, 제목·8개 보완안·흐름도 확인 |

1,560은 반복 검사 조합 수이며 고유 문서 수가 아니다.
발행 중 기존 환경의 buildx 부재 안내 후 Docker legacy builder로 정상 완료되었으며 도구 설치·설정 변경은 하지 않았다.
브라우저의 favicon 404는 문서·흐름도 표시 실패로 집계하지 않았다.
실패했던 외부 원문 조회는 출처 대장에 남겼고 정상 열람으로 바꾸지 않았다.

## 미실시와 다음 작업

제품 코드 변경이 없어 앱 테스트·빌드·앱 배포는 재실행하지 않았다.
신규 기능의 TS 실행·공무원 인터뷰·업무 효율 측정은 미실시다.
이번 검증은 공개자료 조사와 게시 확인이며 자료의 전국 대표성·모든 법령 준수 검토를 뜻하지 않는다.

다음은 [8개 보완안](../research/2026-09-municipal-requirement-proposals.md)을 바탕으로
업무 흐름·자료 정의·기존 SRS/UC/TS와 기획·예산·결과 화면을 함께 개정하는 작업이다.
지도→비교→기획 대안의 MVP 순서와 예측모델 연구 후순위는 유지한다.
