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

## T-005 · Codex · implementer

- Position: 2026년 자료를 확보하고 조회 시점별 개정·누락 보존, 실제 사전 예측 발행·재현·사후 비교와 읽기 전용 화면을 구현했다. 일반 날짜의 예측 2건을 실제 발행 시각에 저장했으며 아직 결과는 없다. API 공개 지연·다음 축제 회차·자동 예약 실행·축제 효과와 운영 적용은 미확정이다.
- Evidence:
  - docs/validation/evidence/2026-09-07-nonsan-current-history.json: 26회 호출, 2025-12-01~2026-09-06 280일 중 251일 확보·29일 누락·오류 0. 최신 관측 2026-08-08.
  - 이전 수집과 겹친 2025년 12월 31일분의 외지인 값·품질 변경 0건. 합친 1,345일 중 1,316일 확보. 동일 날짜 재조회는 같은 날의 두 수집본 비교이며 실제 공개 지연의 증거가 아니다.
  - docs/validation/evidence/prospective/: 9월 14~17일 D-7과 10월 5~8일 D-28 일반 날짜 예측, 2026-09-07 18:42 한국시각 실제 발행. 입력 마지막 날짜 2026-08-03, 모델·계수·자료 보관본 고정.
  - docs/validation/10-prospective-records.md: 발행·자료 선택·누락·개정·구간 보류·재수집·사후 비교 규칙과 검증. 당시 공개시각은 null, 새 사전 예측의 결과 관측 0일.
- Changes:
  - lib/forecast/vintages.ts: 수집본 검증·시점별 값 선택·개정/철회/제공 전환 관찰. 같은 캐시 재조립은 새 관측으로 세지 않음.
  - lib/forecast/prospective.ts, store.ts, summary.ts와 forecast-records CLI: 실제 시각 발행·동시 실행/덮어쓰기 방지·원본 재현·별도 사후 기록·화면 요약 검증.
  - 홈 및 /forecast에서 /forecast/records 연결. 최신 관측일·누락·발행 입력·일별 예측·결과 대기를 표시. 사이트맵 반영.
  - 2024년에 선정된 v1 설정을 고정하고 실제 확보한 2026년 과거까지 계수 재학습. 기존 실험의 구간 포함률 부족으로 사전 발행의 범위는 보류. 계획·계약·문서 지도·프로젝트 상태 갱신.
- Validation:
  - Node 24.20.0 / npm 11.19.0 WSL, e8afe23 기반 전용 feat/forecast-vintages: npm test 102개·typecheck·production build 통과. 요약 검증 CLI 분리 후 관련 4개 테스트·타입 검사 재통과.
  - forecast:records verify: 실제 발행 2건·사후 기록 2건을 보관본으로 재학습·재계산하여 일치. 화면 요약도 일치. 미래 입력·오래된 입력·0/누락·동시 요청·충돌·변조·개정 보존 테스트 통과.
  - 최종 E2E 기존 결정·성과·복제 흐름 및 신규 화면·상세 펼치기·390px 문서 넘침 검사 통과. 공개 읽기 전용 화면에서 편집 링크 없음·콘솔 오류/경고 0 확인.
  - 배포 계약 17개 리소스·28개 검증기 테스트·dev-standard 통과. 공개 운영 배포·예약 수집 설치·실무자 관찰은 미실시.
- Questions:
  - No open question
- Handoff: Codex

## T-006 · Codex · implementer

- Position: 매일 한국시각 09시 수집·사전 발행·결과 확인을 운영 서비스에 연결하고 첫 실제 처리와 공개 화면을 확인했다. 기존 예측 2건은 보존됐으며 관측 결과는 아직 없다. 공휴일·축제의 공식 근거와 향후 평가 계획을 정리했고 다음 모델은 개발 필요 상태다.
- Evidence:
  - docs/validation/11-daily-automation.md: 소스 3eb86e1, 이미지 발행 실행 34115679879 성공, 검증 digest 32db6593…10ba9c4d, 선언 c8bbbac의 기존 앱 sync Succeeded·Synced·Healthy.
  - docs/validation/evidence/2026-09-07-nonsan-daily-production.json 및 daily-production-result.json: 운영에서 20:20 한국시각 7회 호출, 최근 90일 중 61일 확보·29일 누락·오류 0. 기존 합계 1,316일과 예측 ID 2건 유지.
  - docs/validation/12-calendar-model-plan.md: 우주항공청 월력·논산 공식 자료. 2027년 엑스포 2/26~3/21 24일 계획은 기존 4일 축제와 다르고 이전 공식 계획에서 일정도 변경됐다.
- Changes:
  - apps/web/lib/forecast/daily.ts, runtime.ts, worker 실행 번들·잠금 진입점·보존 초기 자료·일정 파일. 원자적 요약 교체와 heartbeat, 당일 호출 상한·실패 보존·소급 금지.
  - 기존 Deployment/PVC/Secret 범위 안에서 worker 연결. 예측 하위 디렉터리만 마운트하고 SQLite 접근 분리. 새 클러스터 권한·자격 발급 없음.
  - 공개 /forecast/records에서 자동 상태·최신 자료·사후 대기·발행 일정을 읽고 새로고침으로 갱신. 9/28의 10월 D-7 등록.
  - 계획·검증 보고서·운영 문서·문서 지도 갱신. 11/5~1/31 목~일 13개 창·52일 향후 시험 계획, 최초 D-28 10/8. 모델 v2 구현·시험 발행은 아직 없음.
- Validation:
  - WSL Node 24.20.0/npm 11.19.0: 앱 109개·타입·빌드·격리 DB E2E 통과. exact source CI도 109개·타입·빌드·운영 audit·infra 39개 통과. 활성 manifest 추가 후 infra 40개·release 계약 17개 리소스 통과.
  - 실제 로컬 및 운영 조회 각 7회. 운영 수집본 전체 해시·필드·페이지 근거 검사 통과. 기존 예측 2건 ID·DB 행 개수 유지, worker에서 SQLite 경로 없음.
  - 운영 web/worker 2/2·재시작 0, 실제 imageID 일치, heartbeat·liveness 정상. 원본 서버 health/기록 경로 200.
  - 공개 브라우저에서 처리 전 보관본→처리 후 실제 요약 갱신 확인, 2개 표·다음 발행 표시·편집 없음. 1440/390px 넘침 없음, 콘솔 오류/경고 0. 미래 실행·정답 도착·현장 적용은 미검증.
- Questions:
  - No open question
- Handoff: Codex

## T-007 · Codex · implementer

- Position: 공식 달력과 과거 이력으로 네 후보를 학습하고 공휴일 모델의 겨울 사전 시험 26건을 운영 등록했다. 개발 540일에서 v1 대비 MAE 10.6~11.6% 감소를 확인했다. 축제 입력 후보는 제공일·학습 회차가 부족하고 축제일 과소예측도 남아 있다. 공개 비교 화면은 사용 가능하며 실제 향후 결과는 아직 없다.
- Evidence:
  - docs/validation/13-calendar-experiment.md: 공식 출처 15개, 2023~2026 공휴일 18/19/19/22일·축제 4회, 1,316일 개발 관측·135개 창·선행기간별 540일·모델 1,104개.
  - apps/web/data/calendar-trial-plan.json: 411d2207f62d531413671b6c16e3193e225db74ecab95b97cce23a5b481ef351. 2026-10-08 최초 발행, 달력·보고서·코드 14개 고정. 60/90일 결과·누락·미실행 별도 보존.
  - docs/validation/evidence/2026-09-07-calendar-production.json: 실제 2026-09-07 21:17 한국시각 등록, 예정 26·발행 0·결과 0. 기존 예측 2건·수집 결과 파일 해시 일치, API 7회 유지.
  - 소스 2770229, CI 34120484088 전용 homelab-fest-compass 성공, 이미지 sha256:7ebad161407038aa8e074cc55a32555c3fc49d578d1084a7bc9713c22ee4e6fd, 활성화 1998d98 Succeeded/Synced/Healthy.
- Changes:
  - 공휴일 추가 공표 시점·미확인 일정 보류, 실제 회귀 학습·시간순 비교·연도 제외 민감도·재현 CLI 추가.
  - 겨울 시험의 등록·발행·60/90일 결과 보존과 재현을 기존 매일 처리에 연결. 수집 재조회 없이 등록하며 기존 v1 자료·설정 유지.
  - /forecast/calendar에 선행기간별 비교·제공률·실제 시험 상태·일정 근거·한계를 표시. 계획·운영 절차·검증 문서 갱신.
- Validation:
  - CI의 최종 소스에서 앱 118건·타입 검사·빌드·운영 의존성 감사·배포 계약 40건·원격 이미지 검증 통과.
  - 개발 보고서 전체 재계산(모든 모델·예측·민감도·요약) 일치. 기존 v1 예측 2건·사후 기록 2건 재현 일치.
  - 격리 SQLite E2E와 실제 공개 브라우저에서 D-28/D-7 전환·등록 완료·미래 미발행·읽기 전용·390px 넘침 없음·오류/경고 0 확인.
  - 운영 웹·worker 2/2 Ready·재시작 0, worker health 통과, worker에서 SQLite 파일 비노출 확인.
- Questions:
  - No open question
- Handoff: Codex

## T-008 · Codex · implementer

- Position: 2022년 선행 이력과 2023년 축제 학습 비교를 구현·검증·게시했다. 평균 개선과 최근 회차 악화를 함께 공개하는 화면이 준비됐다. Harbor 보관 한도 초과로 새 화면 배포만 구 이미지 정리 승인 대기다.
- Evidence:
  - docs/validation/14-festival-history.md: 365/365일, 공통 436/472일 비교, 학습 축제 정답 0/4/8→5/9/13일, 최근 두 회차 악화
  - docs/validation/evidence/2026-09-07-nonsan-festival-history.json.gz: 540개 모델·모든 예측·입력·계수와 재현 해시
  - docs/validation/evidence/2026-09-07-festival-history-release.json: CI 검증 통과·이미지 push quota 실패, 실제 보관소 6개/보호 2개/정리 후보 4개
- Changes:
  - 2022년 자료·네 방법 비교·2023년 제외 민감도·/forecast/history·사이트맵·E2E·후속 문서 추가
  - 소스 6dce3c6cb29a9dab4f2cb5d27bb728bb0dd47200 main 게시
  - 기존 달력·겨울 계획·고정 코드 14개·운영 이미지와 저장 자료 유지
- Validation:
  - 전체 재계산 일치, 로컬 앱 테스트 120건·타입 검사·빌드·E2E·배포 계약 40건 통과, 운영 의존성 취약점 0
  - 기존 예측 2건·사후 기록 2건 재현, 겨울 시험 코드 14개 해시 일치
  - CI 34126770861: 전용 ARC에서 검증 단계 success, 이미지 push quota 초과로 전체 failure; 원격 이미지 검증과 배포는 미완료
  - 읽기 전용 운영 확인: 기존 이미지·겨울 등록 26건·예측 2건·매일 API 7회·확보 1,316일·누락 29일 유지; 새 화면 공개 검증 미실시
- Questions:
  - 현재/직전 복구 이미지를 보존하고 docs/ops/forecast-history-release.md의 미사용 이미지 4개 정리와 기존 매일 자동 정리 정책 연결을 승인할지 사용자 답변이 필요하다.
- Handoff: Codex

## T-009 · Codex · implementer

- Position: 사용자 승인 범위의 이미지 정리·자동 정책 연결과 배포 복구를 마쳤다. 모델 정확도보다 MVP 기능을 우선하라는 요청에 따라 개인 작업의 자료·운영안·결정·현장·결과·다음 회차 흐름을 구현하고 공개 사이트에서 검증했다.
- Evidence:
  - docs/ops/forecast-history-release.md: 승인된 4개 정리, 보호본 2개 보존, retention 17 연결, 기존 CI 재실행과 이력 화면 배포 완료
  - docs/design/06-mvp-workspace.md: 개인 작업의 5단계와 저장·결정·결과 기준 및 사용자 과제
  - docs/validation/15-mvp-journey.md 및 evidence/2026-09-08-mvp-production.json: 배포·검증·보존 증거
- Changes:
  - 홈의 주 동선을 내 축제 작업 시작으로 개편하고 /workspace 구현
  - 브라우저 자동 저장·JSON 복원·선택 당시 입력 보존·실측 비교·보고서·다음 회차·의견 파일 제공
  - 기능 소스 6fee76a76fe13ae0f26794053d0fdebd8a9b4704와 검증 이미지 4af5b4104d9e2d3c97d3e8b6e66d89f7e8f19d02f215a1a092dfdd8c05584789 게시·등록 앱 sync
  - 모델 추가 개선을 미루고 화면·기능 피드백 우선으로 계획 개정; 기존 ADR·서버 쓰기 차단·고정 모델 유지
- Validation:
  - 앱 127건·배포 계약 40건·타입·빌드 통과, 운영 의존성 취약점 0, 겨울 코드 14개 해시 일치
  - CI 34173719257 전용 ARC 성공, a7d7df2be31eb831c601827590f12cbe3c2a15f6 배포 Succeeded/Synced/Healthy
  - 공개 Chromium 전체 작업 E2E 통과: 분석 거부, 앱 쓰기 0, 오류 0, 390px 넘침 0, 저장·파일·0/결측·결정 보존·보고서·복사·탭 충돌 확인
  - 2026-09-08 09시 수집 7회·1,317일·최신 8/9·누락 29일 유지, 기존 예측 2개와 겨울 원본 등록 26건 보존
- Questions:
  - No open question
- Handoff: Codex

## T-010 · Codex · proposer

- Position: 현재 제품은 논산 분석과 개인 운영 기록에 치우쳐 지도 기반 기획 의사결정이 빠져 있었다. 사용자가 명확히 한 지자체 중심 목표를 반영해 지도·조회·비교에서 아이템·장소·시기·예산·준비 규모를 결정하는 제품 마일스톤을 명시했다. 이번에는 문서만 갱신했으며 지도 기능을 개발 완료로 표시하지 않는다.
- Evidence:
  - docs/validation/00-plan.md의 기존 7단계는 작업 절차이며 지자체 지도·비교검색의 명시적 완료 기준이 없었음
  - apps/web/app/festivals/new/page.tsx: 편집 모드 전용 이름 검색. 현재 apps/web/app·components에는 지도 화면 없음
  - apps/web/lib/workspace.ts 및 components/PersonalWorkspace.tsx: 수기 장소·총예산·자원·결정·실측 기록, 지도 근거와 항목별 비용 산출 연결 없음
  - 2026-09-08 사용자: 지자체 담당자 타겟, 내 지자체 1차·주변 현재/과거 축제 2차 정보 수요, 올해 축제 아이템·위치·예산·준비 기획이 목표
- Changes:
  - docs/design/07-region-planning-milestones.md: M1~M6·현재 상태·완료 기준·근거 담기 흐름·첫 실무 과제 추가
  - CHARTER.md·00-plan.md·설계 인덱스에 지자체 중심 목표와 M1→M2→M3 우선순위 반영
  - 06-mvp-workspace.md와 STATE.md에서 개인 운영 기록 완성과 전체 제품 MVP 완성을 구분
- Validation:
  - 제품 코드·라우트·설계·프로젝트 기록을 대조해 개발 필요 범위를 확인
  - 문서 상대 링크·변경 범위·diff 검사 및 project-dialogue 구조 검증
  - 앱 테스트·빌드 미실행 — 제품·의존성·배포 선언 변경 없는 문서 작업. 기존 배포 검증은 docs/validation/15-mvp-journey.md 유지
- Questions:
  - No open question
- Handoff: Codex

## T-011 · Codex · implementer

- Position: 사용자 요청에 따라 개발보다 기획·요구사항·기능목록·화면설계·와이어프레임을 먼저 구체화하고 내부 traceboard에 검수본을 게시했다. 새 지도·비교·기획 기능은 개발 전이며 실제 담당자 검수와 제품 인수 시험은 미실시다.
- Evidence:
  - docs/review/2026-09-planning-review.md: 검수 순서·질문·개발 착수 기준
  - docs/sdlc/: 기획·자료 계약·기능 23개/비기능 6개·UC 8개/AC 26개/TS 8개·화면 7개
  - docs/validation/16-planning-review-publication.md: 원천 커밋·그림/링크/추적 검사·내부 배포 검증
  - 홈랩 내부 검수 사이트(주소 비공개): portfolio/fest-compass/site/pages/docs-review-2026-09-planning-review.html
- Changes:
  - 제품 범위·용어집·CHARTER·마일스톤·실행 계획에 D0 문서/시안 검수를 개발 앞에 반영
  - SCR-FC-001~007 편집 원본·SVG, 지역 지도 작은 화면 시안 포함
  - traceboard.yaml과 traceboard 내부 포트폴리오 등록; 기존 FR/UC/SCR ID·accepted ADR·제품 코드·모델·수집기 유지
