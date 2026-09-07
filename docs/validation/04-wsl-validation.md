# WSL 이전과 조사 도구 검증

검증일: 2026-09-07. 기준 제품 커밋 `1322636` 위의 이번 변경을 WSL2 Linux x64에서 검증했다.
Node 24.20.0, npm 11.19.0, 저장소 lockfile에 따른 설치다. 현재 제품의 전체 고도화 완료를 뜻하지 않는다.

## 결과

| 검증 | 결과 |
|---|---|
| `npm ci` | 성공, Prisma client 생성 |
| `npm test` | 최종 78건 통과(앱·데이터 77 + SQLite 마이그레이션 1) |
| `npm run typecheck` | 최종 변경 기준 통과 |
| `npm run db:migrate:deploy` 및 `npm run db:seed` | 신규 로컬 SQLite에 2개 migration·예시 적재 성공 |
| `npm run build` | 최종 변경 기준 성공, standalone 환경파일 제거 검사 통과 |
| `npm run test:e2e` | 격리 DB·임시 loopback 포트에서 `e2e ok` 확인 |
| `npm audit --omit=dev --omit=optional` | 해당 운영 의존성 범위 취약점 0건. 전체 설치 감사와 범위가 다름 |
| `python3 infra/scripts/validate_argocd_registration.py` | prepare mode의 17개 리소스 계약 통과 |
| `python3 -m unittest infra.scripts.test_validate_argocd_registration` | 28건 통과 |
| `python3 .dev-standard/check_compliance.py` | 통과 |
| 원문 보관 경로를 제외한 `git diff --cached --check`·기존 두 API 키의 원문/인코딩 포함 여부 검사 | 통과, 변경 파일에 로컬 DB·자격 값 없음 |
| 기존 Markdown 3건과 보관본 바이트 비교 | 모두 동일 |
| 기존 조사 출력 경로로 CLI 재실행 | 첫 네트워크 호출 전에 거부, 종료코드 1 |

E2E 이후 변경은 조사 CLI의 출력 중복 사전 확인 및 날짜 검증 강화와 문서뿐이다.
앱 화면·서버 액션·DB 계약은 변경되지 않아 브라우저 증거를 재사용했고,
최종 조사 모듈에 대한 자동 테스트·타입 검사·빌드는 다시 실행했다.

원문 보관 경로는 기존 Markdown의 두 칸 줄바꿈과 파일 끝 빈 줄 때문에 기본 whitespace
검사에서 경고가 발생한다. 원본 바이트 보존을 우선해 수정하지 않았으며, 이 경로만 제외한
나머지 최종 diff를 검사했다. 다른 검증 실패를 이 예외로 처리하지 않는다.

## 실데이터 증거

`npm run data:profile -- --output output/research/kto-profile-20260907-runtime.json`:
28회, 비어 있지 않은 정상 16, empty 12, error 0, 종료코드 0.
증거 JSON은 날짜 검증 강화 전 조회 결과다. 표본의 실제 날짜는 유효하며 호출 조건과
응답 파서는 그대로다. 재조회 없이 기존 증거를 보존한다.

실무자 인터뷰, 다년 전체 데이터 확보, 자체 예측 성능, 최종 샘플 선정, 화면 고도화는 후속 단계다.
현재 운영 편집 경계 변경이나 배포 실행은 이 검증 범위에 포함되지 않는다.
