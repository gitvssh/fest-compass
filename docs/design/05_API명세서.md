# 05. API 명세서

> FEST Compass MVP · 2026-08-30
> §1 외부(KTO) 데이터 계약 — 2026-08-30 6건 활용신청 승인 후 실호출 결과를 반영했다.
> §2 내부 서버 액션 명세 (결정 D3: REST 계층 없음)
> 부록 A 지역코드 매핑 · 부록 B 활용신청 체크리스트 · 부록 C 실호출 확정 현황

## 0. 공통 사항 (외부 API)

- 게이트웨이: `https://apis.data.go.kr/B551011/{서비스}/{오퍼레이션}`
- 공통 파라미터: `serviceKey`(data.go.kr 일반 인증키), `MobileOS=ETC`, `MobileApp=FESTCompass`, `_type=json`, `numOfRows`, `pageNo`
- 정상 응답은 JSON `response.{header,body}`와 JSON 최상위 `{header,body}` 두 봉투를 모두 허용한다. 일부 서비스는 `_type=json`에도 XML을 반환할 수 있어 같은 `resultCode/body/items/item` 계약으로 정규화한다. `items.item`은 단일 객체·배열·빈 문자열을 구분한다. body 없는 최상위 `resultCode` 봉투는 오류 응답에만 허용한다. 성공 응답은 `totalCount`가 필수이며, 양수 건수인데 유효 객체 item이 없거나 0건인데 item이 있으면 계약 오류로 닫는다.
- **게이트웨이 오류 봉투**(HTTP 400/403, JSON): `OpenAPI_ServiceResponse.cmmMsgHeader.returnReasonCode`
  - code **30** `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` = 키 미등록 **또는 해당 API 활용신청 미완료**. 2026-08-30 6건 승인 후 필수 서비스에서 해소됨.
  - `NO_OPENAPI_SERVICE_ERROR` = 존재하지 않는 서비스/오퍼레이션 경로
  - code 22 = 일일 트래픽 초과(승인된 실제 한도는 포털에서 별도 확인, 부록 C)
- 클라이언트 계약(lib/kto/client.ts): 모든 호출은 `KtoResult{ok, kind: success|empty|error, status, data, summary, fetchedAt, urlMasked, totalCount}`로 정규화하고 전건 `ApiCallLog`에 기록한다. HTTP 200이어도 게이트웨이 오류·`resultCode!=0000`·봉투 파싱 실패는 error다. `resultCode=0000,totalCount=0`은 **인가된 empty**다.
- serviceKey는 URL·DB 로그에서 `***` 마스킹하고, 오류·진단 문구에서 원문·percent-encoded·URLSearchParams-encoded 형태를 모두 제거한다. 검증 스크립트는 원문 샘플을 출력하지 않는다.
- 호출 실패 시 **이전 성공 스냅샷을 stale 표시로 유지**한다. 최신값처럼 보이게 하지 않는다(기획서 §6.4).

## 1. 외부 KTO 데이터 계약

각 계약의 "허용/금지 해석"은 기획서 §6.2가 정본이며, 스냅샷의 interpretation/prohibition 필드에 저장되어 화면·보고서에 노출된다.

### API-EXT-A. 국문 관광정보 — 축제 검색·상세 [구현됨]

- data.go.kr **15101578** · 서비스 `KorService2` · 지역코드 체계: **KorService2 자체 코드**(부록 A 좌측)
- 역할: 축제 메타데이터 사전채움, 동기간·동지역 겹침 행사 탐지 / 금지: 입장객·예산·만족도 해석

| 오퍼레이션 | 용도 | 주요 파라미터 | 사용하는 응답 필드 |
|---|---|---|---|
| `searchKeyword2` | 등록 시 키워드 검색 | keyword, contentTypeId=15(축제) | contentid, title, addr1, eventstartdate/enddate, mapx/mapy, areacode, sigungucode, tel |
| `searchFestival2` | 기간·지역 겹침 탐지 | eventStartDate, eventEndDate(YYYYMMDD), areaCode | 동일 |
| `detailCommon2` | 식별·공통 상세 보강 | contentId | contentid, title, overview, addr1, mapx/mapy, areacode, sigungucode, lDongRegnCd/lDongSignguCd |
| `detailIntro2` | 축제 일정 재구성 | contentId, contentTypeId=15 | eventstartdate, eventenddate |

