---
class: Current
owner: pickDday
last_verified: 2026-09-27
version: v2
summary: "관광자원 화면 개선의 이미지 정리 확인과 배포·공개 검수 기록입니다."
---

# 관광자원 화면 개선 배포

**사용 가능.** 승인된 세 이미지가 예약 작업에서 이미 정리된 것을 확인한 뒤 최종 버전을 발행·배포했다.
공개 화면·모바일·실제200% 검수와 업무자료 보존 확인을 완료했다. [화면·검증 결과42](../validation/42-resource-experience.md)를 따른다.

이전 구현 `6592de78cdc077bde46fde7cf3085a5506c5fae6`의
[이미지 작업](https://github.com/gitvssh/fest-compass/actions/runs/36250279743)은 검증·빌드 후 용량 한도로 실패했다.
이후 지도 중심 보완 `1dddaa0`까지 포함한 최종 소스 `11c9513`으로 배포를 재개했다.

## 최초 업로드 실패 당시 용량 점검

- `fest-compass` 사용량 988,858,258 / 1,073,741,824 bytes. 추가 87.5 MiB 업로드가 거부됐다.
- 저장소 `web` 하나, 이미지 5개, 보호 표식 2개, 정리 후보 3개다. 정책 차이 없음.
- 매일 03:30 KST 정리 정책17의 최근 실제 실행5079(2026-09-26 03:30 KST)는 성공했다.
  다음 예약은 2026-09-27 03:30 KST다. 용량은 일중 빌드 누적에 따른 것이며 예약 연결 장애가 아니다.
- 최근 전역 GC4714(2026-09-20 04:30 KST)도 성공했다. 이번에는 전역 GC를 실행하지 않았다.
- 기존 `platform registry lifecycle-dry-run --project fest-compass` 비삭제 시험5165 성공.
  정책·quota·권한을 변경하지 않았다.
- 클러스터 Deployment/StatefulSet/DaemonSet/CronJob에서 이 저장소를 참조하는 것은
  `fest-compass`의 migrate·web·forecast-worker·festival-source-worker뿐이며 모두 아래 운영 이미지를 참조한다.

## 정리 대상에서 제외한 두 이미지

| 역할 | digest |
|---|---|
| 재개 전 운영 이미지, 당시 Harbor `deploy-rollback` | `sha256:c27d06af10fdda83e2d0dd5d929bbe102e629d1da5d7a459973725d6febe39ed` |
| 첫 검증 이미지, 당시 Harbor `deploy-current`, 운영 미적용 | `sha256:27f35aa82f76d914653c50d090882bd8bd7e5c82f7d43f383b0e8e6ca626f607` |

표식 이름과 실제 배포 상태를 구분한다. 당시 실패한 대비 보완은 `6592de7`이며, 최종 배포 대상은
지도 중심 보완 `1dddaa0`을 포함한 `11c9513875dc7a8044d23d8df630a143182f7a32`다.

## 승인된 정리 대상과 실제 확인

아래 `fest-compass/web` 이미지 3개만 대상이다. 현재 운영 이미지·보호본·코드·업무자료·PVC는 대상이 아니다.

| 소스 커밋 | digest |
|---|---|
| `bf08b7cc59f71f47f5f99f2514f99e4d39d4aad4` | `sha256:e38b924a8bf778b6a03f23aa040558c1ff15547ef1737dcb34c378ff46261891` |
| `d38b84a328114b73cd6c588563d6b8efc894e2e4` | `sha256:33a0ea81425716341a8a8f3e4454f06476eb3e6a238be516633cf1b8aabaac4b` |
| `6c938b51473b00909b323720cf22185450d33888` | `sha256:8ce8dfa419e431c87df39f4f269c4737c35fa9e3fec46749c303bd5143b3383c` |

2026-09-27 사용자가 위 세 이미지 정리와 배포 재개를 승인했다. 실행 전 재조회에서 예정된 자동 정리
**5177**(2026-09-27 03:30 KST, Schedule, Success)이 이미 완료된 것을 확인했다.
승인 대상 세 digest는 없고 위 보호 이미지 두 개만 남아 있었다. `web` 외 저장소와 추가 소비자는 없으며
실제 운영의 네 컨테이너 선언은 `c27d06af…`를 사용하고 있었다. 이미 목표 상태이므로 수동 삭제를 반복하지 않았다.

사용량은 **419,406,028 / 1,073,741,824 bytes**로 줄었다. 이는 프로젝트 quota 사용량 확인이며
이번 세 이미지의 물리 blob GC 완료를 주장하지 않는다. quota·권한·다른 프로젝트·전역 GC·자동 정리 일정은 변경하지 않았다.

## 중단된 발행의 보호 표식 복구

새 발행 전에 실제 운영 `c27d06af…`와 생성만 완료한 `27f35aa8…`의 보호 표식 순서가 뒤바뀌어 있었다.
기존 발행 gate는 manifest의 운영 digest와 `deploy-current`가 다르면 멈추므로 우회하지 않고 실제 운영에 맞춰 복구했다.
두 manifest의 해시와 현재 Deployment의 네 이미지 선언을 확인한 뒤 기존 `HarborRelease.promote`·읽기 검증을 사용했다.
현재 표식을 `c27d06af…`, 보조 표식을 `27f35aa8…`로 바꿨으며 이미지 삭제0이다.
관리 자격은 stdin·메모리로만 전달했고 복구 출력에는 digest와 결과만 남겼다. 이후 정상 발행에서 기존 운영 이미지를 복구본으로 보존했다.

## 최종 발행·배포 결과

- 이미지 소스: `11c9513875dc7a8044d23d8df630a143182f7a32`. [ARC 작업36287323772](https://github.com/gitvssh/fest-compass/actions/runs/36287323772) 성공.
- 전용 `homelab-fest-compass` runner의 검증·빌드·발행 통과. Actions artifact/cache0.
- 운영·`deploy-current`: `sha256:3eb378420ccc6baba04857156cbf0a065c131f539aae89777b3df93980cba40b`.
- 복구본·`deploy-rollback`: `sha256:c27d06af10fdda83e2d0dd5d929bbe102e629d1da5d7a459973725d6febe39ed`.
- 배포 선언 `dadf3a7d6a6b4f35545cca64dca0f6cee13dedf1`에서 이미지와 관측 annotation을 함께 고정했다. release 검증17개 통과.
- 등록 앱 `fest-compass-prod`의 정상 sync 후 Synced·Healthy, 컨테이너3/3 준비 완료. livez·readyz200.
- Deployment·PVC 식별자와 업무9개 테이블20행의 건수·해시가 전후 일치한다.
- 발행 후 사용량594,856,893 /1,073,741,824 bytes, 이미지3개. 중간 검증 이미지는 기존 예약 정리 정책을 따른다.

공개 실제 응답과 검증 범위는 [실행 근거](../validation/evidence/2026-09-27-resource-experience.json)에 남겼다.
원천 수집·예측 코드·자료 스키마·quota·권한·정리 일정은 변경하지 않았다.