- Validation:
  - 문서 구조·상대 링크·Mermaid 5개·Excalidraw 7개 참조 검사·SVG 재생성 7개 해시 일치
  - traceboard: 기능 FR 23·NFR 6·UC 8·AC 26·TS 8·화면 7 모두 연결, 문서 30개와 그림 7개; 위반 0·미평가 R3/R4/R5/R6 4개
  - 실제 브라우저: 그림 7개 육안 검토·화면 흐름·문서 검색·페이지 링크 확인
  - 신규 제품 인수 시험·앱 테스트·빌드 미실행: 제품/의존성 변경 없음. 기존 운영 검증을 새 기능 통과로 환산하지 않음
  - 내부 게시 접근성 1,556 페이지 검사 조합 위반 0·미평가 0; traceboard-dev 86a4585 Succeeded/Synced/Healthy, HTTPS 48개 파일 원본 해시 일치와 실제 그림 7/7 확인
- Questions:
  - No open question
- Handoff: Codex

## T-012 · Codex · reviewer

- Position: 공개 지자체 축제 업무 사례와 예산·집행 문서를 조사해 기존 기획의 보완안 8개를 작성하고 내부 traceboard에 게시했다. 다음은 이 근거를 요구·화면 문서에 반영하는 작업이다.
- Evidence:
  - docs/research/2026-09-municipal-festival-cases.md: 경기 광주·논산·원주·제주·중랑 핵심 5개 사례
  - docs/research/2026-09-municipal-festival-sources.md: 공식 출처 8건, 직접 접근 실패·열람 범위 구분
  - docs/research/evidence/2026-09-source-checks.json: 내려받은 원본 5개 식별과 확인 범위
  - docs/validation/17-municipal-research-publication.md: 문서 원천 51d2f55, 내부 게시 5ea684a
- Changes:
  - 조사·출처·요구사항/화면 보완안 3문서와 원본 식별 대장 추가
  - 검수 안내·업무 흐름·색인·traceboard 설정에 조사 문서를 연결
  - 제품 코드·모델·수집·기존 SRS/UC/TS·7개 시안은 변경하지 않음
- Validation:
  - 문서 구조·추적 위반 0; 미평가 규칙 4개 유지
  - Mermaid 2개, 게시 문서 33개 상대 링크 검사 통과
  - 발행 접근성 1,560페이지 검사 조합: 위반 0·미평가 0
  - HTTPS 51개 파일 SHA-256 일치; 실제 보고서→보완안 링크·8개 항목 확인
  - traceboard-dev 5ea684a Succeeded/Synced/Healthy, 이미지 cb5d79a 일치
  - 앱 테스트·실제 공무원 인터뷰·사용성 효과 측정은 미실시
- Questions:
  - No open question
- Handoff: Codex

## T-013 · Codex · implementer

- Position: 공개 사례 보완안 8개를 기획·자료·SRS/UC/TS와 7개 화면 v2에 반영하고 내부 traceboard에 게시·검증했다. 지도 중심 MVP 순서와 개인 저장 경계를 유지한다.
- Evidence:
  - docs/research/2026-09-municipal-requirement-proposals.md
  - docs/validation/18-municipal-planning-v2.md
  - FEST 원천 74c3faf363b4cf59ede3d991da340466202ee26d; traceboard 게시 fe067d1279b3dcda4ec801e34237fa430da42f35
- Changes:
  - 사업·수행 관계, 장소 기간/조건, 재원/지출·금액 단계·범위·분류, 준비 과제, 결과/개선·출력 계약 반영
  - 기존 FR 23/NFR 6/UC 8/TS 8·화면 7 ID 유지, AC 26→44. v2 소스/SVG 7쌍 추가, v1 14개 파일 보존
  - 검수 안내·마일스톤·용어·설계 연결 갱신. 앱·모델·수집·공개 배포 설정 변경 없음
- Validation:
  - 문서 구조·추적 누락 0, 미평가 4 유지. AC 본문 정합 44/44, 신규 TS 모두 미실행
  - Excalidraw 참조 7/7, SVG 두 번 렌더 해시 일치 7/7, Mermaid 7블록 파싱, 사이트 링크 누락 0
  - 내부 발행 접근성 1,576 검사 조합 위반/미평가 0. 배포 Synced/Healthy·이미지 일치·가용 1
  - 실제 HTTPS 파일 SHA-256 51/51 일치. 검수 안내→v2 시안 7개 및 흐름 4개 브라우저 확인
- Questions:
  - No open question
- Handoff: Codex

## T-014 · Codex · implementer

- Position: 전국 시작·실자료·시각화 검토안을 요구사항과 7개 v3 시안에 반영하고 내부 Traceboard에 게시·검증했다. 신규 지도·일반 과거 검색·기획 기능은 개발 필요이며 모든 브라우저 검증은 headless로 수행했다.
- Evidence:
  - docs/sdlc/2-design/data-visualization.md
  - docs/research/2026-09-historical-comparison-review.md 및 evidence/2026-09-visualization-fixture.json
  - docs/validation/19-national-comparison-v3.md 및 evidence/2026-09-08-planning-v3-publication.json
  - FEST 원천 387af0e87ec80db1c22f0d0de817ad79585428da; Traceboard 게시 6a19ba87b85837b54809a5bdd29aa0696bd9435c
- Changes:
  - 남한 전국→시도→시군구·상위 복귀와 명시적 우리 지역 이동, 자료 확보 범위·페이지 완료 표시 계약
  - 논산 실제 45개 일별 값 선그래프·일정표, 원주 지원사업 계획/집행 막대·재원 도넛, 예산 미산정 구성비 보류
  - 기존 FR 23/NFR 6/UC 8/TS 8/화면 7 ID 유지, AC 44→54. v1·v2 자산 28개 보존
  - 앱·모델·수집·FEST 배포 선언 변경 없음. 내부 Traceboard 동시 게시 이력 병합·기존 다른 프로젝트 수정 보존
- Validation:
  - 구조·추적 위반 0, 미평가 4 유지, UC 본문/YAML·TS 인수 기준 54개 일치
  - 원천 해시·실제 45개 값과 그래프 좌표 대조, 원주 재원 합계 2개 대조
  - Excalidraw 7개 참조·SVG 7개 재생성 일치·Mermaid 8블록 파싱·사이트 링크 누락 0
  - headless 접근성 1,576 검사 조합 위반 0·미평가 0. 실제 HTTPS 53/53 파일 해시 일치
  - 실제 v3 그림 7/7·흐름 5/5·390px 가로 넘침 0. 배포 Succeeded/Synced/Healthy 및 이미지 일치
  - 앱 테스트·신규 TS·실무자 관찰 미실행. 제품·의존성 변경 없는 설계/검수 작업이며 기존 모델 계획 유지
- Questions:
  - No open question
- Handoff: Codex

## T-015 · Codex · implementer

- Position: M1 전국→시도→시군구 조회와 개인 근거 보관을 구현·공개했다. 실제 관광자료·논산 방문 추세·당시 근거를 연결하고 내부 Traceboard에 실제 화면과 검증 범위를 게시·확인했다. 전체 과거 회차 비교·기획 후보·예산 연결과 실무자 관찰은 후속이다.
- Evidence:
  - docs/sdlc/2-design/region-explorer-implementation.md
  - docs/validation/20-region-explorer.md
  - docs/validation/evidence/2026-09-08-region-explorer-production.json
  - 기능 ba4732289bb60dce1eb994b97c7f88f873273bbf; 앱 배포 bbd4bdace21083ee914a29ebcfedb7eb5e40827d; CI 34196206622
  - Traceboard 문서 원천 1dc8abca1a2b36917996725bce5e02da8eb6234b; 게시 9c5b4fce71a5ddbe956586aced289b896daa0423
- Changes:
  - 전국 기본 진입·선택 뒤 펼쳐지는 시군구·상위 복귀·명시적 우리 지역·390px 두 선택창
  - 공식 조회 목록 269행/16시도 그룹·개편 코드·세종 36110 예외 보존. 관광지/문화시설/기간 내 시작 행사 완전 조회·출처·좌표 누락·조회 순서 검사
  - 논산 보관 방문 이력 선그래프/수치 표, 개인 근거 사본·중복 방지·공간 조건·파일 보관/복원. 기존 개인 작업에 근거 보기 연결
  - M1 현황·UC/TS의 구현 범위와 후속 구분, 실제 화면 4개와 공개 검증 기록. 예측 모델·겨울 계획 유지
- Validation:
  - 단위 135건·배포 40건·타입/빌드·고정 코드 14개 해시·의존성 audit 통과
  - 기존 편집/공개 개인 작업 E2E 및 신규 지역 14개 흐름+공간 필터 검증. 모두 headless, 새 흐름 오류/앱 쓰기 0·390px 넘침 0
  - 공개 전국→충남→논산, 관광지 61건·2026 행사 4건·세종 관광지 54건·3/27 52,671.5명 저장/재조회 확인
  - 앱 Synced/Healthy/Succeeded·1 replica. 배포 전후 기존 예측 2개·최신 관측 2026-08-09·겨울 시험 내용/hash 보존
  - Traceboard 추적 누락 0·4개 정형 연결 미평가 유지. 내부 접근성 1,680 화면 조합 위반/미평가 0
  - Traceboard 게시 파일 59/59 SHA-256 일치·실제 화면 4/4 로드·390px 넘침 0, 등록 앱 Synced/Healthy/Succeeded 확인
- Questions:
  - No open question
- Handoff: Codex

## T-016 · Codex · implementer

- Position: 지도 표기를 전국으로 통일하고 M2 첫 축제 비교를 공개했다. 실제 과거 8회차·지역별 현재 등록 행사·그래프·선택 당시 근거 보관을 연결하고 Traceboard에 실제 화면을 게시·검증했다. 다음은 M3 기획 후보와 근거 연결이며 전국 과거 전수자료와 지도 품질 보완은 남아 있다.
- Evidence:
  - docs/sdlc/2-design/festival-comparison-implementation.md
  - docs/validation/21-festival-comparison.md
  - docs/validation/evidence/2026-09-08-festival-comparison-production.json
  - docs/validation/evidence/2026-09-08-comparison-source-checks.json
  - 기능 181144c3a9505f916dcbc11cca16d562f6436d0c; 앱 배포 78e182a5601304ac5c02dca86df99bd59ec56f13; CI 34202154992
  - Traceboard 문서 원천 fdfe3cd94a2ab46fe7dcf753044fd0debb0146fd; 게시 c5f27a68fac5b14973a663354abe197d998c662a
- Changes:
  - 제품 UI·활성 기획의 전국 표기, 전국/지역 조회→비교 동선·홈/탐색/검색 색인 연결
  - 독립 회차 8개·현재 지역 최대 3곳 조회·필터·지표별 확보 상태, 선택 최대 3회차와 당시 조회 조건 보존
  - 실제 방문값 45개 추세/상대일/점·구간 선택·수치 표, 연도별 일정과 실제 겹침, 비용 범위/단계별 막대·합계 확인 재원 도넛
  - 비교 근거 사본·파일 보관/복원·중복/손상 방어·모바일/인쇄, 기존 지역 근거와 개인 저장 경계 유지
  - 요구·인수 기준과 기획 현황 갱신, 실제 화면 3개·출처 점검·운영 검증 기록. TS-FC-002 전체 완료로 확대하지 않음
- Validation:
  - 단위 143개(신규 비교 8개)·배포 선언 40개·타입/빌드·운영 의존성 검사 통과. 전용 ARC CI에서 대상 소스 재검증
  - 기존 편집·개인 작업·지역 흐름과 신규 비교 21개 headless 흐름 통과. 신규 오류/앱 쓰기 0·390px 넘침 0·인쇄 출처 확인
  - 과거 45개 관측 원값 전수 일치·공식 URL 9개 HTTP 200·기존 확인 원문 해시 4개 일치. 나머지 동적 HTML은 기존 검토본 식별 유지
  - 공개 전국→충남→논산→비교, 논산 D0 52,671.5명 보관/재조회·공주/임실 4일 겹침·원주 재원 도넛 확인. 2026 시작 행사 논산 4·공주 3·부여 4건 각 조회 완료
  - 공개 콘솔 오류/경고 0·390px 넘침 0·7개 URL HTTP 200. 앱 Synced/Healthy/Succeeded·1 replica·검증 이미지 일치
  - 배포 전후 기존 예측 2개·방문 상태·겨울 시험의 내용 해시·당일 자동 처리 식별 보존. 모델·겨울 고정 코드·데이터베이스 구조 유지
  - Traceboard 접근성 1,680 화면 조합 위반/미평가 0·추적 누락 0·정형 연결 미평가 4개 유지
  - Traceboard 실제 HTTPS 64/64 파일 SHA-256 일치·그림 3/3 디코드·390px 넘침 0·제품 비교 링크 확인. 콘솔은 기존 favicon 404 한 건
  - Traceboard Synced/Healthy/Succeeded·검증 이미지 일치·가용 1개. 동시 게시 13개 프로젝트 원천이 동일/최신임을 확인하고 두 게시 이력을 보존해 병합
- Questions:
  - No open question
- Handoff: Codex

## T-017 · Codex · implementer

- Position: M3 기획 후보를 공개해 M1 지역 자료·M2 비교 근거와 아이템·장소·시기 판단을 연결했다. 두 후보의 항목·일정과 장소·준비 확인을 비교하고 당시 자료를 보관·복원할 수 있다. 다음은 M4 예산·준비 규모 비교이며 전체 MVP 완료와 공식 승인으로 확대하지 않는다.
- Evidence:
  - docs/sdlc/2-design/planning-options-implementation.md
  - docs/validation/22-planning-options.md
  - docs/validation/evidence/2026-09-08-planning-options-production.json
  - 기능 590c80599c07113df19ad6900c64122fa6887afd; 앱 배포 c2d45fed92463d705c793082dc402916fe152fc9; CI 34208955839
  - Traceboard 문서 원천 3260214858010f054589cd918bc30c11f61567e9; 게시 bc69393e91beb55b614e6b25eb1b11a832a5d22d
- Changes:
  - 담은 지역/비교 근거→기획 후보 동선, 담당 지역·사업·복수 수행 관계와 최대 6개 후보
  - 아이템/대상/장소/시기/선택 판단에 당시 근거 사본·출처·조회 조건과 참고 이유 연결. 후보 항목 비교·공통 날짜 일정 그래프
  - 설치/행사/철거별 장소 확인, 준비 과제·선행 관계·해당 없음·업무 진행과 외부 확인 분리. 조건 변경 시 이전 확인 보존·재확인
  - 최대 20개 불변 보관본·초안/파일 복원·다른 창 충돌/공간 부족/손상 파일 방어. 후보 복사 시 선택·확인·준비 진행 초기화
  - 요구·화면·검수 안내·검증 범위와 실제 화면 4개 갱신. 모델·데이터베이스·겨울 계획 유지
- Validation:
  - 단위 154개(신규 기획 11개)·타입/빌드·배포 계약 40개·운영 의존성 취약점 0. 전용 ARC CI 성공과 원격 digest 검증
  - 기존 편집/개인 작업/지도/비교와 신규 기획 27개 headless 흐름 통과. 신규 오류/앱 쓰기 0·390px 넘침 0
  - 공개 강경근대거리 관광자료·논산 실제 D0 근거 연결, 공주시 담당 지역 유지·검수용 두 후보 일정 비교·보관. 연결 해제 후 당시 52,671.5 재조회
  - 공개 브라우저 콘솔 오류/경고 0·10개 URL HTTP 200·390px 넘침 0. Python 직접 조회의 경계 403은 통과에서 제외
  - 앱 Synced/Healthy/Succeeded·1 replica·검증 이미지 일치. 전후 기존 예측 2개·겨울 시험·모니터 의미 값·당일 자동 처리 식별 보존
  - Traceboard 접근성 1,680 화면 조합 위반/미평가 0·추적 누락 0·정형 연결 미평가 4 유지. 실제 HTTPS 70/70 파일 SHA-256 일치·그림 4/4 디코드·390px 넘침 0·제품 링크 확인. Synced/Healthy/Succeeded·이미지 일치·가용 1개. 콘솔은 기존 favicon 404 한 건
- Questions:
  - No open question
- Handoff: Codex

## T-018 · Codex · implementer

