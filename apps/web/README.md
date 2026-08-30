# FEST Compass

축제 기획·운영 의사결정 지원 MVP입니다. 흥행 예측이 아니라 근거·가정·시나리오·결정·실측을 한 원장으로 연결합니다.

## 로컬 실행

Node.js 24.19 이상 25 미만과 npm 10.7 이상을 사용합니다. 컨테이너 기준 버전은 `.nvmrc`와 Dockerfile에 고정되어 있습니다.

```bash
npm ci
npx prisma db push
npm run db:seed
npm run dev
```

브라우저에서 `http://localhost:3000`을 열고 시드 축제 **○○군 봄꽃축제**로 데모를 진행합니다. 로컬 기본 모드는 `editor`입니다.

## 환경변수

| 이름 | 기본/예시 | 설명 |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite URL. 컨테이너에서는 반드시 `file:/data/...` 사용 |
| `TOUR_API_KEY` | 빈 값 | 공공데이터포털 일반 인증키. 서버 런타임 Secret으로만 주입 |
| `APP_MODE` | 개발 `editor`, production `public-readonly` | 읽기 전용에서는 모든 서버 액션이 거부되고 편집 UI가 숨겨짐 |
| `SITE_URL` | 개발 `http://localhost:3000`, production `https://kto.damecasol.com` | canonical·robots·sitemap 기준 URL |
| `KTO_FETCH_TIMEOUT_MS` | `10000` | KTO 요청별 제한시간. 1,000~30,000ms만 허용 |

잘못된 `APP_MODE` 값은 안전하게 `public-readonly`로 처리됩니다. `editor` 모드는 인증된 내부 경계에서만 사용해야 합니다.

## 검증과 헬스체크

```bash
npm test
npm run typecheck
npm run build
```

빌드는 Next standalone 산출물의 존재를 확인하고, 이미지에 포함되기 전에 산출물 안의 `.env*` 파일을 제거합니다. 런타임 Secret은 이미지나 저장소에 넣지 말고 배포 환경에서만 주입합니다.

- `GET /health/livez`: DB·외부 API 없이 프로세스 생존만 확인
- `GET /health/readyz`: Prisma로 Festival 테이블을 읽고 성공 시 200, 실패 시 503

두 응답 모두 `no-store`이며 내부 오류나 환경변수 값을 반환하지 않습니다.

## Prisma migration

새 데이터베이스에는 `npm run db:migrate:deploy`로 baseline과 후속 인덱스를 적용합니다.

기존 `prisma db push` 데이터베이스는 먼저 백업하고 앱을 중지한 뒤, baseline SQL과 현재 스키마가 일치하는지 확인해야 합니다. 그 후에만 아래 순서로 baseline을 적용 완료로 표시하고 인덱스 migration을 실행합니다.

```bash
npm run db:migrate:baseline
npm run db:migrate:deploy
```

`db:seed`는 데이터베이스가 비어 있을 때만 데모를 만들며, 동일한 데모 ID가 이미 있으면 no-op입니다. 다른 축제가 있는 DB에 데모 ID가 없으면 실패합니다.

## 컨테이너

빌드 컨텍스트는 이 디렉터리여야 합니다.

```bash
docker build -t fest-compass:web .
```

이미지는 Debian 기반 Node.js 24.20.0, Next standalone, 비루트 `node` 사용자로 실행됩니다. 기본값은 `APP_MODE=public-readonly`, `DATABASE_URL=file:/data/fest-compass.db`입니다. `/data` 전체를 쓰기 가능한 영속 볼륨으로 마운트하고 `TOUR_API_KEY`는 이미지 빌드가 아니라 런타임 Secret으로 주입합니다.

동일 이미지를 fresh PVC용 initContainer로 사용할 때만 `RUN_DB_MIGRATIONS=1`, `SEED_DEMO_DATA=1`, `MIGRATE_ONLY=1`을 함께 설정합니다. initContainer는 체크섬 고정 SQLite migration runner로 SQL을 트랜잭션 적용한 뒤 번들된 데모 시드를 한 번 적용합니다. 기존 데모에서는 no-op이고 다른 데이터가 있는 DB에는 삽입을 거부합니다. 앱 Pod에는 이 플래그를 주입하지 않으므로 재시작 때 migration·seed를 실행하지 않습니다. production 이미지에는 Prisma CLI와 다른 개발 의존성을 포함하지 않습니다.

SQLite 배포는 `replicas: 1`, `Recreate` 전략, RWO PVC를 사용해야 합니다. 다중 replica가 필요하면 PostgreSQL로 전환합니다. Kubernetes에서 root filesystem을 읽기 전용으로 설정할 경우 `/data`는 PVC, `/tmp`와 `/app/.next/cache`는 `emptyDir`로 제공합니다.
