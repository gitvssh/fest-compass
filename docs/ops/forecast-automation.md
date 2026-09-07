# 논산 자료 자동 수집·사전 발행·결과 확인

앱은 매일 **09:00 Asia/Seoul**에 최근 90일을 수집하고, 등록된 당일 예측을 발행한 뒤
사후 관측을 대조한다. 하루가 지난 뒤 시작해도 이전 날짜의 예측을 소급하지 않는다.
공개 화면 `/forecast/records`는 수집 상태·마지막 자료 날짜·누락·발행 일정·결과를 보여 준다.
코드 준비와 실제 배포·첫 실행 결과는 [단계 검증 기록](../validation/11-daily-automation.md)에서 구분한다.

## 실행과 보관

- 기존 Deployment에 `forecast-worker`를 함께 둔다. replicas=1, Recreate, 기존 RWO PVC를 유지한다.
  새 Kubernetes 리소스 종류·PVC·Vault 읽기 범위·네트워크 권한은 추가하지 않는다.
- worker는 `/data/forecast` 하위만 마운트한다. SQLite 파일은 이 컨테이너에 보이지 않는다.
  웹·마이그레이션과 같은 검증된 이미지 digest를 쓰고 API 키는 기존 runtime Secret에서 받는다.
- Linux `flock --no-fork`가 프로세스 수명 동안 단일 실행을 보장한다. 충돌은 75로 종료한다.
  파일을 지우거나 만료 시간을 추정해 잠금을 해제하지 않는다. 프로세스 종료 시 커널이 해제한다.
- 이미지의 `data/forecast-seed.json.gz`에는 기존 공개 수집본과 사전 예측·사후 기록을 포함한다.
  최초 실행·재시작 시 파일 해시와 재현 검사를 수행하고 기존 파일이 다르면 덮어쓰지 않는다.
- `snapshots/`, `forecasts/`, `assessments/`는 원본 보존, `runs/YYYY-MM-DD/`는 처리 결과·요청 시도·완료 지점이다.
  `public-summary.json`은 해시를 포함한 파생 화면 자료이며 완전히 쓴 뒤 원자적으로 교체한다.
  페이지 요청은 파일 읽기만 한다. 수집·학습·DB 갱신을 실행하지 않는다.
- `heartbeat.json`은 30초마다 갱신한다. 180초를 넘으면 웹은 연결 확인 필요로 표시한다.
  컨테이너 상태 검사도 이를 사용한다. API 오류와 웹 DB 상태는 서로 독립이다.

## 호출·실패·저장공간

한 날짜의 요청 시도 상한은 **20회**다. 요청 직전에 시도 기록을 디스크에 반영한다.
정상 빈 응답은 누락을 포함한 수집 완료(`partial`), 접근·한도·네트워크·검증 오류는 `failed`다.
0이라는 실제 값은 유지한다. 페이지가 없거나 중복/건수가 어긋난 일부 응답을 학습에 넣지 않는다.

완료·실패 결과가 있는 같은 날짜는 재시작해도 추가 API 요청을 보내지 않는다.
비정상 종료 뒤 저장되지 않은 요청이 발견되면 그 요청을 재시도하지 않고 당일 실패로 남긴다.
완전히 저장한 페이지·수집본·사후 기록의 완료 지점만 재사용한다.
실패일에도 다음 날의 새 정기 조회는 실행한다. 키/할당량 장애가 지속되면 하루 첫 실패 시점에 중단된다.
수집 실패일에는 새 예측을 발행하지 않는다. 지나간 발행일은 일정에 `missed`로 표시한다.

자료 저장 상한은 256MiB, 같은 파일시스템의 남은 용량 하한은 128MiB다.
검사에서 벗어나면 수집을 중단하고 기존 자료를 보존한다. 페이지 검증용 전국 식별자는 해당 일의 처리가
끝난 뒤 그 실행의 임시 `pages/`에서만 제거한다. 논산 원본·요청 시도·실패 원인은 보존한다.
이 검사는 SQLite와 공간을 공유하는 개발상 제한이며 다른 프로세스의 동시 사용량까지 예약하지 않는다.
장기 저장은 PVC 백업과 함께 관리한다. 자동으로 오래된 예측이나 관측을 삭제하지 않는다.

## 일정 등록

