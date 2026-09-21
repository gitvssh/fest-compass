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

## 실행 결과 (2026-09-21)

`https://pickday.damecasol.com`에서 사용 가능하다. 구현 `cca7239`, 배포 `f9d905b`,
전용 ARC [실행 35554076890](https://github.com/gitvssh/fest-compass/actions/runs/35554076890)이 성공했다.
운영 web·worker는 검증한 `sha256:020efc8ce631eeff05c14ac6a73bf877cb878558c8ba5ae0224ae039e4fbbf9a`를 사용한다.

- 로컬 Node 24.20.0에서 단위 201건·격리 마이그레이션 1건, 빌드·타입 검사·배포 계약 40건 통과.
- Application과 Traefik은 Synced/Healthy/Succeeded, 앱 generation 24와 관측 세대가 일치한다.
- 새 호스트 인증서 Ready, HTTPRoute Accepted/ResolvedRefs, 원본 HTTPS readiness 정상.
- Cloudflare 공개 DNS와 Tunnel 등록·재조회 일치, 공개 경로 6개 HTTP 200.
- canonical·robots·sitemap은 새 주소만 사용한다.
- 기존 headless 실제 자료 시나리오 11개(지도·공주/임실 비교·비용·기획·390px) 통과,
  브라우저 오류 0·앱 서버 쓰기 0. 분석 동의 거부/허용 각각 false/true 전환 확인.
- Deployment/PVC UID 유지, 축제 DB 1건 유지, 예측 파일 124개 유지.
  배포 후 수정된 예측 파일은 worker 시작 상태인 `heartbeat.json`뿐이다.

공개 DNS `1.1.1.1`은 새 호스트를 정상 해석한다. 검증 호스트의 로컬 DNS는 NXDOMAIN을
캐시하고 있어 공개 Cloudflare IP `104.21.37.194`를 정확한 호스트에 지정하여 TLS 검증을
유지한 채 HTTP와 headless 검증을 수행했다. 지도 타일은 기존 테스트용 이미지로 대체했다.

구 호스트는 더 이상 앱에 연결되지 않으며 검증 시 HTTP 502다. 구 DNS/Tunnel 항목은
삭제하지 않았다. 브라우저 개인 초안은 주소별 저장이므로 자동 이전되지 않는다.
새 Search Console 주소 등록·실제 GA4 수신은 이번 검증에 포함하지 않았다.
