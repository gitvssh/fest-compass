---
schema_version: 1
project_id: fest-compass-evolution
revision: 58
status: waiting-human
next_actor: human
last_actor: claude
current_question: "3단계 데이터랩 수동 보강을 언제, 어떤 축제부터 할지 정해 주세요."
updated_at: "2026-10-04T07:13:31.401Z"
---

# Current state

## Summary

기존·새 축제와 관광지도의 공통 방문·자원·시기 자료, 축제 기획 길잡이(설계24 묶음 1)를 공개 중이다. 2026-10-04 방문 흐름 겹쳐 보기·점 상세 수치·축제장 표시, 목적별 축제 찾기 1단계(등록 분류 유형 칩, 문화관광축제 방문 규모와 외지인/현지인 구성)와 2단계(등록 소개 글 근거 체험·어린이·가족·무료 표시와 거르기, 전국 모든 축제 목록)를 공개했다(이미지 720c589c). 이동 시간 원은 보류, 3단계 데이터랩 수동 보강은 사람 작업 대기.

## Accepted decisions

- 2026-10-03 사용자 승인: 공모전 홍보 영상을 홈에 게시하되 자동 전면 재생 대신 상시 진입점·첫 방문 비차단 안내·누를 때 재생으로 한다. 웹용은 제작 검증 카드를 사용자 관점 문구로 바꾸고 제출본은 유지한다(docs/design/23-intro-video.md).
- 공모전 완성도와 실무 활용성을 같은 비중으로 추진하고 과거·현재·예측·기획 결정·결과·다음 회차를 연결한다(2026-09-07 사용자 확인).
- 승인된 개발·검증·일반 Git 게시·등록 앱 sync·전용 worktree 정리는 재승인 없이 진행한다(사용자 요청·저장소 규약).
- 논산딸기축제를 개발 샘플, 논산시 일별 외지인 방문 추세를 1차 예측 지표로 삼는다. 행사장 입장·시간별 혼잡과 구분하며 다른 지자체에 자동 일반화하지 않는다(docs/validation/05~06).
- 과거 이력 학습·사전 예측·매일 수집·겨울 공휴일 후보 시험을 구현했다. 발행 입력과 겨울 계획·코드 14개는 고정한다. 승인된 구 이미지 4개 정리·자동 정책 연결·배포 복구도 완료했다(docs/validation/08~15).
- 2026-09-07 사용자는 모델 정확도보다 화면·기능과 빠른 MVP 피드백을 우선했다. 현재 /workspace는 개인 운영 계획·기록의 사용 가능한 기반이며 제품 전체 MVP 완료를 뜻하지 않는다(2026-09-08 목표 명확화).
- 2026-09-08 사용자 명시: 주 타겟은 지자체 담당자, 자기 지자체 관광정보가 1차 요구다. 주변 다른 현재 축제와 과거 기록의 비교검색을 2차 정보 수요 가설로 삼는다.
- 2026-09-08 사용자 명시: 지역 관광데이터를 지도에서 시각화·조건 조회하고 이를 근거로 올해 어떤 축제를 어떤 아이템·위치·예산·준비 규모로 기획할지 판단하는 것이 목표다. 이 목표의 실행 순서를 docs/design/07-region-planning-milestones.md의 M1~M6로 구체화했다.
- 지도에서 선택한 자료·조회 조건과 기획안의 판단 근거를 연결하고, 기존 운영 기록·보고서·다음 회차 기능을 M4~M6에 재사용한다(위임된 목표·마일스톤 정리 범위).
- 공개 서버 쓰기 차단·개인 브라우저 저장 경계는 유지한다. 공동 편집·공식 승인과 실제 현장 효과는 후속 개발·검증이며 이미 제공하는 것처럼 표현하지 않는다(ADR-0001).
- 2026-09-08 사용자 후속 승인: 바로 개발하지 않고 개정 기획·요구사항·기능목록·화면설계·와이어프레임을 먼저 작성하며 traceboard에도 배포해 검수한다.
- 검수용 문서·배치·기본값은 제안으로 표시하고 기존 내부 traceboard에만 게시한다. 지도·예산·위치 시안의 가상 자료를 실제 확보 데이터로 표현하지 않는다(위임된 문서·검수 게시 범위).
- 2026-09-08 사용자 추가 요청: 실제 지자체 담당자의 축제 준비·예산안 작성·집행을 반영하기 위해 공개 온라인 사례를 조사한다. 조사 근거와 설계 보완안을 문서화하며 실제 사용자 관찰로 표현하지 않는다.
- 2026-09-08 사용자 후속 승인: 공개 사례의 보완안 8개를 업무·자료·기존 요구/인수 기준과 7개 화면 v2에 반영하고 내부 traceboard 검수본을 갱신한다. 기능 구현·실무자 검증 완료로 확대하지 않는다.
- 2026-09-08 사용자 승인: 첫 지도는 남한 전국에서 시작해 시도→시군구로 좁히고, 우리 지역·이전 탐색은 명시적 바로가기로 제공한다. 실제 과거 자료의 확보 여부와 출처를 드러내며 그래프·파이/도넛·수치 표 중심으로 비교·기획 근거에 연결한다.
- 2026-09-08 사용자 요청: Playwright 등 브라우저 자동 검증은 headless로 수행한다. v3는 설계·내부 검수본 갱신이며 제품 기능 구현 완료로 확대하지 않는다.
- 2026-09-08 사용자가 시도→시군구 확장을 UI로 표현하고 다음 개발을 진행하도록 승인했다. M1 전국·지역 조회와 개인 근거 보관을 구현·공개하며 브라우저 검증은 계속 headless로 수행한다.
- 2026-09-08 사용자 후속 요청: 지도 진입 표기를 '전국'으로 확정하고 다음 M2 축제 비교 개발을 이어간다. 모델 정확도보다 MVP 화면·기능 우선과 headless 검증을 유지한다.
- 2026-09-08 사용자 후속 요청으로 다음 M3 기획 후보·근거 연결을 구현·검증·일반 게시한다. 모델 정확도보다 MVP 화면·기능 우선, 개인 브라우저 저장과 headless 검증을 유지한다.
- 2026-09-09 사용자가 다음 M4 예산·재원·준비 규모 비교의 개발·검증·일반 게시를 승인했다. 모델·겨울 시험·개인 브라우저 저장 경계와 headless 검증을 유지한다.
- 2026-09-09 사용자가 다음 마일스톤을 goal로 설정해 진행하도록 요청했다. M5 기획안 보관·사업설명/준비 목록 출력의 구현·headless 검증·일반 게시·작업공간 정리를 수행하며 모델·개인 저장 경계는 유지한다.
- 2026-09-09 사용자가 M6를 goal로 지정해 진행하도록 요청했다. 공개 집행·정산 자료와 담당자 입력을 구분하고 미확인 금액을 추정하거나 0으로 처리하지 않는다. 구현·검증·일반 게시·작업공간 정리를 수행한다.
- 2026-09-09 사용자가 docs/ops/planning-outcomes-release.md의 미사용 이미지 네 개 삭제를 명시 승인하고 기본 승인 정책 확인을 요청했다. 정확한 대상만 정리했으며 기존 자동 예약 정리와 수동 삭제 승인 경계를 구분한다.
- 2026-09-09 다음 작업 진행 요청에 따라 기존 지도 품질 피드백을 우선 보완했다. 도로 배경·이동·자료 선택·영역 보관을 구현·검증·일반 게시하며 모델·개인 저장 경계와 headless 원칙을 유지한다(기존 기능 우선 위임 범위).
- 2026-09-09 다음 작업 진행 요청에 따라 공식 연계표·도형 검증과 기준일 있는 경계 지도를 구현·공개했다. 참고 경계는 지역 선택과 당시 근거 보관에 사용하고 현재 법정 영역 인증·자원 포함 판정·통계 배분에는 사용하지 않는다(기존 지도 개선·일반 게시 위임 범위).
- 2026-09-10 다음 작업 진행 요청에 따라 기획 기간과 겹치는 현재 등록 행사 조회·일정 그림·선택 당시 조건 보관을 구현·공개했다. 실제 제공처 응답을 근거로 시작일 범위라는 기존 가정을 정정했으며 거리 검색·전국 자료 완비·실제 개최 증명으로 확대하지 않는다(기존 화면·M2 보완·일반 게시 위임 범위).
- 2026-09-10 다음 작업 진행 요청으로 조회한 현재 행사 안의 직선거리순·반경 비교와 기준 좌표·출처 보관을 구현·공개했다. 좌표 미확인은 유지하고 전국 자동 탐색·이동시간·행사장 실측 정확도로 확대하지 않는다(기존 M2 보완·일반 게시 위임 범위).
- 2026-09-10 다음 작업 진행 요청에 따라 지도에서 담은 관광지·문화시설의 이름·주소를 후보 장소 입력에 명시적으로 적용하고 출처 사본을 연결하는 기능을 구현·공개했다. 관광정보를 대관·안전·수용 인원 확인으로 확대하지 않고 장소 변경 시 기존 확인을 재검토한다(기존 M1→M3 화면 보완·일반 게시 위임 범위).
- 2026-09-10 다음 작업 진행 요청에 따라 공주·임실 2023~2025년 방문 이력과 공주 2024 백제문화제 공개 비용을 원문 대조 후 지도·비교·기획 근거에 연결하고 일반 게시했다. 지역 방문 추정과 행사 입장객, 예산·집행·총원가를 구분하며 전국 자료 완비·새 지역 예측 성능으로 확대하지 않는다(기존 M1/M2 자료 확대·일반 게시 위임 범위).
- 2026-09-22 사용자 확정: 국내·지역 관광 활성화를 고정 목표로 두고 축제를 기획·운영하는 지역 공무원을 주 사용자로 삼는다. 지역 소비·주민 참여·인지도는 관광 활성화와의 관계 안에서 다룬다(docs/product/planning-principles.md).
- 2026-09-22 사용자 확정: 기존 축제 개선·새 축제 기획을 두 핵심 제품 흐름으로 두고 첫 화면에서 상황을 나눈다. 두 흐름의 상세 설계와 구현은 후속이며 코드·배포 분리를 확정한 것은 아니다.
- 2026-09-22 사용자 확정: 한국관광공사뿐 아니라 다양한 정부·공공기관 데이터를 확보·정제하고 목적에 맞게 가공·연결·시각화해 의사결정을 돕는 것이 핵심 가치다. 전문성을 전제하지 않는 가이드와 시각화의 상세는 후속 검토한다.
- 2026-09-22 사용자 정정·확정: 관광객·방문 이유 등 핵심 질문은 정보 설계 기준이다. 데이터만으로 답을 확정하지 않으며 사용자 답변·선택 이유·메모·기획안·결과 기록은 선택 사항이다. 기록 없이 핵심 조회·비교·시각화를 이용하고 기록을 선택해도 전략적 질문 전체의 답변 완료를 강제하지 않는다. 기존 기획안 완주 중심 기준에 우선한다.
- 2026-09-22 사용자 요청으로 위 기준과 결정만 문서화했다. 기존 상세 필수값·동선·인수 기준의 정렬, 데이터 조사, 앱 개편은 후속이며 이번 기록을 구현·검증 완료로 확대하지 않는다.
- 2026-09-22 사용자 요청: Grok 4.6 조사와 직접 검수로 확인한 최신 구현·데이터 정보를 문서에 반영하고 다음 기획 작업의 시작점을 남긴다. 이번 범위는 문서 갱신이며 앱 개편·신규 수집 착수는 아니다.
- 2026-09-22 사용자 확정: 공공데이터를 활용한 핵심 조회·비교·시각화 기능을 먼저 구현한 뒤 뉴스 검색·원문 연결을 추가한다. 외부 보도자료·뉴스 수치의 자동 정규화·핵심 통계 반영은 첫 버전에서 제외하고 AI 요약은 나중에 검토한다. 현재 AI 모델 선정·성능 시험·요약 구현을 착수하지 않는다.
- 2026-09-22 사용자 정정: 뉴스 검색 제공자를 네이버로 고정하지 않고 DuckDuckGo 등을 후속 검토 후보로 둔다. 공급자 채택이나 API·수집·AI 이용 조건을 확인한 결정은 아니다.
- 2026-09-22 사용자 확정: 축제별 데이터 차이는 정보 선택·노출·배치·위계·글자 크기와 차트로 전달한다. 내부 수집·검증 규약을 제약 안내문으로 노출하지 않으며 법적으로 필요한 고지만 별도 표시한다. 지표의 대상·기간·단위와 필요할 때 확인하는 출처는 유지한다.
- 2026-09-22 사용자 확정: 기존 축제 첫 버전의 핵심을 과거 방문 흐름 비교·주변 관광자원 연결·다음 개최 시기 검토의 세 기능으로 정한다. 전국 기본 관광정보·행사 탐색과 자료 확보 지역부터의 과거 분석 확장, 과거 방문 흐름 우선 제시와 세 기능 사이의 기록 없는 자유 탐색을 설계 방향으로 채택한다. 성별·연령·소비·숙박 분석은 실제 자료 확보 가능성 확인 뒤 추가 범위를 정한다.
- 2026-09-22 사용자 요청: 최신 devkit UI/UX 기준을 고려해 기존 축제 핵심 지표·비교 기준과 화면 문구·디자인·레이아웃을 구체화한다. 이번 산출물은 상세 설계·시안이며 세부 배치 자체를 사람이 별도로 확정하거나 앱 구현을 완료한 것으로 표시하지 않는다.
- 2026-09-22 사용자 후속 요청: 다음 안인 새 축제 기획 상세 설계를 이어서 진행한다. 지역·공공데이터 중심 탐색과 선택적 기록 원칙을 유지하며 최신 devkit UI/UX 기준을 적용한다. 구체적인 자원 우선 배치·비교 개수·경로는 검토 가능한 상세 제안이며 앱 구현 완료로 기록하지 않는다.
- 2026-09-22 사용자 요청: 사람 확인이 필요한 화면설계·시안·임시자료는 D:\download\project에 복사해 쉽게 확인하게 한다. 프로젝트에서 필요한 문서는 프로젝트에도 남긴다. 목적에 맞게 전달 정책을 정리·개선할 수 있으며 devkit 운영지침에 등록한다.
- 2026-09-23 사용자 요청: 기능·기획 개선에 집중하고 화면 목표·와이어프레임·기본 레이아웃까지만 전달한다. 최종 시각 디자인은 사용자가 개선하며 이전 시안의 색·폰트·간격을 확정값으로 고정하지 않는다.
- 2026-09-23 사용자 요청·순차 실행 승인: shlee의 FEST Compass를 다른 프로젝트와 비교해 같은 축제 제품의 자료·기능만 흡수하고 기존 gitvssh/fest-compass를 개발·CI·배포 정본으로 통합한다. 다른 제품과 원본 자료는 보존한다.
- 2026-09-23 사용자 변경 요청: 위임 모델은 Grok 4.6 대신 Claude Opus 5.5를 사용하고 통합 담당이 직접 검수한다. 실제 claude-opus-5-5 실행으로 자료·문서·기능 작업을 수행했다.
- 2026-09-23 다음 작업 진행 요청에 따라 기존 축제 개선의 검색·과거 방문·주변 자원·개최 시기를 구현·검증·공개했다. Claude Opus 5.5에 위임하고 통합 담당이 직접 검수하며 선택적 기록·실제 자료와 통제 응답 구분·최종 시각 디자인 후속 원칙을 유지한다.
- 2026-09-23 사용자 요청: 프로젝트 표시 이름을 정확히 pickDday로 바꾸고 설명·현재 문서를 정리한 뒤 새 축제 전용 흐름을 구현한다. 기존 관광 활성화·지역 공무원·두 목적·선택적 기록 기준과 Claude Opus 5.5 위임·직접 검수를 유지한다.
- 2026-09-24 사용자 진행 요청: 두 핵심 흐름 뒤의 관련 자료 검색·원문 연결을 Claude Opus 5.5로 설계·구현 위임하고 직접 검수한다. 위임 범위에서 공식 URL 형식을 확인한 DuckDuckGo 새 탭 검색을 축제·회차·지역·자원에 연결했다. 기사 수집·수치 자동 반영·AI 요약은 포함하지 않는다.
- 2026-09-24 다음 개선 진행 요청: 방문자 특성·연계 관광정보를 실제 Claude Opus 5.5에 조사·설계·구현 위임하고 직접 검수했다. 위임 범위에서 관측기간이 확인된 임실 축제 회차 방문 구성·임실군 연간 추세를 먼저 연결했다. 성·연령·거주지·목적지 순위는 기간을 추정해 제공하지 않고 기존 현재 관광자원 조회는 유지한다.
- 2026-09-24 사용자 진행 요청에 따라 임실N치즈축제 2025년 방문자 특성을 공식 공개 UI에서 조회 조건과 함께 새로 확보했다. 실제 Claude Opus 5.5 네 작업 위임·직접 검수 후 성·연령 비율·목적지 검색순위와 검토된 현재 관광자원 세 곳을 구현·검증·공개했다. 축제별 거주지는 현재 공개 영역이 숨겨져 있어 제공하지 않고 시군구 자료로 대체하지 않는다. 최종 시각 디자인은 후속이며 기록은 선택이다.
- 2026-09-24 사용자 후속 진행 승인으로 임실 2023·2024년 공식 자료를 새로 확보하고 2025년과 두 회차 비교를 구현·검증·공개했다. 기존 최대 세 회차 선택은 유지하며 상세 비교는 최근 두 회차를 쓰고 다른 조합은 기존 선택기로 고른다. 실제 Claude Opus 5.5 설계·자료·서버·화면·문서 위임 후 직접 검수했다. 수동 후보 수집·검사 실패 시 이전 자료 보존을 구현했으며 전국 확대·축제별 거주지·예약 수집은 후속이다.
- 2026-09-26 사용자 정정·진행 승인: 특정 축제 자료 추가보다 검색해 고른 모든 등록 축제의 방문·자원·시기 공통 경험을 우선한다. 공식 API 전국 시군구 관측·등록 일정의 보관/일별 갱신을 구현·공개하고 검토된 기존 회차는 같은 화면에 연결한다. 과거의 전국 확대 제외는 이 승인으로 대체하며 논산 예측·고정 시험은 확대하지 않는다. 실제 Opus5.5 여섯 작업 위임 후 직접 검수했다.
- 2026-09-26 사용자 진행 승인: 관광자원 공통 상세와 음식점·숙박 연결을 먼저 설계한 뒤 실제 Claude Opus 5.5에 구현을 위임하고 주 담당자가 직접 검수한다. 기존·새 축제의 네 유형 선택·공통 소개를 구현·공개했다. 기본 관광지·문화시설과 선택적 기록을 유지하며 특정 축제 전용 조건을 추가하지 않는다. 최종 시각 디자인은 후속이다.
- 2026-09-27 사용자 승인: devkit 제품 경험 기준으로 두 관광자원 화면의 위계·군집 지도·첫 화면 목적 이미지를 설계·구현한다. 주 담당자가 설계 후 실제 Opus5.5에 구현을 위임하고 직접 검수하며 프로젝트 원본과 D 드라이브 확인용 사본을 함께 유지한다.
- 2026-09-27 사용자가 배포 기록의 구 이미지3개 정리와 배포 재개를 승인했다. 실행 전 예약 정리5177 완료와 세 digest 부재를 확인하여 추가 수동 삭제 없이 최종 버전을 발행·공개 검수했다. 기존 운영 이미지는 복구본으로 보존했다.
- 2026-09-27 사용자 요청: PC에서 자료 조사·비교·기획을 주목적으로 두고 두 목적 이미지의 구도 차별화·확대, 과밀 헤더·하단 강조·자료 작업 배치를 개선한다. 설계21의 범위에서 기존 와이어프레임까지만 작업하는 제한을 대체하며 좁은 창·확대 접근성과 선택적 기록은 유지한다. 이번 Opus5.5 호출은 사용 한도로 실행되지 않아 협업 에이전트 분담·주 담당자 직접 검수로 진행했다.
- 2026-09-27 사용자가 공공 관광 사진·이용정보 연결을 승인했다. 관광지도와 두 축제 흐름·두 후보 비교에 실제 사진을 연결하고, 사진 없음은 영역 생략·실패는 기존 자료 보존/재시도·사진별 출처와 이용조건을 제공한다. 포토코리아와 AI 요약은 후속이다.
- 2026-10-03 사용자 요청: 초기 사용자 의견을 반영해 순환보직으로 처음 축제를 맡은 담당자의 의사결정 길잡이(단계 목표·체크리스트·읽을거리)와 페이지별 시각 이미지를 현황 분석·조사·기획하고 Codex(gpt-6-astra xhigh)·Fable의 설계 검토를 받는다. 이번 범위는 기획·설계이며 구현과 디자인 채택은 사용자 결정 뒤다(docs/design/24-planning-guide.md).
- 2026-10-03 사용자 승인: 설계24 개선안 전체와 D1~D6 제안을 확정하고 구현을 지시했다. 흔들림은 끝(얻는 것)과 순서 모두이고 행정 절차 연결은 확인할 수 없었다. 시·도 담당자 없음, 개인 PC, 인쇄본은 내부 보고용, 내용 검수자는 없어 우리가 정한다(docs/design/24-planning-guide.md 19절).
- 2026-10-03 사용자 방향: 문장·설명을 줄이고 시각 도구·아이콘·이미지로 직관적으로 보이게 하며 팝업·초점 상태의 디자인 시스템을 정제한다(docs/sdlc/2-design/design-system.md 2026-10-03 절).
- 2026-10-04 사용자 요청: 기존 축제 방문 흐름은 회차를 한 그래프에 겹쳐 보는 것이 기본(따로 보기 유지), 점의 상세 수치, 연계 관광 지도의 축제 위치(검토된 등록 연결만) — 구현·공개(docs/validation/46-planning-guide.md 후속 개선).
- 2026-10-04 사용자 결정: 이동 시간 원(자동차·도보 15·35·60분)은 보류한다(docs/design/25-festival-discovery.md 1절).
- 2026-10-04 사용자 결정: 목적별 축제 찾기를 제안 순서대로 — 1단계 등록 분류 유형 칩·문화관광축제 방문 규모(외지인·현지인 구성 포함) 구현·공개, 2단계 체험·어린이·무료 표시(등록 소개 글 근거), 3단계 데이터랩 수동 보강(사람 작업, 나중)(docs/design/25-festival-discovery.md).
- 2026-10-04 사용자 승인: 이미지 저장소 한도로 막힌 발행을 위해 지난 이미지 ae7b945·1312880만 프로젝트 정리 절차로 지우고 즉시 공개(docs/validation/47-festival-discovery.md 공개 배포).