정본은 `apps/web/data/forecast-plan.json`이다. 2026-09-28에 `nonsan-20261005-d7-v1`를 발행하도록 등록했다.
이미 발행한 9월 D-7·10월 D-28 기록은 원본 그대로 초기 자료에 포함한다.
계획 파일은 최대 20개 요청을 허용한다. 대상·선행기간·ID·일정 근거를 검증한다.
동일 ID의 입력 의도를 바꾸지 않는다. 변경·재발행은 새 ID로 기록하고 기존 예측을 남긴다.
축제 회차는 HTTPS 일정 출처와 공개 시각이 필요하다. 운영자가 근거를 읽고 확정한 뒤 등록한다.
현재 v1은 1~4일 창이며 2027년의 24일 엑스포 전체를 기존 축제와 같은 회차로 자동 등록하지 않는다.

## 운영 확인

```bash
kubectl --context homelab-k8s -n fest-compass get deployment,pod
kubectl --context homelab-k8s -n fest-compass logs deployment/fest-compass -c forecast-worker --tail=10
kubectl --context homelab-k8s -n fest-compass exec deployment/fest-compass -c forecast-worker -- \
  node /app/forecast-worker.cjs --health
```

로그는 처리 날짜·성공/누락/실패·호출 수·고정 오류 코드만 표시한다. 키와 전체 환경·Secret은 출력하지 않는다.
웹에 표시된 갱신 시각과 마지막 관측일은 다르다. 최신 통계가 늦게 들어오면 매일 수집이 성공해도
마지막 관측일은 그대로일 수 있다. 이 차이를 실제 공개 지연으로 단정하지 않는다.
잘못된 요약 파일은 사용하지 않고 보관된 사례와 읽기 실패를 표시한다.

로컬 점검은 별도 디렉터리에서 실행한다. 운영 중인 worker에 두 번째 수집 명령을 동시에 보내지 않는다.
`--once`는 현재 날짜 한 번의 처리를 확인하고 종료하며 시각을 바꾸는 옵션은 없다.

```bash
npm run build:forecast
export FORECAST_DATA_DIR="$PWD/output/forecast-local"
export FORECAST_WORKER_PATH="$PWD/.next/forecast-worker.cjs"
export FORECAST_PLAN_PATH="$PWD/data/forecast-plan.json"
export FORECAST_SEED_PATH="$PWD/data/forecast-seed.json.gz"
export FORECAST_TRIAL_PATH="$PWD/data/calendar-trial-plan.json"
# 기존 비공개 환경으로 TOUR_API_KEY를 전달한 상태에서 실행
sh docker/forecast-worker.sh --once
```

코드 게시 → 기존 ARC의 `publish-image` 수동 실행 → 원격 이미지 검증 → 동일 digest로 manifest 변경 →
등록된 `fest-compass-prod`의 exact revision sync → live 이미지·첫 실행·공개 화면 확인 순서로 배포한다.
초기 자료를 다시 만드는 명령은 `npm run forecast:seed`이며 기존 gzip을 덮어쓰지 않는다.

## 공휴일 모델 겨울 시험

`data/calendar-trial-plan.json`은 2026-11-05~2027-01-31의 13개 목~일 창을 28일/7일 전에
비교하는 26건의 고정 목록이다. 기존 v1의 최대 20개 목록과 별도로 관리한다.
설계·선택 결과·달력 출처는 [모델 개발과 시험 기록](../validation/13-calendar-experiment.md)에 있다.

- `calendar-trial/active-plan.json`과 `<계획 해시>/registration.json`이 실제 운영 등록을 보존한다.
  다른 계획으로 교체하거나 10/8 이후에 처음 등록하려 하면 실패한다. 수정을 통해 소급 등록하지 않는다.
- `<계획 해시>/forecasts/`에는 v1·B1·B2와 공휴일 후보의 실제 발행 시각·입력·학습 계수를 보존한다.
  예정일을 놓친 발행은 `missed`다. 수집 실패일에는 발행하지 않는다.
- `<계획 해시>/outcomes/`에 대상일의 60일/90일 후 첫 정기 확인 결과를 별도로 보존한다.
  당일 미실행과 값 미확보는 구분하고 나중에 들어온 값으로 덮어쓰지 않는다.
- `/forecast/calendar`에서 모델 비교, 실제 등록·발행 상태와 결과 대기를 확인한다.
  재시작 시 기존 당일 수집 결과를 재사용하며, 시험 처리 오류만 30초마다 재시도한다. API를 추가 호출하지 않는다.
- `npm run forecast:trial:verify`와 앱 빌드는 고정한 계산 코드·달력·개발 결과 해시를 검사한다.
  등록 이후 모델 수정은 기존 시험을 덮어쓰는 방식으로 하지 않으며 별도 시험의 근거·규칙을 먼저 기록한다.
