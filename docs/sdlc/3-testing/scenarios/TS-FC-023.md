---
class: Current
owner: pickDday
last_verified: 2026-10-04
id: TS-FC-023
version: v1
status: active
summary: "방문 분석 동의 배너(기본 창 대체·선택 전달·다시 보기·소개 영상 안내와의 순서)의 인수 기준입니다."
usecase: null
covers_ac: ["CB1", "CB2", "CB3", "CB4", "CB5", "CB6", "CB7"]
apis: []
specs: []
---

# TS-FC-023 · 방문 분석 동의 배너

[설계26](../../../design/26-consent-banner.md)의 인수 기준이다. 실행 결과는 [검수48](../../../validation/48-consent-banner.md)에 기록한다.
자동 시험은 `lib/analytics/consent.test.ts`, `scripts/consent-banner-e2e.mjs`(Zaraz 대체 스크립트), `scripts/intro-video-e2e.mjs`다.

| 기준 | 확인할 결과 | 수단 |
|---|---|---|
| CB1 | 아직 고르지 않은 방문자: Zaraz가 기본 창을 여는 순간 창은 한 번도 보이지 않고 닫히며(`modal` 쓰기 `false` 1회), 화면 아래 한국어 배너가 뜬다. 초점 이동·덮개·흐림·첫 화면 밀림이 없고 뒤의 링크를 바로 누를 수 있다 | 단위·headless |
| CB2 | `거부`·`허용`을 누르면 배너가 먼저 닫히고 숨김 표식이 풀린 뒤 `setAll(허용 여부)` 1회. 허용 때만 대기 이벤트 전송 1회. 닫힌 기본 창에는 다시 쓰지 않는다. 넘기는 중 예외가 나도 배너가 남지 않는다 | 단위·headless |
| CB3 | 이미 고른 방문자: 배너가 뜨지 않고 6초 뒤 기본 창 숨김이 풀린다. 지켜보기를 멈추면 더 이상 창을 닫지 않는다 | 단위·headless |
| CB4 | 바닥글·개인정보 안내의 `분석 동의 다시 보기`가 같은 배너를 열고 초점을 배너로 옮긴다. Zaraz가 없는 주소에서는 `고를 것이 없습니다`와 `닫기`만 보인다 | 단위·headless |
| CB5 | 소개 영상 안내는 배너가 보이는 동안과 지켜보는 6초 동안 뜨지 않고, 배너가 닫힌 뒤 2초에 나타난다. 배너가 다시 열리면 비켜섰다가 돌아온다. Zaraz 없는 주소에서는 기존처럼 2초 뒤 나타난다 | headless |
| CB6 | 390×844·1440×900에서 배너가 화면 안에 들고 가로 넘침이 없으며 안내 카드와 겹치지 않는다. 키보드로 링크 → 거부 → 허용 순 이동과 Enter 선택. 배너가 열린 홈에서 배너 관련 axe 위반 0, 새 색 대비 4.5:1 이상 | headless·대비 계산 |
| CB7 | 앱 소스에 purpose ID 리터럴·목적 단위 `set`·동의 읽기·쿠키/저장소·`showConsentModal`이 없다. CSP와 분석 전송 경계 불변, 인라인 스크립트 없음, 브라우저 오류·CSP 위반 0. 개인정보 안내가 작은 배너와 다시 보기 경로를 설명한다 | 단위·headless |

실제 Cloudflare Zaraz와의 동작(기본 창 미표시·`zaraz-consent` 쿠키·새로고침 뒤 미표시)은 공개 반영 뒤 `scripts/consent-banner-live.mjs`로 확인하며 이 시험의 범위가 아니다(검수48에 미확인으로 남긴다).