- Position: M4 후보별 예산·재원·준비 규모 비교를 공개하고 Traceboard 검수본을 게시했다. 금액 산출·그래프·원문 단계 기록·이전 기획 복원을 연결했다. 다음은 M5 완성 기획안·사업설명/준비 목록 출력이며 전체 MVP 완료로 확대하지 않는다.
- Evidence:
  - docs/sdlc/2-design/budget-implementation.md
  - docs/validation/23-planning-budget.md
  - docs/validation/evidence/2026-09-09-planning-budget-production.json
  - 소스 dcf1f5f5d710f086193eba78b0fe5934caa8790f; 배포 f51c0d0cd37979fbca02962fa0b6604e6408fc63; CI 34254837134 attempt 2
  - Traceboard 문서 원천 61d5333ecde3ae82da31cf8bb72ccc42ff23d82b; 게시 d3592a8ca8589b1e5966f0f7e9f75086f6bbd204
- Changes:
  - 기획 후보와 같은 초안의 /planning/budget, 재원/지출 분리·수량/기간/단가·원 반올림·미산정/0·세금/범위 보류
  - 0축 후보 금액 막대·총액 병기 구성비·독립 재원/지출 도넛과 수치 표. 같은 재원·상하위 분담 중복 검사
  - 단계별 원문·누계·출처·단위·분류 연도 보존, 준비 과제·당시 근거 연결, 이전 예산 대비 변경 이유
  - 기획 파일 v2·v1 읽기·기존 불변 보관본 보존, 작성 중 원문 입력 저장·조건 변경 재확인·후보 복사 초기화
  - M4 요구·인수·검수 문서와 실제 화면 4개. 운영 모델·겨울 시험·DB 구조 유지
- Validation:
  - 단위 168개(예산 14개)·타입/빌드·배포 계약 40개·운영 의존성 취약점 0·변경 Mermaid 1개 통과
  - 전체 기존 E2E와 신규 예산 23개 headless 흐름 통과·오류/앱 쓰기 0·390px 넘침 0
  - 공개 두 후보 500000/600000원·독립 도넛·VAT 미확인 보류·단계 원문 3개 보존·수량 수정 후 보관본 불변·500000원 복원
  - 공개 11개 URL HTTP 200·예산 사이트맵·저장/새로고침 유지·콘솔 오류/경고 0. 앱 Synced/Healthy/Succeeded·1 replica·이미지 일치
  - 첫 CI quota 실패 뒤 기존 정기 retention으로 400733491 bytes 확보·정책 차이 0; 같은 실패 job 재실행 성공. 수동 삭제/증액 없음
  - 배포 전후 예측 2개·겨울 시험·모니터 의미 값·당일 처리 식별 보존
  - Traceboard 1684 접근성 조합 위반/미평가 0·실제 76/76 파일 SHA-256 일치·그림 4/4·390px 넘침 0. 기존 favicon 404 한 건
  - Traceboard 동시 게시 두 이력 보존·13개 프로젝트 원천 동일/최신 확인. Synced/Healthy/Succeeded·이미지 일치·가용 1개
- Questions:
  - No open question
- Handoff: Codex

## T-019 · Codex · implementer

- Position: M5 기획안 불변 보관과 사업설명/준비 목록 출력을 공개하고 검수 문서를 연결했다. 다음은 M6 결과·다음 회차 연결이며 전체 MVP나 실무자 검수 완료로 확대하지 않는다.
- Evidence:
  - docs/sdlc/2-design/proposal-implementation.md
  - docs/validation/24-planning-proposal.md
  - docs/validation/evidence/2026-09-09-planning-proposal-production.json
  - 최종 앱 소스 1e63741279f7170b430fee07f30945c0f1f35c0a; CI 34298889931; 배포 f0e557e5202c9d47f91c499923e6d2dd378ac1f1
  - Traceboard 원천 285a4e3b08e8e13f7bab40d7ee33d657378a7877; 게시 d0a2fef202841c3180b55f84c4411a049032e3c4
- Changes:
  - /planning/proposal, 불변 기획안·선택 이유·측정 계획·두 종류 PDF, 보관본의 그래프/표/출처/준비 상태 유지
  - v3 개인 파일·v1/v2 호환·동시 창 충돌/변조/한도 검사, 기존 보관본과 직전 초안 보존
  - M5 요구·인수·검수 문서와 실제 화면 5개, 운영 DB·모델·겨울 시험 유지
- Validation:
  - 단위 175개(신규 7)·headless 신규 14개 및 기존 전체 흐름·타입/빌드·배포 계약 40개·운영 취약점 0
  - 공개 두 PDF·새 버전 저장·P1 보존·파일 가져오기·390px·12개 URL HTTP 200·사이트맵 확인
  - 최종 실제 45값과 지역 15점·자료 확보 한국어·명시적 비교 기준·PDF 수치 대조, 브라우저 오류/기획 앱 쓰기 0; Cloudflare Zaraz 요청은 별도 분류
  - 예측 2건·겨울 시험·모니터 의미 값·당일 자동 처리 식별의 전후 보존
  - 최종 CI 34298889931와 배포 f0e557e5202c9d47f91c499923e6d2dd378ac1f1: Synced/Healthy/Succeeded·가용 1개·이미지 일치
  - 이미지 표식과 선언 순서 불일치로 중단된 후속 승격을 검증된 첫 이미지 반영→후속 CI로 복구. 검사 우회·수동 삭제·quota/권한 변경 없음
  - Traceboard 접근성 1676 조합 위반/미평가 0·HTTPS 83/83 파일 SHA-256 일치·그림 5/5·390px 넘침 0. 기존 favicon 404 한 건. Synced/Healthy/Succeeded·이미지 일치·가용 1개
- Questions:
  - No open question
- Handoff: Codex

## T-020 · Codex · implementer

- Position: M6 운영 결과·실제 비용·다음 회차 연결의 구현과 검증, Traceboard 게시를 완료했다. 공개 앱은 Harbor 1GiB quota 때문에 기존 M5 상태이며 M6는 아직 사용할 수 없다. 정확한 정리 대상 4개를 문서화하고 비삭제 모의 실행을 완료했다. goal은 앱 배포·공개 검증이 남아 완료하지 않았다.
- Evidence:
  - docs/validation/evidence/2026-09-09-planning-outcomes-production.json
  - docs/validation/25-planning-outcomes.md
  - docs/ops/planning-outcomes-release.md
  - docs/sdlc/2-design/outcome-implementation.md
  - apps/web/app/planning/outcomes/page.tsx
  - apps/web/lib/planning/outcome-model.ts
  - apps/web/scripts/outcome-e2e.mjs
  - docs/design/07-region-planning-milestones.md
  - docs/review/2026-09-planning-review.md
  - traceboard.yaml
  - CI 34302743602 source c3e53b3: 코드 검증·이미지 빌드 통과, push quota 실패; 원격 검증·marker 승격·배포 미실행
  - Traceboard df6508c1eb2020a58d2f6e9ed28a5b8564aa8fe2: Synced/Healthy/Succeeded, generation 45, image b3c8fe4948a736745eaab6f2b0c785d49690fac21b3ff491f686fcb829708062
  - Harbor dry-run 3576 success: 전체 6, 보호 2, 후보 4; 실제 삭제 없음
- Changes:
  - M6 공개 비용 사례·개인 결과 입력·계획/실측 차트·재원별 실제 비용·불변 결과 출력·과거 회차 검색·다음 회차 개선 연결
  - v1~v4 호환·개인 저장 경계·이전 계획/결과 보존과 차기 일정/검토 상태 초기화
  - 화면·요구·인수 기준·로드맵·검증·배포 복구 문서 갱신; 검수용 실제 화면 5개 게시
- Validation:
  - 단위 183개, 신규 headless 14개와 기존 전체 흐름 통과; typecheck/build/infra 40개 통과
  - 390px 넘침 수정 후 신규 14개 재실행 통과; A4 19쪽 PDF 수치·출처·흑백·출력 후 복원 확인
  - Traceboard 1680 조합 위반/미평가 0; 실제 HTTPS 91/91 SHA 일치, 이미지 5개 표시, 390px 가로 넘침 없음; 기존 favicon 404는 별도
  - 공개 기존 8경로 200, /planning/outcomes 404; M6 공개 배포 검증은 미실행
  - 보존 증거: /home/lsh/.cache/fest-compass/verification/2026-09-09-m6/
- Questions:
  - docs/ops/planning-outcomes-release.md에 명시한 미사용 이미지 4개 삭제 승인 필요. 현재·복구용 2개는 보존한다. 기존 승인은 다른 4개에 한정되므로 확대하지 않는다.
- Handoff: Codex

## T-021 · Codex · implementer

- Position: M6 공개 배포와 검증 완료. 공개 비용 원문과 개인 결과 입력을 구분하고 계획/실측·재원 비교·불변 결과 출력·개인 과거 회차 검색·차기 개선 연결을 사용할 수 있다. 승인된 네 이미지만 정리해 배포를 복구했다. 전국 자료 완비·지도 품질·실무자 인수까지 완료한 것은 아니다.
- Evidence:
  - docs/validation/evidence/2026-09-09-planning-outcomes-production.json
  - docs/validation/25-planning-outcomes.md
  - docs/ops/planning-outcomes-release.md
  - docs/sdlc/2-design/outcome-implementation.md
  - apps/web/scripts/outcome-e2e.mjs
  - docs/design/07-region-planning-milestones.md
  - docs/review/2026-09-planning-review.md
  - traceboard.yaml
  - CI 34302743602 attempt 2 source c3e53b309ef63a32008aea85f911d8ac74ce69b3 success, 전용 ARC homelab-fest-compass-k8d69-runner-tbbvc
  - 배포 867e1036ad9427109b481c931ae37bb0d0d3610f, 실제 이미지 9d83122cfaa7924c699701fecfbe7c04a70fe7ae01a12d0744efe8f279ac160a, Synced/Healthy/Succeeded, generation 16, 가용 1개
  - Traceboard source 0569377b88c4a28bbe62b76b1a2ad0f0031ad629, publication 779fb07cf0e44a4f266a7511f947e5427580d642, image 8aa21dfaed7e3427b8fa88b05e7288738e66b96c4bfc088d140790eeae14c80a
- Changes:
  - 정확한 승인 목록 대조→비삭제 3577→실제 정리 3578: 현재/복구 2개 보존, 미사용 4개 삭제, quota/권한/데이터 변경 없음
  - 공개 분석 쿠키 창의 Reject All 버튼을 누르는 headless 검증 절차 보완; 런타임 기능은 검증된 c3e53b3와 동일
  - 운영 이미지와 service-version 고정, 공개 사용 상태·정책 확인·배포 증거 문서 반영
  - Traceboard 공개 사용 안내·실제 검증 결과 갱신과 발행; 전체 프로젝트 MVP나 실무자 검수 완료로 확대하지 않음
- Validation:
  - 기존 단위 183개·신규 로컬 14개 증거 재사용, CI 동일 소스 검증 통과; 배포 계약 40개·17개 prod 리소스 검사 통과
  - 공개 신규 headless 14개 모두 통과, 오류/앱 쓰기 0, 390px 넘침 0. 첫 시도의 쿠키 모달 차단은 실제 거부 동작 추가 후 재실행해 해소
  - 공개 A4 19쪽 PDF 수치 35118200·당시 자료 52671.5·P/R 연결·개선 문구 확인; 11개 경로 HTTP 200·M6 sitemap 포함
  - 배포 전후 예측 2건·모니터 의미 값·겨울 시험·당일 수집 결과 일치
  - Traceboard 1680 조합 위반/미평가 0, HTTPS 91/91 SHA 일치, 그림 5/5 스크롤·디코드, 390px 넘침 0. 기존 favicon 404 한 건. Synced/Healthy/Succeeded, generation 46, 가용 1개
- Questions:
  - No open question
- Handoff: Codex

## T-022 · Codex · implementer

- Position: 전국·지역 지도 개선을 공개했다. 도로 배경과 드래그/터치/키보드 이동, 자료 묶음·상세 선택, 명시적 영역 필터·근거 보관과 간단 지도 대체를 사용할 수 있다. 실제 논산 자료에서 발견한 표식 겹침도 수정했다. 정식 경계·전국 과거 자료·실무자 인수는 후속이다.
- Evidence:
  - docs/validation/evidence/2026-09-09-region-map-production.json
  - docs/validation/26-region-map.md
  - docs/sdlc/2-design/region-map-improvement.md
  - apps/web/scripts/map-e2e.mjs
  - apps/web/lib/region/map-view.ts
  - docs/design/07-region-planning-milestones.md
  - docs/review/2026-09-planning-review.md
  - traceboard.yaml
  - CI 34314707431: source 89e40a0ac7bf91f2c4dda0fd4e294824ba31c814, 전용 ARC success. 배포 8a5fa6f7effeab4ff997ddfe4d979f95f48a2fd5, image b83bba2bc9c0604d919109148cf2542b5c60935e57486d5d7d492810446106e5, generation 18, Synced/Healthy/Succeeded.
  - Traceboard source 49d5b6d9caef660cd9f6a694305a32f5024b397d, publication 149eda00b44eb2e15cd6bffffc5273a3e0d352c2, generation 47, Synced/Healthy/Succeeded.
- Changes:
  - Leaflet 배경·출처/개인정보 안내·CSP 한정 호스트와 외부 배경 없는 대체 지도
  - 지역명 충돌 방지·원래 목록 번호·같은/가까운 위치 자료 묶음·선택 원문과 영역 보관
  - 실제 61건 검사에서 인접 격자 묶음 겹침 수정, 해당 회귀 시험과 공개 동의창 언어 대응 추가
  - UC/TS v4 AC8·요구/설계·마일스톤/검수 안내·공개 검증 기록과 내부 검수본 갱신
- Validation:
  - 단위 186개·전체 headless 명명 125개 및 편집/공개 작업공간 흐름·타입·빌드·배포 계약 40개/17리소스 통과, 운영 의존성 취약점 0
  - 공개 지도 headless 12개 통과. 실제 논산 관광자료 61건/좌표 61건·2025년 3월 방문 31일 조회와 표식 겹침 없음·선택 원문/조건/출처/수집일 보존 확인, 브라우저 예외/앱 쓰기 0
  - 모든 지도 자동화 타일은 가상 응답, OSMF로 전달 0. 실제 배경 가용성 검증으로 표현하지 않음
  - 배포 전후 예측 2건·관측 내용·겨울 시험·당일 자동 수집 상태 동일
  - Traceboard 게시 게이트 표본 1680조합 + 변경 문서 28조합 위반/미평가 0. 실제 HTTPS 95/95 SHA 일치, 링크·그림 2개 디코드·390px 넘침 없음, 브라우저/콘솔 예외 0. 추적 원천 미선언 4종은 미평가 유지
- Questions:
  - No open question
- Handoff: Codex

## T-023 · Codex · implementer

- Position: 공식 SGIS 2025 경계 원본과 속성표를 확보하고 관광조회 269개 단위를 대조했다. 명칭 일치 후보 221·일반시 합성 후보 12·미연결 36개이며 공식 연계·공간 검증 완료는 0개다. 오연결 방지 도구·연결 자료 정의·화면 적용 기준과 Traceboard 검수본 게시를 완료했다. 현재 앱 경계 기능의 구현 완료로 확대하지 않는다.
- Evidence:
  - docs/sdlc/2-design/region-boundary-contract.md
  - docs/validation/27-region-boundary-audit.md
  - docs/validation/evidence/2026-09-09-region-boundary-audit.json
  - docs/validation/evidence/2026-09-09-region-boundary-publication.json
  - tools/audit_region_boundaries.py
  - tools/test_audit_region_boundaries.py
  - docs/design/07-region-planning-milestones.md
  - docs/review/2026-09-planning-review.md
  - traceboard.yaml
- Changes:
  - 해시 고정 공개 ZIP·시도 17/시군구 252 속성·구성 파일 10개 해시와 조회 단위별 대조 증거
  - 오프라인 대조 도구와 코드 충돌·동명 구·합성·개편·중복·잘못된 DBF 방지 시험
  - 원본 확보/미연결/공간 검증/화면 연결을 구분한 설계·마일스톤·검수 안내
  - Traceboard 게시 동시 충돌을 13개 프로젝트 원천 동일/조상 확인과 생성 기록 보존 병합으로 복구; 앱 런타임·배포 변경 없음
- Validation:
  - 6개 단위 시험·원본 재실행 결과 정확 일치·전체 269행 연결 금지 보존
  - Traceboard 컴플라이언스·산출물 36개 누락 0; 미선언 원천 4종 미평가 유지
  - 게시 표본 1684조합 + 변경 문서 16조합 접근성 위반/미평가 0
  - 실제 HTTPS 97/97 SHA 일치·headless 문서 연결/후보 수/개발 상태·390px 넘침 0·브라우저/콘솔 오류 0
  - Traceboard 244a4b93ddef52eaddbcda6da6e0153b5ba62ca0, image 2531cbdd42f4b65e2ea0375db19fe5dc698c6b231042b5f370ec13d87b16d8bf, generation 49, Synced/Healthy/Succeeded·가용 1개
  - 앱/배포 diff 없음; 전체 앱 회귀·경계 형상/공식 연계 검증은 미실행
