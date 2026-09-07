# 축제 이력 비교 화면 배포와 이미지 보관소 정리

확인일: 2026-09-07. 상태: **개발·검증 완료, 이미지 정리 승인 필요**.

새 기능 소스는 `6dce3c6cb29a9dab4f2cb5d27bb728bb0dd47200`으로 main에 게시했다.
[CI 34126770861](https://github.com/gitvssh/fest-compass/actions/runs/34126770861)은 전용
`homelab-fest-compass-k8d69-runner-sstk2`에서 테스트·타입 검사·일반 빌드·배포 계약을 통과했으나,
이미지 push에서 기존 사용량 977.0MiB + 새 layer 86.7MiB가 프로젝트 한도 1GiB를 넘어 실패했다.
원격 이미지 검증·표식 승격은 실행되지 않았다. 새 화면은 아직 운영에 반영되지 않았다.

Harbor 읽기 전용 감사에서 실제 사용량 1,024,459,632 bytes, 한도 1,073,741,824 bytes를 확인했다.
infra 정본에는 현재/직전 복구본을 남기는 매일 03:30 한국시각 정책이 선언돼 있지만,
실제 `fest-compass`의 retention ID는 null이었다. quota 증액보다 선언된 정리 정책의 연결이 우선이다.

## 검수할 정확한 범위

보존할 두 이미지:

| 역할 | source commit | image digest |
|---|---|---|
| 현재 운영·deploy-current | 2770229d93e298a1d0b19a3d56b913d8a9e2f52f | sha256:7ebad161407038aa8e074cc55a32555c3fc49d578d1084a7bc9713c22ee4e6fd |
| 직전 복구·deploy-rollback | 3eb86e1bb6c843f0fdec962c314cd7938a63f229 | sha256:32db6593000e16a2f7b4fce6817417be6d49d3279909130a211db74f10ba9c4d |

`fest-compass/web`의 아래 오래된 네 이미지가 정리 대상이다. Git 소스와 축제 데이터는 삭제 대상이 아니다.

| source commit | image digest |
|---|---|
| bda722f256bf482fc5b4d2fe5318035350cf6e08 | sha256:cd0297029f0b2b164c4ad068f12bed6ef3f344773096dbdc8143784f0487ba2b |
| ac29f9913a87f369496876eca9a3877b406f0f76 | sha256:616e0656897f29ed1ff0bfa315b3596814feb74aa9b225ffd684c4835dfc6109 |
| bd286391d840d546fe9aa52d5f03d1593fc4480f | sha256:086c02bc8cef999b9dd35a80848dd52e261d5c8abd98f77ffb3be8bbfe8ffd76 |
| 2611ad86acc2370fd50d2ea564a87385aae9dad4 | sha256:3ef211be2bee1ec1f6496dbe8af1a49a7efc193db8302052c9ef81d98d4a9ad0 |

2026-09-07T13:32:26Z 조회에서 repository는 `web` 하나, artifact는 위 6개였다.
현재 Kubernetes의 앱 controller 이미지와 두 보호 표식, Git 배포 이력을 대조했다.
보존하는 현재·직전 이미지 외에 새 후보나 소비자가 나타나면 이 목록을 재검토한다.

## 승인 후 에이전트가 수행할 절차

정본: infra `ansible/inventories/homelab/group_vars/all/04-platform-harbor-policy.yml`의 `fest-compass`.
공통 정책 §1의 삭제 승인 경계를 적용한다. 기존 1GiB quota·권한·다른 프로젝트·전역 GC는 변경하지 않는다.

1. live 이미지·보호 표식·전체 후보가 위 목록과 같은지 다시 확인한다.
2. 기존 자격을 비출력 stdin으로 전달해 infra `platform registry plan --env homelab --project fest-compass --password-stdin`을 실행한다.
   예상 변경은 선언된 retention 객체/스케줄뿐이다.
3. 같은 범위의 `apply --yes`, `lifecycle-dry-run --yes`로 정책을 연결하고, 두 보호 digest의 보존을 확인한다.
4. 같은 범위의 `lifecycle-execute --yes`로 fresh dry-run 후 정리한다. 정책·후보가 달라지면 중단한다.
   위 네 개 외 이미지 삭제나 새로운 권한·quota 변경으로 범위를 넓히지 않는다.
5. 실제 사용량과 보호 이미지 존재를 다시 확인하고 원래 소스 커밋의 실패 CI만 재실행한다.
   물리 blob 공간의 회수는 기존 GC 스케줄과 별도로 확인하며 retention만으로 GC 완료를 주장하지 않는다.
6. 원격 검증 digest를 앱 overlay에 고정한 뒤 게시·등록 앱 sync·공개 화면·기존 예측 보존을 확인한다.

현재는 읽기 전용 감사·후보 검수까지만 완료했다. 정리 실행이나 스케줄 활성화는 하지 않았다.
