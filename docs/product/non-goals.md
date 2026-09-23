---
class: Current
doc_class: current
doc_kind: product
authority: canonical
owner: pickDday
last_verified: 2026-09-23
summary: "데이터만으로 기획 판단을 확정하거나 사용자 기록을 필수화하지 않습니다. 지역 통계를 입장객·혼잡으로 바꾸지 않고 기존 운영 경계를 유지합니다."
---

# Non-goals

2026-09-22 [확정 기획 기준](planning-principles.md)의 경계:

- 핵심 질문을 필수 설문으로 만들거나 목표 관광객·방문 이유·주제·축제명·전략·선택 사유·메모·기획안 저장을 조회·비교·시각화의 선행 조건으로 요구하지 않는다.
- 기록 기능을 선택해도 핵심 질문 전체의 답변 완료를 강제하지 않는다. 저장 형식 검사는 업무적 판단의 완성도와 구분한다.
- 공공데이터만으로 최적 관광객·방문 동기·축제 주제·최종 선택을 확정하지 않는다.
- 관광자원·지역의 인기 점수, 축제 테마 예측·추천, 관측하지 않은 방문객 수를 만들지 않는다.
- 뉴스 연결·AI 요약은 첫 버전의 핵심 기능이 아니며 후속으로 검토한다.
- 기록·기획안 작성 완료를 모든 사용자의 제품 이용 완료 기준으로 삼지 않는다.

pickDday does not:

- claim that regional visitor counts equal festival attendance or ticket admissions;
- promise unvalidated crowd, revenue, or demand accuracy from KTO signals; bounded regional trend experiments remain supporting evidence only;
- enable anonymous public mutation of operational records;
- treat missing evidence as zero;
- compute safety capacity without both a referenced basis document and an approver;
- provide multi-tenant authorization in the current release;
- run multiple SQLite writers or present the SQLite deployment as highly available;
- let the app repository choose cluster-wide Argo CD permissions, sync, deletion, Gateway, certificate, Tunnel, or DNS policy.

추가 범위 경계:

- 전국 모든 과거 축제·예산·성과 자료 확보를 첫 지도 MVP의 선행 조건으로 삼지 않는다.
- 확인된 자료 없이 행사장·도로·시간대 혼잡, 축제 흥행 효과, 안전 규모를 자동 산출하지 않는다.
- 최적 축제 아이템·입지·예산을 자동으로 정하지 않는다. 담당자가 근거와 제약을 비교해 선택한다.
- 관광시설 정보만으로 장소 사용 허가·견적·수용 기준이 확인됐다고 표시하지 않는다.
- 초기 개인 기획안 보관을 조직의 공식 결재나 공동 승인으로 표시하지 않는다.
- 새 지도·기획 시안 검수와 기존 개인 기록 기능 검증을 제품 전체 MVP 완료로 환산하지 않는다.
