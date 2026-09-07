# FEST Compass 실데이터 기반 고도화

## Goal

공모전과 실무 활용을 같은 비중으로 검증하고 실제 축제 한 곳의 과거·현재·예측·운영 결정·결과 축적 흐름을 구현한다

## Scope

- 승인된 7단계: 현재 점검 → 데이터 검증·샘플 선정 → 예측·운영 판단 검증 → 기획 확정 → 화면 설계 → 실제 축제 샘플 구현 → 공모전·실무 종합 평가.
- 축제의 과거·현재·향후 전망, 운영 결정, 결과와 다음 개최회차 재사용을 연결한다.
- 개발 정본은 WSL `~/dev/side/fest-compass`, 수정은 `~/dev/worktrees/fest-compass-<topic>`에서 수행한다.
- 단계별 계획과 증거는 `docs/validation/`, 과거 기획 원문은 `docs/archive/2026-08-planning/`에 둔다.

## Non-goals

- 지역 방문자를 축제 입장객으로 치환하거나, 사용자 가정을 실측 또는 검증된 예측으로 표시하지 않는다.
- 과거 회차 몇 개만으로 예측 성능을 단정하지 않는다. 예측 자체는 제품 목표이며, 데이터·비교실험으로 제공 범위를 결정한다.
- 외부 기관에 연락하거나 새로운 제공자 자격을 발급하는 것은 이번 개발 지시만으로 실행하지 않는다.

## Constraints

- Preserve repository instructions and safety boundaries.
- Do not expose credentials, tokens, or private session transcripts.
- 사용자가 승인한 개발·검증·일반 Git 게시·작업공간 정리는 재승인 없이 진행한다. 범위 밖의 파괴적 변경과 저장소 정책의 사람 전용 작업만 별도 확인한다.
- 공개 운영의 읽기 전용 경계와 기존 배포 ADR은 유지한다. 실제 편집 기능 공개는 선행 요건을 구현·검증하고 후속 결정으로 관리한다.

## Completion criteria

- 실제 축제 한 곳의 과거·현재·예측·운영 결정·결과 기록 흐름이 구현되고 주요 수치의 출처가 추적된다.
- 예측 대상·시간 단위·예측 시점·오차·단순 기준 대비 성능 및 미검증 한계가 기록된다.
- 공모전 완성도와 실무 활용성을 같은 비중으로 평가한다. 실무자 검증 미실시는 완료로 기록하지 않는다.
- 단계별 검증 증거와 후속 개발을 남긴다. 개발환경 이전이나 첫 조사 도구 완성만으로 전체 목표를 완료로 표시하지 않는다.

## Durable references

- [실행 계획](../../../docs/validation/00-plan.md)
- [현재 상태](../../../docs/validation/01-baseline.md)
- [WSL 개발환경](../../../docs/ops/wsl-development.md)
- [운영 경계 ADR](../../../docs/decisions/0001-public-readonly-sqlite-boundary.md)
