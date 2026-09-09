---
class: Current
owner: fest-compass
last_verified: 2026-09-09
version: v1
summary: "M6 코드 검증은 완료했으나 이미지 저장소 한도로 운영 배포가 대기 중입니다. 현재·복구 이미지를 보존하고 미사용 이미지 네 개만 정리하는 승인 범위를 제시합니다."
---

# M6 배포 대기와 이미지 정리 검토

2026-09-09 현재 **개발·자동 검증 완료 / 새 앱 이미지 업로드 실패 / 정리 승인 필요**다.
기존 운영 앱은 정상이고 M6 화면은 아직 운영에 반영되지 않았다. Traceboard에는 로컬 실제 화면과 검수 자료를 게시한다.

소스 `c3e53b309ef63a32008aea85f911d8ac74ce69b3`의 [CI 34302743602](https://github.com/gitvssh/fest-compass/actions/runs/34302743602)는
전용 ARC `homelab-fest-compass-k8d69-runner-s2fqv`에서 코드 검증과 이미지 빌드까지 통과했으나 업로드가 거부됐다.
저장량 985.1MiB에 새 레이어 86.7MiB를 더하면 기존 한도 1GiB를 넘는다. 원격 이미지 검증·보호 표식 승격은 실행하지 않았다.

## 보존할 이미지

| 역할 | source commit | digest |
|---|---|---|
| 현재 운영·deploy-current | 1e63741279f7170b430fee07f30945c0f1f35c0a | sha256:6b5f271087a7080f3b444beb666b279a5e6d10f325397cf8aabcb037b598381d |
| 직전 복구·deploy-rollback | 00432323f58feedfb5781535526f79158d996804 | sha256:4f0df90a7ed0b7695c63bd32384f3b5d781035abf59b7420ffa28cb0db4542bd |

현재 Deployment의 web·forecast-worker와 Git overlay가 위 현재 운영 이미지를 사용한다.

## 새로 승인받을 정리 대상

`fest-compass/web`의 아래 이미지 4개만 삭제하는 범위다. Git 코드·축제 자료·PVC·예측 기록·현재 운영/복구 이미지는 대상이 아니다.
아래는 검토 가능한 제안이며 이 문서를 작성한 시점에 삭제하지 않았다.

| source commit | digest |
|---|---|
| fed424fddd2b7c6b3c6ea38f4a3bcd332fe2c022 | sha256:4232ae15b44b5a6d61d47d91919c093868d8bfed349828e5db17a778ef899c21 |
| dcf1f5f5d710f086193eba78b0fe5934caa8790f | sha256:d4d655f8c4f087fa34987ead203f816cbeeddb52a7d0e1beb3ef373a76cf9799 |
| 590c80599c07113df19ad6900c64122fa6887afd | sha256:00322425feb7b9d1d26237adad224bb5dcf4f33a78e092b3f06f2d080ced7846 |
| 181144c3a9505f916dcbc11cca16d562f6436d0c | sha256:5c090b44164c4a442761375c7a29051696fdacff97c6d1bddfb9ebf66df657fa |

Harbor 조회에서 저장소는 web 하나·artifact 6개·보호 표식 2개다. retention ID 17은 현재/직전 복구 표식 보존 정책이며 매일 03:30 한국시각에 예약되어 있다. 조회 당시 다음 예약은 2026-09-10 03:30이다.
여러 배포가 다음 예약 전에 누적되어 한도에 도달했다. 사용량을 단순 이미지 크기 합계로 계산하지 않는다(공유 레이어가 있음).
실제 저장량은 1,032,968,664 bytes / 한도 1,073,741,824 bytes다. 최근 예약 정리 3507(2026-09-09 03:30 한국시각)은 Success여서 예약 연결 실패가 아니라 이후 배포 누적이다.

## 승인 후 수행할 정확한 절차

1. 현재/복구 digest, 후보 네 개, 단일 저장소와 정책·사용량을 다시 조회한다. 대상이 달라졌으면 이 목록으로 삭제하지 않는다.
2. 기존 비출력 자격 경로로 infra `platform registry plan --env homelab --project fest-compass --password-stdin`을 실행해 정책 변경 없음인지 확인한다.
3. 같은 프로젝트의 기존 `lifecycle-execute --yes`를 실행한다. 이 명령은 새 dry-run과 보호 표식 확인 후 선언된 정책의 정리를 실행한다. quota·권한·전역 GC·다른 프로젝트·예약 설정은 바꾸지 않는다.
4. 정리 후 정확한 현재/복구 두 이미지와 사용량을 확인한다. 실패한 CI 34302743602의 같은 소스만 재실행한다.
5. 원격 검증 digest를 앱 overlay와 service-version에 고정해 게시·등록 앱 sync한다. 실제 이미지·공개 M6 headless 흐름·기존 예측 보존을 확인한다.
6. Traceboard의 배포 대기 표기를 실제 완료 증거로 갱신하고 전용 worktree를 정리한다.

추가 승인이 필요한 근거는 [앞선 승인 기록](forecast-history-release.md)의 “위 네 개 외 이미지 삭제나 새로운 권한·quota 변경으로 범위를 넓히지 않는다”와 홈랩 공통 정책 §1이다. 앞선 네 개와 이번 네 개는 서로 다른 digest다.
