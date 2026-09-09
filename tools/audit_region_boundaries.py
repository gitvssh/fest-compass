"""Audit a pinned public SGIS archive offline; never authorise a spatial join.

python3 tools/audit_region_boundaries.py --archive /path/to/sgis-2025.zip
Only the reviewed archive is accepted. No network, extraction, or app data writes.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct
import zipfile

ARCHIVE_SHA256 = "f1cf0f9de453ac7eaacb273f39cee52851183372b9ddfda428a967c3a670b2c6"
ROOT = Path(__file__).resolve().parents[1]


def digest_file(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read_dbf(data):
    """Read the pinned archive's UTF-8 character-only DBF tables strictly."""
    count = struct.unpack_from("<I", data, 4)[0]
    header, size = struct.unpack_from("<HH", data, 8)
    if header < 33 or (header - 33) % 32 or data[header - 1] != 13:
        raise ValueError("Invalid DBF header")
    fields, offset = [], 1
    for pos in range(32, header - 1, 32):
        field = data[pos:pos + 32]
        if field[11] != ord("C"):
            raise ValueError("Only character fields are supported")
        name = field[:11].split(b"\0")[0].decode("ascii")
        fields.append((name, offset, field[16]))
        offset += field[16]
    if offset != size or len(data) < header + count * size:
        raise ValueError("Truncated or inconsistent DBF")
    rows = []
    for index in range(count):
        record = data[header + index * size:header + (index + 1) * size]
        if record[0] != ord(" "):
            raise ValueError("Deleted/invalid DBF record")
        rows.append({name: record[start:start + length].decode("utf-8").strip()
                     for name, start, length in fields})
    return rows


def classify(row, provinces, districts):
    # Names generate review candidates only. Never concatenate KTO codes,
    # infer renamed areas, or match a common district name across provinces.
    province_codes = [p["SIDO_CD"] for p in provinces
                      if p["SIDO_NM"] == row["provinceName"]]
    scoped = [d for d in districts if d["SIGUNGU_CD"][:2] in province_codes]
    exact = [d for d in scoped if d["SIGUNGU_NM"] == row["districtName"]]
    children = [d for d in scoped
                if d["SIGUNGU_NM"].startswith(row["districtName"] + " ")]
    if len(exact) == 1 and len(province_codes) == 1:
        status, candidates = "name-candidate", exact
    elif exact or len(province_codes) > 1:
        status, candidates = "ambiguous", exact
    elif children:
        status, candidates = "aggregate-candidate", children
    else:
        status, candidates = "unresolved", []
    return {**row, "status": status, "joinAllowed": False,
            "sgisCandidates": [{"code": d["SIGUNGU_CD"], "name": d["SIGUNGU_NM"]}
                               for d in candidates]}


def audit(archive, catalogue):
    archive_hash = digest_file(archive)
    if archive_hash != ARCHIVE_SHA256:
        raise ValueError("Unreviewed archive SHA-256; inspect new source before changing the pin")
    with zipfile.ZipFile(archive) as source:
        tables, members = {}, []
        for level, expected_count in (("sido", 17), ("sigungu", 252)):
            suffix = f"bnd_{level}_00_2025_2Q"
            for ext in ("dbf", "cpg", "prj", "shp", "shx"):
                matches = [n for n in source.namelist() if n.endswith(f"/{suffix}.{ext}")]
                if len(matches) != 1:
                    raise ValueError(f"Missing/duplicate {suffix}.{ext}")
                name = matches[0]
                with source.open(name) as stream:
                    digest = hashlib.file_digest(stream, "sha256").hexdigest()
                members.append({"path": name, "bytes": source.getinfo(name).file_size,
                                "sha256": digest})
                if ext == "cpg" and source.read(name).decode().strip() != "UTF-8":
                    raise ValueError("Unexpected DBF encoding")
                if ext == "dbf":
                    tables[level] = read_dbf(source.read(name))
            rows = tables[level]
            code = "SIDO_CD" if level == "sido" else "SIGUNGU_CD"
            if len(rows) != expected_count or len({r[code] for r in rows}) != expected_count:
                raise ValueError("Unexpected count or duplicate codes")
            if any(r["BASE_DATE"] != "20250630" for r in rows):
                raise ValueError("Unexpected boundary date")
    kto = json.loads(catalogue.read_text())
    result = [classify(r, tables["sido"], tables["sigungu"]) for r in kto["rows"]]
    return {
        "schemaVersion": 1,
        "source": "https://www.data.go.kr/data/15129688/fileData.do",
        "boundaryDate": "2025-06-30", "statisticsYear": 2024,
        "archiveSha256": archive_hash, "archiveBytes": archive.stat().st_size,
        "sourceCrs": "EPSG:5179", "geometryValidated": False,
        "note": "명칭 대조 후보이며 공식 코드 연계·공간 동일성 검증 결과가 아님. 지도 연결 금지.",
        "catalogue": {"source": kto["source"], "collectedAt": kto["collectedAt"],
                      "fileSha256": digest_file(catalogue), "rows": len(result)},
        "counts": dict(sorted(Counter(r["status"] for r in result).items())),
        "verifiedJoins": 0, "members": members,
        "provinces": tables["sido"], "districts": tables["sigungu"], "rows": result,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--catalogue", type=Path,
                        default=ROOT / "apps/web/data/region-catalogue.json")
    args = parser.parse_args()
    print(json.dumps(audit(args.archive, args.catalogue), ensure_ascii=False, indent=2))
