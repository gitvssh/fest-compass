---
class: 운영 런북
doc_class: how_to
doc_kind: runbook
authority: canonical
owner: fest-compass
last_verified: 2026-08-31
---

# 분석·검색 최종 연결 런북 (kto.damecasol.com)

앱 배포가 끝난 뒤 수행하는 **콘솔 연결 절차**다. 앱 구현은 완료됐고, 아래 항목은
Cloudflare·GA4·Search Console 콘솔에서 사람이 설정해야 한다. 작성 시점에는 어떤
콘솔 설정도 변경하지 않았다.

앱과 콘솔의 경계는 분명하다. **앱은 측정 ID도 목적 ID도 갖지 않는다.** 앱은
`window.zaraz.track(이벤트명, 속성)`만 호출하고, GA4 연결과 동의 목적 배정은 전적으로
Cloudflare 콘솔이 소유한다. 따라서 동의가 없으면 `window.zaraz`가 없고, 이벤트는
조용히 사라진다.

## 1. 배포 전제 확인 (완료됨, 2026-08-31 실측)

```bash
curl -I https://kto.damecasol.com/
curl -I https://kto.damecasol.com/privacy
curl -I https://kto.damecasol.com/robots.txt
curl -I https://kto.damecasol.com/sitemap.xml
```

네 경로 모두 `200`이고, `/` HTML의 canonical은 `https://kto.damecasol.com`,
`robots.txt`는 `https://kto.damecasol.com/sitemap.xml`을 가리킨다. 비정규 호스트는
`APP_MODE`가 `public-readonly`가 아닐 때 전체 disallow와 `noindex`를 반환한다.

## 2. Zaraz · 동의 관리 · GA4 연결 (사용자 작업)

1. Cloudflare Zaraz에서 GA4 도구를 추가하고 운영 GA4 Measurement ID를 연결한다.
   **측정 ID는 앱 저장소에 넣지 않는다.**
2. Zaraz Consent Management에서 분석 목적을 **기본 거부**로 두고 GA4 도구를 그 목적에
   명시적으로 할당한다. 동의 후에만 도구와 `zaraz.track`이 실행되도록 설정한다.
3. `zaraz.track`의 custom event name과 flat property가 GA4 event name·event
   parameter로 그대로 전달되도록 매핑한다.
4. 보안·전송을 위한 Cloudflare 필수 처리와 선택 분석은 별도 목적으로 유지한다.

## 3. 이벤트 사전 (앱이 강제하는 정본)

정본은 앱 코드 `apps/web/lib/analytics-events.ts`이고, `/privacy` 화면이 같은 표를
사용자에게 그대로 보여준다. 전송 경계(`apps/web/lib/analytics/events.ts`)가 이 표를
런타임에 강제하므로, 표에 없는 이벤트·속성·값은 전송되지 않는다.

| 이벤트 | 트리거 | 속성 | 허용 값 |
|---|---|---|---|
| `festival_list_view` | 축제 목록(홈) 열람 | `app_mode` | `public-readonly`, `editor` |
| `festival_workspace_view` | 근거·시나리오·결정·보고서 탭 열람 | `tab`, `app_mode` | `tab`: `evidence`, `scenarios`, `ledger`, `report` |
| `privacy_view` | 개인정보·분석 안내 열람 | `app_mode` | `public-readonly`, `editor` |

**금지 속성** (전송 직전에 제거된다): `festival_id`, `festival_name`, `author`,
`approver`, `actor`, `service_key`, `free_text`.

속성값은 전부 **고정 열거**다. 축제 식별자·이름, 자유 입력, URL, 이메일 형태,
줄바꿈, 32자 초과 문자열은 통과하지 못한다. 축제 단위 분석이 필요해지면 이 문서와
`analytics-events.ts`, 전송 경계, `/privacy` 표를 **같은 변경에서** 함께 고쳐야 한다.

## 4. GA4 key event 지정 (사용자 작업)

`festival_workspace_view`를 key event로 지정한다. 홈 목록 열람은 도달이고, 워크스페이스
탭 열람이 "근거를 실제로 살펴봤다"는 첫 유효 신호이기 때문이다.

탐색 제안:

- `festival_list_view` → `festival_workspace_view` 전환율 (도달 대비 열람)
- `festival_workspace_view`의 `tab` 분포 (근거에서 보고서까지 얼마나 내려가는가)
- `app_mode` 분리 — 공개 트래픽과 편집 세션을 절대 합산하지 않는다

## 5. Google Search Console (사용자 작업)

1. 속성을 `https://kto.damecasol.com`으로 등록한다(정규 canonical과 일치).
2. `https://kto.damecasol.com/sitemap.xml`을 제출한다.
3. URL Inspection으로 `/`와 축제 상세 1건의 색인 가능 여부를 확인한다.

## 6. 연결 완료 판정

아래가 전부 참일 때만 "분석 연결됨"으로 기록한다. 하나라도 미달이면
`준비됐지만 연결 필요` 상태다.

- [ ] 동의 **전**: 네트워크 탭에 GA4 요청이 없다
- [ ] 동의 **후**: 홈 → 축제 탭 이동에서 `festival_list_view`와
      `festival_workspace_view`가 GA4 DebugView에 보인다
- [ ] 동의 **철회 후**: 다시 GA4 요청이 발생하지 않는다
- [ ] GA4 이벤트에 금지 속성이 하나도 없다
- [ ] Search Console에 sitemap이 성공으로 처리됐다

## 현재 상태

- **앱 구현: 완료** (2026-08-31). 전송 계층, 타입·런타임 이중 경계, 사전 일치
  테스트, `/privacy` 공개 고지까지 배포됨.
- **콘솔 연결: 대기.** §2·§4·§5는 사용자가 Cloudflare/GA4/Search Console에서
  수행해야 한다. 그 전까지 이벤트는 전송되지 않는다(동의가 없으므로 정상 동작이다).
