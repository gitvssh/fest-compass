// Real official responses + independently read persisted observations. No response mocking or fabricated visits.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const base = process.env.E2E_BASE_URL, source = process.env.SOURCE_DATA_DIR;
if (!base || !source) throw Error("E2E_BASE_URL and SOURCE_DATA_DIR required");
const output = resolve(process.env.LIVE_OUTPUT_DIR || "output/unified-live"); mkdirSync(output,{recursive:true});
const envelope = JSON.parse(readFileSync(join(source,"national/months/2025-09.json"),"utf8"));
assert.equal(createHash("sha256").update(JSON.stringify(envelope.payload)).digest("hex"),envelope.checksum);
const month = envelope.payload;
const samples = [
  {id:"531391",code:"51150",p:"51",d:"150",name:"강릉단오제",district:"강릉시"},
  {id:"506670",code:"47170",p:"47",d:"170",name:"안동국제탈춤페스티벌",district:"안동시"},
  {id:"767114",code:"12770",p:"12",d:"770",name:"정남진 장흥 물축제",district:"장흥군"},
  {id:"667418",code:"50110",p:"50",d:"110",name:"제주들불축제",district:"제주시"},
];
const json = async path => { const r=await fetch(`${base}${path}`); assert.equal(r.status,200,path);return r.json(); };
const report={base,headless:true,mockedResponses:0,samples:[],browserErrors:[],appWrites:[],checks:[]};
for(const s of samples){
 const id=`current:${s.code}:${s.id}`;
 const record=await json(`/api/existing/festivals?${new URLSearchParams({id})}`);
 assert.equal(record.current.items[0].name,s.name);assert.equal(record.current.items[0].region.code,s.code);
 assert.equal(record.current.items[0].linkedArchiveId,null);
 const query=new URLSearchParams({province:s.p,district:s.d,year:"2025"});
 const data=await json(`/api/existing/monthly?${query}`);
 const values=month.series[s.code];assert.equal(values.length,30);
 const points=data.daily.filter(x=>x.date.startsWith("2025-09"));
 assert.deepEqual(points.map(x=>x.value),values);
 assert.equal(data.months[8].mean,values.reduce((a,b)=>a+b,0)/30);
 const newData=await json(`/api/new/visits?${query}`);
 assert.deepEqual(newData.months,data.months);
 assert.ok(!/snapshotId|bodyHash|backfill|TOUR_API_KEY/.test(JSON.stringify(data)));
 report.samples.push({...s,firstDay:values[0],septemberMean:data.months[8].mean,observed2025:data.years.find(y=>y.year===2025).observedDays,registeredPeriods:record.current.items[0].periods?.length??0});
}
const currentHistory=await json('/api/existing/history?festival=current%3A52750%3A2031318');
const archiveHistory=await json('/api/existing/history?festival=archive%3Aimsil-cheese');
assert.deepEqual(currentHistory.editions,archiveHistory.editions);
assert.deepEqual(currentHistory.visitorProfile,archiveHistory.visitorProfile);
report.checks.push("current-archive-identical-editions-and-profile","four-unseen-festivals-exact-30-daily-values-and-monthly-mean","new-festival-shares-observations");
const split=await json('/api/existing/monthly?province=28&district=275&year=2026');
assert.equal(split.months[0].mean,null);assert.ok(split.months[7].observedDays>0);
if(split.months[7].observedDays<split.months[7].days)assert.equal(split.months[7].mean,null);
report.checks.push("new-incheon-district-has-own-observations-without-invented-past");
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"ko-KR"});
 const page=await context.newPage();page.setDefaultTimeout(30000);
 page.on("pageerror",e=>report.browserErrors.push(e.message));
 page.on("request",r=>{if(r.method()!=="GET"&&new URL(r.url()).pathname.startsWith('/api/'))report.appWrites.push(r.method()+" "+new URL(r.url()).pathname);});
 for(const s of samples){
  await page.goto(`${base}/existing/search?${new URLSearchParams({q:s.name})}`);
  const reject=page.getByRole("button",{name:"거부",exact:true}); if(await reject.count())await reject.click();
  const href=`/existing/${encodeURIComponent(`current:${s.code}:${s.id}`)}/visits`;
  await page.locator(`a[href="${href}"]`).click();
  await page.getByRole("heading",{level:1,name:s.name,exact:true}).waitFor();
  await page.getByRole("heading",{name:`2025년 ${s.district} 월별 외지인 방문`,exact:true}).waitFor();
  await page.getByRole("button",{name:"9월",exact:true}).click();
  await page.getByRole("img",{name:`2025년 9월 ${s.district} 일별 외지인 방문 선그래프`,exact:true}).waitFor();
  assert.ok((await page.locator("main").innerText()).includes(month.series[s.code][0].toLocaleString("ko-KR",{maximumFractionDigits:3})));
  await page.screenshot({path:join(output,`${s.code}-visits-desktop.png`),fullPage:true});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${s.code}:${width}`);
  }
  await page.screenshot({path:join(output,`${s.code}-visits-mobile.png`),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  const res=page.waitForResponse(r=>r.url().includes('/api/existing/resources?')&&r.status()===200);
  await page.getByRole("navigation",{name:"축제 탐색 메뉴"}).getByRole("link",{name:"주변 관광자원",exact:true}).click();
  const resourceBody=await(await res).json();assert.ok(resourceBody.byType.some(b=>b.status==='complete'&&b.items.length>0));
  await page.getByRole("heading",{name:`${s.district} 전체 주변 관광자원`,exact:true}).waitFor();
  await page.getByRole("navigation",{name:"축제 탐색 메뉴"}).getByRole("link",{name:"개최 시기",exact:true}).click();
  await page.getByRole("heading",{name:`2025년 ${s.district} 월별 외지인 방문`,exact:true}).waitFor();
 }
 await page.goto(`${base}/existing/current%3A52750%3A2031318/visits`);
 await page.getByRole("heading",{level:1,name:"임실N치즈축제",exact:true}).waitFor();
 await page.getByRole("heading",{name:/방문자 특성/}).first().waitFor();
 assert.ok(new URL(page.url()).pathname.includes('current'));
 await page.screenshot({path:join(output,"linked-imsil.png"),fullPage:true});
 report.checks.push("real-search-to-all-three-views-four-regions","320-390-1440-no-page-overflow","reviewed-history-inline-keeps-current-identity");
 assert.deepEqual(report.browserErrors,[]);assert.deepEqual(report.appWrites,[]);
 await context.close();
} finally {await browser.close();writeFileSync(join(output,"report.json"),JSON.stringify(report,null,2)+"\n");}
console.log(JSON.stringify(report));
