---
class: Current
owner: fest-compass
last_verified: 2026-09-09
version: v2
summary: "사용자 승인으로 미사용 이미지 네 개를 정리하고 현재·복구용 두 개를 보존했습니다. 동일 소스 배포 재실행과 공개 검증 결과를 기록합니다."
---

# M6 배포 복구와 이미지 정리 기록

2026-09-09 최초 시도는 **개발·자동 검증 완료 / 새 앱 이미지 업로드 실패**였다.
이후 사용자가 아래 네 이미지 삭제를 승인했고 정리를 완료했다. 앱 배포 결과는 아래 후속 기록을 따른다.

소스 `c3e53b309ef63a32008aea85f911d8ac74ce69b3`의 [CI 34302743602](https://github.com/gitvssh/fest-compass/actions/runs/34302743602)는
전용 ARC `homelab-fest-compass-k8d69-runner-s2fqv`에서 코드 검증과 이미지 빌드까지 통과했으나 업로드가 거부됐다.
저장량 985.1MiB에 새 레이어 86.7MiB를 더하면 기존 한도 1GiB를 넘는다. 원격 이미지 검증·보호 표식 승격은 실행하지 않았다.

## 정리 당시 보존한 이미지

| 역할 | source commit | digest |
|---|---|---|
| 현재 운영·deploy-current | 1e63741279f7170b430fee07f30945c0f1f35c0a | sha256:6b5f271087a7080f3b444beb666b279a5e6d10f325397cf8aabcb037b598381d |
| 직전 복구·deploy-rollback | 00432323f58feedfb5781535526f79158d996804 | sha256:4f0df90a7ed0b7695c63bd32384f3b5d781035abf59b7420ffa28cb0db4542bd |

정리 당시 Deployment의 web·forecast-worker와 Git overlay가 위 현재 운영 이미지를 사용했다. 후속 배포의 새 현재/복구 표식은 아래 기록을 따른다.

## 사용자가 승인한 정리 대상

`fest-compass/web`의 아래 이미지 4개만 삭제하는 범위다. Git 코드·축제 자료·PVC·예측 기록·현재 운영/복구 이미지는 대상이 아니다.
아래 목록은 최초 제안 당시 삭제하지 않았으며, 2026-09-09 후속 명시 승인 후에만 삭제했다.

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

## 승인 정책 확인과 실제 정리

2026-09-09 사용자가 “승인할게 삭제해줘. 이미지 삭제는 기본승인정책아니야? 확인해줘.”라고 요청했다.
공통 정책 §1의 일반 삭제 경계와 §1.2 상시 위임 예외, infra ADR-035의 이미지 보관 절차를 확인했다.
이미 연결된 매일 자동 보관 정리는 그대로 실행되지만, 임의 이미지 삭제 전체가 상시 위임된 것은 아니다.
정책에는 이번 수동 즉시 정리를 일반 삭제 경계에서 제외하는 명시 조항이 없고, 이전 FEST 승인은 다른 네 digest로 제한됐다.
이번 승인으로 위 정확한 네 개의 수동 정리를 수행했다. 향후 모든 이미지 삭제에 대한 포괄 승인으로 확대하지 않는다.

실행 직전 전체 여섯 digest와 보호 표식 두 개를 승인 목록과 대조했다. `platform registry plan`은 정책 차이 없음이었다.
기존 project-scoped `lifecycle-execute`의 새 비삭제 시험 **3577**, 실제 정리 **3578**이 모두 성공했다.
종료 후 **artifact 2개·보호본 2개·후보 0개**, 사용량 **403,833,432 / 1,073,741,824 bytes**를 확인했다.
현재/복구 digest는 위 표와 같았다. 축제 자료·예측 기록·PVC·quota·권한·다른 프로젝트는 변경하지 않았다.
이는 artifact 정리와 프로젝트 quota 확보의 증거이며 물리 orphan blob의 GC 완료 증거로 표현하지 않는다.

## 후속 배포 완료

동일 CI 34302743602 attempt 2가 원격 검증·표식 승격까지 성공했다. 새 현재 이미지는
`sha256:9d83122cfaa7924c699701fecfbe7c04a70fe7ae01a12d0744efe8f279ac160a`,
복구용 표식은 직전 운영 이미지 `sha256:6b5f271087a7080f3b444beb666b279a5e6d10f325397cf8aabcb037b598381d`로 이동했다.
배포 커밋 `867e1036ad9427109b481c931ae37bb0d0d3610f`를 sync하고 실제 web·forecast-worker 이미지와 generation 16의 정상 가동을 확인했다.
공개 headless 14개·PDF·11개 경로·기존 예측 보존 결과는 [M6 검증 기록](../validation/25-planning-outcomes.md)을 따른다.
