# MVP 전체 흐름 구현과 검증

작성일: 2026-09-07. 모델 정확도 개선보다 전체 화면·기능과 빠른 피드백을 우선한다는 사용자 요청을 적용했다.

## 제공 기능

[작업공간 설계](../design/06-mvp-workspace.md)에 따라 홈의 첫 행동을 내 작업 시작으로 바꾸고,
`/workspace`에서 자료·준비 → 운영안 비교 → 결정·현장 기록 → 결과 비교 → 보고·다음 회차를 연결했다.
논산의 실제 지역 자료·기존 예측은 참고 링크와 수집 상태로 연결한다. 입력은 개인 브라우저에만 저장한다.
공개 서버의 쓰기 차단, 기존 편집 모드, 일일 수집과 고정된 모델·겨울 시험은 유지한다.

## 검증

환경: SH-HOME WSL, Node 24.20.0, npm 11.19.0, 전용 worktree `fest-compass-mvp-journey`.

- `npm test`: 127건 통과. 새 7건은 결정 보존·결측/0·결과 기준·다음 회차 격리·파일 검증을 확인한다.
- `npm run typecheck`: 통과. production build 통과, 겨울 시험의 코드 14개 해시 검증 유지.
- `npm run test:e2e`: 기존 편집 모드 전체 회귀와 별도 공개 모드 개인 작업 전체 흐름 통과.
  논산 샘플 → 두 운영안 → 결정 → 현장 대응 실행 → 준비 가정 변경 → 실측 0건 → 보고서 → 복사 →
  파일 내보내기·손상 파일 거부·복원·모바일 다섯 단계·인쇄·다른 탭 변경 보호를 확인했다.
  개인 작업 중 서버 쓰기 요청 0건, 브라우저 오류 0건, 390px 가로 넘침 0건.
- `python -m unittest discover -s infra/scripts -p 'test_*.py'`: 40건 통과. 배포 선언 검사 통과.
- `npm audit --omit=dev --omit=optional --audit-level=high`: 취약점 0건.

첫 브라우저 검사에서는 다중 탭 검사의 Playwright context 생성 방식이 잘못돼 마지막 검사에서 실패했다.
명시적 browser context로 수정한 뒤 전체 E2E를 다시 실행해 통과했다. 제품 실패로 숨기거나 이전 실패를
통과로 바꾸지 않는다. 화면 증거는 로컬 `output/mvp-journey-20260907/playwright/`에 보관한다.

## 미검증·후속

전체 개인 작업 동선은 사용할 수 있지만, 실제 사용자의 과제 관찰·현장 효과 검증은 아직 하지 않았다.
공동 저장·인증·공식 승인, CSV와 시간·구역 실측의 개인 작업 연결, 다른 지역 데이터 연결은 후속이다.
기존 겨울 시험은 실제 발행과 관측 도착을 기다린다. 이 구현을 공모전·실무 종합 평가 완료로 표시하지 않는다.

## 2026-09-08 공개 배포 확인

상태: **개인 작업 전체 흐름 사용 가능**. [내 축제 작업공간](https://kto.damecasol.com/workspace)에서
논산 샘플 또는 빈 축제로 시작할 수 있다. 공동 편집·공식 승인은 개발 필요다.

- 기능 소스: `6fee76a76fe13ae0f26794053d0fdebd8a9b4704`.
- [배포 CI 34173719257](https://github.com/gitvssh/fest-compass/actions/runs/34173719257): 성공.
  `homelab-fest-compass-k8d69-runner-jf289`에서 127개 테스트·타입·빌드·배포 검사와 원격 이미지 검증 통과.
- 검증 이미지: `sha256:4af5b4104d9e2d3c97d3e8b6e66d89f7e8f19d02f215a1a092dfdd8c05584789`.
- 배포 선언: `a7d7df2be31eb831c601827590f12cbe3c2a15f6`. Argo Succeeded / Synced / Healthy, 한 replica 유지.
- 공개 전체 흐름 검증: `E2E_BASE_URL=https://kto.damecasol.com E2E_REJECT_ANALYTICS=1 node scripts/workspace-e2e.mjs` 통과.
  실제 Cloudflare 동의 창에서 Reject All을 선택한 뒤 개인 입력·저장·출력·다중 탭 보호를 확인했다.
  애플리케이션 쓰기 요청 0건, 브라우저 오류 0건, 다섯 단계의 390px 가로 넘침 0건.
  동의 창의 별도 전송은 Cloudflare 소유 경로로 구분하며 개인 작업 데이터를 허용하지 않는다.
- 공개 홈 → 내 작업공간 진입과 기존 이력 비교·수집 화면을 Chromium으로 확인했다.
- 오늘 09시 수집 7회, 최신 관측 2026-08-09·1,317일·누락 29일이 배포 전후 같았다.
  기존 예측 2개와 겨울 등록 원본·26건 계획의 값과 해시가 보존됐다.

정형 증거: [2026-09-08-mvp-production.json](evidence/2026-09-08-mvp-production.json).
공개 동의 창 처리만 E2E 스크립트에 추가했으며 이미지의 제품 소스·고정 예측 코드는 바꾸지 않았다.
실제 사용자 관찰은 자동 브라우저 검증과 별개로 남아 있다.
