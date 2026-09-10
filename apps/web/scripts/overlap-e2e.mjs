import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.E2E_BASE_URL;if(!base)throw new Error('E2E_BASE_URL required');
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1100},locale:'ko-KR'}),page=await context.newPage();
const errors=[],writes=[],requests=[],passed=[];let fail=false,hold=false,release;
page.setDefaultTimeout(15_000);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin===new URL(base).origin&&!['GET','HEAD'].includes(r.method())&&!r.url().includes('/cdn-cgi/'))writes.push(r.url());});
await context.route('**/api/regions?*',async route=>{
 const q=Object.fromEntries(new URL(route.request().url()).searchParams);requests.push(q);
 if(hold){hold=false;await new Promise(resolve=>{release=resolve;});}
 const all=[['1001','계속 열리는 행사 (가상)','2026-09-01','2026-10-03'],['1002','이미 끝난 행사 (가상)','2026-09-01','2026-10-02'],['1003','마지막 날 시작 (가상)','2026-10-05','2026-10-06']];
 const items=all.filter(([, ,start,end])=>start<=q.end&&end>=q.start).map(([id,title,start,end])=>({id,title,start,end,address:'가상 주소',longitude:null,latitude:null,modifiedAt:null}));
 try{await route.fulfill({json:{query:q,region:{provinceCode:q.province,districtCode:q.district,provinceName:'충청남도',districtName:q.district==='150'?'공주시':'논산시'},resources:{status:fail?'unavailable':'complete',message:fail?'시험용 조회 실패':'전체 페이지 확인 완료 (가상)',items:fail?[]:items,total:fail?null:items.length,pages:1,collectedAt:'2026-09-10T00:00:00Z',source:'https://www.data.go.kr/data/15101578/openapi.do'},history:{status:'unavailable',points:[]}}});}catch{/* aborted obsolete request */}
});
const button=name=>page.getByRole('button',{name,exact:true});
const found=page.getByRole('region',{name:'회차 검색 결과'});
async function count(n){await found.getByRole('heading',{name:`현재 조회한 등록 행사 · ${n}건`,exact:true}).waitFor();await page.getByText('등록 행사의 전체 페이지를 지역별로 조회하고 있습니다…',{exact:true}).waitFor({state:'hidden'});}
try{
 mkdirSync('output/playwright',{recursive:true});
 await page.goto(`${base}/compare?province=44&district=230&mode=current&start=2026-10-03&end=2026-10-05&dateRule=starts-within`);
 const reject=page.getByRole('button',{name:/^(Reject All|모두 거부|Reject all)$/});if(await reject.isVisible())await reject.click();
 await count(1);assert.equal(await found.getByRole('heading',{name:'계속 열리는 행사 (가상)',exact:true}).count(),0);passed.push('legacy-starts-within');
 await page.getByLabel('일정 검색 방식',{exact:true}).selectOption('overlap');await button('등록 행사 조회').click();await count(2);
 assert.equal(requests.at(-1).start,'2026-10-03');await found.getByRole('heading',{name:'계속 열리는 행사 (가상)',exact:true}).waitFor();assert.equal(await found.getByText('이미 끝난 행사 (가상)',{exact:true}).count(),0);passed.push('continuing-boundary-day-and-ended-filter');
 await found.getByText(/제공처 조회 2건/).waitFor();await found.getByText(/기획 기간 내 2026-10-03 ~ 2026-10-03 \(1일\)/).waitFor();passed.push('provider-total-and-overlap-chart');
 await button('2026 계속 열리는 행사 (가상) 비교에 추가').click();await page.getByLabel('일정 검색 방식',{exact:true}).selectOption('starts-within');await button('등록 행사 조회').click();await count(1);
 await button('선택 회차와 비교 조건 담기').click();await page.getByText(/축제 비교를 기획 근거에 담았습니다/).waitFor();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('fest-compass.comparison-evidence.v1')).items[0]);assert.equal(stored.editions[0].discoveredWith.dateRule,'overlap');assert.equal(stored.editions[0].discoveredWith.start,'2026-10-03');assert.equal(stored.context.dateRule,'starts-within');passed.push('selected-original-context-after-new-search');
 await page.goto(`${base}/evidence#comparisons`);await page.getByText('당시 비교 그래프·수치·출처 보기',{exact:true}).click();await page.getByRole('heading',{name:'기획 기간과 겹치는 등록 일정',exact:true}).waitFor();
 await page.getByText(/기획 기간 내 2026-10-03 ~ 2026-10-03 \(1일\)/).waitFor();passed.push('saved-scope-chart-and-limit');
 await page.getByRole('link',{name:'이 비교 근거로 후보 기획 →',exact:true}).click();await page.getByText('연결 전 당시 값·출처 확인',{exact:true}).click();await page.getByRole('heading',{name:'기획 기간과 겹치는 등록 일정',exact:true}).waitFor();await page.getByText(/기획 기간 내 2026-10-03 ~ 2026-10-03 \(1일\)/).waitFor();passed.push('planning-retains-original-overlap-chart');
 await page.goto(`${base}/compare?province=44&district=230&mode=current&start=2026-10-03&end=2026-10-05&dateRule=starts-within`);await count(1);await page.getByLabel('일정 검색 방식',{exact:true}).selectOption('overlap');
 await page.getByLabel('겹치는 기간 시작',{exact:true}).fill('2024-01-01');const before=requests.length;await button('등록 행사 조회').click();await page.getByRole('alert').filter({hasText:'최대 366일'}).waitFor();assert.equal(requests.length,before);passed.push('over-limit-no-request');
 await page.getByLabel('겹치는 기간 시작',{exact:true}).fill('2026-10-03');fail=true;await button('등록 행사 조회').click();await count(0);await found.getByText(/시험용 조회 실패/).waitFor();await found.getByText(/실제 행사 없음·미개최를 뜻하지 않습니다/).waitFor();passed.push('failed-region-not-zero-claim');
 fail=false;hold=true;await button('등록 행사 조회').click();for(let i=0;i<100&&!release;i++)await page.waitForTimeout(20);assert.ok(release);await button('출처가 있는 과거 회차').click();release();await found.getByRole('heading',{name:/보관 출처에서 찾은 회차/}).waitFor();assert.equal(await found.getByRole('heading',{name:'계속 열리는 행사 (가상)',exact:true}).count(),0);passed.push('late-current-response-after-mode-switch');
 await page.goto(`${base}/compare?province=44&district=230&mode=current&start=2026-10-03&end=2026-10-05&dateRule=starts-within`);await count(1);await page.getByLabel('일정 검색 방식',{exact:true}).selectOption('overlap');await button('등록 행사 조회').click();await count(2);
 await page.screenshot({path:'output/playwright/overlap-desktop-test.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:'output/playwright/overlap-mobile-test.png',fullPage:true});passed.push('390px-range-chart');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const result={checkedAt:new Date().toISOString(),headless:true,data:'synthetic current festival responses',passed,errors,writes};writeFileSync('output/playwright/overlap-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){console.error(JSON.stringify({passed,requests,errors,error:String(e)}));await page.screenshot({path:'output/playwright/overlap-failure.png',fullPage:true});throw e;}finally{release?.();await browser.close();}
