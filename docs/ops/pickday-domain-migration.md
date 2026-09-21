---
class: Current
owner: fest-compass
last_verified: 2026-09-21
version: v1
summary: "기관 약칭을 피하기 위해 공개 주소를 pickday로 전환하며 기존 저장소와 전용 실행 환경을 유지한다."
---

# 공개 주소 전환

2026-09-21 사용자가 `pickday.damecasol.com`으로 변경하고 기존
`gitvssh/fest-compass`에 배포하도록 지시했다. 이전 주소는 `kto.damecasol.com`이다.
ADR-0001의 공개 읽기 전용 경계와 ADR-0002의 배포 소유권은 유지하며 공개 호스트만 대체한다.

## 저장소와 데이터

전환 준비 시 `pick-d-day` main `6e8b5b5`의 `developer/shlee/fest-compass`와
운영 저장소 main `cd0e6d8`의 앱·배포 파일은 동일했다. README와 저장소 공통 파일만 달랐다.
배포는 기존 `homelab-fest-compass` 전용 ARC와 수동 `publish-image` workflow를 사용한다.
PAT 재발급이나 러너 등록 대상을 바꾸지 않는다. 운영 PVC와 자료를 보존한다.

## 전환 순서

1. 앱 검증 후 기존 저장소에서 이미지를 게시하고 원격 digest 검증을 확인한다.
2. 홈랩의 정확한 호스트 인증서·Gateway 리스너와 앱 HTTPRoute를 새 주소로 맞춘다.
3. 검증한 이미지 digest로 기존 Application을 수동 sync한다.
4. Cloudflare Tunnel·DNS와 호스트별 분석 배선을 전환한다.
5. 공개 HTTPS·canonical·robots·sitemap·읽기 전용 화면과 운영 데이터 보존을 확인한다.

이 문서의 절차는 배포 완료 증거가 아니다. 실제 실행 결과는 완료 시 아래에 기록한다.