- 겹침 스냅샷 규칙: 결과에서 자기 자신(contentId 동일)을 제외한 상위 5건. apiName="searchFestival2".
- 자동 등록과 상세 새로고침은 `detailCommon2`와 `detailIntro2`가 모두 성공하고 contentId·이름·유효한 시작/종료일이 결합될 때만 성공한다. 한쪽이 empty/error이거나 일정이 잘못되면 부분 상세를 폐기한다. 상세 스냅샷 apiName은 기존 호환을 위해 "detailCommon2"로 유지하되 rawSummary에 결합 검증 결과를 남긴다.
- 2026-08-30 실응답에서 `lDongRegnCd`(2자리)와 `lDongSignguCd`(3자리 시군구 접미사)를 확인했다. 내부 저장·E/F 호출 전 `lDongRegnCd + lDongSignguCd`를 5자리 행정 시군구코드로 정규화한다(예: `52` + `750` → `52750`). 이미 5자리로 오는 응답도 접두 일치 시 허용한다. 숫자 형식·접두 일치가 검증된 경우에만 쓰며 KorService2 `sigungucode`로 대체하지 않는다.

### API-EXT-B. 광역 지역별 방문자 수 [계약 교정, 조회기간 변경 D4]

- data.go.kr **15101972** · 서비스 `DataLabService` · MVP 오퍼레이션 `metcoRegnVisitrDDList`(광역지자체)
- 공식 Swagger상 요청 파라미터는 `startYmd`, `endYmd`(YYYYMMDD)이며 **areaCd가 없다**. 전국 광역 행을 페이징한 뒤 응답 `areaCode`를 부록 A의 현행·구 코드 후보로 로컬 필터한다. areaCd를 보내 시도 코드를 판별하는 기존 검증은 무효다.
- 사용 필드: `baseYmd`, `areaCode`, `areaNm`, `daywkDivCd/Nm`, `touDivCd/Nm`, `touNum`. `signguCode/Nm`은 보존하되 광역 배경선을 시군구 수치로 표시하지 않는다.
- `locgoRegnVisitrDDList`는 검증된 5자리 법정동 시군구 매핑과 지역별 필터/페이징 계약을 추가할 때까지 예비로 둔다(D5).
- 허용: 평시 대비 지역 유입 변화의 배경선 / 금지: 축제 입장객·관광객 수 해석, 광역·기초 합산
- 스냅샷 apiName="metcoRegnVisitrDDList", aggregation="광역지자체 일별 지역방문자. 축제 입장객 아님"
- 2026-08-30 실응답 153행에서 현행 특별자치도 코드 `51`(강원특별자치도), `52`(전북특별자치도)를 확인했다. 구 코드 `42`/`45`는 이 표본에 없었으나 과거 데이터 호환을 위해 로컬 필터 후보로 유지한다.

### API-EXT-C. 지역별 관광 수요 강도 [변경 — 2026-08-30 엔드포인트 교정]

- data.go.kr **15151868** · 서비스 **`AreaTarDemDsService`** · 오퍼레이션 **`areaTarExpDsList`**
  (구현 이력 주의: 이전 코드의 `DataLabService/areaTarSjrnDsList`는 실존하지 않는 경로였음 — 재도입 금지)
