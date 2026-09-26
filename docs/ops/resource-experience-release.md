---
class: Current
owner: pickDday
last_verified: 2026-09-27
version: v1
summary: "관광자원 화면 개선 배포의 이미지 저장소 용량 점검과 정확한 정리 후보입니다."
---

# 관광자원 화면 개선 배포

구현·로컬 검수는 완료했다. 구현 커밋 `6592de78cdc077bde46fde7cf3085a5506c5fae6`의
[이미지 작업](https://github.com/gitvssh/fest-compass/actions/runs/36250279743)은 검증과 빌드를 통과했지만
Harbor 업로드가 용량 한도로 거부됐다. 공개 서비스는 기존 이미지로 정상 운영 중이다.
그 뒤 실제 확대 검수에서 지도 중심 보존을 추가 보완한 `1dddaa0`의 빌드와 관광자원 회귀48개를 완료했다.
후속 이미지 작업은 이 보완을 포함한 최신 검증 main을 대상으로 실행해야 한다.

## 현재 확인

- `fest-compass` 사용량 988,858,258 / 1,073,741,824 bytes. 추가 87.5 MiB 업로드가 거부됐다.
- 저장소 `web` 하나, 이미지 5개, 보호 표식 2개, 정리 후보 3개다. 정책 차이 없음.
- 매일 03:30 KST 정리 정책17의 최근 실제 실행5079(2026-09-26 03:30 KST)는 성공했다.
  다음 예약은 2026-09-27 03:30 KST다. 용량은 일중 빌드 누적에 따른 것이며 예약 연결 장애가 아니다.
- 최근 전역 GC4714(2026-09-20 04:30 KST)도 성공했다. 이번에는 전역 GC를 실행하지 않았다.
- 기존 `platform registry lifecycle-dry-run --project fest-compass` 비삭제 시험5165 성공.
  정책·quota·권한을 변경하지 않았다.
- 클러스터 Deployment/StatefulSet/DaemonSet/CronJob에서 이 저장소를 참조하는 것은
  `fest-compass`의 migrate·web·forecast-worker·festival-source-worker뿐이며 모두 아래 운영 이미지를 참조한다.

## 보존할 두 이미지

| 역할 | digest |
|---|---|
| 현재 운영 이미지, Harbor `deploy-rollback` | `sha256:c27d06af10fdda83e2d0dd5d929bbe102e629d1da5d7a459973725d6febe39ed` |
| 이번 작업의 첫 검증 이미지, Harbor `deploy-current`, 운영 미적용 | `sha256:27f35aa82f76d914653c50d090882bd8bd7e5c82f7d43f383b0e8e6ca626f607` |

표식 이름과 실제 배포 상태를 구분한다. 공개 서비스에 적용할 최종 대비 보완은 `6592de7`이며 업로드가 아직 완료되지 않았다.

## 즉시 정리 제안 대상

아래 `fest-compass/web` 이미지 3개만 대상이다. 현재 운영 이미지·보호본·코드·업무자료·PVC는 대상이 아니다.

| 소스 커밋 | digest |
|---|---|
| `bf08b7cc59f71f47f5f99f2514f99e4d39d4aad4` | `sha256:e38b924a8bf778b6a03f23aa040558c1ff15547ef1737dcb34c378ff46261891` |
| `d38b84a328114b73cd6c588563d6b8efc894e2e4` | `sha256:33a0ea81425716341a8a8f3e4454f06476eb3e6a238be516633cf1b8aabaac4b` |
| `6c938b51473b00909b323720cf22185450d33888` | `sha256:8ce8dfa419e431c87df39f4f269c4737c35fa9e3fec46749c303bd5143b3383c` |

즉시 수동 삭제는 아직 실행하지 않았다. [이전 정리 승인](planning-outcomes-release.md)은 당시 네 digest로 한정됐고
향후 삭제 전체로 확대하지 않는다고 명시했다. 홈랩 공통 정책 §1·§1.3에 따라 위 세 이미지의 즉시 정리는 별도 결정이 필요하다.
승인되면 실행 직전 후보·보호본·소비자를 다시 대조하고 기존 project-scoped `lifecycle-execute`를 실행한다.
그 뒤 최종 지도 보완을 포함한 최신 검증 main의 이미지 작업을 실행하고 원격 검증된 digest만 배포·공개 검수한다.
자동 예약 정리를 기다리는 경우에는 삭제를 앞당기지 않고 예정된 정리 결과 확인 후 배포를 재개한다.
quota·권한·다른 프로젝트·전역 GC·자동 정리 일정은 바꾸지 않는다.
