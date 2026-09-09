---
class: Current
owner: fest-compass
last_verified: 2026-09-09
version: v1
summary: "공식 SGIS 2025 경계 원본을 확보하고 관광조회 지역 269개와 대조했습니다. 원본 점검·오연결 방지 시험은 통과했으며 지도 형상·공식 연계·화면 연결은 아직 검증하지 않았습니다."
---

# 행정경계 원본·지역 코드 대조

**원본 확보와 명칭 대조 도구는 사용 가능하다. 지도 연결은 개발 필요다.**
결과와 적용 기준은 [경계 연결 설계](../sdlc/2-design/region-boundary-contract.md)에 정리했다.
앱 실행 코드·지도 표시·예측·수집·운영 이미지에는 변경이 없다.

## 원본과 재현

- [공공데이터포털 공식 원본](https://www.data.go.kr/data/15129688/fileData.do), 확인일 2026-09-09.
- 일반 파일 다운로드 절차에서 `needCaptcha=false` 확인 후 다운로드했다. 새 계정·키 발급 없이 공개 파일을 받았다.
- ZIP 269,032,521바이트, SHA-256 `f1cf0f9de453ac7eaacb273f39cee52851183372b9ddfda428a967c3a670b2c6`.
- 원본 ZIP은 저장소에 넣지 않고 로컬 캐시에 보관한다. 다른 환경에서는 공식 원본을 내려받아 아래 경로로 지정한다.
- 고정 해시와 다른 원본은 거부한다. 공급자가 갱신하면 새 원본·연도·필드를 검토한 뒤 핀을 변경한다.

```bash
python3 tools/audit_region_boundaries.py --archive /path/to/sgis-2025.zip > /tmp/region-boundary-audit.json
python3 -m unittest tools.test_audit_region_boundaries
```

결과 정본: `docs/validation/evidence/2026-09-09-region-boundary-audit.json`.
시도·시군구 원문 속성, 구성 파일 10개 SHA-256, 관광조회 목록 해시·수집일과 269개 후보를 담는다.
`joinAllowed=false`, `verifiedJoins=0`, `geometryValidated=false`로 미확인 상태를 보존한다.

## 실행 결과

| 검사 | 결과 |
|---|---|
| ZIP 해시·시도/시군구 구성 파일 | 고정 원본 일치, DBF·CPG·PRJ·SHP·SHX 각 2개 |
| DBF 형식·문자·기준일·코드 유일성 | UTF-8, 20250630, 시도 17·시군구 252 확인 |
| 관광조회 목록 대조 | 269개 = 명칭 일치 후보 221 + 합성 후보 12 + 미연결 36 |
| 자동 지도 연결 허용 | 0개 |
| 오연결 방지 단위 시험 | 6개 통과: 숫자 코드 충돌, 다른 시도 동명 구, 일반시 합성, 새 행정구, 중복 후보, 잘못된 DBF |
| 형상·공식 코드 연계·현재 영역 동일성 | 미실행·미확인 |
| 새 경계 UI·앱 전체 회귀·배포 | 앱 변경이 없어 미실행. 기존 지도 검증은 26번 기록의 범위에만 유효 |

후속은 공식 연계 근거 확보→표본 형상 검증→지도 연결이며, 후보 수를 검증된 지도 제공률로 표시하지 않는다.
