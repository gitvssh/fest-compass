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
  - https://traceboard.homelab.damecasol.com/portfolio/fest-compass/site/pages/docs-review-2026-09-planning-review.html
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
