# WSL 개발환경

2026-09-07 기준 저장소를 `/mnt/c/dev/2026공모전`에서
`/home/lsh/dev/side/fest-compass`로 복제했다. Windows 원본과 기존 자료는 보존한다.
Linux 명령은 Linux 파일시스템 안에서 실행한다
([Microsoft 안내](https://learn.microsoft.com/en-us/windows/wsl/filesystems)).

## 작업 위치

- 기준 저장소: `~/dev/side/fest-compass`
- 수정 작업: `~/dev/worktrees/fest-compass-<topic>`의 전용 브랜치. 생성 전에 coordination lease를 확보한다.
- 병합 후 작업공간이 깨끗하고 브랜치 병합이 확인되면 worktree·브랜치·lease를 같은 세션에 정리한다.
- 프로젝트 목표·현재 상태: `.ai/projects/fest-compass-evolution/`.

## 로컬 실행

앱 디렉터리에서 저장소 `.nvmrc`에 맞춘 Node를 사용한다. 전역 기본 Node는 바꾸지 않는다.

```bash
cd ~/dev/side/fest-compass/apps/web
source ~/.nvm/nvm.sh
nvm install
npm ci
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

`.env`는 Git에 올리지 않고 파일 권한 0600으로 유지한다. 이번 이전에서는 기존 설정을
비출력 경로로 복사했다. 이후 첫 실호출에서 기존 Windows 키가 403/code 30으로 거부되어,
기존 앱 runtime Secret의 같은 필드만 비출력 경로로 읽어 WSL 설정을 동기화했고 실호출 성공을 확인했다.
제공자 키 신규 발급·회전이나 운영 Secret 변경은 수행하지 않았다.
새 작업공간은 `.env.example` 또는 승인된 기존 로컬 설정으로 준비한다.
Windows의 `node_modules`, `.next`, SQLite 파일은 개발환경 설치 재료로 복사하지 않는다.
시드 실행은 새 빈 로컬 DB에서만 한다.

## 검증

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

E2E는 별도 SQLite와 자유 loopback 포트를 사용한다. 앱 DB를 재설정하지 않는다.
기존 `output/` 산출물은 기준 저장소에 보존하고, 새 조사 결과는 프로젝트 문서로 요약한다.
