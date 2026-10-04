import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base=process.env.E2E_BASE_URL;
if(!base)throw new Error("E2E_BASE_URL required");
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},locale:"ko-KR"}),page=await context.newPage();
const errors=[],writes=[],bundles=[];
page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{const u=new URL(r.url());if(r.method()!=="GET"&&u.origin===new URL(base).origin)writes.push(r.url());if(u.pathname==="/api/datalab/festival")bundles.push(u.searchParams.get("festival"));});
const visible=l=>l.waitFor({state:"visible"});
const table=()=>page.getByRole("region",{name:"개최연도별 수치 표"}).locator("table");
const row=year=>table().locator("tbody tr").filter({has:page.getByRole("rowheader",{name:String(year),exact:true})});
const cells=async year=>(await row(year).locator("th,td").allInnerTexts()).map(s=>s.trim());
try{
  // The page carries every festival's name and place but no festival's values until one is chosen.
  const entryHtml=await(await page.request.get(`${base}/compare/annual`)).text();assert.ok(entryHtml.length<400_000,`entry page ${entryHtml.length} bytes`);assert.ok(!entryHtml.includes("체육공원"),"no destination ranking in the entry page");
  await page.goto(`${base}/compare/annual`);
  await visible(page.getByRole("heading",{name:"축제별 방문 자료",exact:true,level:1}));await visible(page.getByText("한국관광 데이터랩 · 문화관광축제 92곳",{exact:true}));
  await visible(page.getByText("축제를 골라 해마다 방문, 축제 기간과 평소의 차이, 방문객 성·연령, 많이 찾은 곳을 봐요.",{exact:true}));
  await visible(page.getByText("관광 자료 출처: ⓒ한국관광공사 (한국관광콘텐츠랩·한국관광 데이터랩)",{exact:true}));
  assert.equal(await page.locator("#festival-indicators").count(),0,"no profile before a festival is chosen");
  await visible(page.getByText(/목록에서 축제를 고르면/));assert.equal(await page.getByRole("list",{name:"축제 목록"}).getByRole("button").count(),92);await visible(page.getByText("축제 92곳 · 가나다순",{exact:true}));
  const names=await page.getByRole("list",{name:"축제 목록"}).getByRole("button").evaluateAll(bs=>bs.map(b=>b.firstElementChild.textContent));assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,"ko-KR")),"list in name order");
  const search=page.getByLabel("축제 이름·지역 찾기");
  // A place finds festivals whose names do not carry it (강경젓갈축제 is in 논산).
  await search.fill("논산");await visible(page.getByText("2곳 일치",{exact:true}));
  assert.deepEqual((await page.getByRole("list",{name:"축제 목록"}).getByRole("button").allInnerTexts()).map(t=>t.replace(/\s+/g," ").trim()),["강경젓갈축제 충남 논산시 · 3개 연도","논산딸기축제 충남 논산시 · 2개 연도"]);
  await search.fill("공룡");await visible(page.getByText("‘공룡’에 맞는 축제가 없습니다.",{exact:true}));assert.equal(await page.getByRole("list",{name:"축제 목록"}).count(),0);assert.equal(await page.getByRole("img",{name:/방문자 그래프/}).count(),0);
  // Keyboard-only selection
  await search.fill("서산");await search.press("Tab");await page.keyboard.press("Enter");
  await visible(page.getByRole("heading",{name:"서산해미읍성축제",level:2}));await page.waitForFunction(()=>document.activeElement?.id==="period-trend-title");
  assert.deepEqual(bundles,["seosan-haemieupseong"],"one festival's values are fetched when it is chosen");
  await visible(page.getByText("충남 서산시 · 개최기간 일평균 방문자 · 단위 명",{exact:true}));
  assert.equal(new URL(page.url()).searchParams.get("festival"),"seosan-haemieupseong");assert.equal(new URL(page.url()).searchParams.get("metric"),null);
  assert.equal(await page.getByRole("button",{name:"일평균",exact:true}).getAttribute("aria-pressed"),"true");assert.equal(await page.getByRole("button",{name:"기간 합계",exact:true}).getAttribute("aria-pressed"),"false");
  await visible(page.getByRole("img",{name:/서산해미읍성축제 개최연도별 개최기간 일평균 방문자 그래프. 자료 연도 2018, 2019, 2022, 2023, 2024, 2025/}));
  await visible(table().locator("caption",{hasText:"축제 개최 행정동 · 축제 개최기간 방문자 (명)"}));
  assert.deepEqual(await cells(2018),["2018","3","32,565.3","97,696"]);assert.deepEqual(await cells(2024),["2024","4","29,135.8","116,543"]);
  assert.deepEqual(await cells(2020),["2020","값 없음"]);assert.deepEqual(await cells(2021),["2021","값 없음"]);
  await visible(page.getByText("자료 없는 연도: 2020 · 2021",{exact:true}));assert.equal(await page.getByText(/선으로 잇지 않습니다/).count(),0);
  assert.equal(await page.getByRole("img",{name:/방문자 그래프/}).locator("path").count(),2,"2018–2019 and 2022–2025 are separate lines");
  // DataLab profile cards: jump links, indicator year switch, withheld years, sex·age summary, destination groups
  const jump=page.getByRole("navigation",{name:"이 축제의 다른 자료"});assert.deepEqual((await jump.getByRole("link").allInnerTexts()).map(t=>t.trim()),["축제 기간과 평소 ↓","방문객 성·연령 ↓","목적지 검색순위 ↓","개최지 서산시 ↓"]);
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
  // Host region cards: the whole municipality over the download range, linked only where the host dong is in the region
  await visible(page.getByText("개최지 서산시 전체 자료 · 축제 기간만이 아닌 2018~2025년 지역 전체",{exact:true}));
  await jump.getByRole("link",{name:"개최지 서산시 ↓"}).click();assert.equal(await page.evaluate(()=>document.activeElement?.id),"region-spending");
  const spending=page.locator("section",{has:page.locator("#region-spending")}),visitorsCard=page.locator("section",{has:page.locator("#region-visitors")});
  await visible(spending.getByRole("heading",{name:"서산시 관광 소비",level:3}));await visible(spending.getByText("같은 시도 목록 16곳 중 6위 · 2018~2025년 합계",{exact:true}));
  await visible(spending.getByRole("img",{name:/서산시 해마다 관광 소비\. 2018년 .*2025년 3,343억 원$/}));
  await visible(spending.getByRole("img",{name:/^서산시 업종별 관광 소비 비율\. 쇼핑업 34\.6%/}));
  await visible(visitorsCard.getByRole("heading",{name:"서산시 외지인 방문객",level:3}));
  await visible(visitorsCard.getByRole("img",{name:/^서산시 외지인 방문객 거주지\. 충청남도 태안군 12\.6%, 충청남도 당진시 10\.2%/}));
  await visitorsCard.getByRole("button",{name:"읍면동별 방문·소비 표 보기"}).click();
  const dongs=visitorsCard.getByRole("region",{name:"서산시 읍면동별 방문·소비 비율 표"});
  assert.deepEqual((await dongs.locator("tbody tr").filter({has:page.getByRole("rowheader",{name:"해미면",exact:true})}).locator("th,td").allInnerTexts()).map(t=>t.trim()),["해미면","12.1","14.9"]);
  await visitorsCard.getByRole("button",{name:"기준"}).click();const vcrit=page.getByRole("dialog",{name:"외지인 방문객 자료의 기준"});await visible(vcrit);
  await visible(vcrit.getByText(/한 사람이 여러 읍면동을 들르면 각각 세는 값/));await page.keyboard.press("Escape");await vcrit.waitFor({state:"hidden"});
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
  await search.fill("영암");await page.getByRole("button",{name:/영암왕인문화축제/}).click();await visible(page.getByRole("heading",{name:"영암왕인문화축제",level:2}));assert.equal(new URL(page.url()).searchParams.get("metric"),"total");
  assert.deepEqual(await cells(2022),["2022","값 없음"]);assert.deepEqual(await cells(2025),["2025","값 없음"]);assert.deepEqual(await cells(2023),["2023","4","30,600.8","122,403"]);
  await visible(page.getByText("자료 없는 연도: 2020 · 2021 · 2022 · 2025",{exact:true}));
  // Daegu Chimac's host dong (Duryu 3-dong, Dalseo-gu) is not in the Jung-gu download: no host cards, no jump link
  await search.fill("치맥");await page.getByRole("button",{name:/대구치맥페스티벌/}).click();await visible(page.getByRole("heading",{name:"대구치맥페스티벌",level:2}));
  assert.equal(await page.locator("#region-spending").count(),0);assert.equal(await page.getByRole("link",{name:/개최지/}).count(),0);
  await search.fill("부평");await page.getByRole("button",{name:/부평풍물대축제/}).click();await visible(page.getByRole("heading",{name:"부평구 관광 소비",level:3}));
  await visible(page.getByText("이 지역은 외지인 방문객의 거주지·읍면동 자료가 아직 없어요.",{exact:true}));
  await search.fill("영암");await page.getByRole("button",{name:/영암왕인문화축제/}).click();await visible(page.getByRole("heading",{name:"영암군 관광 소비",level:3}));
  // All-zero indicator years are withheld: no 2022 button, a plain "no value" row in the year table
  const yeongam=page.locator("section",{has:page.locator("#festival-indicators")});
  assert.deepEqual((await yeongam.getByRole("group",{name:"연도"}).getByRole("button").allInnerTexts()).map(t=>t.trim()),["2018","2019","2023","2024"]);
  await yeongam.getByRole("button",{name:"연도별 원문 값 보기"}).click();
  await visible(yeongam.getByRole("region",{name:"영암왕인문화축제 연도별 주요 지표 표"}).getByRole("cell",{name:"값 없음(그해 방문 측정 없음)",exact:true}));
  // A source value above that year's maximum withholds the whole year and says so.
  await search.fill("댄싱");await page.getByRole("button",{name:/원주다이내믹댄싱카니발/}).click();await visible(page.getByRole("heading",{name:"원주다이내믹댄싱카니발",level:2}));
  const wonju=page.locator("section",{has:page.locator("#festival-indicators")});
  assert.deepEqual((await wonju.getByRole("group",{name:"연도"}).getByRole("button").allInnerTexts()).map(t=>t.trim()),["2018","2019","2022"]);
  await wonju.getByRole("button",{name:"연도별 원문 값 보기"}).click();await visible(wonju.getByRole("cell",{name:"값 없음(원문 값이 최댓값을 넘음)",exact:true}));
  await wonju.getByRole("button",{name:"지표 기준"}).click();const wcrit=page.getByRole("dialog",{name:"축제 기간과 평소 비교의 기준"});await visible(wcrit.getByText("2023년은 원문 값 일부가 그해 최댓값(1)을 넘어 기준과 맞지 않아 비교에서 뺐어요.",{exact:true}));await page.keyboard.press("Escape");await wcrit.waitFor({state:"hidden"});
  // No destination ranking in the official download: the card says so instead of showing nothing or zeros.
  await search.fill("세종");await page.getByRole("button",{name:/^세종축제/}).click();await visible(page.getByRole("heading",{name:"세종축제",level:2}));await visible(page.getByText("세종 · 개최기간 합계 방문자 · 단위 명",{exact:true}));
  const sejongDest=page.locator("section",{has:page.locator("#festival-destinations")});await visible(sejongDest.getByText(/한국관광 데이터랩이 이 축제의 목적지 검색순위를 제공하지 않아요/));
  assert.equal(await sejongDest.getByRole("listitem").count(),0);assert.equal(await sejongDest.getByRole("link",{name:"원문 CSV ↗"}).count(),0);
  // Owner-download festivals held in a downloaded region get its cards like the first ones.
  await search.fill("효석");await page.getByRole("button",{name:/평창효석문화제/}).click();await visible(page.getByRole("heading",{name:"평창군 관광 소비",level:3}));
  assert.ok((await page.getByRole("navigation",{name:"이 축제의 다른 자료"}).getByRole("link").allInnerTexts()).map(t=>t.trim()).includes("개최지 평창군 ↓"));
  // A failed load names its own retry and recovers without leaving the page.
  const bundleApi=u=>u.pathname==="/api/datalab/festival";await page.route(bundleApi,r=>r.abort("failed"));
  await search.fill("약령시");await page.getByRole("button",{name:/대구약령시한방문화축제/}).click();
  const failed=page.getByRole("alert").filter({hasText:"축제 자료를 불러오지 못했어요."});await visible(failed);
  await page.unroute(bundleApi);await failed.getByRole("button",{name:"축제 자료 다시 불러오기",exact:true}).click();
  await visible(page.getByRole("heading",{name:"대구약령시한방문화축제",level:2}));await visible(page.getByRole("heading",{name:"중구 관광 소비",level:3}));
  mkdirSync("output/playwright",{recursive:true});await page.screenshot({path:"output/playwright/annual-trend-desktop.png",fullPage:true});
  // A deep link renders that festival with the page: 논산딸기축제 from the owner's download, 2024~2025 only
  const before=bundles.length;await page.goto(`${base}/compare/annual?festival=nonsan-strawberry`);await visible(page.getByRole("heading",{name:"논산딸기축제",level:2}));assert.equal(bundles.length,before,"no extra request for the linked festival");
  assert.deepEqual(await cells(2024),["2024","4","18,942.5","75,770"]);assert.deepEqual(await cells(2025),["2025","4","18,643.5","74,574"]);assert.deepEqual(await cells(2023),["2023","값 없음"]);
  const nonsanDest=page.locator("section",{has:page.locator("#festival-destinations")});assert.equal(await nonsanDest.getByRole("list",{name:"외지인 목적지 검색순위"}).getByRole("listitem").count(),1);await visible(nonsanDest.getByText("부창동 · 2024~2025년 축제기간 합산 · 음식점·숙박 제외",{exact:true}));
  assert.equal(await page.locator("#region-spending").count(),0,"no 논산 region download");
  await page.getByText("출처와 기준",{exact:true}).click();
  assert.ok(decodeURIComponent(await page.getByRole("link",{name:"원문 CSV 보기 ↗"}).getAttribute("href")).startsWith("https://github.com/gitvssh/fest-compass/blob/main/docs/research/imported/datalab-festivals-2026-10/original/data/20261004234455_문화관광축제_2024-2025_데이터랩_다운로드/"));
  assert.equal((await page.locator("dt",{hasText:"내려받은 날"}).locator("xpath=following-sibling::dd[1]").innerText()).trim(),"2026-10-04");
  // Unknown deep link: short notice, no synthesized festival
  await page.goto(`${base}/compare/annual?festival=unknown-festival`);await visible(page.getByText("요청한 축제의 자료가 없습니다. 목록에서 골라 주세요.",{exact:true}));assert.equal(await page.getByRole("img",{name:/방문자 그래프/}).count(),0);
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
  console.log(JSON.stringify({headless:true,passed:["entry-page-light","entry-list-92-name-order","intro-copy","place-search-nonsan","no-match","festival-bundle-on-choice","heading-focus-after-load","place-line","above-maximum-year-withheld","sejong-no-ranking-note","new-festival-host-region","bundle-failure-retry","nonsan-deeplink-owner-source","keyboard-select","url-festival","default-daily-mean","exact-table-values","missing-years-not-zero","line-breaks-at-gaps","year-detail-no-hover","foreign-zero-raw","metric-url-restore","raw-disclosure-typo-preserved","previous-year-note","source-links","metric-definition","download-date-only","no-sha256","yeongam-gaps","desktop-screenshot","unknown-deeplink","390px-no-overflow","raw-table-own-scroll","footer-kto-credit","profile-jump-links","indicator-year-switch","indicator-raw-table","indicator-criteria-dialog","demographics-summary","destination-groups-and-show-all","withheld-indicator-years","profile-tables-390px","host-region-jump-and-cards","host-region-spending-values","host-region-visitor-origins","host-region-dong-table","host-region-criteria","chimac-no-host-link","bupyeong-no-visitor-note"],browserErrors:errors.length,clientWrites:writes.length}));
}finally{await browser.close();}
