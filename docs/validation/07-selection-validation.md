# 샘플 선정·과거 조사 도구 검증

검증일: 2026-09-07. 기준 `fbe50f0` 위의 `feat/festival-sample-selection` 변경.
수정은 `/home/lsh/dev/worktrees/fest-compass-sample-selection`에서 진행했다.
환경은 WSL Linux x64, Node 24.20.0, npm 11.19.0, 기존 lockfile 설치다.

## 변경 범위

- 공개 자료로 임실·백제·논산의 2023~2025 회차를 비교하고 논산딸기축제를 선정했다.
- 논산시 일별 외지인 방문 추세의 정답 필드·발행 시점·기준 모델·평가 방법·사용 한계를 정의했다.
- `data:profile-history`는 앱 DB에 쓰지 않고 전국 하루 응답에서 네 지역의 3종 방문자 자료를 검증한다.
- 계획·문서 지도·프로젝트 상태와 조사 증거를 갱신했다. 제품 화면·모델·DB·운영 배포는 이번 변경 대상이 아니다.

## 실행 결과

| 검증 | 결과 |
|---|---|
| `npm ci --no-audit --no-fund` | 성공; Prisma client 생성 |
| `npm test` | 최종 82건 통과(81 + SQLite migration 1) |
| `npm run typecheck` | 통과. 최초 새 테스트의 튜플 타입 오류를 수정한 뒤 재실행 |
| `npm run build` | 성공, standalone 환경파일 검사 통과 |
| `npm run test:e2e` | 격리 DB·임시 loopback 포트에서 `e2e ok` |
| `python3 infra/scripts/validate_argocd_registration.py` | prepare mode, 17개 리소스 통과 |
| `python3 -m unittest infra.scripts.test_validate_argocd_registration` | 28건 통과 |
| `python3 .dev-standard/check_compliance.py` | 통과 |
| 기존 출력 경로로 조사 CLI 실행 | 첫 네트워크 호출 전에 거부, 종료코드 1; 기존 증거 보존 |
| 기초지자체 과거 선택일 실조회 | 아래 보고서 14회: success 10, empty 4, error 0, 두 실행 모두 종료코드 0 |
| 출처 URL·내용 확인 | 직접 HTTP 23/25 성공. B1·B4는 직접 연결 실패, 검색 도구의 공식 페이지 본문 사용 |
| 공주시 재정공시 PDF | 97쪽(인쇄 91쪽) 이미지에서 2024 기간·공주 지역·996,038명 확인 |

새 단위 검사는 일부 전국 페이지만 받은 경우, 방문자 종류 누락·중복, 전북 구/신 코드 중복,
지역코드·이름 불일치, 날짜·종류 불일치, 잘못된 숫자·음수를 거부하고 0과 소수 추정치는 보존하는지 확인한다.
E2E 이후 조사 전용 숫자 검사를 강화하고 자동 테스트·타입 검사·빌드를 재실행했다.
제품 경로가 이 조사 모듈을 사용하지 않으므로 E2E 증거는 재사용한다.

## 재현 가능한 실조회

앱 디렉터리에서 기존 `TOUR_API_KEY` 환경변수를 사용한다. 이번 실행은 기준 작업공간의
기존 Git 제외 `.env`를 Node `--env-file`로 읽었다. 키 복사·발급·회전이나 클러스터 접근은 하지 않았다.
재실행은 반드시 새로운 출력 파일명을 쓴다.

```bash
npm run data:profile-history -- \
  --date 20230308 --date 20230923 --date 20231006 \
  --date 20240321 --date 20240928 --date 20241003 \
  --date 20250327 --date 20251003 --date 20251008 \
  --date 20260801 --date 20260901 --date 20260903 \
  --output output/research/history-days-new.json

npm run data:profile-history -- \
  --date 20260815 --date 20260831 \
  --output output/research/history-availability-new.json
```

- [첫 12회 보고서](evidence/2026-09-07-kto-history-days.json)
- [추가 2회 보고서](evidence/2026-09-07-kto-history-availability.json)
- [출처 주소·현재 응답 해시](evidence/2026-09-07-source-checks.json)

도구 작성 전 계약 확인용 2025-03-27 실호출 1회가 별도로 있어 시군구 API 실호출은 총 15회다.
보고서 14회와 합쳐 새 증거가 15개 날짜를 덮는 것으로 계산하지 않는다.
빈 응답은 0명이나 API 중단으로 해석하지 않는다. 2026-08-01은 확인한 선택일 중 가장 최근 값이지,
제공되는 전체 기간의 끝이나 확정 갱신 지연을 뜻하지 않는다.

## 미검증 범위

연속 다년 자료, 과거 공개시각·개정 전 데이터, 예측 정확도·불확실성 보정,
일별 축제 입장객·현장 혼잡·실제 셔틀 운행·대기·비용, 실무자 인터뷰는 미검증이다.
샘플 선정·지표 정의·조사 도구 통과를 전체 고도화나 예측 기능 사용 가능으로 표시하지 않는다.
