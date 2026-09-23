# hkjin plan-03 DataLab 원본 가져오기 — 출처와 목록

이 디렉터리는 pick-d-day 저장소의 `developer/hkjin/plan-03-datalab` 산출물 중 한국관광 데이터랩 CSV와
관련 문서를 **바이트 그대로** 보관한다. `original/` 아래 파일은 고치지 않는다. 링크 설명, 해시, 분류는
이 README와 [`manifest.json`](./manifest.json)에만 둔다.

## 원본

| 항목 | 값 |
|---|---|
| 저장소 | https://github.com/travel-resolver/pick-d-day (fest-compass 저장소가 아님) |
| 커밋 | `f362e65ba9e1cac18757951236484cff666c2696` |
| 원본 경로 | `developer/hkjin/plan-03-datalab/` |
| 보관 위치 | `original/` — 원본 경로 기준 상대 경로 유지 (`original/data/…`, `original/01-retraction.md`, `original/02-results.md`) |
| 공식 제공처 | 한국관광 데이터랩 축제 데이터 https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do |
| 지표 정의 확인일 | 2026-09-23 (공식 화면 기준, 이 가져오기 작업에서 새로 수집하거나 스크래핑하지 않음) |

원본 파일 링크는 `https://github.com/travel-resolver/pick-d-day/blob/<커밋>/developer/hkjin/plan-03-datalab/<경로>`
형식이며 경로 조각마다 퍼센트 인코딩한다. 파일별 URL은 `manifest.json`의 `url`에 있다.

## 포함 파일

- CSV 304개 — 모두 UTF-8(BOM), LF 줄바꿈, 파일 종류별 헤더 1종
  - 축제 폴더 26개 × 4종 = 104 (`목적지 검색순위`, `문화관광축제 주요 지표`, `성-연령별 내국인 방문자`, `연도별 방문자 추이`)
  - `data/region/` 26개 × 4종 = 104 (시군구 관광소비)
  - `data/region_visitor/` 24개 × 4종 = 96 (시군구 연간 방문자)
- 문서 5개 — `data/README.md`, `data/CHECKLIST.md`, `data/COLLECT-REGION.md`, `01-retraction.md`, `02-results.md`
- 원본 `data/PROMPT-desktop.txt`는 데이터가 아니어서 가져오지 않았다.

`manifest.json`은 파일마다 경로, 바이트 수, SHA-256, 원본 커밋의 Git blob ID, 인코딩, 줄바꿈, 헤더, 데이터 행 수,
원본 URL, 사용 구분(`consumed` / `preserved-only`)을 기록한다. 생성 시 각 파일의 Git blob ID가 원본 커밋 트리와
일치하는지 확인했다.

## 앱에서 쓰는 범위

앱은 `연도별 방문자 추이` 26개 파일(147행)만 쓴다(`use: consumed`). 나머지 278개 CSV와 문서는 출처 보관용이다.

- 값의 뜻: 축제가 열린 행정동에서 통신 데이터로 추정한 방문자 수의 **개최기간 합계**와 **일평균**. 개최기간이
  짧으면 합계가 줄 수 있다. 행사장 입장객, 연간 방문객, 시군구 일별 방문 이력(`Edition.visits`)과 다르다.
- 개최연도는 2018·2019·2022~2025. 2020·2021 행은 없다. 축제마다 빠진 연도가 있으며 0으로 채우지 않는다.
- 시작일·종료일 열은 없고 개최일수(`축체기간(일)`, 원문 오타 유지)만 있다.
- `전년도 …`, `증감률`, `(이전)전체방문자` 등 파생 열은 실제 전년이 아니라 직전 자료 연도와 비교한 값일 수 있고,
  첫 행은 빈 값·`N/A`·0이 섞여 있다. 원문 문자열로만 보관하고 비교 계산에 쓰지 않는다.
- `(외국인)방문자수` 0은 49행이다. 원문 0을 유지하되 실제로 없었는지 비공개 처리인지는 확인되지 않았다.
- `문화관광축제 주요 지표`에는 방문 추이에 없는 축제·연도 7개가 있다(보성 2022, 부평 2019, 안성 2019, 영암 2022,
  평창 2018·2022, 포항 2022). 주요 지표, `region_visitor`, 원본 `work/` 산출물로 이 빈칸을 채우지 않는다.
- 논산 축제는 26개에 없다.
- 원문에 축제 코드가 없어 고정 ID는 `apps/web/data/datalab-festival-ids.json`의 검토된 대응표로 정한다.

## 시각 정보

파일·폴더명 앞 14자리(예: `20260829165421`)는 다운로드 시각 표기로 보이지만 **시간대가 기록되지 않았다.**
화면에는 내려받은 날짜만 표시한다. 이 값은 수집 시점이며 관측 기간이 아니다. 시간대 미기재 사실은 이 출처 기록에 남기며 화면에 시각을 추정해 표시하지 않는다.

## 원본 문서의 상대 링크

`original/` 문서는 원본 저장소 기준의 상대 링크를 그대로 담고 있다. 예를 들어 `02-results.md`의
`./work/analyze.py`, `./work/confound.py`, `./work/adjust2.py`는 이 저장소로 가져오지 않았다. 이런 링크는 원본 커밋에서 연다.

- `work/` 디렉터리: https://github.com/travel-resolver/pick-d-day/tree/f362e65ba9e1cac18757951236484cff666c2696/developer/hkjin/plan-03-datalab/work
- `00-analysis-design.md` 등 가져오지 않은 문서: https://github.com/travel-resolver/pick-d-day/tree/f362e65ba9e1cac18757951236484cff666c2696/developer/hkjin/plan-03-datalab

`./01-retraction.md`처럼 함께 가져온 문서를 가리키는 링크는 `original/` 안에서도 그대로 열린다.

## 재생성과 검증

`apps/web`에서 실행한다. 앱 빌드 단계에는 포함하지 않으며, 앱은 체크인된 JSON만 읽는다.

```bash
node scripts/build-datalab-festival-trend.mjs --verify   # 목록·해시·분류 확인 후 체크인 JSON과 재생성 결과 비교
node scripts/build-datalab-festival-trend.mjs            # apps/web/data/datalab-festival-trend.json 재생성
node --test scripts/datalab-festival-trend.test.mjs
# 원본 체크아웃이 있을 때만: 목록 재작성
node scripts/build-datalab-festival-trend.mjs --init-manifest --source-repo <pick-d-day 체크아웃>
```
