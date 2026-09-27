// Read-only official TourAPI sample. Never serialize upstream request URLs or credentials.
// node --env-file=apps/web/.env tools/probe-tourism-media.mjs [output.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

let key = process.env.TOUR_API_KEY?.trim();
if (!key) throw Error('TOUR_API_KEY is required');
try { key = decodeURIComponent(key); } catch { /* raw key */ }
const catalogue = JSON.parse(readFileSync('apps/web/data/region-catalogue.json', 'utf8'));
const region = catalogue.rows.find(r => r.districtName === '강릉시');
const source = 'https://www.data.go.kr/data/15101578/openapi.do';
async function call(operation, params) {
  const url = new URL(`https://apis.data.go.kr/B551011/KorService2/${operation}`);
  Object.entries({ serviceKey: key, MobileOS: 'ETC', MobileApp: 'pickDday', _type: 'json', pageNo: '1', numOfRows: '10', ...params })
    .forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { status: 'unavailable', http: response.status };
    const json = await response.json(), root = json.response ?? json;
    if (!['0000', '00'].includes(String(root.header?.resultCode))) return { status: 'unavailable' };
    const body = root.body, items = body?.items?.item;
    return { status: 'complete', total: body.totalCount, rows: Array.isArray(items) ? items : items ? [items] : [] };
  } catch { return { status: 'unavailable' }; }
}
const report = { checkedAt: new Date().toISOString(), source, method: '강릉 유형별 수정일순 첫10건; 임의추출·전국 제공률 아님', region: region.districtName, lists: [], details: [] };
for (const kind of ['12', '14', '39', '32']) {
  const list = await call('areaBasedList2', { arrange: 'C', lDongRegnCd: region.provinceCode, lDongSignguCd: region.districtCode, contentTypeId: kind });
  if (list.status !== 'complete') { report.lists.push({ kind, status: list.status }); continue; }
  const photos = list.rows.filter(row => !!row.firstimage);
  report.lists.push({ kind, total: list.total, sampled: list.rows.length, withPhoto: photos.length,
    withKnownLicense: photos.filter(row => ['Type1', 'Type3'].includes(row.cpyrhtDivCd)).length });
  const sample = photos[0];
  if (!sample) continue;
  const params = { contentId: String(sample.contentid) };
  const common = await call('detailCommon2', params);
  const gallery = await call('detailImage2', { ...params, numOfRows: '20' });
  const intro = await call('detailIntro2', { ...params, contentTypeId: kind });
  const row = common.rows?.[0];
  const detail = { kind, id: sample.contentid, title: sample.title, common: common.status, gallery: gallery.status,
    photoCount: gallery.total ?? null, photoLicenseTypes: [...new Set((gallery.rows ?? []).map(x => x.cpyrhtDivCd))],
    intro: intro.status, nonemptyIntroFields: Object.entries(intro.rows?.[0] ?? {}).filter(([, v]) => v !== null && String(v).trim()).map(([k]) => k),
    representative: row?.firstimage ?? null, license: row?.cpyrhtDivCd ?? null, imageGet: null };
  try {
    const url = new URL(row?.firstimage);
    if (url.hostname === 'tong.visitkorea.or.kr' && !url.username && !url.password) {
      url.protocol = 'https:';
      const image = await fetch(url, { signal: AbortSignal.timeout(15000) });
      detail.imageGet = { status: image.status, type: image.headers.get('content-type') };
      await image.body?.cancel();
    }
  } catch { detail.imageGet = { status: 'unavailable' }; }
  report.details.push(detail);
}
const output = resolve(process.argv[2] ?? 'docs/validation/evidence/2026-09-27-tourism-media-source.json');
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output, lists: report.lists, details: report.details.map(({ representative, ...rest }) => rest) }));