- 파라미터: `areaCd`(행정표준 시도), `signguCd`(선택 — D5에 따라 당분간 미사용), `baseYm`(YYYYMM)
- 공식 Swagger 필드: `baseYm`, `areaCd/Nm`, `signguCd/Nm`, `tarExpDsIxCd/Nm/Val`, `tarSjrnDsIxCd/Nm/Val`. 파서는 전체 지표 배열을 보존하고, `tarExpDsIxCd=22`(전체)가 있을 때만 UI 호환 `score`로 노출한다.
- 2026-08-30 `baseYm=202604, 202512, 202506, 202412, 202406, 202312, 202306`과 `areaCd=44` 조합 모두 HTTP 200, `resultCode=0000`, `totalCount=0`으로 **인가·경로·파라미터 정상 + 탐색 월 데이터 없음**을 확인했다. 실 item 필드값은 아직 미확정이며 그 전까지 공식 Swagger 필드만 파싱한다.
- 허용: D-90 시기·주제 비교 참고(월별 체류·소비 잠재력) / 금지: 개별 축제 참석자·실시간 수요·인과효과
- 스냅샷 apiName="areaTarExpDsList"

### API-EXT-D. 지역별 관광 자원 수요 [P2 — 계약만 정의]

- data.go.kr **15152138** · 서비스 `AreaTarResDemService` · 오퍼레이션 `areaTarSvcDemList`
- 파라미터: `areaCd`, `signguCd`(선택), `baseYm`. 공식 Swagger 필드: `tarSvcDemIxCd/Nm/Val`, `culResDemIxCd/Nm/Val` 및 지역·기준월 필드.
- 2026-08-30 `baseYm=202604, 202512, 202506, 202412, 202406, 202312, 202306`과 `areaCd=44` 조합 모두 HTTP 200, `resultCode=0000`, `totalCount=0`(인가된 정상 empty). 실 item 필드값은 아직 미확정이다.
- 허용: 프로그램·지역 적합성 참고(SNS·소비·내비 기반) / 금지: 프로그램 인과효과
- 구현 우선순위 P2 — C(수요 강도)가 시기 축, D(자원 수요)는 주제 축. 발표 §3 시그니처 사용례 4행("시기·주제 적합성")을 완성하려면 필요.

### API-EXT-E. 관광지 집중률 [구현됨]

- data.go.kr **15128555** · 서비스 `TatsCnctrRateService` · 오퍼레이션 `tatsCnctrRatedList`
- 파라미터: `areaCd`(필수), `signguCd`(필수), `tAtsNm`(선택). area/signgu는 KTO가 제공한 관광지 시군구/법정동 코드 쌍을 쓴다. KorService2 `sigungucode`는 사용 금지.
- 사용하는 응답 필드: `tAtsNm`(관광지명), `baseYmd`, `cnctrRate`(상대 집중률, 피크=100)
- 허용: 동일 관광지의 날짜별 상대 피크 보조신호 / 금지: 행사장 실인원, 서로 다른 장소의 절대 혼잡 비교
- 빈 결과가 정상인 API다(지원 관광지 목록이 제한적) — status=empty를 오류로 취급하지 않는다.
- 2026-08-30 `areaCd=44, signguCd=44230` 실호출은 HTTP 200, `resultCode=0000`, `totalCount=1470`으로 성공했다. 실응답 필드는 `baseYmd,areaCd,areaNm,signguCd,signguNm,tAtsNm,cnctrRate`로 확정했다.
- 앱은 1,000행 단위로 최대 20페이지를 `totalCount`까지 완주한 경우에만 스냅샷을 저장한다. 페이지 실패·동일 페이지 반복·totalCount 변동·상한 도달 시 앞서 받은 부분 데이터는 폐기하고 error로 기록한다.

### API-EXT-F. 관광지별 연관 관광지 [D9 데이터 계층 구현]