- Questions:
  - No open question
- Handoff: Codex

## T-024 · Codex · implementer

- Position: 공식 연계표와 도형 검증을 거친 2025년 참고 경계 지도를 공개했다. 전국·시도·시군구 선택과 실제 관광자료의 근거 보관, 내부 검수 문서 게시까지 완료했다. 최신 경계·전국 과거 자료·실무자 인수는 별도 후속이다.
- Evidence:
  - docs/sdlc/2-design/region-boundary-layer.md
  - docs/validation/28-boundary-layer.md
  - docs/validation/evidence/2026-09-09-boundary-build.json
  - docs/validation/evidence/2026-09-09-boundary-layer-publication.json
- Changes:
  - 시도 15개·시군구 조회 단위 234개 경계와 날짜·개편 35개 목록 대체; 표시된 경계만 근거 보관
  - 공식 XLSX 두 기준시점·SGIS 형상/공유 경계/섬 보존·좌표 변환 검증, 배포 파일 16개 생성
  - 공개 앱 배포·검수 v5·Traceboard 게시와 실제 자료 증거 기록
- Validation:
  - 앱 단위 190·Python 9·전체 headless 명명 시험 136 및 기존 편집/공개 작업공간·타입·빌드·취약점 0·배포 계약 40 통과
  - CI 34336660754 전용 ARC 성공; 공개 경계 11개·경계 파일 16/16 해시 일치·실제 논산 61자원/31일·당시 원문/경계 근거 보존·브라우저 오류/앱 쓰기 0
  - 기존 예측 자료·기록 2개·겨울 시험·일일 수집 상태 보존
  - Traceboard 산출물 38·추적 오류 0, HTTPS 102/102 파일 일치; 접근성·headless 링크/이미지/390px 검증 완료. 미선언 원천 4종은 미평가
- Questions:
  - No open question
- Handoff: Codex

## T-025 · Codex · implementer

- Position: 기획 기간 전에 시작한 현재 등록 행사도 조회하고 겹치는 일정을 그림으로 비교하도록 공개했다. 실제 공주 자료의 조회·근거 보관·기획 연결과 내부 검수 문서 게시를 완료했다.
- Evidence:
  - docs/sdlc/2-design/current-festival-overlap.md
  - docs/validation/29-current-festival-overlap.md
  - docs/validation/evidence/2026-09-10-festival-date-probe.json
  - docs/validation/evidence/2026-09-10-overlap-publication.json
- Changes:
  - 공유 지역 API의 잘못된 시작일 거부 수정; 현재 비교 기본 기간 겹침과 기간 안 시작 선택
  - 공통 날짜 축의 겹친 구간·일수 그림, 선택 당시 검색 조건을 근거·기획 상세에 유지
  - 배포 의존성 검사에서 발견한 deepmerge-ts 취약점 수정, 실제 화면과 요구·인수 문서 게시
- Validation:
  - 단위·마이그레이션 193, 전체 headless 146 및 기존 편집/공개 흐름, 타입·빌드·취약점 0·배포 선언 40 통과
  - CI 34447362560 내부 ARC 성공; 공개 회귀 10개·실제 공주 7개 흐름 통과, 오류·앱 서버 쓰기 0
  - 예측 요약·기록 2개·겨울 시험·자동 수집 상태 보존
  - Traceboard 산출물 40·추적 오류 0, HTTPS 106/106 파일 일치; 접근성·headless 링크/이미지/390px 검증 완료. 미선언 원천 4종은 미평가
- Questions:
  - No open question
- Handoff: Codex

## T-026 · Codex · implementer

- Position: 조회한 현재 행사에서 실제 등록 좌표의 직선거리순·반경 비교와 일정 그림을 연결해 공개했다. 거리 미확인 자료를 남기고 기준 좌표·반경·출처를 근거와 기획 상세에 보존했다. 실제 공주·논산 7개 자료 검수와 Traceboard 게시까지 완료했다.
- Evidence:
  - docs/sdlc/2-design/festival-distance-comparison.md
  - docs/validation/30-festival-distance.md
  - docs/validation/evidence/2026-09-10-distance-publication.json
- Changes:
  - 등록 좌표 사본과 버전 있는 구면 거리 계산, 반경 밖·거리 미확인 구분
  - 추가 API 호출 없는 기준/반경 조작과 최대 20건 거리 그림, 기존 파일 호환·입력 검사
  - 요구·AC11·설계·실제 검증 문서와 공개 앱·내부 검수본 게시
- Validation:
  - 단위·마이그레이션 196, 전체 headless 156 및 기존 편집/공개 흐름, 타입·빌드·취약점 0·배포 선언 40 통과
  - CI 34451230981 내부 ARC 성공; 공개 거리 회귀 10개, 실제 공주 3·논산 4건의 거리순·10/30km·원래 근거·기획 연결 6개 흐름 통과. 오류·앱 서버 쓰기 0
  - 예측 요약·기록 2개·겨울 시험·자동 수집 상태 보존
  - Traceboard 산출물 42·추적 누락 0, HTTPS 110/110 일치, 접근성·headless 링크/이미지/390px 통과. 미선언 원천 4종은 미평가
- Questions:
  - No open question
- Handoff: Codex

## T-027 · Codex · implementer

- Position: 관광자료의 후보 장소 입력 연결을 공개하고 실제 논산 자료·출처 사본·변경 후 확인 재검토와 내부 검수본 게시를 확인했다.
- Evidence:
  - docs/validation/31-venue-evidence.md
  - docs/validation/evidence/2026-09-10-venue-publication.json
  - 공개 논산 관광자료 61건 중 강경근대거리 이름·주소·좌표로 지도→근거→기획 입력 확인
- Changes:
  - 장소 입력 미리보기와 명시적 이름·주소 적용, 당시 출처 사본 연결; 기존 기획 파일 형식 유지
  - UC-FC-004/TS-FC-004 v3 AC7, 요구사항·화면 설계·검수 v8·Traceboard 선언 갱신
  - 앱 배포 세대 22, Traceboard 세대 54·게시 파일 114개 일치
- Validation:
  - 단위 198 + 격리 마이그레이션 1, typecheck/build, 전체 headless 165개와 운영·개인 여정 통과
  - 공개 가상 회귀 9 + 실제 관광자료 6개 흐름, 앱 서버 쓰기·브라우저 오류 0; 동의창·Zaraz 전송은 앱 쓰기와 구분
  - CI 34455285244 성공, 배포 계약 40·리소스 17, 운영 의존성 audit 0
  - 예측 모니터·발행 기록·겨울 시험·자동 수집 의미 값 5개 배포 전후 동일
  - Traceboard 1672 + 변경 문서 24개 페이지·테마 조합 위반/미평가 0, 실제 링크·이미지 2·390px 확인
- Questions:
  - No open question
- Handoff: Codex

## T-028 · Codex · implementer

- Position: 지역 과거 방문과 공개 비용을 실제 원문 기반으로 확대하고 앱·Traceboard 게시 및 검증을 완료했다.
- Evidence:
  - docs/research/2026-09-regional-history-costs.md
  - docs/research/evidence/2026-09-10-gongju-cost.json
  - docs/validation/evidence/2026-09-10-history-costs-publication.json
- Changes:
  - 공주·임실 1096일씩 수집·검증·보관하고 4회차 비교에 60개 값을 추가했다.
  - 공주 예산·집행·총원가를 구분하고 확인된 원가 항목만 도넛·수치 표로 표시하며 근거 파일·기획 연결을 보존했다.
  - 지도·비교 바로가기, 요구/인수 기준·화면 설계·조사·검증 문서를 보완했다.
- Validation:
  - 단위 201+격리 마이그레이션 1, typecheck/build, 전체 headless 176 흐름 통과; production audit 0, 배포 계약 40/17 통과.
  - 공개 실제 11개 headless 흐름과 6회 API 조회의 2192일 대조 통과, 앱 쓰기·브라우저 오류 0.
  - 예측 보존 다섯 값 일치; 앱·Traceboard Healthy/Synced/Succeeded, 게시 파일 일치와 접근성 검사 통과.
- Questions:
  - No open question
- Handoff: Codex

## T-029 · Codex · implementer

- Position: 공개 주소를 pickday.damecasol.com으로 전환하고 기존 gitvssh/fest-compass 배포 경로에서 검증했다. pick-d-day의 FEST 앱과 앱·배포 파일을 맞춘다.
- Evidence:
  - docs/ops/pickday-domain-migration.md
  - https://github.com/gitvssh/fest-compass/actions/runs/35554076890
- Changes:
  - 공개 URL·HTTPRoute·인증서·Tunnel/DNS·호스트별 분석 연결을 pickday로 전환
  - 기존 저장소 전용 ARC·PAT·운영 PVC와 자료 유지
- Validation:
  - 앱 202건·배포 계약 40건·빌드·타입 검사 통과
  - 공개 경로 6개 200·canonical/sitemap 일치·실제 자료 headless 11개·분석 동의 거부/허용 통과
  - Application/Deployment/PVC UID 유지, 예측 파일 124개 유지; heartbeat만 갱신
  - 로컬 DNS NXDOMAIN 캐시를 구분하고 공개 DNS에서 확인한 정확한 Cloudflare IP로 TLS를 유지해 검증
- Questions:
  - No open question
- Handoff: Codex

## T-030 · Codex · recorder

- Position: 관광 활성화·두 제품 흐름·공공데이터 의사결정 지원을 기획 기준으로 기록했다. 핵심 질문은 정보 설계 기준이며 사용자 답변·기획·메모 기록은 선택 사항이라는 정정을 정본과 기존 설계 진입점에 반영했다.
- Evidence:
  - 2026-09-22 사용자의 두 흐름·관광 중심 전략 확인 및 기준 기록 요청과 필수 기록 금지 정정
  - docs/product/planning-principles.md
  - docs/sdlc/0-planning/product-plan.md
  - docs/sdlc/1-analysis/srs.md
- Changes:
  - 기획 기준 신설, 제품 목표·비목표와 기획서·요구사항·설계/문서 진입점에 적용 경계 추가
  - pick-d-day README 소개를 관광 의사결정 지원 목표로 정렬
  - CHARTER의 목표·기록 선택성·현재 개발 경로 정렬, STATE의 현재 기획과 후속 과제 갱신
- Validation:
  - git diff --check 통과; 문서 전용 변경과 신규 상대 링크 17개 실경로 확인
  - 앱 시험·운영 재검증 미실행: 코드·배포 변경 없는 기획 기준 기록이며 이전 검증을 새 방향의 인수 실적으로 주장하지 않음
- Questions:
  - No open question
- Handoff: Codex

## T-031 · Codex · recorder

- Position: 최신 코드·보관 CSV·Foundry 직접 조회·공식 자료를 반영한 현행 요약과 데이터 현황을 신설하고 기존 기능·흐름·유스케이스 문서의 불일치를 정정했다. 두 목적의 새 설계와 선택 기록 조건 개편은 후속으로 분리했다.
- Evidence:
  - 기준 앱 코드 139dc62와 기존 검증 기록, 2026-09-22 원본 CSV 집계 및 Foundry dw_schema→SELECT 조회
  - docs/review/2026-09-current-state.md
  - docs/research/2026-09-data-inventory.md
  - Cursor Agent cursor-grok-4.6-high 다섯 분야 조사 뒤 코드·파일·공식 문서·DB 대조; 외부 자료 일부는 공식 원문을 공급해 분석
- Changes:
  - 현재 경로·기록 조건·세 작업공간 연결과 다음 설계 순서 정리
  - 앱 소비·보관 CSV 304개·Foundry 실보유·공식 추가 후보를 단위·시점·연결 조건별 정리
  - M3~M6 구현 상태·저장/복원·지역 이력·참고 경계·행사 기간 겹침·공개 주소 정정
  - README·문서/설계 인덱스·검수 안내·Traceboard 문서 목록·프로젝트 상태 연결
- Validation:
  - 문서 본문 점검: YAML frontmatter 22개·상대 링크 369개·문서 목록 50개·UC/TS 8쌍 참조 검사 통과; git diff --check 통과
  - CSV 304개를 직접 재집계해 파일·행수와 연 단위 열 확인
  - 저장소 구조 검사 exit 0(warn): 루트 필수 경로 5개 경고는 변경 전 main에서도 동일. 신규 위반 아님
  - 앱 시험·운영 API/브라우저·내부 문서 사이트 재게시 미실행: 문서와 문서 목록만 변경. 과거 시험을 새 설계 인수 실적으로 표시하지 않음
- Questions:
  - No open question
- Handoff: Codex

## T-032 · Codex · recorder

- Position: 공공데이터 핵심 기능 구현을 우선하고 뉴스 검색·원문 연결을 후속으로 두는 결정을 기록했다. 보도자료 수치 자동 반영과 AI 요약의 초기 범위를 정리하고 내부 제약을 안내문으로 노출하지 않는 UI 원칙을 반영했다.
- Evidence:
  - 2026-09-22 사용자 확정: 첫 버전에서 보도자료 수치 자동 반영 제외, AI 요약 후속 검토, 핵심 데이터 기능 구현 뒤 뉴스 검색·원문 연결
  - 2026-09-22 사용자 UI 정정: 정보 노출·배치·위계·글자 크기로 전달하고 내부 규약은 노출하지 않음
  - docs/product/planning-principles.md
- Changes:
  - 기획 기준의 구현 순서·첫 버전 제외 범위·뉴스 검색 제공자 미확정·화면 표현 원칙 정리
  - CHARTER와 프로젝트 상태에 확정 범위·다음 작업 반영
- Validation:
  - 기획 기준·CHARTER frontmatter 및 상대 링크 13개 확인, git diff --check 통과
  - 앱 시험·운영 검증 미실행: 문서 전용 결정 기록이며 기능 구현·공급자 검증 완료를 주장하지 않음
- Questions:
  - No open question
- Handoff: Codex

## T-033 · Codex · recorder

- Position: 사용자가 기존 축제 첫 버전의 핵심 세 기능을 확정해 기획 기준에 반영했다. 전국 기본 탐색·자료 확보 지역부터 과거 분석 확장과 기록 없는 자유 탐색 방향을 함께 기록했다.
- Evidence:
  - 2026-09-22 사용자: 과거 방문 흐름 비교·주변 관광자원 연결·다음 개최 시기 검토 제안에 대해 모두 핵심으로 확정
  - docs/product/planning-principles.md
- Changes:
  - 기획 기준에 핵심 세 기능·제공 정보·지역 범위·탐색 우선순위·후속 설계 항목 명시
  - CHARTER와 프로젝트 상태에 확정한 기능 범위 및 다음 상세 설계 반영
- Validation:
  - 기획 기준 frontmatter·기획 기준/CHARTER 상대 링크 13개 및 git diff --check 통과
  - 앱 시험·운영 검증 미실행: 문서 전용 결정 기록이며 세 기능의 새 설계 구현 완료를 주장하지 않음
- Questions:
  - No open question
- Handoff: Codex

## T-034 · Codex · designer

- Position: 최신 devkit 제품 경험 기준에 따라 기존 축제의 데이터·지표·비교 기준과 세 핵심 화면 및 목적 선택을 구체화했다. 실제 논산 자료와 Foundry 관광자원 표본으로 v5 시안을 만들고 직접 검수했다. 앱 구현과 실행 인수는 후속이다.
- Evidence:
  - dev-standard 65c4179 policy/product-experience.md·roles/ui-designer.md·sdlc-doc-rules.md
  - 기준 앱·자료 main 5bbb559, 논산 회차·지역 방문 JSON 직접 재계산
  - Foundry dw_schema→SELECT 관광자원 3행 직접 대조, query hash 42dab9c487e1c0e528272da8830c3d98f38c9880c4288ee0e93cbbd39dbe85c1
  - 실제 cursor-agent cursor-grok-4.6-high 데이터·UI 기준 조사 2회 완료 후 원문 직접 대조
  - docs/sdlc/2-design/design-system.md의 정성 검수 기록
- Changes:
  - IA·흐름·화면 레지스터 v5, SCR-FC-008~011 Excalidraw/SVG 4쌍·9프레임
  - 일별·개최기간·월별 일평균과 결측·지도 기준점·미래 일정 분리 계약, 역할별 문구·폰트·배치·복구
  - FR-EXF-1~4와 UC-FC-009 AC10개, 설계/검수/현행·데이터 문서 진입점 갱신
