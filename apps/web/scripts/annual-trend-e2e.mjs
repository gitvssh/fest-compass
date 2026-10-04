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
  await visible(page.getByRole("heading",{name:"축제별 방문 자료",exact:true,level:1}));await visible(page.getByText("한국관광 데이터랩 · 문화관광축제 26곳",{exact:true}));
  await visible(page.getByText("축제를 골라 해마다 방문, 축제 기간과 평소의 차이, 방문객 성·연령, 많이 찾은 곳을 봐요.",{exact:true}));
  await visible(page.getByText("관광 자료 출처: ⓒ한국관광공사 (한국관광콘텐츠랩·한국관광 데이터랩)",{exact:true}));
  assert.equal(await page.locator("#festival-indicators").count(),0,"no profile before a festival is chosen");
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
  // DataLab profile cards: jump links, indicator year switch, withheld years, sex·age summary, destination groups
  const jump=page.getByRole("navigation",{name:"이 축제의 다른 자료"});assert.deepEqual((await jump.getByRole("link").allInnerTexts()).map(t=>t.trim()),["축제 기간과 평소 ↓","방문객 성·연령 ↓","목적지 검색순위 ↓"]);
  await jump.getByRole("link",{name:"축제 기간과 평소 ↓"}).click();assert.equal(await page.evaluate(()=>document.activeElement?.id),"festival-indicators");
  const indicators=page.locator("section",{has:page.locator("#festival-indicators")});
  assert.equal(await indicators.getByRole("group",{name:"연도"}).getByRole("button",{name:"2025",exact:true}).getAttribute("aria-pressed"),"true");
  await visible(indicators.getByRole("img",{name:/^2025년 축제기간과 평소, 그해 최댓값을 100으로 본 값\. 외지인 방문 축제기간 66\.3, 평소 41\.9, 차이 \+24\.4; 현지인 방문 축제기간 78\.2/}));
  await visible(indicators.getByText("평소보다 가장 크게 오른 지표:",{exact:false}));assert.match(await indicators.locator("p.rounded-xl").innerText(),/현지인 방문\(\+32\.5\).*관광 소비\(−2\.0\)/s);
  await indicators.getByRole("group",{name:"연도"}).getByRole("button",{name:"2018",exact:true}).click();await visible(indicators.getByRole("img",{name:/^2018년 축제기간과 평소/}));
  await indicators.getByRole("button",{name:"연도별 원문 값 보기"}).click();const yearTable=indicators.getByRole("region",{name:"서산해미읍성축제 연도별 주요 지표 표"});
  await visible(yearTable.getByRole("cell",{name:"0.663 / 0.419",exact:true}));await visible(yearTable.getByRole("columnheader",{name:"외부방문자 유입",exact:true}));
  await indicators.getByRole("button",{name:"지표 기준"}).click();const criteria=page.getByRole("dialog",{name:"축제 기간과 평소 비교의 기준"});await visible(criteria);
  await visible(criteria.getByText("평소는 축제 시작 전 4주와 끝난 뒤 4주예요.",{exact:true}));await visible(criteria.getByText(/다른 축제와 값의 크기를 견주지 말고/));
  assert.ok(decodeURIComponent(await criteria.getByRole("link",{name:"원문 CSV ↗"}).getAttribute("href")).endsWith("20260829165421_서산해미읍성축제_문화관광축제 주요 지표.csv"));
  await page.keyboard.press("Escape");await criteria.waitFor({state:"hidden"});assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"지표 기준");
  const demographics=page.locator("section",{has:page.locator("#festival-demographics")});
  await visible(demographics.getByText("2018~2025년 축제기간을 합친 내국인 방문자",{exact:true}));
  assert.deepEqual((await demographics.locator("dl dd").allInnerTexts()).map(t=>t.trim()),["55.0%","45.1%","50~59세 21.5%"]);
  await visible(demographics.getByRole("img",{name:/50~59세 남성 11\.6%, 여성 9\.9%/}));
  const destinations=page.locator("section",{has:page.locator("#festival-destinations")});
  await visible(destinations.getByText("해미면 · 2018~2025년 축제기간 합산 · 음식점·숙박 제외",{exact:true}));
  const ranks=destinations.getByRole("list",{name:"외지인 목적지 검색순위"});assert.equal(await ranks.getByRole("listitem").count(),10);
  assert.match(await ranks.getByRole("listitem").first().innerText(),/^1위\s+해미읍성\s+역사유적지 · 충남 서산시 남문2로 143$/);
  await destinations.getByRole("button",{name:"16곳 모두 보기"}).click();assert.equal(await ranks.getByRole("listitem").count(),16);
  await destinations.getByRole("group",{name:"검색한 사람"}).getByRole("button",{name:"현지인",exact:true}).click();
  assert.equal(await destinations.getByRole("list",{name:"현지인 목적지 검색순위"}).getByRole("listitem").count(),10);await visible(destinations.getByRole("button",{name:"16곳 모두 보기"}));
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
  // All-zero indicator years are withheld: no 2022 button, a plain "no value" row in the year table
  const yeongam=page.locator("section",{has:page.locator("#festival-indicators")});
  assert.deepEqual((await yeongam.getByRole("group",{name:"연도"}).getByRole("button").allInnerTexts()).map(t=>t.trim()),["2018","2019","2023","2024"]);
  await yeongam.getByRole("button",{name:"연도별 원문 값 보기"}).click();
  await visible(yeongam.getByRole("region",{name:"영암왕인문화축제 연도별 주요 지표 표"}).getByRole("cell",{name:"값 없음(원문 값이 모두 0)",exact:true}));
  mkdirSync("output/playwright",{recursive:true});await page.screenshot({path:"output/playwright/annual-trend-desktop.png",fullPage:true});
  // Unknown deep link: short notice, no synthesized festival
  await page.goto(`${base}/compare/annual?festival=nonsan-strawberry`);await visible(page.getByText("요청한 축제의 자료가 없습니다. 목록에서 골라 주세요.",{exact:true}));assert.equal(await page.getByRole("img",{name:/방문자 그래프/}).count(),0);
  // 390px: no page overflow; wide raw table scrolls inside its own region
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/compare/annual?festival=seosan-haemieupseong`);await visible(page.getByRole("heading",{name:"서산해미읍성축제",level:2}));
  await page.getByText("원문 표 보기",{exact:true}).click();await page.getByText("출처와 기준",{exact:true}).click();
  await page.getByRole("button",{name:"연도별 원문 값 보기"}).click();await page.getByRole("button",{name:"성·연령 비율 표 보기"}).click();await page.getByRole("button",{name:"16곳 모두 보기"}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  const yearBox=page.getByRole("region",{name:"서산해미읍성축제 연도별 주요 지표 표"});assert.ok(await yearBox.evaluate(e=>e.scrollWidth>e.clientWidth),"year table scrolls inside its own region");
  const rawBox=page.getByRole("region",{name:"서산해미읍성축제 원문 표"});assert.ok(await rawBox.evaluate(e=>e.scrollWidth>e.clientWidth));
  const chartBox=page.getByRole("region",{name:"서산해미읍성축제 방문 흐름 그래프 영역"});assert.ok(await chartBox.evaluate(e=>e.scrollWidth>e.clientWidth&&e.querySelector("svg").getBoundingClientRect().width>=500));
  await rawBox.focus();await page.keyboard.press("End");
  await page.screenshot({path:"output/playwright/annual-trend-mobile.png",fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes("annual")||k.includes("datalab")).length),0);
  console.log(JSON.stringify({headless:true,passed:["entry-list","intro-copy","nonsan-no-match","keyboard-select","url-festival","default-daily-mean","exact-table-values","missing-years-not-zero","line-breaks-at-gaps","year-detail-no-hover","foreign-zero-raw","metric-url-restore","raw-disclosure-typo-preserved","previous-year-note","source-links","metric-definition","download-date-only","no-sha256","yeongam-gaps","desktop-screenshot","unknown-deeplink","390px-no-overflow","raw-table-own-scroll","footer-kto-credit","profile-jump-links","indicator-year-switch","indicator-raw-table","indicator-criteria-dialog","demographics-summary","destination-groups-and-show-all","withheld-indicator-years","profile-tables-390px"],browserErrors:errors.length,clientWrites:writes.length}));
}finally{await browser.close();}
