# 임실N치즈축제 2023년 방문자 특성 원자료

2026-09-24 공식 [문화관광축제 분석](https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do)의
보이는 축제·조회 연도 선택에서 임실N치즈축제, 시작/종료 2023년을 적용했다. headless Chromium을 사용했고
로그인·개인 쿠키·내려받기 전용 경로는 사용하지 않았다. `original/` 다섯 응답은 원본 바이트다.
`manifest.json`은 요청 조건·응답 시각·바이트 수·SHA-256·관측기간·공식 정의 검사 근거를 보존한다.

- 축제 KCTF0061, 개최기간 2023-10-06~09, 4일. 상세 `info_list`의 개최지는 임실군 성수면이다.
- 목적지의 모든 `EMD_CD`는 52750340이다. `info_listTot`의 첫 행정동 칸이 비어 있다는 이유로 지역을 추정하지 않았다.
- 성·연령 8구간, 남녀 16비율. `DISP_YN=N`은 공식 차트의 백분율 표시 분기이며 결측 표시가 아니다.
- 목적지 검색순위는 외지인·현지인·전체 각 6곳이다. 검색량은 방문 인원·동선으로 전환하지 않는다.
- 지역 방문 추정 합계 93,318, 외지인 79,355, 현지인 13,923, 외국인 40. 기존 검증 자료와 대조한다.
- 현재 관광정보의 임실치즈테마파크·상이암만 정확한 장소 ID와 도로명 주소로 연결한다. 2026-09-24 실제 관광지 54개·문화시설 2개 응답에서 연결 대상 필드 전체가 일치했다. `resource-links.json`은 이 두 연결의 근거다.
- 공식 거주지 영역은 숨겨져 있어 제공하지 않는다. 시군구 거주지를 축제 기간 자료로 바꾸지 않는다.

공식 `festival.js`, `festival_chart.js`의 SHA-256은 [2025년 검사](../datalab-imsil-2025/README.md)와 같다.
이번 정상 조회의 성·연령 차트는 `demographics.png`다. HTML은 조회 시점에 따라 달라질 수 있어 별도 해시를 기록했다.
비교 계약과 실행 상태는 [검증 기록39](../../../validation/39-edition-profile-comparison.md)를 따른다.

재수집은 `apps/web`에서 `node scripts/capture-datalab-visitor-profile.mjs --out ../../output/<새 폴더> --year 2023`으로 실행한다.
새 후보를 만든 뒤 원자료·기간·지역·정의·장소 연결을 검수한다. 생성/검사는
`node scripts/build-datalab-visitor-profile.mjs --year 2023 [--verify]`다. 수집만으로 운영 자료를 덮어쓰지 않는다.
