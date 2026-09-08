// Explicit maintainer refresh. API credentials remain in the server environment.
import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
const hash = b => createHash("sha256").update(b).digest("hex");
const destination = new URL("../data/", import.meta.url);
const input = process.argv[2];
if (!input) throw new Error("Pass the directory containing reviewed ldongCode2.json and country.json responses.");
const raw = await readFile(`${input}/ldongCode2.json`, "utf8"), body = JSON.parse(raw).response;
if (body.header.resultCode !== "0000" || body.body.totalCount !== body.body.items.item.length) throw new Error("Incomplete region catalogue");
const rows = body.body.items.item.map(r => ({ provinceCode: r.lDongRegnCd, provinceName: r.lDongRegnNm, districtCode: r.lDongSignguCd, districtName: r.lDongSignguNm }));
if (new Set(rows.map(r => `${r.provinceCode}:${r.districtCode}`)).size !== rows.length) throw new Error("Duplicate region code");
await writeFile(new URL("region-catalogue.json", destination), JSON.stringify({ source: "https://www.data.go.kr/data/15101578/openapi.do", endpoint: "ldongCode2", collectedAt: (await stat(`${input}/ldongCode2.json`)).mtime.toISOString(), sourceSha256: hash(raw), note: "관광공사 조회 단위. 일반시와 행정구를 함께 포함하며 기초자치단체 수가 아님. 세종의 36110/36110은 원문 그대로 보존.", rows }, null, 2) + "\n");
const country = JSON.parse(await readFile(`${input}/country.json`, "utf8"));
// Longitude scaled at 36°N, latitude inverted. Keep every island and ring; no fabricated boundaries.
const project = ([lon, lat]) => [+(lon * Math.cos(36 * Math.PI / 180) * 100).toFixed(3), +(-lat * 100).toFixed(3)];
const path = country.feature.geometry.coordinates.flatMap(p => p.map(ring => ring.map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`).join("") + "Z")).join("");
await writeFile(new URL("korea-outline.json", destination), JSON.stringify({ source: country.url, sourceSha256: country.sourceSha256, license: "Public domain", licenseUrl: "https://www.naturalearthdata.com/about/terms-of-use/", purpose: "전국 탐색용 일반화 육지 윤곽. 행정경계·도로·장소 사용 가능 여부를 뜻하지 않음.", path }) + "\n");
console.log(`Prepared ${rows.length} KTO query regions and ${country.feature.geometry.coordinates.length} land polygons.`);
const seed = JSON.parse(gunzipSync(await readFile(new URL("forecast-seed.json.gz", destination))));
const datasets = seed.files.filter(f => f.path.startsWith("snapshots/")).map(f => {
  if (hash(f.content) !== f.hash) throw new Error("Corrupt history source");
  const d = JSON.parse(f.content);
  return { snapshotId: d.snapshotId, collectedAt: d.generatedAt, source: d.source, sourceSha256: f.hash, region: d.region,
    points: d.days.map(p => ({ date: p.date, quality: p.quality, value: p.quality === "complete" ? p.values["2"] : null })) };
});
await writeFile(new URL("region-history.json", destination), JSON.stringify(datasets) + "\n");