- data.go.kr **15128560** · 서비스 `TarRlteTarService1` · 오퍼레이션 `areaBasedList1` (경로 실존 검증됨)
- 파라미터: `baseYm`, `areaCd`, `signguCd`(공식 Swagger상 필수). 검증된 `lDongRegnCd/lDongSignguCd` 쌍이 없으면 DataQuality를 기록하고 호출하지 않는다.
- 역할(개선안 §3): 인근 관광지의 연관 이동 패턴 → 분산 유도 동선 설계의 보조신호
- 금지: 행사장 유입 경로 단정, 인과 해석
- 2026-08-30 `baseYm=202604, areaCd=44, signguCd=44230`으로 HTTP 200, 3건을 확인했다. 실응답 필드: `baseYm,tAtsCd,tAtsNm,areaCd,areaNm,signguCd,signguNm,rlteTatsCd,rlteTatsNm,rlteRegnCd,rlteRegnNm,rlteSignguCd,rlteSignguNm,rlteCtgryLclsNm,rlteCtgryMclsNm,rlteCtgrySclsNm,rlteRank`.
- 같은 호출에서 `signguCd`를 생략하면 HTTP 200 안의 최상위 `resultCode=11`로 거부됨을 확인했다. 따라서 `signguCd`는 실계약에서도 필수다.
- E와 동일한 완주형 페이지네이션을 적용하고, 전체 수집 후 숫자 `rlteRank` 오름차순으로 정렬한다. 화면은 그 결과의 상위 3건만 표시한다.
- 스냅샷 apiName="tarRlteTarAreaBasedList1" · SCR-02 "시기·분산 보조신호" 카드에 상위 3건 표시

### 1.4 조회 기간 정의 [변경 D4]

FR-EVD-1 새로고침 시 각 API의 조회 창. `오늘`은 서버 기준일.

| API | 창 | 정의 |
|---|---|---|
| B 광역 방문자 | 평시 기준선 | 시작일−28일 ~ 시작일−22일 (7일) — 구간 라벨 "평시" |
| B 광역 방문자 | 전년 동기간 | (시작일−1년)−3일 ~ (종료일−1년)+3일 — 구간 라벨 "전년 동기간" |
| B 광역 방문자 | 당해 기간 | 시작일 ~ 종료일. **종료일 < 오늘일 때만** 호출 — 구간 라벨 "당해" |
| C 수요 강도 | 전년 동월 | baseYm = 시작월 − 1년 |
| D 자원 수요 | 전년 동월 | 동일 |
| E 집중률 | 예측 데이터 | 파라미터 창 없음(향후 예측 제공) — 그대로 호출 |
| F 연관 관광지 | 전년 동월 | baseYm = 시작월 − 1년 |
| A 겹침 | 당해 축제 기간 | eventStartDate=시작일, eventEndDate=종료일 |

- 각 구간은 **별도 스냅샷 1건**으로 저장하고 valueJson은 `{ "window": "평시"|"전년 동기간"|"당해", "items": [...] }`다
  (혼합 저장 금지 — 화면 표의 `구간` 열이 여기서 나온다, 03 §SCR-02).
- 데이터랩 데이터는 지연 공개되므로 전년 동기간도 empty일 수 있다. empty는 정상 상태로 표기한다.

---

## 2. 내부 서버 액션 명세 (lib/actions.ts)

공통: FormData 입력 · 검증 실패 시 typed FormActionState로 필드 오류와 제출값 반환(입력 유지) · 성공 시 관련 경로 revalidate.
빈 문자열은 null로 정규화(`emptyToNull`). 모든 수치 파싱은 `parseOptionalNumber`(실패 시 null, 0 치환 금지).

