// Bounded, manual source refresh for the reviewed Imsil 2025 pilot.
// Uses visible public UI and its own JSON chart responses; no login, private cookies, or download endpoint.
// Writes a NEW candidate directory, never replaces reviewed application data.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--out' || !args[1]) throw new Error('Usage: node scripts/capture-datalab-visitor-profile.mjs --out <new-candidate-directory>');
const dir = resolve(args[1]);
await mkdir(dirname(dir), { recursive: true });
await mkdir(dir); // EEXIST is intentional: never overwrite an earlier capture.
await mkdir(join(dir, 'original'));
const base = 'https://datalab.visitkorea.or.kr', officialPage = base + '/datalab/portal/fes/getFesDataForm.do';
const qids = { FE_01_01_004_00: 'destinations', FE_01_01_005: 'trend', FE_01_01_006: 'demographics' };
const pending = [], records = new Map();
let selectedId;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(45000);
page.on('response', response => {
  const req = response.request(), url = new URL(response.url());
  if (url.origin !== base) return;
  let kind, parameters;
  if (url.pathname === '/visualize/getTempleteData.do') {
    parameters = Object.fromEntries(new URLSearchParams(req.postData()));
    kind = qids[parameters.qid];
    if (!kind || parameters.FSTV_ID !== selectedId || parameters.BASE_YY1 !== '2025' || parameters.BASE_YY2 !== '2025') return;
  } else if (url.pathname.endsWith('/getFesList.do')) {
    try { parameters = JSON.parse(req.postData()); } catch { return; }
    if (parameters.fesNm !== '임실') return;
    kind = 'festival-list';
  } else if (url.pathname.endsWith('/getFesInfoList.do')) {
    try { parameters = JSON.parse(req.postData()); } catch { return; }
    if (parameters.fstvId !== selectedId) return;
    kind = 'festival-periods';
  } else return;
  // Rejections are observed immediately and checked after all relevant responses settle.
  pending.push((async () => {
    assert.equal(response.status(), 200);
    const body = await response.body();
    const parsed = JSON.parse(body.toString('utf8'));
    assert.ok(parsed && typeof parsed === 'object');
    const path = `original/${kind}.json`;
    await writeFile(join(dir, path), body, { flag: 'wx' });
    records.set(kind, { kind, path, url: response.url(), method: req.method(), parameters, status: response.status(), retrievedAt: new Date().toISOString(), bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
  })().then(() => null, error => ({ error })));
});

try {
  await page.goto(officialPage, { waitUntil: 'domcontentloaded' });
  await page.locator('#area-select').click();
  await page.locator('#fesNm').fill('임실');
  await page.locator('#fesNm').press('Enter');
  await page.getByRole('link', { name: '임실N치즈축제', exact: true }).click();
  selectedId = await page.locator('#fstvId').inputValue();
  assert.equal(selectedId, 'KCTF0061');
  await page.locator('#srchBgngYear1').selectOption('2025');
  await page.locator('#srchEndYear1').selectOption('2025');
  await page.getByRole('button', { name: '조회', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#age_gender_BASE_YEAR')?.value === '2025' && document.querySelector('#rank_table_BASE_YEAR')?.value === '2025');
  await page.waitForFunction(() => document.querySelectorAll('#outer_rank_table_list tbody tr').length > 0);
  const until = Date.now() + 45000;
  while (records.size < 5 && Date.now() < until) {
    const results = await Promise.all(pending);
    if (results.some(r => r?.error)) throw new Error('Public chart capture failed; candidate not published');
    await new Promise(r => setTimeout(r, 250));
  }
  const results = await Promise.all(pending);
  assert.equal(results.some(r => r?.error), false, 'capture errors');
  assert.equal(records.size, 5, 'all five public responses are required');
  const scope = await page.evaluate(() => ({ name: document.querySelector('#area-select').textContent.trim(), festivalId: document.querySelector('#fstvId').value, startYear: document.querySelector('#srchBgngYear1').value, endYear: document.querySelector('#srchEndYear1').value, demographicYear: document.querySelector('#age_gender_BASE_YEAR').value, residenceYear: document.querySelector('#festivalMap_BASE_YEAR').value, destinationYear: document.querySelector('#rank_table_BASE_YEAR').value }));
  assert.equal(scope.startYear, '2025'); assert.equal(scope.endYear, '2025');
  await page.locator('#chart_05').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#chart_05 svg')?.textContent.includes('60~69'));
  await page.locator('#chart_05').screenshot({ path: join(dir, 'demographics.png') });
  const manifest = { schemaVersion: 1, page: officialPage, headless: true, method: 'public page UI and its own chart responses; no login or download endpoint', scope, residenceVisible: await page.locator('#festivalMap_BASE_YEAR').isVisible(), observation: { year: 2025, start: '2025-10-08', end: '2025-10-12', days: 5, areaCode: '52750340', areaName: '임실군 성수면', regionCode: '52750' }, records: [...records.values()] };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ candidate: dir, responses: records.size, festivalId: selectedId, year: 2025 }));
} finally { await browser.close(); }
