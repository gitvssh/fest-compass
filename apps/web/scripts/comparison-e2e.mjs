import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";
const base=process.env.E2E_BASE_URL;
if(!base)throw new Error("E2E_BASE_URL required");
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},locale:"ko-KR"}),page=await context.newPage();
await mockMapTiles(context);
const errors=[],writes=[],key="fest-compass.comparison-evidence.v1";
page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()!=="GET"&&new URL(r.url()).origin===new URL(base).origin)writes.push(r.url());});
const visible=l=>l.waitFor({state:"visible"});
let delay=0;
// Explicit synthetic current events; archive schedules and 45 historical values are real product data.
await page.route("**/api/regions?*",async route=>{
  try{
    const response=await route.fetch(),data=await response.json();if(!response.ok())return route.fulfill({response});
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    data.resources={status:data.query.district==="150"?"unavailable":"complete",message:data.query.district==="150"?"검증용 공주 조회 실패":"검증용 현재 행사 전체 페이지 확인",total:data.query.district==="150"?null:1,pages:1,collectedAt:"2026-09-08T00:00:00Z",source:"https://www.data.go.kr/data/15101578/openapi.do",items:data.query.district==="150"?[]:[{id:data.query.district==="230"?"525292":"952988",title:`${data.region.districtName} 등록 행사 (검증용)`,address:"검증용 주소",longitude:null,latitude:null,start:"2026-10-03",end:"2026-10-06",modifiedAt:null}]};
    await route.fulfill({json:data});
  }catch{/* superseded request aborted */}
});
try{
  await page.goto(`${base}/regions`);assert.equal(await page.getByText(/남한/).count(),0);await visible(page.getByRole("button",{name:"전국",exact:true}));
  await page.goto(`${base}/compare`);await visible(page.getByRole("heading",{name:"주변·과거 축제 비교",exact:true}));
  await visible(page.getByRole("heading",{name:"보관 출처에서 찾은 회차 · 8건"}));
  await page.getByRole("button",{name:"논산 3회차 방문 비교",exact:true}).click();
  await page.getByLabel("선택 시작",{exact:true}).selectOption("0");await page.getByLabel("선택 끝",{exact:true}).selectOption("0");
  await visible(page.getByText("52,671.5",{exact:true}));
  await page.getByLabel("비교를 참고할 이유").fill("검증: 개최 시작일의 지역 방문 추세 참고");
  await page.getByRole("button",{name:"선택한 방문 추세 담기",exact:true}).click();await visible(page.getByText(/축제 비교를 기획 근거에 담았습니다/));
  await page.getByRole("button",{name:"선택한 방문 추세 담기",exact:true}).click();await visible(page.getByText(/같은 비교와 선택 범위를 이미 담았습니다/));
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items.length,key),1);
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items[0].editions[2].visits.points[0].value,key),52671.5);
  await page.getByLabel("그래프 날짜 기준").selectOption("calendar");await page.getByLabel("그래프 날짜 기준").selectOption("relative");
  await page.getByLabel("축제·지역 이름").fill("공주");await page.getByRole("button",{name:"과거 회차 검색",exact:true}).click();await visible(page.getByRole("heading",{name:"보관 출처에서 찾은 회차 · 1건"}));await visible(page.getByText("비교 3/3회차",{exact:true}));
  await page.getByRole("button",{name:"원주 계획·집행 보기",exact:true}).click();await visible(page.getByText("분모 35,118,200원 · 재원 합계와 일치 · 소수 첫째 자리 반올림. 재원과 지출을 합친 구성이 아닙니다.",{exact:true}));
  await visible(page.getByRole("img",{name:/지원사업 집행액 재원 구성: 보조금 30,000,000원 85.4%/}));
  await visible(page.getByText("2022 치악산복숭아 축제: 개최일 미확인 · 일정 겹침 판단 보류",{exact:true}));
  await page.getByRole("button",{name:"2025 논산딸기축제 비교에 추가",exact:true}).click();await visible(page.getByText(/사업·포함 범위·금액 단계·부서가 달라 차액·순위 비교 보류/).first());
  await page.getByRole("button",{name:"지원사업 집행액 근거 담기",exact:true}).click();await visible(page.getByText(/축제 비교를 기획 근거에 담았습니다/));
  await page.getByRole("button",{name:"공주·임실 일정 비교",exact:true}).click();await visible(page.getByText(/등록·확인 일정 4일 겹침/));
  await page.getByRole("button",{name:"선택 회차와 비교 조건 담기",exact:true}).click();await visible(page.getByText(/축제 비교를 기획 근거에 담았습니다/));
  await page.getByLabel("축제·지역 이름").fill("존재하지않는검색어");await page.getByRole("button",{name:"과거 회차 검색",exact:true}).click();await visible(page.getByText(/실제 행사 없음·미개최를 뜻하지 않습니다/));
  await page.getByRole("button",{name:"선택 비우기",exact:true}).click();
  await page.getByRole("button",{name:"논산·공주·부여 등록 행사 조회",exact:true}).click();await visible(page.getByRole("button",{name:"2026 부여군 등록 행사 (검증용) 비교에 추가",exact:true}));await visible(page.getByText(/검증용 공주 조회 실패/));
  await page.getByRole("button",{name:"2026 논산시 등록 행사 (검증용) 비교에 추가",exact:true}).click();await visible(page.getByText(/실제 개최·취소·변경은 미확인/));assert.equal(await page.getByText("52,671.5",{exact:true}).count(),0);
  delay=700;await page.getByRole("button",{name:"등록 행사 조회",exact:true}).click();await page.getByRole("button",{name:"출처가 있는 과거 회차",exact:true}).click();await page.waitForTimeout(900);assert.equal(await page.getByRole("heading",{name:/현재 조회한 등록 행사/}).count(),0);
  await page.goto(`${base}/evidence#comparisons`);await visible(page.getByText("보관 비교 3개 / 최대 50개",{exact:true}));
  await page.getByText("당시 비교 그래프·수치·출처 보기",{exact:true}).first().click();await visible(page.getByText("52,671.5",{exact:true}).filter({visible:true}));
  const pending=page.waitForEvent("download");await page.getByRole("button",{name:"비교 근거 파일 보관",exact:true}).click();const download=await pending,raw=readFileSync(await download.path(),"utf8");assert.equal(JSON.parse(raw).items[0].editions[2].visits.points[0].value,52671.5);
  await page.getByLabel("비교 근거 파일 가져오기",{exact:true}).setInputFiles({name:"comparison.json",mimeType:"application/json",buffer:Buffer.from(raw)});await visible(page.getByText(/비교 근거 0개를 추가했습니다/));
  await page.getByLabel("비교 근거 파일 가져오기",{exact:true}).setInputFiles({name:"broken.json",mimeType:"application/json",buffer:Buffer.from("{}")});await visible(page.getByText(/손상된 비교 근거 파일/));assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items.length,key),3);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.goto(`${base}/compare`);await page.getByRole("button",{name:"논산 3회차 방문 비교",exact:true}).click();await visible(page.getByText("52,671.5",{exact:true}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  mkdirSync("output/playwright",{recursive:true});await page.screenshot({path:"output/playwright/comparison-mobile.png",fullPage:true});
  await page.emulateMedia({media:"print"});assert.equal(await page.getByRole("button",{name:"선택 회차와 비교 조건 담기",exact:true}).isVisible(),false);await visible(page.getByRole("heading",{name:"회차 원문과 확인할 항목"}));await page.emulateMedia({media:"screen"});
  await page.unroute("**/api/regions?*");await page.goto(`${base}/compare?province=44&district=230&mode=current&start=2026-01-01&end=2026-12-31`);await visible(page.getByText(/공공데이터 연결이 준비되지 않았습니다/));await page.getByRole("button",{name:"논산 3회차 방문 비교",exact:true}).click();await visible(page.getByText("52,671.5",{exact:true}));
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log(JSON.stringify({headless:true,passed:["nationwide-label","eight-independent-archives","three-edition-selection","actual-45-values","actual-calendar-axis","selected-point-snapshot","dedup","filter-keeps-selection","unknown-date-retained","cost-scope-hold","funding-denominator","four-day-calendar-overlap","empty-not-absence","three-region-partial-failure","current-not-archive","stale-response-cancelled","reopen-saved-values","export-import-corruption","390px-no-overflow","print-sources","missing-key-keeps-archive"],browserErrors:errors.length,clientWrites:writes.length}));
}finally{await browser.close();}