## Open questions

- 공통 지역 방문·자원·시기, 기존 회차 비교·선택적 기록은 사용 가능하다. 축제 입장객·효과·성/연령·거주지 전국 확대, 미확보 과거 개최일·공개 비용·나머지277CSV/Foundry연계는 후속이다. 비공식 데이터랩 차트 자동 수집은 원천으로 쓰지 않고 공식 API/다운로드만 사용한다.
- 이번 개편 범위 밖의 기획·운영 화면 상세 디자인·실제 담당자 관찰·전체 보조기술·다른 화면의200% 확대·개편35조회단위 공식 경계 교체·공동편집/공식승인·정형 API/Spec/Run 연결은 후속이다. 뉴스 AI요약은 나중에 검토한다.
- 관광자원 군집 지도·목록/상세 위계·목적 이미지는 공개 사용 가능하며 실제 자료·모바일·200%와 D 사본 검수를 완료했다. 등록된 운영시간·메뉴·입퇴실·주차는 연결했다. 실시간 영업·객실 재고·예약 가능 여부와 포토코리아 지역 경관 검색은 후속이다.
- PC 전역 메뉴·홈·관광자원3열·방문 병렬 분석은 공개 사용 가능하며 실제 자료·200%·D 사본 검수를 완료했다. 실무자 관찰에 따른 추가 밀도·배치 조정은 후속이다.
- 설계24 묶음2(요청형 길잡이 패널·탭별 자료 읽는 법·읽을거리)~5의 착수 순서. 검수자가 없으므로 문장은 출처 대장 원문과 대조해 정하고 업무 경험자 검수를 받았다고 쓰지 않는다.
- 공개 서버 그림 최적화 캐시가 읽기 전용 루트 때문에 매번 MISS다. 쓰기 가능한 임시 캐시 볼륨을 붙일지(그림 화면의 첫 화면 시간 개선, 검수46).
- 묶음 1 뒤 초기 사용자 재확인(설계24 14절): 각 흐름의 목표·끝·순서를 자기 말로 설명하는지, 어디서 막히는지.
- 함께 공개된 분석 동의 배너(deee795, 다른 작업): 공개 검사에서 390px 소개 영상 카드가 바닥글 `분석 동의 다시 보기`를 가리고, 1440px에서 한 번 Cloudflare 기본 창이 약 0.1초 보였다(검수47 공개 배포). 그 작업의 확인 대상.
- 목적별 축제 찾기 3단계(데이터랩 화면에서 더 많은 축제의 연도별 방문 추이를 사람이 내려받아 방문 규모에 더하기) 착수 시기와 대상 축제 목록.
- 이미지 저장소가 994MiB/1GiB다(운영·복구본 외 정리 후보 ed3585c·d3def74). 다음 발행은 매일 03:30 자동 정리 뒤, 또는 두 이미지 정리 승인 뒤에 가능하다.

