import test from "node:test";
import assert from "node:assert/strict";
import raw from "../../data/datalab-region-profiles.json";
import festivalRaw from "../../data/datalab-festival-profiles.json";
import { parseFestivalProfiles } from "./festival-profiles";
import { defaultRegionProfiles, loadRegionProfiles, ORIGINS_SHOWN, parseRegionProfiles, RegionProfileDataError, regionProfileFor } from "./region-profiles";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
type Raw = typeof raw;
const mutate = (edit: (d: Raw) => void) => { const d = clone(raw); edit(d); return d; };

test("checked-in profiles parse: 26 regions, 27 festivals linked to reviewed festival IDs", () => {
  const p = parseRegionProfiles(raw), festivals = parseFestivalProfiles(festivalRaw).festivals.map(f => f.id);
  assert.equal(p.regions.length, 26);
  assert.deepEqual(defaultRegionProfiles, p);
  assert.equal(Object.keys(p.festivalRegions).length, 27);
  assert.equal(p.festivalRegions["daegu-yangnyeongsi"], "27110", "성내2동 is in 대구 중구");
  assert.deepEqual(["pyeongchang-trout", "pyeongchang-hyoseok"].map(id => p.festivalRegions[id]), ["51760", "51760"], "two festivals in one region");
  assert.ok(Object.keys(p.festivalRegions).every(id => festivals.includes(id)));
  assert.equal(p.festivalRegions["daegu-chimac"], undefined);
  assert.equal(p.festivalRegions["jangheung-water"], "12770");
  assert.equal(regionProfileFor(p, "27110")?.name, "중구");
  assert.equal(regionProfileFor(p, "44230"), null, "Nonsan has no DataLab region download");
});

test("ranks are computed within the province list; origins show the top ten and sum the rest", () => {
  const jangheung = regionProfileFor(parseRegionProfiles(raw), "12770")!;
  assert.deepEqual(jangheung.spending.rank, { position: 17, count: 22 });
  assert.deepEqual(jangheung.visitors!.rank, { position: 21, count: 22 });
  assert.equal(jangheung.visitors!.origins.length, ORIGINS_SHOWN);
  assert.equal(jangheung.visitors!.listed, 250);
  const listed = raw.regions.find(r => r.code === "12770")!.visitors!.origins;
  assert.equal(jangheung.visitors!.otherShare, Math.round(listed.slice(ORIGINS_SHOWN).reduce((n, o) => n + o.share, 0) * 10) / 10);
  assert.equal(regionProfileFor(parseRegionProfiles(raw), "28237")!.visitors, null);
});

test("the public projection carries original links but no paths, hashes or province values", () => {
  const text = JSON.stringify(parseRegionProfiles(raw));
  assert.ok(!/"(path|sha256|bytes|originalPath|manifestSha256|repository|commit|value)"/.test(text));
  assert.ok(regionProfileFor(parseRegionProfiles(raw), "12770")!.spending.links.trend.startsWith("https://github.com/travel-resolver/pick-d-day/blob/"));
});

test("malformed artifacts are rejected rather than coerced", () => {
  const r = (d: Raw) => d.regions.find(x => x.code === "12770")!;
  const cases: [unknown, RegExp][] = [
    [mutate(d => { (d as { kind: string }).kind = "other"; }), /kind/],
    [mutate(d => { d.source.officialUrl = "https://example.com/"; }), /official region page/],
    [mutate(d => { d.regions[1].code = d.regions[0].code; }), /unique/],
    [mutate(d => { r(d).code = "1277"; }), /5-digit/],
    [mutate(d => { r(d).spending.years.pop(); }), /reviewed years/],
    [mutate(d => { r(d).spending.industries.reverse(); }), /largest first/],
    [mutate(d => { r(d).spending.areas[0].share = 12.34; }), /one-decimal/],
    [mutate(d => { r(d).spending.province = r(d).spending.province.filter(x => x.name !== "장흥군"); }), /list the region once/],
    [mutate(d => { r(d).visitors!.origins.reverse(); }), /largest first/],
    [mutate(d => { delete (r(d).spending.sources as Record<string, unknown>)["업종별 지출액"]; }), /reviewed tables/],
    [mutate(d => { r(d).festivalIds.push("mokpo-port"); }), /linked twice/],
    [mutate(d => { r(d).range.to = 2024; }), /download range/],
  ];
  for (const [input, error] of cases) assert.throws(() => parseRegionProfiles(input), (e: unknown) => e instanceof RegionProfileDataError && error.test((e as Error).message), String(error));
});

test("an invalid artifact yields no region profiles and logs one fixed category", () => {
  const logs: string[] = [];
  assert.equal(loadRegionProfiles({ kind: "datalab-region-profiles" }, c => logs.push(c)), null);
  assert.deepEqual(logs, ["datalab-region-profiles: invalid-artifact"]);
});
