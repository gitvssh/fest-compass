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

## T-004 · Codex · implementer

- Position: 논산시 2023~2025 연속 이력 1,096일을 확보하고 실제 이력으로 학습하는 첫 회귀 모델·기준 비교·2025 사례 화면을 구현했다. 기본 지연 가정에서 전체 시험 MAE는 선정 기준보다 12.4~18.2% 작지만 축제 4일 WAPE는 36.1~37.1%이고 구간 포함률도 부족하다. 현재 개정자료 실험이며 운영 적용·당시 공개본 재현은 완료하지 않았다.
- Evidence:
  - docs/validation/evidence/2026-09-07-nonsan-history.json: 108페이지·전국 864,747행 검사, 논산 1,096일·3종 별도 보존, 누락/오류 0. 기존 선택일 27개 값과 일치.
  - docs/validation/08-model-experiment.md: 2025 수치 계산 전 후보·시간 분리·지연 가정·채택 규칙 고정. 2024 선택 104일, 보정 36일, 2025 시험 208일을 선행기간별 비교.
  - docs/validation/evidence/2026-09-07-nonsan-forecast.json.gz: 6개 시나리오, 모델 366개, 예측/기준 7,512개, 계수·입력 ID·시점·실패 사유 보존.
  - docs/validation/09-model-validation.md: 실제 오차·구간 포함률·민감도·재현 명령·후속 과제. apps/web/data/nonsan-forecast-summary.json은 전체 결과에서 생성.
- Changes:
  - lib/kto/history.ts와 collect-kto-history.ts: 호출 예산·페이지 체크섬·재개·부분 응답 격리·자료 버전·누락 보고.
  - lib/forecast/: 과거 시점 입력 제한, B1/B2, 실제 학습 회귀, 시간순 평가·구간 보정·실패 기록; 평가·증거 검증 CLI.
  - 홈→/forecast: 28일/7일 전과 지연 가정 선택, 추세 그래프·표·오차·마지막 관측일·출처·운영 적용 한계. 사이트맵 반영.
  - 계획·예측 계약·문서 지도·공동 프로젝트 상태 갱신. 전용 worktree/브랜치에서 수정.
- Validation:
  - Node 24.20.0 / npm 11.19.0 WSL: npm test 95개 통과, 모델 ID 정리 후 관련 7개 재통과, typecheck·production build 통과.
  - forecast:verify: 자료 해시·입력 시점·예측 재계산·기준·구간·평가·화면 요약 일치. 오프라인 전체 재학습 결과는 생성시각을 제외하고 최초 산출물과 동일.
  - E2E 기존 흐름과 예측 시점 전환·390px 모바일 통과, 브라우저 오류 0. 별도 공개 읽기 전용 화면에서 지연 가정 변경·편집 링크 없음 확인.
  - 배포 계약 17개 리소스·28개 테스트와 dev-standard 통과. 공개 운영 배포·현장 검증은 미실시.
- Questions:
  - No open question
- Handoff: Codex