| ID | 액션 | 입력(필수*) | 검증 | 부수효과 | 이동 |
|---|---|---|---|---|---|
| ACT-01 | `createFestivalAction` | name*, organization, place, program, startDate, endDate, areaCode, sigunguCode, ldongRegnCd, ldongSignguCd, mapX/Y, author | name 공백·날짜 형식/순서 거부 | Festival 생성(L0, provenance=manual, contentId=null) + 기본 골격 + FR-EVD-1. 클라이언트의 contentId/provenance는 무시 | SCR-02 |
| ACT-02 | `createFromKtoAction` | contentId* | detailCommon2+detailIntro2의 contentId·이름·유효 일정 결합 실패 시 거부 | 서버가 KTO 상세를 다시 조회해 모든 필드를 재구성하고 provenance=kto로 생성 | SCR-02 |
| ACT-03 | `updateAssumptionsAction` | festivalId*, inflowMin/Base/Max, dwellHours, operatingHours, peakRatio, rationale, author | FR-EVD-4 | [변경 D7] 가정 4행을 동일 신규 version으로 append → 시나리오 재계산(FR-SCN-2) | 잔류 |
| ACT-04 | `updateCapacityAction` | festivalId*, zone, approvedCapacity, dwellHours, documentRef, approver | capacity>0 또는 null, 0<dwellHours≤24 또는 null | CapacityRule 교체 → 기준문서·승인자가 모두 있을 때만 안전 계산 | 잔류 |
| ACT-05 | `decideScenarioAction` | festivalId*, scenarioId*, reason*, approver* | reason·approver 공백 거부 | Decision append(changeSummary는 FR-SCN-4 형식, decidedAt=now) | 잔류 |
| ACT-05a | `updateScenarioResourcesAction` [신규] | festivalId*, scenarioId*, shuttles, staffParking, sessions, zone, routeNote | 수치 ≥ 0 | Scenario 자원·구역 갱신 → 재계산 | 잔류 |
| ACT-06 | `addFieldAction` | festivalId*, occurredAt*, action*, triggerId 또는 trigger, actor | [신규] occurredAt 형식 "YYYY-MM-DD HH:mm", action 공백 거부 | FieldAction 생성(+트리거 연결) | 잔류 |
| ACT-07 | `addOutcomeAction` | festivalId*, metric*, plannedValue, actualValue, unit, source, measureMethod, granularity, bucketLabel | metric 공백 거부, granularity ∈ {total,hourly,zone}, hourly/zone은 bucketLabel 필수 | Outcome 생성(kind=measured, confirmed=true) + **라벨 전이 FR-LBL** | 잔류 |
| ACT-08 | `refreshEvidenceAction` | festivalId* | — | FR-EVD-1 실행 | 잔류 + /logs revalidate |
| ACT-09 | `addTriggerAction` [신규] | festivalId*, condition*, plannedAction*, owner* | 3필드 공백 거부 | OperationTrigger 생성 | 잔류 |
| ACT-10 | `cloneFestivalAction` | festivalId* | — | FR-CLONE-1 규칙으로 새 Festival + FR-EVD-1 자동 실행 | 새 축제 SCR-02 |

부수 명세:
- `runKtoSearch`/`searchKtoAction`: SCR-01 검색은 GET 쿼리(`?q=`)로 서버 컴포넌트에서 직접 `searchKeyword2`를 호출한다. 별도 액션 불필요(searchKtoAction은 리다이렉트 보조).
- 인증 없음(D8) — festivalId 위·변조 방어는 MVP 범위 밖. 파일럿 전 단계에서 문서화만 한다.

---

## 부록 A. 지역코드 매핑 (lib/kto/areacode.ts)

| 시도 | KorService2 areaCode (A) | 행정/법정 시도코드 (B 응답 필터·C·E·F) | 구 코드(승격 전) |
|---|---|---|---|
| 서울 1 · 인천 2 · 대전 3 · 대구 4 · 광주 5 · 부산 6 · 울산 7 · 세종 8 | 좌기 | 11 · 28 · 30 · 27 · 29 · 26 · 31 · 36 | — |
| 경기 31 · 강원 32 · 충북 33 · 충남 34 | 좌기 | 41 · **51** · 43 · 44 | 강원 42 |
| 경북 35 · 경남 36 · 전북 37 · 전남 38 · 제주 39 | 좌기 | 47 · 48 · **52** · 46 · 50 | 전북 45 |

- B 방문자 API는 areaCd를 요청으로 받지 않는다. 응답 `areaCode`를 로컬 필터할 때 특별자치도 현행·구 코드를 동일 시도 후보로 인정한다. 신/구 코드를 요청값으로 비교하는 실험은 하지 않는다.
- C 수요 강도는 시도 단위 `areaCd`를 사용한다. E 집중률·F 연관 관광지는 2자리 areaCd와 5자리 signguCd 쌍이 필수다.
- KorService2 `sigungucode` ≠ 법정동 5자리. B/C는 언제나 `areacode`를 정본 매핑으로 변환한 현행 행정 시도코드를 사용한다. E/F는 provenance=`kto`인 축제에서 **이번 새로고침의** `detailCommon2+detailIntro2`가 등록 contentId와 일치하고, 그 응답의 `lDongRegnCd/lDongSignguCd`가 형식·접두·시도 일치 검증을 통과한 경우에만 호출한다. 저장값·수기값만으로는 호출하지 않으며 실패 시 DataQuality를 기록한다(D5).