- Validation:
  - 주 담당자가 최종 headless 표시본 직접 검수; 평균 단위·폰트·화면번호·결측 범위·후보 재선택 수정 후 대조
  - Excalidraw 스키마4개·SVG 반복 렌더 동일해시4개·Mermaid10블록 통과; 방문 차트72좌표와 원자료36일 일치
  - 추적 빌드 화면11개·산출물50개 누락0, lint error0. 신규 AC의 TS미작성 warn10개 유지; 미선언 API/Run은 미평가
  - 앱 구현·실행 시험·담당자 사용성·운영/내부 문서 사이트 재게시 미수행. 공개API 표본조회 HTTP403은 성공으로 표시하지 않고 Foundry 읽기 표본 사용
- Questions:
  - No open question
- Handoff: Codex

## T-035 · Codex · designer

- Position: 새 축제 기획은 지역만 고르면 관광자원에서 시작하고 방문 흐름·개최 달력을 기록 없이 오가는 v6 상세안으로 구체화했다. 실제 자료·문구·모바일을 직접 검수했고 문서 간 연도 변경·집계 범위·조작 이름을 정렬했다. 기존 축제 v5는 유지하며 두 흐름의 앱 구현은 후속이다.
- Evidence:
  - 2026-09-22 사용자: 다음 안도 진행 및 이어서 진행, 추가 PRODUCT-EXPERIENCE 규약 적용
  - dev-standard 6e6ce25 policy/product-experience.md §5~7, 기준 앱·자료 main 7d6678f
  - 실제 cursor-agent Grok 4.6 자료·흐름 조사와 최종 문서 교차 검토 후 주 담당자가 원자료·지표·렌더 직접 대조
  - docs/sdlc/2-design/data-visualization.md의 2025 논산 365일 집계·Foundry 소개 두 건·2026 공휴일 근거
  - docs/sdlc/2-design/design-system.md의 과업 입력·고객 문구·첫인상 및 직접 검수
- Changes:
  - SCR-FC-011 지역 선택·012 관광자원·013 방문 흐름·014 달력 v6 Excalidraw/SVG 4쌍, 10프레임
  - IA·흐름·화면·가공 규칙 v6, 디자인 시스템 v4, FR-NEW-1~4와 UC-FC-010 AC10개
  - 설계 인덱스와 기획 검수 v12에 새 축제 진입점·개발 필요 상태 갱신
- Validation:
  - 주 담당자 headless 렌더 1280/390px 직접 확인, 012 상세/비교 조작 구분·모바일 비교와 013 축 글자·표 접근 보완 후 재검수
  - 실제 월별/요일별 평균과 시안 38개 막대 높이 일치. 새 Excalidraw4개 스키마·SVG 반복 렌더 최종해시4개 일치, Mermaid12블록 통과
  - 추적 빌드 화면14개·산출물50개 누락0, lint error0·warn20(UC009/010 TS미작성). API/Run 미선언은 통과로 환산하지 않음
  - UC010 전면부/본문 AC10개 일치, 상대 링크228개 누락0, git diff --check 통과
  - 앱 구현·실행 인수·실제 담당자 관찰·운영/문서 사이트 재게시 미수행
- Questions:
  - No open question
- Handoff: Codex

## T-036 · Codex · implementer

- Position: 사람 확인용 자료를 D:\download\project의 프로젝트·날짜/주제별 사본으로 전달하도록 devkit 0.12.0과 프로젝트 진입점에 등록했다. 원본·편집 소스는 저장소에 유지하고 현재 두 목적의 설계를 브라우저에서 바로 읽는 묶음으로 전달했다.
- Evidence:
  - 2026-09-22 사용자: 검토용 임시자료 사본의 공통 경로 지정, 프로젝트 원본 유지, 정책 개선 위임
  - dev-standard a71fd33 policy/doc-architecture.md §4 사람 확인용 사본, product-experience·역할·AGENTS 라우터 연결
  - D:\download\project\fest-compass\index.html → 2026-09-22-design-v6-reviewed
  - 자료 기준 d74eb6c, 실제 D 드라이브 마운트 확인
- Changes:
  - docs/ops/review-delivery.md와 tools/export-review.py, 프로젝트 AGENTS·설계 인덱스에 사본 전달 경로·원본 보존 명시
  - 확인용 시작 페이지·시안8개·문서12개 및 원본35개 사본 생성. 자료 내용·제품 기능은 변경하지 않음
- Validation:
  - 원본/사본 SHA-256 35개 일치, 로컬 링크·이미지236개 존재
  - headless Chromium file://에서 HTML21개·이미지·Mermaid 표시, 시안 선택·모바일 펼치기·390px 시작 페이지·페이지오류0 확인 후 주 담당자 표시본 직접 검수
  - 별도 임시 폴더로 사용자 첫 페이지와 대체 이름 충돌 파일 보존·새 이름 생성·중복 묶음 거부 검증
  - devkit 정책 링크·앵커21개, 버전·역할길이·임시 스캐폴드와 기존 AGENTS 보존 확인; 다른 세션의 원장 미커밋 변경 보존
  - git diff --check 통과. Windows 브라우저 직접 실행·앱 인수는 미평가/이번 범위 밖
- Questions:
  - No open question
- Handoff: Codex

## T-037 · Codex · designer

- Position: 기능·기획에 집중해 두 목적의 검색·식별·조건 전달·자료 공급/갱신·복구와 구현 순서를 구체화했다. 화면 목표와 기본 배치, 부족한 자료/실패 3상태의 PC·모바일 와이어프레임을 전달했다. 최종 시각 디자인은 사용자 작업이며 앱 개편은 개발 필요다.
- Evidence:
  - 2026-09-23 사용자: 기능·기획 개선과 화면 목표·와이어프레임·기본 구성까지만 요청
  - 기반 52f2975의 지역 조회·비교 코드와 데이터 문서, dev-standard a71fd33 제품 경험 기준
  - docs/sdlc/2-design/functional-spec.md, design-system.md의 직접 검수
  - 자료 커밋79322d1, D:\download\project\fest-compass\index.html → 2026-09-23-functional-plan-v7
- Changes:
  - 기능 상세·자료 공급/시점·필터 밖 선택/원천 삭제·회차 없음/개최일 미확인·후보 없는 달력·조건 복귀 구체화
  - SRS·IA·흐름·화면 v7, UC009/010 각14개 인수 기준과 디자인 작업 범위 정렬
  - SCR-FC-008/012/014 v7 Excalidraw/SVG 3쌍·6프레임, 확인용 묶음과 전달 도구 갱신
- Validation:
  - 주 담당자가 원문·코드·새 6프레임 직접 검수. 독립 읽기 검토의 충돌3건 수정. Grok 4.6 실제 호출은250초 시간 초과로 결과 미수신, 완료 검토로 인용하지 않음
  - Excalidraw3개 스키마·반복 SVG해시3개·Mermaid14블록·UC 전면부/본문28개·상대링크282개 및 git diff --check 통과
  - 추적 산출물51개 누락0·error0·warn28(새 UC 시험 시나리오 미작성). API/실행 명세/Run 미선언은 미평가
  - 최종 D드라이브 사본42개 SHA 일치·로컬링크/앵커287개·headless HTML25개/이미지/Mermaid14개·모바일 펼치기·390px 넘침없음·페이지오류0 확인
  - 앱 구현·키보드/보조기술 실행·실제 담당자 관찰·운영/문서 사이트 배포는 미수행
- Questions:
  - No open question
- Handoff: Codex

## T-038 · Codex · verifier

- Position: FEST Compass의 최신 설계·원자료와 선별 기능을 gitvssh/fest-compass로 통합·게시했다. Claude Opus 5.5 위임 결과를 직접 대조했고 연도별 방문·행사 달력·CSV를 공개 운영에서 확인했다. 확인용 사본을 D 드라이브에 전달했으며 v7 두 목적 전체 흐름은 다음 개발이다.
- Evidence:
  - 2026-09-23 사용자: 관련 프로젝트만 선별 통합한 뒤 기존 gitvssh 저장소에서 순서대로 진행, Claude Opus 5.5 위임 및 직접 검수
  - docs/ops/repository-consolidation.md
  - docs/validation/evidence/2026-09-23-consolidation.json
  - 자료 f362e65, 앱 a889be5, 배포 05716b4, 원본 이전 안내 6288436, 검토 사본 2811b03
- Changes:
  - 최신 문서·시안 62개와 CSV 304개·원문 문서 5개 이관, 독립 저장소 경로·현행 상태 정리
  - 26개 축제 147행 연도별 방문, 지도·목록과 연동하는 월별 행사 달력, URL 조건 복원·CSV·현재 메뉴 연결
  - 원본 저장소의 안내 4개 게시. 다른 제품은 수정·이동·삭제하지 않음
  - D:\download\project\fest-compass\index.html → 2026-09-23-consolidated-reviewed. 원본은 저장소에 유지
- Validation:
  - Node 24.20.0: 단위 239건·인프라 40건·타입·빌드·headless 시나리오 스크립트 16개 통과. 저장소 전용 ARC CI 35824313294 성공
  - 원본 Git blob 309/309 일치. 공개 운영 Synced·Healthy, 기존 PVC 및 SQLite 업무 9개 테이블 내용 해시 보존
  - 실제 공개 화면 26개 축제·서산 2018년 수치 대조, 논산 행사 조회 5건·CSV 다운로드·390px·브라우저 오류 0
  - D 드라이브 사본 46개 SHA 일치, 링크·이미지·앵커 317개 정상, HTML 27개·Mermaid 14개·1280/390px 넘침 및 페이지 오류 0. 한글 바로가기 오류 수정 후 확인
  - 전체 v7 두 흐름 28개 인수 기준·담당자 실사용·Windows 브라우저 직접 실행은 이번 완료 범위에 포함하지 않음
- Questions:
  - No open question
- Handoff: Codex

## T-039 · Codex · verifier

- Position: 기존 축제 개선의 검색·과거 방문·주변 관광자원·개최 시기를 구현해 공개 서비스에 반영했다. Claude Opus 5.5 위임 결과를 직접 대조하고 실제 자료·PC/모바일·배포를 확인했다. D 드라이브에 현재 화면과 갱신된 설계 문서를 전달했으며 다음 대상은 새 축제 전용 흐름이다.
- Evidence:
  - 2026-09-23 사용자: 통합 후 다음 작업 진행, Claude Opus 5.5 위임·직접 검수
  - docs/validation/34-existing-festival-journey.md
  - docs/validation/evidence/2026-09-23-existing-journey.json
  - 구현 66c3b74, 배포 81ce345, 검토 사본 d8efc78
- Changes:
  - 첫 화면 목적 선택과 /existing/search·visits·resources·timing, 실제 자료 GET API 다섯 개 구현
  - 회차별 실제 날짜·평균·차트, 현재 관광자원 지도·목록, 월별 관측과 후보 0~2개 기간 비교·달력 연결
  - 확인 전 지역 연결 방지, 0·결측·취소·정의 차이와 독립 실패·이전 성공값 복구 구분
  - 기능 상세·요구사항·UC009·TS009·화면/흐름/정보구조와 현재 상태 갱신; 프로젝트 원본·기존 운영 데이터 유지
  - D:\download\project\fest-compass\index.html → 2026-09-23-existing-journey-reviewed
- Validation:
  - Node 24.20.0: 단위 268건·타입·빌드·headless 스크립트 17개·인프라 40건 통과. 기존 축제 AC1~14의 28개 확인 항목 통과
  - 실제 claude-opus-5-5 최종 세 위임 성공 종료. 통합 담당이 코드·원자료·화면을 직접 검수
  - ARC CI 35868993176 성공·Actions artifact 0, 공개 Synced/Healthy. 배포 전후 Deployment·PVC 식별자와 업무 9개 모델 행수·내용 해시 동일
  - 실제 논산 현재 등록 축제 2건·관광지61/문화시설7·지도 표식68·선택, 과거3개 회차·월별12개 수치 확인. 브라우저 오류·API 쓰기0, 390px 페이지 넘침없음
  - D 드라이브 사본53개 SHA 일치·로컬 링크/이미지/앵커336개 정상·HTML28개/Mermaid14개·1280/390px 오류/넘침0
  - 새 축제 전용 흐름·최종 시각 디자인·전체 보조기술·담당자 실사용·Windows 브라우저 직접 실행은 완료 범위에 포함하지 않음
- Questions:
  - No open question
- Handoff: Codex

## T-040 · Codex · verifier

- Position: 제품 표시명과 소개를 pickDday로 정리하고 새 축제 전용 지역 선택·관광자원 함께 보기·월/요일 방문·개최 시기를 공개 서비스에 반영했다. 실제 원자료·화면·배포를 직접 검수하고 D 드라이브에 확인 자료를 전달했다.
- Evidence:
  - 2026-09-23 사용자: pickDday로 이름·설명 변경 후 새 축제 전용 흐름 진행
  - docs/validation/35-pickdday-new-festival.md
  - docs/validation/evidence/2026-09-24-pickdday-new-festival.json
  - 구현 c8f7c6c, 배포 7bcb6cc, 검토 원본 ff35234
- Changes:
  - 제품 표시명·메타데이터·다운로드 이름·저장소 소개·현재 문서를 pickDday로 정리. 저장소/배포 주소와 기존 개인 저장 형식은 유지
  - /new 지역 선택 → 자원·방문·시기 세 화면, 실제 관광공사 소개와 최대 두 곳 비교, 명시적 위치 기준점, 완전연도의 월/요일 방문, 실제 관측월 달력과 선택적 0~2개 후보
  - UC010/TS010·화면·흐름·정보구조·자료 계약과 검수 결과 갱신
  - D:\download\project\pickDday\index.html → 2026-09-24-pickdday-new-journey-reviewed. 프로젝트 원본과 이전 fest-compass 검토 폴더 보존
- Validation:
  - 실제 claude-opus-5-5/firstParty 위임 종료 확인, 통합 담당 원자료·코드·실제 화면 직접 검수
  - Node24.20.0 단위280건·타입·빌드·headless18개 스크립트·인프라40건 통과. 새 축제 AC1~14의37개 항목, 기존 축제28개 항목 통과
  - 전용 homelab-fest-compass ARC CI35878391672 성공, Actions artifact0. 공개 Synced/Healthy, Deployment·PVC와 업무9개 모델 내용 보존
  - 실제 논산 관광지61·문화시설7·온빛자연휴양림/논산아트센터 소개. 논산·공주·임실2025 요일 원평균/표시값 대조, 2026 부분 연도 처리, 후보/연도 유지·자원 선택 해제. 390px 넘침·브라우저 오류·API쓰기0
  - D 드라이브 사본62개 해시 일치, 링크/이미지/앵커371개 정상. HTML29·Mermaid14·1280/390px 오류/깨진 이미지/넘침0
  - 최종 시각 디자인·담당자 실사용·전체 보조기술·Windows 브라우저 직접 실행은 미평가
- Questions:
  - No open question
- Handoff: Codex

## T-041 · Codex · verifier

- Position: 축제·회차·지역·관광자원의 관련 자료 검색을 설계·구현해 공개 서비스에 반영했다. Claude Opus 5.5 위임 결과를 직접 검수하고 실제 공개 화면과 D 드라이브 확인 자료까지 검증했다. 검색 결과의 적합성·원문 내용 확인과 최종 시각 디자인·담당자 관찰은 완료 범위와 구분한다.
- Evidence:
  - 2026-09-24 사용자: 진행 요청, Opus 5.5 설계 후 위임·직접 검수
  - docs/validation/36-related-material-search.md
  - docs/validation/evidence/2026-09-24-related-material-search.json
  - 구현 cd8e253, 배포 ee42b44, 검토 사본 원본 20cc9b3
- Changes:
  - 기존 축제 머리·새 지역 머리·자원 상세의 관련 자료 검색창. 확인된 연도·주제·검색어 조정과 DuckDuckGo 새 탭 연결, 기록·저장 요구 없음
  - 검색 입력의 Esc 닫기·초점 복귀와 긴 제목 줄바꿈 보완. 관련 인수 시험 추가, 기존 자원 비교 시험의 초점 복귀 대기 보완
  - 요구사항·두 유스케이스·기능 상세·화면·흐름·정보구조·현재 상태·개인정보 안내 갱신
  - D:\download\project\pickDday\index.html → 2026-09-24-related-search-reviewed-v2. 원본과 이전 검토 자료 유지