## Artifacts and durable documents

- docs/review/2026-09-current-state.md
- docs/research/2026-09-data-inventory.md
- docs/product/planning-principles.md
- docs/product/vision-scope.md
- docs/product/non-goals.md
- docs/sdlc/2-design/regional-history-costs.md
- docs/research/2026-09-regional-history-costs.md
- docs/validation/32-regional-history-costs.md
- docs/validation/evidence/2026-09-10-history-costs-publication.json
- apps/web/scripts/history-costs-e2e.mjs
- docs/design/07-region-planning-milestones.md
- docs/review/2026-09-planning-review.md
- traceboard.yaml
- docs/sdlc/2-design/screens.md
- docs/sdlc/2-design/ia.md
- docs/sdlc/2-design/flows.md
- docs/sdlc/2-design/data-visualization.md
- docs/sdlc/2-design/design-system.md
- docs/sdlc/1-analysis/usecases/UC-FC-009.md
- docs/sdlc/1-analysis/usecases/UC-FC-010.md
- docs/ops/review-delivery.md
- tools/export-review.py
- docs/sdlc/2-design/functional-spec.md
- docs/ops/repository-consolidation.md
- docs/research/imported/hkjin-plan-03/README.md
- docs/research/festival-officer-interview.md
- docs/validation/evidence/2026-09-23-consolidation.json
- apps/web/scripts/annual-trend-e2e.mjs
- apps/web/scripts/schedule-absorption-e2e.mjs
- docs/validation/34-existing-festival-journey.md
- docs/validation/evidence/2026-09-23-existing-journey.json
- docs/sdlc/3-testing/scenarios/TS-FC-009.md
- apps/web/scripts/existing-journey-e2e.mjs
- docs/validation/35-pickdday-new-festival.md
- docs/validation/evidence/2026-09-24-pickdday-new-festival.json
- docs/sdlc/3-testing/scenarios/TS-FC-010.md
- apps/web/scripts/new-festival-e2e.mjs
- docs/validation/36-related-material-search.md
- docs/validation/evidence/2026-09-24-related-material-search.json
- docs/sdlc/3-testing/scenarios/TS-FC-011.md
- apps/web/scripts/related-search-e2e.mjs
- docs/validation/37-visitor-context.md
- docs/validation/evidence/2026-09-24-visitor-context.json
- docs/sdlc/3-testing/scenarios/TS-FC-012.md
- apps/web/scripts/visitor-context-e2e.mjs
- apps/web/data/datalab-region-annual.json
- apps/web/data/datalab-festival-links.json
- docs/validation/38-visitor-profile.md
- docs/validation/evidence/2026-09-24-visitor-profile.json
- docs/research/imported/datalab-imsil-2025/README.md
- apps/web/scripts/capture-datalab-visitor-profile.mjs
- apps/web/scripts/build-datalab-visitor-profile.mjs
- apps/web/scripts/visitor-profile-e2e.mjs
- docs/sdlc/3-testing/scenarios/TS-FC-013.md
- docs/validation/39-edition-profile-comparison.md
- docs/validation/evidence/2026-09-24-edition-profile.json
- docs/research/imported/datalab-imsil-2023/README.md
- docs/research/imported/datalab-imsil-2024/README.md
- apps/web/scripts/edition-profile-e2e.mjs
- docs/sdlc/3-testing/scenarios/TS-FC-014.md
- docs/design/18-unified-festival-analysis.md
- docs/validation/40-unified-festival-analysis.md
- docs/validation/evidence/2026-09-26-unified-festival.json
- docs/sdlc/3-testing/scenarios/TS-FC-015.md
- docs/ops/festival-sources.md
- docs/research/imported/mois-2026-region-codes/README.md
- apps/web/scripts/unified-festival-e2e.mjs
- apps/web/scripts/unified-festival-live.mjs
- docs/design/19-tourism-resources.md
- docs/validation/41-tourism-resources.md
- docs/validation/evidence/2026-09-26-tourism-resources.json
- docs/validation/evidence/2026-09-26-tourism-resource-probe.json
- docs/sdlc/3-testing/scenarios/TS-FC-016.md
- apps/web/scripts/tourism-resources-e2e.mjs
- docs/design/20-resource-experience.md
- docs/validation/42-resource-experience.md
- docs/validation/evidence/2026-09-27-resource-experience.json
- docs/sdlc/3-testing/scenarios/TS-FC-017.md
- docs/ops/resource-experience-release.md
- apps/web/scripts/resource-experience-live.mjs
- docs/design/21-desktop-research-experience.md
- docs/validation/43-desktop-research-experience.md
- docs/validation/evidence/2026-09-27-desktop-research.json
- docs/sdlc/3-testing/scenarios/TS-FC-018.md
- apps/web/scripts/desktop-experience-e2e.mjs
- docs/design/22-tourism-media.md
- docs/validation/44-tourism-media.md
- docs/validation/evidence/2026-09-27-tourism-media.json
- docs/validation/evidence/2026-09-27-tourism-media-source.json
- docs/validation/evidence/2026-09-27-tourism-media-delivery.json
- docs/sdlc/3-testing/scenarios/TS-FC-019.md
- apps/web/scripts/tourism-media-e2e.mjs
- apps/web/scripts/tourism-media-live.mjs
- docs/design/23-intro-video.md
- docs/validation/45-intro-video.md
- docs/sdlc/3-testing/scenarios/TS-FC-020.md
- apps/web/scripts/intro-video-e2e.mjs
- apps/web/scripts/intro-video-live.mjs
- docs/design/24-planning-guide.md
- docs/research/2026-10-novice-planner-sources.md
- docs/research/2026-10-guidance-ux-patterns.md
- docs/review/2026-10-03-planning-guide-review-codex.md
- docs/review/2026-10-03-planning-guide-review-fable.md
- docs/assets/design-24/mockups/render.mjs
- docs/sdlc/3-testing/scenarios/TS-FC-021.md
- docs/validation/46-planning-guide.md
- apps/web/lib/guide/content.ts
- apps/web/lib/guide/process.ts
- apps/web/scripts/planning-guide-e2e.mjs
- apps/web/scripts/planning-guide-live.mjs
- docs/design/25-festival-discovery.md
- docs/sdlc/3-testing/scenarios/TS-FC-022.md
- docs/validation/47-festival-discovery.md
- apps/web/scripts/festival-discovery-e2e.mjs
- apps/web/scripts/festival-discovery-live.mjs
- docs/ops/festival-sources.md
- apps/web/lib/existing/festival-marks.ts
- apps/web/lib/festival-sources/intro.ts
- docs/validation/evidence/2026-10-04-festival-marks-before.json
- docs/validation/evidence/2026-10-04-festival-marks-after.json