## 부록 B. data.go.kr 활용신청 체크리스트 [2026-08-30 완료]

같은 일반 인증키(현재 `.env`에 설정됨, 유효성은 타 API로 검증 완료)로 아래 6건 활용신청·승인 완료:

1. https://www.data.go.kr/data/15101578/openapi.do — 국문 관광정보
2. https://www.data.go.kr/data/15101972/openapi.do — 지역별 방문자 수
3. https://www.data.go.kr/data/15151868/openapi.do — 지역별 관광 수요 강도
4. https://www.data.go.kr/data/15152138/openapi.do — 지역별 관광 자원 수요
5. https://www.data.go.kr/data/15128555/openapi.do — 관광지 집중률
6. https://www.data.go.kr/data/15128560/openapi.do — 관광지별 연관 관광지

6건 승인 후 강화된 `node scripts/verify-kto-live.mjs` 실호출 검증을 최종 재실행해 exit 0을 확인했다. 스크립트는 키·URL·원문 샘플을 출력하지 않고, body 없는 성공·건수/item 모순·상세 일정 결합 실패를 non-zero로 닫는다. `detailCommon2`와 `detailIntro2(contentTypeId=15)`는 동일 contentId의 단일 item과 유효 일정으로 결합됐다. C/D는 제한된 과거월 탐색도 모두 정상 empty여서 실 item 샘플만 미확정으로 남긴다.

## 부록 C. 실호출 확정 현황 (P0)

| # | 항목 | 2026-08-30 상태 |
|---|---|---|
| 1 | 방문자 시도코드 | **확정**: 요청에 areaCd 없음. `metcoRegnVisitrDDList` 153행에서 현행 `51`·`52` 확인. 전국 행을 현행·구 코드 후보로 로컬 필터. |
| 2 | areaTarExpDsList | **인가·empty 확정**: 7개 탐색 월 모두 정상 empty. 공식 Swagger 필드로 파서 교정; 실 item 샘플만 미확정. |
| 3 | areaTarSvcDemList | **인가·empty 확정**: 7개 탐색 월 모두 정상 empty. P2 파서/화면은 실 item 검증 후. |
| 4 | tatsCnctrRatedList | **확정**: `44/44230` 호출 성공, 1,470건·7필드 확인. |
| 5 | TarRlteTar areaBasedList1 | **확정**: `44/44230`에서 총 771건·17필드 확인 및 완전 페이징. signguCd 생략 시 최상위 `resultCode=11`로 거부되어 필수임을 확인. |
| 6 | KorService2 법정동 코드 | **확정**: 시도 2자리 + 시군구 3자리 접미사. 내부에서 5자리로 정규화하고 접두 일치 검증 후 E/F에만 사용. |
| 7 | 일일 트래픽 한도 | **미확정**. 검증 스크립트는 한도를 실측하지 않으며, 앱 새로고침은 광역 페이징·D4 창 수에 따라 변동. 포털 승인 한도 별도 확인. |
| 8 | 데이터 공개 지연 폭 | **미확정**. C/D의 7개 탐색 월이 모두 인가된 empty이므로 지연 폭이나 데이터 부재 원인을 추정하지 않음. |
| 9 | KorService2 상세 일정 결합 | **확정**: `detailCommon2` 공통정보와 `detailIntro2(contentTypeId=15)`가 같은 contentId의 단일 item으로 응답했고 `eventstartdate/enddate` 유효성을 확인. 앱은 어느 한쪽이라도 실패하면 부분 상세를 폐기. |