- Validation:
  - 실제 claude-opus-5-5/firstParty의 설계·구현·인수 시험 작성 종료 확인. 설계의 복합 조회 한 번 도구 거부 후 읽기 도구로 완료; 구현·인수 작성 거부 0. 주 담당자가 코드·실제 화면·검증 결과 직접 확인
  - Node 24.20.0 단위289건·타입·빌드·인프라40건·17개 운영 리소스·전체 headless19개 스크립트 통과. 관련 검색25항목 포함
  - 전용 homelab-fest-compass ARC CI35947438978 성공·Actions artifact0. 공개 Synced/Healthy, Deployment·PVC와 업무9개 모델 건수·내용 보존
  - 실제 논산딸기축제2025·논산시·온빛자연휴양림 검색, 320/390/1440px·Esc·선택 유지·브라우저 오류/앱쓰기0. 최초 동의 창과 자원 준비 대기를 확인 스크립트에 반영해 재검증
  - 사전 DuckDuckGo 직접 검색은 사람 확인 화면, 최종 공개 새 탭은 HTTP200·검색어/제목·referrer/opener 없음 확인. 결과 적합성·원문 내용은 검증하지 않음
  - 문서 추적52개 누락0·오류/경고0. D 사본67개 해시·링크394개 정상, HTML30개/60개 렌더·Mermaid15개·1280/390px 오류/깨진 이미지/넘침0. 제목 링크 수정 후 v2 재확인, 이전 fest-compass 시작 파일 해시 보존
  - 최종 시각 디자인·담당자 실사용·실제 IME/전체 보조기술/200% 확대·Windows 브라우저 직접 실행·정형 API/Spec/Run/티켓 연계는 미평가 또는 미선언
- Questions:
  - No open question
- Handoff: Codex

## T-042 · Codex · implementer/reviewer

- Position: 임실N치즈축제의 개최 행정동 방문 구성과 임실군 연간 추세를 두 핵심 화면에 공개했다. 관측기간이 없는 성·연령·거주지·목적지 순위의 연결은 완료로 주장하지 않는다.
- Evidence:
  - docs/validation/37-visitor-context.md: 실제 Opus 5.5 네 작업과 주 담당자의 원본·공식 정의·일별 합계 직접 검수
  - docs/validation/evidence/2026-09-24-visitor-context.json: 로컬·내부 ARC·공개 응답·업무 자료 보존·D 드라이브 사본 근거
  - 구현8307da2, 배포a878921, 검토 원본ffd072b; ARC 실행35969926185 성공·artifact0
- Changes:
  - 기간·ID를 확인한 임실 회차만 구성/일평균을 연결하고 2018~2025년 지역 연간 추세·표·월별 이동을 추가했다. 원문27개 소비·277개 보존, 자료 원본은 유지한다.
  - 기능·화면·흐름·요구사항·유스케이스·인수 기준·현재 기능/데이터 문서와 공개 화면4장을 갱신했다.
  - D:\download\project\pickDday\index.html의 최신 검토 묶음을 전달하고 이전 묶음과 옛 시작 파일을 보존했다.
- Validation:
  - Node24.20.0 단위313건·타입·빌드·운영 취약점0·인프라40건/17리소스·전체 headless20스크립트 통과, 방문 자료12항목 추가
  - 구현 커밋의 내부 ARC CI 성공, 확인 이미지 고정 뒤 기존 앱 Succeeded/Synced/Healthy·ready1; Deployment/PVC 유지·업무9종 건수/내용 해시 동일
  - 실제 공개 응답의 PC/모바일 수치·연도 이동·출처·빈 월별/다른 지역 동작 확인, 페이지 오류·앱 쓰기0, 실제 화면4장 직접 검수
  - D 드라이브 원본 사본72개 해시·로컬 링크415개 정상. HTML31개를2크기로62회 확인·Mermaid15개·오류/깨진 이미지/가로 넘침0. 시작/모바일 문서 직접 검수
- Questions:
  - No open question
- Handoff: Codex

## T-043 · Codex · verifier

- Position: 임실N치즈축제 2025년 성·연령 비율과 목적지 검색순위를 공개하고 확인된 관광자원 세 곳에 연결했다. 거주지 자료는 미확보로 제외했다.
- Evidence:
  - docs/validation/38-visitor-profile.md
  - docs/research/imported/datalab-imsil-2025/README.md
  - docs/validation/evidence/2026-09-24-visitor-profile.json
- Changes:
  - 공식 조회 응답 5개·기간/지역·해시 보존, 생성/검사/새 후보 수집 도구
  - 회차별 비율·순위·관광자원 이동과 복귀/재시도, 잘못된 직접 진입의 유형 선택 수정
  - 기능/화면/흐름/유스케이스/자료 현황 갱신, 공개 화면과 D 드라이브 새 검토본 전달
- Validation:
  - 실제 claude-opus-5-5 감사/설계/데이터/화면 네 작업의 모델·권한 거부 없음 확인 후 직접 검수
  - 원본 5개 재수집 일치·기존 후보 덮어쓰기 거부, 단위325·타입·빌드·취약점0·인프라40·리소스17 통과
  - 전체 headless21스크립트·추가19항목, 공개 실제 목록의19항목 재실행·별도 무응답변조 PC/모바일 확인 통과
  - ARC run35976682362 성공·artifact0, bbb984c 배포 Synced/Healthy·업무 자료9종 유지
  - D 검토본 c42f7d6: 원본77개 일치·HTML32개 2폭·링크436·Mermaid15·이미지70·오류/넘침0, 옛 검토본 보존
- Questions:
  - No open question
- Handoff: Codex

## T-044 · Codex · verifier

- Position: 임실N치즈축제 2023~2025년 자료와 두 회차 비교를 공개했다. 성·연령 비율 차이·목적지 순위 변화·하루 평균 및 외지인 비율을 기록 없이 비교할 수 있다.
- Evidence:
  - docs/validation/39-edition-profile-comparison.md
  - docs/validation/evidence/2026-09-24-edition-profile.json
  - docs/ops/review-delivery.md
- Changes:
  - 2023·2024년 공식 원응답 10개·조회 조건·정의 확인, 회차별 생성/검사와 갱신 실패 시 기존 자료 보존
  - 선택한 한 회차/두 회차 표시·목적지 합집합과 정확한 ID 비교·현재 관광자원 연결. 기존 세 회차 선택·방문 추이는 유지
  - 기능·화면·유스케이스·인수·현재 자료 문서와 공개 화면 4장 갱신. D 드라이브 최신 묶음 전달
- Validation:
  - 실제 claude-opus-5-5 설계/자료/서버/화면/문서와 문서 정정 실행 확인 후 직접 검수. 원문 모든 비율·순위 일치, 2023 합계100.1% 보존, 2024 재수집5개 바이트 일치
  - Node24.20.0 단위342·타입·빌드·운영취약점0·인프라40/17리소스·전체 headless22스크립트 통과. 생성기와 읽기 모듈의 장소 연결 조건 차이 및 세 회차 선택 규칙 수정
  - 구현 d38b84a의 내부 ARC35998517278 성공·artifact0. 배포 bf816cc Succeeded/Synced/Healthy·ready1·Deployment/PVC 유지·업무9종 해시/건수 동일
  - 공개 실제 목록으로 비교13·단일19항목 재검증, 별도 무응답변조1440/390px·관광지54/문화시설2·초점 복귀·세 회차 출처 정의 확인. 오류/앱쓰기/넘침0, 화면4장 직접 검수
  - D 검토본 af2781b: 원본82개 해시·링크461·HTML33개2폭·Mermaid16/이미지74·오류/깨짐/넘침0. 옛 시작파일과 이전 묶음 보존. 최종 시각 디자인·실무자 관찰·전체 보조기술/200% 확대·Windows 직접 실행은 미평가
- Questions:
  - No open question
- Handoff: Codex

## T-045 · Codex · implementer and verifier

- Position: 검색한 등록 축제의 공통 방문·관광자원·개최 시기 흐름과 공식 API 전국 관측 갱신을 구현·공개했다. 강릉·안동·장흥·제주의 실제 값과 세 메뉴, 임실 기존 회차 연결을 검증했으며 D 드라이브 검토본을 전달했다.
- Evidence:
  - docs/validation/40-unified-festival-analysis.md
  - docs/validation/evidence/2026-09-26-unified-festival.json
  - docs/ops/festival-sources.md
  - docs/ops/review-delivery.md
- Changes:
  - 전국 지역 방문·축제 등록 공식 API 보관/일별 갱신과 독립 source worker. 공개 읽기 전용·기존 예측 입력/14개 고정 코드 유지
  - 등록 축제의 지역 월별/일별 방문, 정확한 ID/지역 기반 임실·논산 과거 회차 연결, 검색 결과 통합. 성·연령은 확보한 보조 자료로 유지
  - 행안부 원문 법정동 구성 대조로 전남·광주27곳 연결. 인천 분할/합병 옛3코드 배분 제외
  - 기능·기획·화면 목표·기본 배치·흐름·인수·현재 자료 문서 갱신, 실제 공개 화면과 D 검토본87개 전달
- Validation:
  - 실제 claude-opus-5-5 여섯 작업 완료 후 직접 검수. 비공식 데이터랩 차트 자동 수집·올해 날짜의 과거 복제 제안 미채택
  - 첫 공식 수집141회+당월1회: 2023-01~2026-08 44개월 자료·현재 조회단위269·등록867. 최신 관측2026-08-27, 9월빈응답. 불완전 월평균 없음
  - 단위357·타입·빌드·기존 headless22스크립트·신규 통제16항목 통과. 초기/일상 동시 수집의 일별180호출 상한 수정 후 수집10시험 재검증
  - 구현 bf08b7c의 ARC36231323372 성공·인프라41시험·artifact0. b53e708 배포 Synced/Healthy/Succeeded·3컨테이너 정상·Deployment/PVC 동일·업무9종 건수/해시 보존
  - 공개 원자료 대조 네 축제 30일값/월평균·새 축제 공유·신설지역 실제날짜·임실회차 일치. 응답변조0·오류0·앱쓰기0·320/390/1440페이지 넘침0. 늦은 동의창은 일반 모두 거부 버튼으로 시험 수정
  - D 최종v2 e257efd: 원본87해시·참조498·HTML35×2폭·Mermaid17/이미지77·오류/깨짐/넘침0. 첫 사본 앵커 오류 수정, 이전 묶음/옛 시작파일 보존. 실제 공개 화면/사본 직접 검수
  - 최종 시각 디자인·실무자 관찰·전체 보조기술/200%·Windows 브라우저 직접 실행·정형 API/Spec/Run/YouTrack은 미평가
- Questions:
  - No open question
- Handoff: Codex

## T-046 · Codex · designer, implementation delegator and verifier

- Position: 기존·새 축제에 음식점·숙박 선택과 공통 장소 소개를 연결하고 공개했다. 설계 후 실제 Opus 5.5 구현 위임·직접 검수, 공식 자료 대조, D 드라이브 검토본 전달을 완료했다.
- Evidence:
  - docs/design/19-tourism-resources.md
  - docs/validation/41-tourism-resources.md
  - docs/validation/evidence/2026-09-26-tourism-resources.json
  - docs/ops/review-delivery.md
- Changes:
  - 관광지·문화시설·음식점·숙박을 두 흐름의 목록·지도·거리·소개에 공통 연결. 기본 선택12/14 유지, 기존 상세 도착 링크와 새 축제 두 곳 함께 보기 유지
  - 유형별 전체 목록 최대2000건, 축제15 기존600건. 명시 유형·지역·ID·총수·페이지 검증. 내부 실패 사유는 공통 짧은 조회 실패로 변경
  - 검수에서 필터 후 상세·거리 보존, 다른 지역·블록 누락 응답 복구 및 잘못된 캐시 재사용 방지 보완
  - 화면 목표·기본 배치·기능·흐름·유스케이스·인수·데이터 현황과 실제 공개 화면4장 갱신
- Validation:
  - 실제 claude-opus-5-5 네 CLI 작업 완료, 주 담당자가 공식 API5지역 목록10·소개4 응답과 코드 직접 대조
  - Node24.20.0 단위368·타입·빌드·운영취약점0·인프라41/배포선언17 통과. 동일 제품 빌드의 전체 headless24스크립트 완료, 신규 관광자원31항목·오류0·앱쓰기0
  - 구현956a849의 ARC36245474007 성공·artifact/cache0. 검증 이미지c27d06af를 6fe8675에서 배포, Synced/Healthy/Succeeded·3/3준비·Deployment/PVC 유지·업무9종 건수/해시 동일
  - 공개 응답변조0: 강릉/제주/논산/강남 음식점·숙박 전체 건수, 소개4건 원천 일치. 강릉 새 축제 두 곳 비교/기준점·기존 제주 도착 상세/필터 유지, 320/390/1440 넘침0·오류0·앱쓰기0. 정상 동의창 조작으로 시험 정정 후 완료
  - D 검토본 bad17a0: 원본93해시·참조530·HTML37×2폭·Mermaid17/이미지81·오류/깨짐/넘침0. 이전 묶음/옛 시작파일 보존, 실제 공개/사본 화면 직접 검수
  - 650가상 목록·마커·반경·상세 시험은 통제 응답. 겹친 마커 이벤트 호출은 실제 포인터 편의성 검증으로 확대하지 않음. 최종 시각 디자인·실무자 관찰·전체 보조기술/200%·Windows 직접 실행은 미평가
- Questions:
  - No open question
- Handoff: Codex

## T-047 · Codex · 설계·위임·직접 검수

- Position: 관광자원 시각화·목적 이미지 구현과 D 검토 사본 전달을 완료했다. 공개 배포는 이미지 저장소 용량과 정확한 수동 정리 결정만 남았다.
- Evidence:
  - docs/design/20-resource-experience.md
  - docs/validation/42-resource-experience.md
  - docs/ops/resource-experience-release.md
  - docs/ops/review-delivery.md
- Changes:
  - 실제 claude-opus-5-5 CLI 7회 구현 위임 후 직접 검수; 추가 확대 검토 호출은 한도로 실행되지 않아 완료로 세지 않음.
  - 유형 건수·선택 위계·목록/지도/상세 공통화, 겹친/동일 좌표 군집 선택과 초점 복귀, 두 목적 장식 이미지 적용.
  - 직접 실증한 숨김/크기 변경 후 지도 중심 이동을1dddaa0에서 보완.
  - 2475522 원본에서 D 드라이브107개 사본과 로컬 실제 자료 화면10장 전달.
- Validation:
  - 기존 단위379·전체 headless24 완료. 최종 지도 보완은 타입 포함 빌드·관광자원48항목 재검증.
  - 강릉478/178·제주426/89 실제 앱 응답, 실제 Chrome 탭 확대2.0·모바일·오류0·앱쓰기0. 공개 최종 버전 검증은 대기.
  - D사본107개 해시·39HTML·556로컬참조·Mermaid17·이미지93,1280/390px 오류/넘침0.
  - ARC36250279743은6592de7 검증/빌드 후 Harbor push quota 실패. 비삭제 시험5165 성공·후보3/보호2·삭제미실행. 기존 앱 Synced Healthy 3/3.
- Questions:
  - 이전 이미지3개 즉시 정리 또는03:30 예약 정리 후 최신 main 배포 재개 결정이 필요하다.
- Handoff: Codex

## T-048 · Codex · 배포·공개 검수

- Position: 관광자원 화면 개선을 공개 배포하고 실제 자료·모바일·200% 확대와 업무자료 보존을 확인했다. D 드라이브의 최신 화면·설계 사본도 갱신·검수했다.
- Evidence:
  - docs/validation/42-resource-experience.md
  - docs/validation/evidence/2026-09-27-resource-experience.json
  - docs/ops/resource-experience-release.md
  - docs/ops/review-delivery.md
- Changes:
  - 승인된 세 이미지가 예약 정리5177에서 이미 제거된 것을 확인하여 추가 수동 삭제 없이 배포 재개. 실제 운영에 맞게 기존 보호 표식 복구 후 정상 발행.
  - 11c9513 소스의 검증 이미지3eb37842를 dadf3a7에서 고정·정상 sync. 배포·시나리오·설계 문서의 대기 상태를 사용 가능으로 갱신.
  - 공개 캡처11개와 실행 근거 보존. D 사본은 21e70b3 기준 107개 원본·공개 화면10장을 전달하고 이전 묶음 유지.
