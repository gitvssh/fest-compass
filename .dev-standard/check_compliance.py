#!/usr/bin/env python3
"""dev-standard 컴플라이언스 게이트 (결정론적, 구조적 사실만).

각 소비 리포에 `.dev-standard/check_compliance.py`로 복사되어 pre-commit / CI에서 실행된다.
읽는 정책: `.dev-standard/required-structure.yaml` (같은 폴더).

원칙:
- 구조적 사실만 검사(파일 존재/패턴/enum 중복). 산문 품질은 검사하지 않는다.
- severity=warn 이면 위반이 있어도 exit 0(경고만). severity=error 이면 위반 시 exit 1.
- 의존성 없음: pyyaml이 있으면 쓰고, 없으면(폐쇄망) 최소 파서로 fallback.

실행: python3 .dev-standard/check_compliance.py [--root .] [--json]
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent               # <repo>/.dev-standard
SPEC = HERE / "required-structure.yaml"


def _load_spec(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore
        return yaml.safe_load(text) or {}
    except Exception:
        return _minimal_parse(text)


def _minimal_parse(text: str) -> dict:
    """우리가 저작한 고정 형태만 파싱하는 fallback.

    severity, required_paths, decision_records 일부만 지원한다.
    """
    spec: dict = {"required_paths": [], "decision_records": {}}
    m = re.search(r'^severity:\s*"?(\w+)"?', text, re.M)
    if m:
        spec["severity"] = m.group(1)
    # required_paths: 아래의 '- path: "X"' 라인들
    in_rp = False
    for line in text.splitlines():
        if re.match(r'^required_paths:\s*$', line):
            in_rp = True
            continue
        if in_rp:
            if re.match(r'^\S', line):  # 다음 top-level 키 → 종료
                in_rp = False
            else:
                pm = re.search(r'-\s*path:\s*"([^"]+)"', line)
                if pm:
                    spec["required_paths"].append({"path": pm.group(1)})
    dr = {}
    for key in ("dir", "id_pattern", "filename_pattern", "index"):
        km = re.search(rf'^\s+{key}:\s*"([^"]+)"', text, re.M)
        if km:
            dr[key] = km.group(1)
    em = re.search(r'^\s+status_enum:\s*\[([^\]]*)\]', text, re.M)
    if em:
        dr["status_enum"] = [s.strip().strip('"') for s in em.group(1).split(",") if s.strip()]
    spec["decision_records"] = dr
    return spec


def _read_frontmatter(path: Path) -> dict:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return {}
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    fm = {}
    for line in text[3:end].splitlines():
        m = re.match(r'^([A-Za-z_][\w-]*):\s*(.*)$', line.strip())
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return fm


def check(root: Path) -> list:
    spec = _load_spec(SPEC)
    violations = []  # (severity, message)

    # 1) 필수 경로 존재
    for entry in spec.get("required_paths", []):
        p = entry.get("path") if isinstance(entry, dict) else entry
        if not p:
            continue
        target = root / p
        ok = target.is_dir() if p.endswith("/") else target.exists()
        if not ok:
            reason = entry.get("reason", "") if isinstance(entry, dict) else ""
            violations.append(("required_path", f"필수 경로 없음: {p} — {reason}"))

    # 2) 결정 기록 규칙 (있을 때만 best-effort)
    dr = spec.get("decision_records", {}) or {}
    dr_dir = root / dr.get("dir", "docs/decisions/")
    if dr_dir.is_dir():
        id_pat = re.compile(dr.get("id_pattern", r"^(ADR|CIR)-[0-9]{4}$"))
        fn_pat = re.compile(dr.get("filename_pattern", r"^[0-9]{4}-[a-z0-9-]+\.md$"))
        status_enum = set(dr.get("status_enum", []))
        seen = {}
        # v0.3.2: 하위 폴더(adr/, cir/ 등)까지 재귀 검사 — ID 중복은 트리 전체에서 유일해야 한다
        for f in sorted(dr_dir.rglob("*.md")):
            if f.name.lower() == "readme.md":
                continue
            if not fn_pat.match(f.name):
                violations.append(("decision_filename", f"결정 파일명 규칙 위반: {f.name}"))
            fm = _read_frontmatter(f)
            fid, status = fm.get("id"), fm.get("status")
            if fid and not id_pat.match(fid):
                violations.append(("decision_id", f"결정 ID 형식 위반: {fid} ({f.name})"))
            if status_enum and status and status not in status_enum:
                violations.append(("decision_status", f"결정 status enum 밖: {status} ({f.name})"))
            if fid:
                seen.setdefault(fid, []).append(f.name)
        for fid, files in seen.items():
            if len(files) > 1:
                violations.append(("decision_dup", f"결정 ID 중복: {fid} → {files}"))

    # 3) front-matter 필수 필드 (Current/SSOT 문서)
    rf = spec.get("required_frontmatter", {}) or {}
    if rf:
        glob = rf.get("applies_to_glob", "docs/**/*.md")
        classes = set(rf.get("when_class_in", []))
        fields = rf.get("fields", [])
        for f in sorted(root.glob(glob)):
            if not f.is_file():
                continue
            fm = _read_frontmatter(f)
            if fm.get("class") in classes:
                missing = [x for x in fields if x not in fm]
                if missing:
                    rel = f.relative_to(root)
                    violations.append(("frontmatter", f"front-matter 필드 누락 {missing}: {rel}"))

    return violations


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    root = Path(args.root).resolve()
    spec = _load_spec(SPEC)
    severity = spec.get("severity", "warn")
    violations = check(root)

    if args.json:
        payload = {
            "severity": severity,
            "violations": [{"kind": k, "msg": m} for k, m in violations],
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        if not violations:
            print("dev-standard: 컴플라이언스 통과")
        else:
            head = "위반(차단)" if severity == "error" else "경고(비차단)"
            print(f"dev-standard: {head} — {len(violations)}건 [severity={severity}]")
            for k, m in violations:
                print(f"  - [{k}] {m}")

    if violations and severity == "error":
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
