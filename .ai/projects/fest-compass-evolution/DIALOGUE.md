# Project dialogue — FEST Compass 실데이터 기반 고도화

This ledger stores final public contributions from the human, Claude, and Codex. Do not record hidden chain-of-thought, raw command logs, secrets, or full native session transcripts.

The state revision is the number of the last `T-NNN` entry below.

## T-001 · Human · chair

- Position: 2026-09-07 사용자는 공모전·실무 활용을 같은 비중으로 추진하고, 실제 축제 한 곳의 과거·현재·향후 예측·운영 결정·기록 축적을 구현하는 7단계 계획을 승인했으며 개발 착수와 Git 반영·WSL 개발환경 준비를 요청했다.
- Evidence:
  - 이 대화의 2026-09-07 사용자 목표 확인 및 '좋아 개발 진행해줘' 지시
- Changes:
  - 승인된 범위를 CHARTER.md와 docs/validation/00-plan.md에 기록
- Validation:
  - 현재 구현·공식 데이터 정의를 사전 점검했으며 실무 검증 완료를 주장하지 않음
- Questions:
  - No open question
- Handoff: Codex

## T-002 · Codex · implementer

- Position: WSL 기준 저장소와 개발환경, 승인 계획·초기 기획 보존, 반복 가능한 KTO 표본 조사 도구를 준비했다. 실제 후보 3곳의 28회 조회로 정상 표본 16·empty 12를 확인했으며 최종 축제 선정과 예측 검증은 다음 단계다.
- Evidence:
  - 기준 제품 1322636, WSL ~/dev/side/fest-compass 및 feat/validation-foundation 작업공간
  - docs/validation/evidence/2026-09-07-kto-profile.json: 28회·오류 0·후보 3곳
  - 기존 Windows API 키는 거부됐으며 기존 app runtime 값 연결 후 성공. 키 발급·회전·클러스터 변경 없음
- Changes:
  - docs/validation/00-plan.md~04-wsl-validation.md와 docs/archive/2026-08-planning/ 원문 3건
  - apps/web/lib/kto/probe.ts, probe.test.ts, scripts/profile-kto.ts, package.json data:profile
  - docs/ops/wsl-development.md 및 문서 지도
- Validation:
  - 앱·데이터·SQLite 자동 테스트 최종 78건, 타입 검사·빌드 통과
  - 격리 DB 브라우저 E2E 통과; 이후 CLI의 날짜·파일 중복 검사 강화는 앱 동작을 바꾸지 않아 브라우저 증거 재사용
  - 배포 계약 검사 및 28개 단위 검사, dev-standard, diff·시크릿 검사 통과
  - 초기 Markdown 보관본 3건 바이트 동일. 상세 범위는 docs/validation/04-wsl-validation.md
- Questions:
  - No open question
- Handoff: Codex

## T-003 · Codex · implementer

- Position: 후보 3곳의 2023~2025 공개 자료를 비교해 논산딸기축제를 개발 샘플로 선정하고, 논산시 일별 외지인 방문 추세를 첫 예측 대상으로 정의했다. 지역 과거 자료는 선택일에서 확인됐지만 연속 자료·당시 공개본·예측 성능은 미검증이다.
- Evidence:
  - docs/validation/05-festival-selection.md: 회차별 일정·발표 총계·측정 한계·운영 자료·25개 출처
  - docs/validation/evidence/2026-09-07-kto-history-days.json 및 kto-history-availability.json: 14회 중 success 10·empty 4·error 0, 지역 관측값 120개
  - docs/validation/evidence/2026-09-07-source-checks.json: 직접 HTTP 23/25 성공, B1·B4 연결 실패는 검색 도구의 공식 본문으로 보완
  - 기준 fbe50f0, 전용 feat/festival-sample-selection worktree. 기존 키만 사용, 앱 DB·클러스터·자격 수명주기 변경 없음
- Changes:
  - docs/validation/05-festival-selection.md~07-selection-validation.md와 계획·문서 지도
  - apps/web/scripts/profile-kto-history.ts, lib/kto/history-probe.ts 및 단위 검사, 조사 경로·npm 명령 추가
  - 논산 2025 사례와 2023~2024 비교, 발행시점 D-28/D-7·정답 필드·단순 기준·오차·시점 증거 조건 정의
- Validation:
  - 최종 npm test 82건, typecheck·build·격리 DB E2E 통과
  - 배포 계약 prepare mode 17개 리소스 및 단위 검사 28건, dev-standard 통과
  - 보고서 14회와 사전 계약 확인 1회를 구분. 기존 증거 덮어쓰기 거부 확인
  - 공주시 결산 PDF 표 시각 확인. 상세 범위는 docs/validation/07-selection-validation.md
- Questions:
  - No open question
- Handoff: Codex