- Validation:
  - ARC36287323772 성공: 전용 homelab-fest-compass, 단위379·타입·빌드·취약점0·인프라41, artifact/cache0. release 선언17개 검증 통과.
  - Synced Healthy Succeeded·3/3 준비·livez/readyz200. Deployment/PVC UID 보존, 업무9테이블20행 개수·내용 해시 전후 동일.
  - 공개 응답변조0: 강릉478/178·제주426/89 전수 ID 대조·군집 선택·상세·키보드 복귀·320/390/1440px·실제 Chrome 탭2.0. 오류0·앱쓰기0. 첫 화면 정상 쿠키 거부 후 촬영하도록 검증 스크립트 보완.
  - D 원본/사본/커밋107해시·HTML39·로컬참조556·Mermaid17·이미지93,1280/390px 오류/깨짐/넘침0. 이전 사본/옛 시작파일 해시 보존, 주 담당 직접 시각 검수.
  - 문서 trace 누락0. 정형 API/Spec/Run/YouTrack 연결과 Windows 브라우저 직접 실행·전체 보조기술 인증·실무자 관찰은 미평가.
- Questions:
  - No open question
- Handoff: Codex

## T-049 · Codex · 설계·구현·공개 검수

- Position: PC 중심 조사·기획 화면을 공개 배포했다. 두 목적 이미지를 서로 다른 장면으로 키우고 헤더·홈 위계·목록/지도/상세·방문 병렬 분석을 정리했으며 D 드라이브 사본도 검수했다.
- Evidence:
  - docs/design/21-desktop-research-experience.md
  - docs/validation/43-desktop-research-experience.md
  - docs/validation/evidence/2026-09-27-desktop-research.json
  - docs/ops/review-delivery.md
- Changes:
  - 설계21·기획 기준에 사용자 PC 중심 결정 기록. 내장 imagegen 두 원본 편집과 프롬프트 보존. Opus 사용량 한도 거부를 성공으로 세지 않고 native 협업·직접 검수로 진행.
  - 주 메뉴4개+기획 도구·보조 영역의 강조 조정·1400px 이상 선택 상세3열·48px 짧아진 조건 영역·월/요일 및 월/일별 병렬 분석. 데이터 계산·선택·주소·선택적 기록 보존.
  - 48cc50f 소스의 검증 이미지e33197a4를7994db4에서 고정·정상 sync. 8fc0ac2 원본으로 D 검토 묶음 전달.
- Validation:
  - 단위381·타입·배포 빌드·headless26회·관광자원49항목·인프라41 통과. ARC36290156260 성공, 전용 runner·의존성 취약점0·Actions artifact/cache0.
  - Synced Healthy Succeeded·3/3·livez/readyz200. Deployment/PVC UID 보존·업무9테이블20행 개수/해시 일치.
  - 공개 실제 응답 대체0: 강릉478/178·제주426/89 전체 ID·군집·상세·키보드·1366/1440/1920px·좁은 창·실제 Chrome 탭2.0. 2025 방문 병렬 표시와 공개 기획 도구 경로, 페이지 오류0·앱API쓰기0.
  - D 원본/사본/커밋120해시·HTML41·로컬참조585·앵커60·Mermaid17·이미지104.1280/390px 오류/깨짐/넘침0. 이전 묶음148파일·옛 시작파일 보존·주 담당 직접 시각 검수.
- Questions:
  - No open question
- Handoff: Codex

## T-050 · Codex · 설계·구현·공개 검수

- Position: 관광지도와 기존·새 축제의 대표사진·상세사진·유형별 이용정보를 공개 연결했다. 두 후보의 사진·조건도 나란히 비교하며 출처·이용조건과 부분 실패 복구를 유지한다. 실제 공개 자료와 D 확인용 사본을 검수했다.
- Evidence:
  - docs/validation/44-tourism-media.md
  - docs/validation/evidence/2026-09-27-tourism-media.json
  - docs/validation/evidence/2026-09-27-tourism-media-delivery.json
- Changes:
  - 공통 사진·이용정보 정규화와 TourAPI 상세 연결, 세 흐름 및 두 후보 비교
  - 설계22·인수TS-FC-019·현행 기능·화면/흐름·자료 목록 갱신
  - 소스2bf1f8a 발행36294562405 성공, pin476ad7a 정상 sync
  - D:\download\project\pickDday\index.html에서 최신 확인 자료 연결
- Validation:
  - 단위397·타입·배포빌드·headless27회·관광자원49항목·미디어23항목·인프라41 통과
  - 공개3흐름의 순포습지8장·이용정보·390/1440/1920px·실제200% 확대·사진 조작 통과. 업무9표20행과Deployment/PVC 식별자 보존
  - D 원본사본129개해시·참조614개·HTML43개2폭·Mermaid17개 정상. 이전164개파일 보존
  - Opus5.5 호출은 제공자 사용한도로 실패. native협업 구현·독립코드검토 후 주 담당자 실제자료/화면 직접검수
- Questions:
  - No open question
- Handoff: Codex

## T-051 · Claude · 홈 소개 영상 구현·공개 반영

- Position: 공모전 홍보 영상을 홈에 게시했다. 상시 진입점과 첫 방문 1회 비차단 안내(동의 창이 닫힌 뒤), 자막·대본·끝 화면이 있는 재생 창, `/?intro=play` 공유 링크를 제공한다. 배포를 막던 Next.js critical 공지를 16.3.8 패치판으로 해소했다.
- Evidence:
  - docs/validation/45-intro-video.md
  - docs/validation/evidence/2026-10-03-intro-video-public/report.json
  - docs/validation/evidence/2026-10-03-intro-video-after.json
- Changes:
  - IntroVideo 컴포넌트·intro 저장 규칙·동의 창 열림 판별, 웹용 영상·포스터·자막, 개인정보 안내 한 줄
  - 설계23·인수TS-FC-020·기능명세14·검수45, 기존 홈 시험의 목적 이미지 범위 조정
  - 소스cb57cf1·9e73694, 발행37086941173 성공, pin9cebf25 정상 sync(첫 요청은 이전 렌더로 476ad7a 재적용, 강제 새로고침 후 정상)
- Validation:
  - 단위406·타입·전체 빌드·운영 의존성 감사0·전체 headless 묶음·소개 영상9항목 통과
  - 공개: 실제 동의 창 대기·재생·자막20개·재방문 미표시·intro=play, 업무9표20행과 Deployment/PVC 식별자 보존
  - 에이전트 실행에서 Prisma가 시험 DB force-reset을 차단해 새 시험 DB 생성으로 같은 절차 실행
- Questions:
  - No open question
- Handoff: Codex

## T-052 · Codex · reviewer

- Position: 설계 24는 수정 후 진행을 권고한다. 두 여정과 번호 없는 자유 이동은 유지하되 초임자의 판단 질문, 회차 자료 없는 경우, 입력 없는 정리·인쇄를 먼저 연결한다. 지역 방문 수치를 참가 규모·수요 근거로 확장하는 문구, 행정 절차 순서·법령 적용 조건, 정리 상태와 기존 기획 초안 전달 계약을 수정해야 한다. 14개 지적과 구체적 대안을 리뷰에 기록했으며 설계·코드는 수정하지 않았다.
- Evidence:
  - docs/review/2026-10-03-planning-guide-review-codex.md
  - docs/design/24-planning-guide.md 및 docs/assets/design-24/의 시안·콘텐츠·생성 소스
  - docs/product/planning-principles.md; docs/product/non-goals.md
  - docs/research/2026-10-novice-planner-sources.md; docs/research/2026-10-guidance-ux-patterns.md
  - apps/web/components/existing/ExistingShell.tsx; apps/web/components/new-festival/NewShell.tsx; 두 여정 memory.ts; apps/web/components/existing/HistoryPanel.tsx
  - apps/web/components/PlanningWorkspace.tsx; apps/web/app/planning/options/page.tsx; apps/web/lib/planning/proposal.ts
  - 법령·방문자료 정의·평가편람 게시물의 공식 원문 링크와 확인 범위는 리뷰 3·5·6번에 기록
- Changes:
  - docs/review/2026-10-03-planning-guide-review-codex.md
- Validation:
  - CHARTER·STATE revision 51·최근 대화, 지정 설계·원칙·연구·관련 여정 및 기획 도구 구현을 정적 대조했다.
  - 제안 JPG 7장, 샘플 JPG 4장, 현재 화면·참고 패턴 JPG 3장을 이미지 도구로 직접 관찰했다. 홈 시안은 이미지·스타일이 정상 표시되지 않아 평가 한계와 재캡처 필요를 명시했다.
  - 2026-10-03 공식 법령의 투자심사·영향평가·예산안 제출·축제 안전·공연·반복 행사 조건을 선별 대조했다. 모든 첨부 PDF와 인허가를 전수 재검증한 것은 아니다.
  - 리뷰 front matter, 요구된 네 절, 연속된 지적 14개, 질문 2개, 전체 경로로 기재한 저장소 근거 파일의 존재를 확인했다.
  - 앱 실행·빌드·브라우저 동작 검증은 수행하지 않았다. 접근성·확대·성능의 실제 동작은 미평가로 기록했다. Git 명령은 실행하지 않았다.
- Questions:
  - 첫 배포를 입력 없는 정리·인쇄와 다음 확인 안내까지로 하고, 기존 기획 초안으로 옮기는 기능은 별도 구현으로 나눌 수 있는가?
  - 법령 금액·기한을 유지할 관리 담당과 갱신 방식을 둘 수 있는가? 정해지기 전에는 협의 부서·적용 질문·공식 원문 연결 중심의 공개를 권고한다.
- Handoff: Claude

## T-053 · Claude · proposer

- Position: 설계24를 v2로 고쳐 사용자 결정에 올린다. 두 흐름은 유지하고 첫 배포에서 목표·순서·끝을 함께 준다: 번호 없는 할 일 탭, 시작 화면의 흐름 지도·판단 질문, 자료 화면의 목표·알 수 없는 것·평문 질문, 하단 이어서 재편, 입력 없는 모아 보기(관측 일평균·출처·인쇄·다음에 확인할 일), 질문·협의할 곳·원문 중심의 축제 준비 전체 과정 안내. 길잡이 패널은 버튼으로만 열고, 자료 화면 그림·공식 금액 기한·기획 도구 옮기기는 뒤로 미룬다. Codex T-052 14개와 Fable 15개 지적을 항목별로 반영 또는 보류 사유를 기록했다.
- Evidence:
  - docs/design/24-planning-guide.md 18절 검토 반영표, 16절 결정 D1~D6
  - docs/review/2026-10-03-planning-guide-review-codex.md (T-052), docs/review/2026-10-03-planning-guide-review-fable.md
  - docs/research/2026-10-novice-planner-sources.md: 공식 자료22·법령 체크포인트11. 시행령 제41조·재난안전법 시행령 제73조의9·지방자치법 제142조는 법제처 원문으로 재확인
  - docs/assets/design-24/mockup-*-v2.jpg: 공개 화면 위 제안 시안. 회차 일평균은 공개 일별 표의 관측값, 2027년 3월 등록 행사·공휴일은 실제 조회 결과
  - 검토받은 v1과 원문은 커밋 f5dd781에 보존
