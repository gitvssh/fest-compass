---
class: Current
doc_class: current
doc_kind: ops
owner: fest-compass
last_verified: 2026-09-23
version: v1
summary: "pick-d-day에 흩어져 있던 FEST Compass의 최신 문서·시안과 데이터랩 원자료를 gitvssh/fest-compass로 선별 통합한 범위와 경계입니다. 원본 삭제나 모노레포 전체 이전이 아니며, 새 연도별 방문 화면의 통합 빌드·브라우저 확인·공개 게시는 대기 중입니다."
---

# 저장소 통합 보고

## 결론

**FEST Compass의 정본은 `gitvssh/fest-compass` 하나다.** 팀 저장소 `travel-resolver/pick-d-day`에서
같은 축제 제품의 최신 문서·시안과 축제 자료만 골라 이 저장소로 옮겼다. 원본 저장소는 지우거나 옮기지 않았고,
다른 제품은 가져오지 않았다. 모노레포 전체를 이전한 작업이 아니다.

| 구분 | 상태 |
|---|---|
| 최신 문서·시안 62개 이관 | 이관 완료. 이 브랜치에 있고 게시 전 |
| 데이터랩 원자료 CSV 304개·문서 5개 보존 | 이관 완료. 원본 바이트 일치 확인 |
| 새 연도별 방문 화면 `/compare/annual` | 준비됐지만 연결 필요 — [검증·게시 대기](#검증게시-대기) |
| 개최 일정·앱 내 이동·추가 CSV 연결 | 다른 담당이 작업 중. 이 보고에서 완료로 기록하지 않음 |
| v7 두 목적 전체 흐름 | 개발 필요 |

## 정본과 작업 위치

- 원격 정본: [gitvssh/fest-compass](https://github.com/gitvssh/fest-compass). 로컬 기준 체크아웃: WSL `~/dev/side/fest-compass`.
- 수정은 `~/dev/worktrees/fest-compass-<topic>`의 전용 브랜치에서 한다. 작업 공간 점유 선언과 병합 후 정리는
  [WSL 개발환경](wsl-development.md)을 따른다. 이번 통합 브랜치는 `feat/consolidate-tourism-planning`이다.
- 사람이 확인할 사본은 [검토 사본 전달](review-delivery.md)에 따라 Windows 검토 폴더로 복사하며 원본은 이 저장소에 둔다.

## 가져온 것

### 최신 문서·시안 62개

원본 커밋 [`f362e65`](https://github.com/travel-resolver/pick-d-day/tree/f362e65ba9e1cac18757951236484cff666c2696/developer/shlee/fest-compass)의
`developer/shlee/fest-compass/`에서 이 저장소의 직전 커밋과 다른 파일 62개(기존 파일 변경 32개·신규 30개)를 옮겼다.
대상은 `docs/` 55개, `.ai/` 3개, 루트 `AGENTS.md`·`README.md`·`traceboard.yaml`, `tools/` 1개다.
원본의 앱 코드·배포 선언(`infra/`)·CI(`.github/`)는 이 저장소 직전 커밋과 차이가 없어 이관 대상이 아니었다.

- 처음 옮긴 62개 파일은 원본 커밋과 바이트를 대조했다. 이후 독립 저장소에서 사용할 경로·현행 상태·색인과 검토 사본 내보내기를 의도적으로 수정했다:
  [검토 사본 전달](review-delivery.md), [기획 기준](../product/planning-principles.md), [데이터 현황](../research/2026-09-data-inventory.md),
  [현행 점검](../review/2026-09-current-state.md), [내보내기 도구](../../tools/export-review.py).
  데이터 원본과 달리 이 제품 문서들은 앞으로도 정본에서 갱신한다.
- 루트 [AGENTS](../../AGENTS.md)·[README](../../README.md)·
  [프로젝트 헌장](../../.ai/projects/fest-compass-evolution/CHARTER.md)은 원본과 다르게 이 저장소의 정본·배포 경계를 유지한다.
- 이 저장소에만 있던 개발 표준·Git 설정 7개는 보존했다.
- 프로젝트 진행 기록(`.ai/projects/fest-compass-evolution/`)은 원본의 revision 29→37 연속 기록을 옮겼다.
  이후 기록의 추가 전이는 통합 책임자(root)가 한다.

### 데이터랩 원자료

원본 `developer/hkjin/plan-03-datalab/`의 CSV 304개와 문서 5개를
[원본 보관 폴더](../research/imported/hkjin-plan-03/README.md)의 `original/`에 바이트 그대로 두었다.
[목록 파일](../research/imported/hkjin-plan-03/manifest.json)은 파일마다 크기·SHA-256·원본 Git blob ID·원본 URL·사용 구분을 기록한다.

- 이 문서 작업에서 309개 파일 전부를 목록과 대조했다. 누락 0, 크기·SHA-256 불일치 0이고,
  현재 파일의 Git blob ID가 목록 및 원본 커밋 `f362e65`의 트리와 309개 모두 일치했다.
- 공식 제공처는 [한국관광 데이터랩 축제 데이터](https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do)다.
  이번 통합에서 새로 내려받거나 수집하지 않았다.
- 앱이 쓰는 것은 `연도별 방문자 추이` 26개(147행)뿐이다. 나머지 278개 CSV와 문서는 보존만 한다.
  데이터랩의 원본 작업 폴더 `work/`, 분석 설계 문서, `PROMPT-desktop.txt`는 가져오지 않았다.

## 가져오지 않은 것과 경계

- **다른 제품은 흡수하지 않았다.** 에움길·ROOTS·반려여행 등 같은 팀 저장소의 다른 제품은 이 저장소 범위가 아니다.
- **같은 축제 제품의 기능·축제 자료만 선별했다.** K-Festival Navigator 코드는 가져오지 않았고, 데이터 현황 문서의
  Navigator 설명은 원본 고정 커밋의 파일 링크로 바꿨다.
- **원본은 참고 사본으로 남는다.** `pick-d-day`의 `developer/shlee/fest-compass/`는 `f362e65` 시점의 참고 사본이다.
  원본 저장소를 수정·삭제하지 않았고, 이후 이 제품의 변경은 이 저장소에서만 한다.
- **저장소 밖 상대 링크 14개를 정리했다.** 가져온 데이터랩 문서·폴더를 가리키던 9개는 `imported/hkjin-plan-03/original/…`로,
  가져오지 않은 Navigator 코드 4개와 9월 13일 선택과 집중 회의 문서 1개는 원본 고정 커밋 URL로 바꿨다.
  원본 저장소의 `main` 등 움직이는 브랜치로는 연결하지 않는다.

## 자료를 읽는 기준

새 화면의 값은 **축제가 열린 행정동의 통신 기반 방문 추정**을 개최기간 동안 더한 값과 하루 평균이다.
기존 논산·공주·임실의 **시군구 일별 외지인 방문**과 다른 지표이고, 둘 다 행사장 입장객이 아니다.

- 26개 축제·147행, 개최연도 2018·2019·2022·2023·2024·2025. 2020·2021은 자료가 없다.
- 논산딸기축제는 26개 목록에 없다. 임실N치즈축제는 두 자료에 모두 있지만 지표가 다르다.
- `문화관광축제 주요 지표`의 축제×연도 154개 관측이나 상대지수를 연도별 추이에 섞지 않는다.

상세 단위·범위·화면 동작은 [데이터 현황](../research/2026-09-data-inventory.md#축제-개최기간-연도별-방문-추이-연결)에 있다.

## 운영 경계

이번 통합은 아래 기존 경계를 바꾸지 않았다. 다시 검증한 것도 아니다.

- 이미지 게시는 수동 실행(`workflow_dispatch`) [release 작업](../../.github/workflows/release.yml)이며
  이 저장소 전용 사내 실행기(`homelab-fest-compass`)에서만 돈다.
- 운영은 [ADR-0001](../decisions/0001-public-readonly-sqlite-boundary.md)의 공개 읽기 전용·단일 SQLite 쓰기·RWO PVC 보존 경계를 따른다.
- 공개 주소는 `pickday.damecasol.com`이다. 이 통합 브랜치는 아직 게시·배포되지 않았다.

## 검증·게시 대기

통합 책임자(root)가 최종 검수를 마치면 이 절의 `대기` 항목을 실제 결과로 바꾼다.
아래 확인 주체를 섞어 기록하지 않는다.

| 확인 주체 | 항목 | 상태 |
|---|---|---|
| 문서 담당(이 보고 작성) | 원자료 309개 목록·해시·원본 blob 대조, 62개 이관 파일의 원본 해시 대조, 화면·자료 코드 읽기 확인, 변경 문서의 링크·앵커 확인 | 완료. 앱 시험·빌드·브라우저는 실행하지 않음 |
| 구현 담당 보고 | `/compare/annual` 단위 시험 15건, 타입 검사 | 통과 보고. 이 보고에서 재실행하지 않음 |
| 통합 책임자 | 전체 단위 시험·타입 검사·제품 빌드 | 대기 |
| 통합 책임자 | 브라우저 확인(데스크톱·390px, [연도별 방문 흐름 시나리오](../../apps/web/scripts/annual-trend-e2e.mjs) 포함) | 대기 |
| 통합 책임자 | 다른 담당의 일정·이동·CSV 연결 결과 반영 여부 | 대기 |
| 통합 책임자 | `main` 게시, 이미지 게시·배포, 공개 주소 확인 | 대기 |

## 관련 문서

- [현행 기능·문서·데이터 점검](../review/2026-09-current-state.md)
- [데이터 확보·연결 현황](../research/2026-09-data-inventory.md)
- [축제 담당자 인터뷰 질문지](../research/festival-officer-interview.md)
