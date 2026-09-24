# 임실N치즈축제 2024년 방문자 특성 원자료

2026-09-24 공식 [문화관광축제 분석](https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do)의
보이는 축제·조회 연도 선택에서 임실N치즈축제, 시작/종료 2024년을 적용했다. headless Chromium을 사용했고
로그인·개인 쿠키·내려받기 전용 경로는 사용하지 않았다. `original/` 다섯 응답은 원본 바이트다.
`manifest.json`은 요청 조건·응답 시각·바이트 수·SHA-256·관측기간·공식 정의 검사 근거를 보존한다.

- 축제 KCTF0061, 개최기간 2024-10-03~06, 4일. 상세 `info_list`의 개최지는 임실군 성수면이다.
- 목적지의 모든 `EMD_CD`는 52750340이다. `info_listTot`의 첫 칸 대신 실제 상세 개최지와 목적지 코드를 대조했다.
- 성·연령 8구간, 남녀 16비율. `DISP_YN=N`은 공식 백분율 표시 분기다. 원문 반올림 비율을 재정규화하지 않는다.
- 목적지 검색순위는 외지인·현지인·전체 각 7곳이다. 수월제는 2025년 목록에 없고 소충사는 이 해 목록에 없다.
- 지역 방문 추정 합계 108,709, 외지인 93,573, 현지인 14,949, 외국인 187. 기존 검증 자료와 대조한다.
- 현재 관광정보의 임실치즈테마파크·상이암만 정확한 장소 ID와 도로명 주소로 연결한다. 2026-09-24 실제 관광지 54개·문화시설 2개 응답에서 연결 대상 필드 전체가 일치했다. `resource-links.json`은 이 두 연결의 근거다.
- 성수산자연휴양림은 2025년 이름이 달라도 동일한 공식 장소 ID 173403으로 비교한다. 같은 주소에 있는 축제·공원·전시시설은 별도 ID이므로 합치지 않는다.

공식 `festival.js`, `festival_chart.js` 해시는 [2025년 검사](../datalab-imsil-2025/README.md)와 같다.
공식 거주지 영역은 숨겨져 있어 제공하지 않는다. 이번 정상 조회의 성·연령 차트는 `demographics.png`다.
비교 계약과 실행 상태는 [검증 기록39](../../../validation/39-edition-profile-comparison.md)를 따른다.

재수집은 `apps/web`에서 `node scripts/capture-datalab-visitor-profile.mjs --out ../../output/<새 폴더> --year 2024`으로 실행한다.
새 후보를 만든 뒤 원자료·기간·지역·정의·장소 연결을 검수한다. 생성/검사는
`node scripts/build-datalab-visitor-profile.mjs --year 2024 [--verify]`다. 수집만으로 운영 자료를 덮어쓰지 않는다.