- Changes:
  - docs/design/24-planning-guide.md (v2), docs/research/2026-10-*.md, docs/assets/design-24/**
  - docs/design/00_INDEX.md, tools/export-review.py, docs/ops/review-delivery.md
  - D:\download\project\pickDday\2026-10-03-planning-guide 검토 사본(원본 커밋 9c7d085)
- Validation:
  - 설계 문서·조사·검토 문서의 상대 링크와 그림 경로 전부 존재 확인, 내부 주소·로컬 경로 없음
  - 검토 사본 HTML49개 headless 1280px: 깨진 이미지0·없는 로컬 연결0·가로 넘침0·오류0, 설계24 페이지 1440/390px 그림15장
  - 앱·배포 변경 없음. 화면 동작·접근성·성능은 구현 전이라 미평가
  - T-051은 Codex 차례 중 사용자의 직접 작업 요청으로 수기 추가했다. 이번 턴은 Codex가 넘긴 차례에서 CLI로 기록한다
- Questions:
  - D1~D6을 제안대로 확정할까요? 특히 D3(자료 화면 그림을 작은 전용 세트 시안 뒤로 미룸)와 D5(공식 금액·기한을 갱신 담당이 정해질 때까지 미표시)는 처음 요청(그림 적극 추가·체크리스트)과 달라 확인이 필요합니다.
  - 초기 사용자 의견의 '흔들림'은 끝(얻는 것)·순서·행정 절차 연결 중 어느 쪽이 강했나요?
- Handoff: Human

## T-054 · Human · chair

- Position: 설계24 개선안 전체와 D1~D6 제안을 승인하고 구현을 지시한다. 흔들림은 ①끝에 얻는 것과 ②볼 순서 모두다. ③행정 절차 연결은 확인해 줄 공무원이 없어 확인하지 못했다. 시·도 담당자는 없고 모두 개인 PC를 쓰며 인쇄본은 내부 보고에 쓴다. 내용 검수자는 없어 우리가 정한다. 방향 조정: 문장·설명을 줄이고 시각 도구·아이콘·이미지로 직관적으로 보이게 하며, 팝업·초점 상태의 디자인 시스템도 함께 정제한다.
- Evidence:
  - 2026-10-03 Claude Code 세션에서 사용자가 T-053 질문에 직접 답하고 구현을 요청했다. 이 턴은 Claude가 사용자 발언을 요약해 대신 기록했다.
- Changes:
  - No changes
- Validation:
  - Not run — 사람 결정 기록
- Questions:
  - No open question
- Handoff: Claude

## T-055 · Claude · implementer

- Position: 설계24 묶음 1을 사용자 방향(문장 대신 아이콘·이미지·시각 도구)에 맞춰 구현·공개했다. 두 흐름의 할 일 탭(아이콘·번호 없음), 시작 화면 흐름 지도, 자료 화면 안내 띠(목표·알 수 없는 것·질문 2)와 이어서 줄, 회차 카드의 개최 전·개최기간·종료 후 일평균 막대, 입력 없는 모아 보기와 인쇄, 홈 얻는 것·전체 과정 띠, /guide 일곱 단계(숫자 기준 없음)를 더했다. 팝업은 공통 표면·머리글·둥근 닫기·휴대폰 아래 시트로, 초점은 2px 고리·입력칸 안쪽 빛·칩 전체 고리로 통일했다. 첫 반영 뒤 공개 측정에서 방문 화면 화면 밀림이 0.04→0.45로 커진 것을 찾아 고쳐 다시 반영했다.
- Evidence:
  - docs/validation/46-planning-guide.md (구현·검증·성능 비교·공개 배포)
  - docs/sdlc/3-testing/scenarios/TS-FC-021.md (인수 기준 G1~G6·G8·G9·DS1·DS2)
  - docs/design/24-planning-guide.md 19절 (결정·구현·계획과의 차이)
  - 공개 검사 docs/validation/evidence/2026-10-03-planning-guide-public/report.json, 배포 전후 보존 docs/validation/evidence/2026-10-03-planning-guide-before.json·after.json
  - 발행 작업 37131260380(ae7b945→ac9f196), 37133708269(1312880→4331467)
- Changes:
  - apps/web: lib/guide/*, components/guide/*, 두 여정 shell·모아 보기(summary) 경로·/guide, 회차 막대, 공통 대화상자·초점·메뉴 CSS, lucide-react 1.51.0
  - apps/web/scripts: planning-guide-e2e·live 추가, 기존 시험의 탭 이름·이어서 줄·부제 변경 반영, 소개 영상 시험 초점 대기
  - docs: 설계24 v3, design-system v8, functional-spec §15, screens·ia, TS-FC-021, 검수46
  - infra/k8s/fest-compass/overlays/prod: 검증 이미지 고정(2회)
- Validation:
  - npm test 414 통과(42+342+30, 새 길잡이 단위 시험 8), typecheck·next build 통과, 운영 의존성 감사 0건
  - 전체 headless 묶음(편집/공개, 시험 실행 29회) 최종 코드에서 통과, 새 시험 15항목, 소개 영상 시험 6회 연속 통과
  - 같은 컴퓨터 반영 전/후 5회 중앙값: 화면 밀림은 모든 화면에서 같거나 감소(방문 0.24→0.001, 시기 0.45→0.001), 전송량 화면당 약 10~30KB 증가, 시작 화면 LCP 소폭 증가
  - 공개: 4331467 Synced·Healthy, livez·readyz200, Deployment·PVC 동일·업무 9테이블20행 해시 일치, 공개 화면 검사 5항목·브라우저 오류0, 방문 화면 CLS 0.042→0.001
  - 미평가: 화면 낭독기 실제 사용, 실제 초기 사용자 재확인
- Questions:
  - No open question
- Handoff: Human

## T-056 · Human · chair

- Position: 2026-10-04 후속 요청과 결정: (1) 기존 축제 방문 흐름은 연도별 색으로 겹친 큰 그래프를 기본으로 하고 따로 보기는 바꿔 보기로 유지, 점에 상세 수치, 연계 관광 지도에 축제 위치 표시. (2) 자동차·도보 이동 시간 원은 보류(고려할 것이 너무 많아짐). (3) 목적에 맞게 축제를 찾는 기능을 제안 순서대로 진행: 등록 분류 유형 칩·먹거리·체험 표시 → 문화관광축제 방문 규모 → 데이터랩 수동 보강(나중). 방문 축제는 외지인 대상(관광 연계)과 지역 주민 대상(교통편·프로그램) 둘 다를 뜻하며 기획자에게 중요한 판단 기준이다. (4) 이미지 저장소 한도로 발행이 막혔을 때 지난 이미지 2개(ae7b945·1312880) 정리 후 즉시 공개를 승인.
- Evidence:
  - 2026-10-04 Claude Code 세션에서 사용자가 직접 요청·결정했다. 이 턴은 Claude가 사용자 발언을 요약해 대신 기록했다.
- Changes:
  - No changes
- Validation:
  - Not run — 사람 결정 기록
- Questions:
  - No open question
- Handoff: Claude

## T-057 · Claude · implementer

- Position: 2026-10-04 후속 개선을 공개했다: 방문 흐름 겹쳐 보기 기본·점 상세 수치·연계 관광 지도의 축제장 표시(검수46 후속), 그리고 목적별 축제 찾기 1단계 — 축제 검색의 등록 분류 유형 칩 일곱 개(지역특산물·먹거리 등, 유형만 고르면 전국 목록 40건씩, 카드·축제 머리 분류 표식)와 /compare/scale 문화관광축제 방문 규모(일평균·기간 합계·외지인/현지인 비율 순위, 세 집단 쌓은 막대, 60% 외지인/현지인 중심 표시). 이동 시간 원은 사용자 결정대로 보류했다.
- Evidence:
  - docs/validation/47-festival-discovery.md (구현·검증·검수·공개 배포)
  - docs/design/25-festival-discovery.md, docs/sdlc/3-testing/scenarios/TS-FC-022.md
  - docs/validation/evidence/2026-10-04-festival-discovery-before.json·after.json
  - 발행 작업 37182965902(deee795 → sha256:72c7ace2…), 배포 선언 a067d79
- Changes:
  - apps/web: lib/existing/festival-types.ts·tour.ts·server.ts·request.ts·identity.ts, components/existing/FestivalSearch.tsx·festival-type.tsx·ExistingShell.tsx, lib/datalab/scale.ts, components/FestivalScale.tsx, app/compare/scale, 홈·축제 비교·연도별 흐름 입구
  - apps/web/scripts: festival-discovery-e2e·live 추가, run-demo-e2e 목록
  - docs: 설계25, TS-FC-022, 검수47, functional-spec §16, screens(SCR-FC-018), ia, data-visualization v13, design-system v9, 자료 목록
  - infra/k8s/fest-compass/overlays/prod: 검증 이미지 고정(동의 배너 deee795 포함)
- Validation:
  - npm test 424 통과(새 단위 시험 9), typecheck·next build 통과
  - 전체 headless 묶음(편집/공개, 시험 실행 30회) 통과, 새 시험 26항목
  - 공개: Synced·Healthy, livez·readyz 200, Deployment·PVC 동일·업무 9테이블 20행 해시 일치, 공개 검사 5항목 통과(지역특산물 47건·문화관광 64건·순위 원문 일치)
  - 미평가: 분류 자체의 타당성(공급처 값), 화면 낭독기 실사용
- Questions:
  - No open question
- Handoff: Claude

## T-058 · Claude · implementer

- Position: 목적별 축제 찾기 2단계를 공개했다: 수집기가 등록 소개 글(detailIntro2)을 하루 한 번 읽어(첫날 200회, 이후 40회, 다가오는 축제 먼저) 체험·어린이·가족·무료(무료·일부 유료) 표시를 근거 글 조각과 함께 만들고, 검색 결과 위 `소개 글로 거르기`(표시별 수, 그리고, 주소 유지, 확인 전 제외 안내), 카드·축제 머리 표시와 `소개 글 근거` 팝업, `전체` = 이름·지역 없는 그해 모든 축제 전국 목록(처음 화면은 눌린 칩 없음, 눌린 칩 재클릭 해제)을 더했다. 3단계 데이터랩 수동 보강은 사람 작업으로 남는다.
- Evidence:
  - docs/validation/47-festival-discovery.md v2 2단계(구현·검증·공개 배포)
  - docs/design/25-festival-discovery.md 6절, docs/sdlc/3-testing/scenarios/TS-FC-022.md v2 M1~M6, docs/ops/festival-sources.md v2
  - 발행 작업 37184689129(f0b0d24 → sha256:720c589c…), 배포 선언 c2cd6c8, 운영 소개 글 첫 수집 200회·200건·오류 0
- Changes:
  - apps/web: lib/existing/festival-marks.ts, lib/festival-sources/intro.ts·run.ts·registry.ts·store.ts, lib/existing/server.ts·tour.ts·request.ts·types.ts, components/existing/FestivalSearch.tsx·festival-marks.tsx·ExistingShell.tsx, 수집 작업자·수동 CLI(--intro)
  - apps/web/scripts: festival-discovery-e2e(34항목)·live 확장
  - docs: 설계25 v2, TS-FC-022 v2, 검수47 v2, functional-spec v12, screens v18, ia v14, design-system v10, 운영 문서 v2, 자료 목록
  - infra/k8s/fest-compass/overlays/prod: 검증 이미지 고정
- Validation:
  - npm test 445 통과(새 단위 시험 12), typecheck·next build·수집기 묶음 통과
  - 전체 headless 묶음(시험 실행 31회) 통과, 축제 찾기 시험 34항목
  - 공개: Synced·Healthy, livez·readyz 200, Deployment·PVC 동일·업무 9테이블 20행 해시 일치, 공개 검사 8항목(모든 축제 486건, 체험 92·어린이·가족 45·무료 104, 근거 팝업)
  - 미평가: 표시 규칙의 넓은 표본 정확도(30건 표본만 대조), 화면 낭독기 실사용
- Questions:
  - 3단계 데이터랩 수동 보강을 언제, 어떤 축제부터 할지 정해 주세요.
- Handoff: Human

## T-059 · Human · chair

- Position: 2026-10-04 결정: 지난 이미지 2개(ed3585c·d3def74) 정리를 승인하고, 공개 검사에서 찾은 문제(휴대폰 바닥글 가림·첫 방문 기본 창 깜박임)를 고치도록 요청했다. 데이터랩 축제별 연도 방문 추이 파일 내려받기의 자동화 가능 여부를 확인하도록 요청했다.
- Evidence:
  - 2026-10-04 Claude Code 세션에서 사용자가 직접 승인·요청했다. 이 턴은 Claude가 사용자 발언을 요약해 대신 기록했다.
- Changes:
  - No changes
- Validation:
  - Not run — 사람 결정 기록
- Questions:
  - No open question
- Handoff: Claude

## T-060 · Claude · implementer

- Position: 승인대로 지난 이미지 2개를 정리하고, 동의 배너 공개 검사에서 찾은 두 문제를 고쳐 공개했다: 화면 아래 고정 카드(동의 배너·소개 영상 안내)가 떠 있는 동안 바닥글 아래 자리를 더해 휴대폰에서도 `분석 동의 다시 보기`를 누를 수 있고, 페이지가 기본 창 숨김 표시를 단 채 와서 첫 방문에 Cloudflare 창이 깜박이지 않는다(로더 없으면 즉시 해제, 지켜보기는 간격 횟수로). 데이터랩 내려받기 자동화는 권하지 않음 — 공지·로그인·약관상 회색지대이고 같은 자료의 공식 API가 없으며, 더 큰 쟁점은 공공누리 없는 자료의 공개 재이용 허락이다.
- Evidence:
  - docs/validation/48-consent-banner.md v2 공개 배포(실행 6054, 발행 37196367559 → sha256:f3650a9e…, 배포 선언 a369dc1, 공개 검사 두 번 모두 통과)
  - docs/research/2026-10-datalab-download-automation.md(공지·저작권 정책 원문 인용, 대안 자료, 신청 경로)
- Changes:
  - apps/web: components/useBottomDock.ts·AppShell·ConsentBanner·intro/IntroVideo, lib/analytics/consent.ts, app/layout.tsx(첫 화면 숨김 표시), scripts/consent-banner-e2e.mjs(바닥글·첫 화면 시험)
  - docs: 설계26, 검수48 v2, design-system, 검수47 메모, 연구 메모 2026-10 데이터랩 자동화, 자료 목록
  - infra/k8s/fest-compass/overlays/prod: 검증 이미지 고정
- Validation:
  - npm test 446 통과, 전체 headless 묶음 31회 통과, 새 첫 화면 시험은 고치기 전 빌드에서 실패(표본12)·고친 뒤 0
  - 공개: Synced·Healthy, livez·readyz 200, Deployment·PVC 동일·업무 9테이블 20행 해시 일치, 동의 공개 검사 2회×2폭 통과, 축제 찾기 공개 검사 통과
  - 미평가: 데이터랩 재이용 범위(공사 회신 필요)
- Questions:
  - 데이터랩 자료의 공개 재이용 허락·일괄 제공을 한국관광공사에 문의할까요? 문의 글 초안은 제가 준비할 수 있고 보내는 것은 사용자 몫입니다.
- Handoff: Human

## T-061 · Human · chair

- Position: 2026-10-04 결정: 공모전 시간이 촉박하니 데이터랩은 쓰지 않는다. 화면이 배포됐다면 제거한다.
- Evidence:
  - 2026-10-04 Claude Code 세션에서 사용자가 직접 결정했다(“공모전 시간이 촉박하니 데이터랩은 안쓰는걸로 할게. 만약 화면 배포되었다면 제거하는걸로 진행해줘”). 이 턴은 Claude가 사용자 발언을 요약해 대신 기록했다.
- Changes:
  - No changes
- Validation:
  - Not run — 사람 결정 기록
- Questions:
  - No open question
- Handoff: Claude

## T-062 · Claude · implementer

- Position: ADR-0003에 따라 데이터랩 웹사이트 내려받기 자료를 쓰던 공개 화면을 모두 뺐다: /compare/annual·/compare/scale(308로 /compare 이동), 기존 축제 방문 흐름의 개최지 방문 구성·임실 방문자 특성(성·연령·목적지·두 회차 비교), 새 축제 방문 흐름의 지역 연간 추세, 그 연결·가공 자료·스크립트·시험. 공공데이터포털 DataLabService API와 TourAPI 기반 기능은 그대로다.
- Evidence:
  - docs/decisions/0003-no-datalab-website-downloads.md
  - docs/validation/47-festival-discovery.md '방문 규모 화면 제거'(발행 37198955311 → sha256:0535ad3c…, 배포 선언 ac101ec, 공개 확인)
- Changes:
  - apps/web: lib/datalab·화면 구성 요소 7개·app/compare/annual·scale 삭제, 가공 자료 8개·스크립트 8개·화면 시험 4개 삭제, 서버·응답 칸 정리, next.config 이동, 홈·축제 비교·축제 검색·사이트맵 연결 제거, ADR 정적 검사·축제 찾기 시험 갱신
  - docs: ADR-0003, functional-spec v13, screens·ia·data-visualization·flows·design-system·srs·UC·TS(TS-FC-012~014 폐기, 022 S1~S6 폐기)·자료 목록·설계25 v3·검수37~39·47
  - infra/k8s/fest-compass/overlays/prod: 검증 이미지 고정
- Validation:
  - npm test 375 통과(ADR 정적 검사 포함)
  - headless: 길잡이 시험 16항목(새 서버)·이후 20개 시험 통과, 앞부분은 묶음 실행에서 통과
  - 공개: Synced·Healthy, livez·readyz 200, 업무 자료 해시 일치, 옛 주소 308·사이트맵 부재·임실 화면에 제거 영역 없음, 축제 찾기 공개 검사 통과
- Questions:
  - 공개 저장소에 남은 데이터랩 원본 파일 337개를 현재 판에서 지울까요?
- Handoff: Human

## T-063 · Human · chair

- Position: 2026-10-04 결정: 연도별 방문 흐름은 꼭 필요하니 제거를 되돌린다. 이 프로젝트는 한국관광공사 공모전 참가작이라 한국관광공사 자료를 쓰는 것이 목표이고, ‘데이터랩’을 다른 기관 사이트로 착각했었다. 공공데이터·공모전·공무원 대상이라 괜찮다고 판단한다.
- Evidence:
  - 2026-10-04 Claude Code 세션에서 사용자가 직접 결정·설명했다. 이 턴은 Claude가 사용자 발언을 요약해 대신 기록했다.
- Changes:
  - No changes
- Validation:
  - Not run — 사람 결정 기록
- Questions:
  - No open question
- Handoff: Claude

## T-064 · Claude · implementer

- Position: ADR-0003 제거를 전부 되돌려 공개했다: 연도별 방문 흐름(/compare/annual), 문화관광축제 방문 규모(/compare/scale), 개최지 방문 구성, 임실 방문자 특성, 지역 연간 추세와 연결·자료·스크립트·시험. 앱 코드는 전체 시험을 마친 c5ed391과 바이트 단위로 같다. ADR-0004가 ADR-0003을 대체한다.
- Evidence:
  - docs/decisions/0004-use-kto-datalab-data.md
  - docs/validation/47-festival-discovery.md ‘되돌림’(발행 37200430264 → sha256:3bba936d…, 배포 선언 f2d2e3d, 공개 확인)
- Changes:
  - apps/web: 4784489 상태로 복원(c5ed391과 동일)
  - docs: ADR-0004, ADR-0003 대체됨 표시, 설계·시험 문서의 제거 표시 되돌림, 검수47 되돌림 기록, 연구 메모 결정 표시
  - infra/k8s/fest-compass/overlays/prod: 검증 이미지 고정
- Validation:
  - npm test 446 통과, 타입 검사·발행 빌드 통과, 같은 코드의 전체 headless 31회 근거 재사용(c5ed391)
  - 공개: Synced·Healthy, livez·readyz 200, 업무 9테이블 20행 해시 일치, 두 화면 200·사이트맵 포함·임실 화면 영역 복귀, 축제 찾기 공개 검사 8항목 통과
- Questions:
  - No open question
- Handoff: Human

## T-065 · Human · chair

- Position: 2026-10-04 결정: 공모전 제출처가 한국관광공사이므로 데이터랩 자료를 적극 쓴다. 재이용 점검 뒤 제안한 대로 이미 받아 둔 표를 화면에 잇고 모든 화면에 ⓒ한국관광공사 출처를 표기한다('좋아 연결해줘'). 서버 보관 문의 메일은 사용자가 바로 보낸다.
- Evidence:
  - 2026-10-04 Claude Code 세션에서 사용자가 직접 결정했다. 이 턴은 Claude가 사용자 발언을 요약해 대신 기록했다.
  - 점검 근거: 2026 관광데이터 활용 공모전(②-2 웹·앱 구현) 공고문 원본 — OpenAPI 필수·그 외 자료 자유, 저작권 등 법적 책임은 지원자
- Changes:
  - No changes
- Validation:
  - Not run — 사람 결정 기록
- Questions:
  - No open question
- Handoff: Claude

## T-066 · Claude · implementer

- Position: 1차 공개: 축제별 방문 자료(/compare/annual)에 데이터랩 26곳의 축제 기간과 평소 비교·방문객 성·연령·목적지 검색순위(78개 표)를 잇고 모든 화면 하단에 ⓒ한국관광공사 출처를 표기했다. 성·연령·목적지 순위는 내려받기 범위 합산, 측정값 없는 7개 축제·연도는 값 없음으로 둔다. 2차(개최지·지역 표)를 이어서 진행한다.
- Evidence:
  - docs/validation/49-datalab-festival-profiles.md(발행 37206020672 → sha256:e2516c84…, 배포 선언 0d017b1, 공개 확인)
  - docs/design/27-datalab-festival-profile.md
  - docs/sdlc/3-testing/scenarios/TS-FC-024.md
- Changes:
  - apps/web: 생성·읽기(datalab-festival-profiles), 화면 FestivalProfile, 공통 Segmented·DemographicBars, 원문 목록 사용 표시 27→105, 하단 출처
  - docs: 설계27, 검수49, TS-FC-024, screens·data-visualization·자료 목록·가져오기 README·현황
  - infra/k8s/fest-compass/overlays/prod: 검증 이미지 고정
- Validation:
  - npm test 459 통과, 타입 검사·발행 빌드 통과
  - headless 31종 통과(길잡이는 그림을 미리 변환한 새 서버에서 16항목)
  - 공개: Synced·Healthy, livez·readyz 200, 업무 9테이블 20행 해시 일치, 공개 화면 10항목 통과
- Questions:
  - No open question
- Handoff: Claude
