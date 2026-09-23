import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base=process.env.E2E_BASE_URL;
if(!base)throw new Error("E2E_BASE_URL required");
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},locale:"ko-KR"}),page=await context.newPage();
const errors=[],writes=[];
page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()!=="GET"&&new URL(r.url()).origin===new URL(base).origin)writes.push(r.url());});
const visible=l=>l.waitFor({state:"visible"});
const table=()=>page.getByRole("region",{name:"개최연도별 수치 표"}).locator("table");
const row=year=>table().locator("tbody tr").filter({has:page.getByRole("rowheader",{name:String(year),exact:true})});
const cells=async year=>(await row(year).locator("th,td").allInnerTexts()).map(s=>s.trim());
try{
  await page.goto(`${base}/compare/annual`);
  await visible(page.getByRole("heading",{name:"개최연도별 방문 흐름",exact:true}));await visible(page.getByText("축제 개최 행정동 · 개최기간 · 통신 기반",{exact:true}));
  await visible(page.getByText("문화관광축제를 골라 개최기간의 일평균 방문자와 방문 합계를 비교합니다.",{exact:true}));
  await visible(page.getByText(/목록에서 축제를 고르면/));assert.equal(await page.getByRole("list",{name:"축제 목록"}).getByRole("button").count(),26);
  const search=page.getByLabel("축제 이름 찾기");
  await search.fill("논산");await visible(page.getByText("‘논산’에 맞는 축제가 없습니다.",{exact:true}));assert.equal(await page.getByRole("list",{name:"축제 목록"}).count(),0);assert.equal(await page.getByRole("img",{name:/방문자 그래프/}).count(),0);
  // Keyboard-only selection
  await search.fill("서산");await search.press("Tab");await page.keyboard.press("Enter");
  await visible(page.getByRole("heading",{name:"서산해미읍성축제",level:2}));
  assert.equal(new URL(page.url()).searchParams.get("festival"),"seosan-haemieupseong");assert.equal(new URL(page.url()).searchParams.get("metric"),null);
  assert.equal(await page.getByRole("button",{name:"일평균",exact:true}).getAttribute("aria-pressed"),"true");assert.equal(await page.getByRole("button",{name:"기간 합계",exact:true}).getAttribute("aria-pressed"),"false");
  await visible(page.getByRole("img",{name:/서산해미읍성축제 개최연도별 개최기간 일평균 방문자 그래프. 자료 연도 2018, 2019, 2022, 2023, 2024, 2025/}));
  await visible(table().locator("caption",{hasText:"축제 개최 행정동 · 축제 개최기간 방문자 (명)"}));
  assert.deepEqual(await cells(2018),["2018","3","32,565.3","97,696"]);assert.deepEqual(await cells(2024),["2024","4","29,135.8","116,543"]);
  assert.deepEqual(await cells(2020),["2020","값 없음"]);assert.deepEqual(await cells(2021),["2021","값 없음"]);
  await visible(page.getByText("자료 없는 연도: 2020 · 2021",{exact:true}));assert.equal(await page.getByText(/선으로 잇지 않습니다/).count(),0);
  assert.equal(await page.getByRole("img",{name:/방문자 그래프/}).locator("path").count(),2,"2018–2019 and 2022–2025 are separate lines");
  // Year detail is reachable without hover; raw foreign 0 is not asserted as absence
  await page.getByRole("group",{name:"연도별 상세 보기"}).getByRole("button",{name:"2018",exact:true}).click();
  await visible(page.getByText("2018년 개최기간",{exact:true}));await visible(page.getByText("외국인 수는 원문 기준입니다.",{exact:true}));
  // Metric toggle and URL restoration
  await page.getByRole("button",{name:"기간 합계",exact:true}).click();assert.equal(new URL(page.url()).searchParams.get("metric"),"total");
  await visible(page.getByRole("img",{name:/개최기간 합계 방문자 그래프/}));
  await page.reload();await visible(page.getByRole("heading",{name:"서산해미읍성축제",level:2}));assert.equal(await page.getByRole("button",{name:"기간 합계",exact:true}).getAttribute("aria-pressed"),"true");
  // Raw disclosure keeps source strings and the header typo
  await page.getByText("원문 표 보기",{exact:true}).click();const raw=page.getByRole("region",{name:"서산해미읍성축제 원문 표"});await visible(raw);
  await visible(page.getByText("전년도는 직전에 자료가 있는 연도를 가리킬 수 있습니다.",{exact:true}));
  await visible(raw.getByRole("columnheader",{name:"축체기간(일)",exact:true}));await visible(raw.getByRole("cell",{name:"N/A",exact:true}));await visible(raw.getByRole("cell",{name:"39400.0",exact:true}));
  await raw.focus();await page.keyboard.press("ArrowRight");
  await page.getByText("출처와 기준",{exact:true}).click();
  await visible(page.getByText(/행사장 입장객 수와는 다릅니다\./));
  const official=page.getByRole("link",{name:"한국관광 데이터랩 축제 데이터 ↗"});assert.equal(await official.getAttribute("href"),"https://datalab.visitkorea.or.kr/datalab/portal/fes/getFesDataForm.do");
  const csv=await page.getByRole("link",{name:"원문 CSV 보기 ↗"}).getAttribute("href");assert.ok(csv.startsWith("https://github.com/travel-resolver/pick-d-day/blob/f362e65ba9e1cac18757951236484cff666c2696/developer/hkjin/plan-03-datalab/data/"));assert.ok(decodeURIComponent(csv).endsWith("20260829165421_서산해미읍성축제_연도별 방문자 추이.csv"));
  assert.equal((await page.locator("dt",{hasText:"내려받은 날"}).locator("xpath=following-sibling::dd[1]").innerText()).trim(),"2026-08-29");
  assert.equal(await page.getByText(/SHA-?256/i).count(),0);assert.equal(await page.getByText(/시간대 미기재/).count(),0);
  // A festival missing 2022 and 2025 keeps gaps
  await search.fill("영암");await page.getByRole("button",{name:/영암왕인문화축제/}).click();assert.equal(new URL(page.url()).searchParams.get("metric"),"total");
  assert.deepEqual(await cells(2022),["2022","값 없음"]);assert.deepEqual(await cells(2025),["2025","값 없음"]);assert.deepEqual(await cells(2023),["2023","4","30,600.8","122,403"]);
  await visible(page.getByText("자료 없는 연도: 2020 · 2021 · 2022 · 2025",{exact:true}));
  mkdirSync("output/playwright",{recursive:true});await page.screenshot({path:"output/playwright/annual-trend-desktop.png",fullPage:true});
  // Unknown deep link: short notice, no synthesized festival
  await page.goto(`${base}/compare/annual?festival=nonsan-strawberry`);await visible(page.getByText("요청한 축제의 자료가 없습니다. 목록에서 골라 주세요.",{exact:true}));assert.equal(await page.getByRole("img",{name:/방문자 그래프/}).count(),0);
  // 390px: no page overflow; wide raw table scrolls inside its own region
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/compare/annual?festival=seosan-haemieupseong`);await visible(page.getByRole("heading",{name:"서산해미읍성축제",level:2}));
  await page.getByText("원문 표 보기",{exact:true}).click();await page.getByText("출처와 기준",{exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  const rawBox=page.getByRole("region",{name:"서산해미읍성축제 원문 표"});assert.ok(await rawBox.evaluate(e=>e.scrollWidth>e.clientWidth));
  const chartBox=page.getByRole("region",{name:"서산해미읍성축제 방문 흐름 그래프 영역"});assert.ok(await chartBox.evaluate(e=>e.scrollWidth>e.clientWidth&&e.querySelector("svg").getBoundingClientRect().width>=500));
  await rawBox.focus();await page.keyboard.press("End");
  await page.screenshot({path:"output/playwright/annual-trend-mobile.png",fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes("annual")||k.includes("datalab")).length),0);
  console.log(JSON.stringify({headless:true,passed:["entry-list","intro-copy","nonsan-no-match","keyboard-select","url-festival","default-daily-mean","exact-table-values","missing-years-not-zero","line-breaks-at-gaps","year-detail-no-hover","foreign-zero-raw","metric-url-restore","raw-disclosure-typo-preserved","previous-year-note","source-links","metric-definition","download-date-only","no-sha256","yeongam-gaps","desktop-screenshot","unknown-deeplink","390px-no-overflow","raw-table-own-scroll"],browserErrors:errors.length,clientWrites:writes.length}));
}finally{await browser.close();}
