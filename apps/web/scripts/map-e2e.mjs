import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { mockMapTiles } from "./map-test-tiles.mjs";
const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("E2E_BASE_URL required");
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR" });
const requests = [], passed = [], errors = [], writes = []; let apiCalls = 0;
await mockMapTiles(context, { requests });
const page = await context.newPage();
page.on("pageerror", e => errors.push(e.message));
page.on("request", r => { if (new URL(r.url()).origin === new URL(base).origin && !["GET","HEAD"].includes(r.method()) && !new URL(r.url()).pathname.startsWith("/cdn-cgi/")) writes.push(r.url()); });
await context.route("**/api/regions?*", route => {
  apiCalls++; const q = Object.fromEntries(new URL(route.request().url()).searchParams);
  const resource = (id, title, longitude, latitude) => ({ id, title, longitude, latitude, address: "가상 검증용 주소", start: null, end: null, modifiedAt: null });
  return route.fulfill({ json: { query: q, region: { provinceCode: "44", provinceName: "충청남도", districtCode: "230", districtName: "논산시" },
    resources: { status: "complete", total: 4, pages: 1, collectedAt: "2026-09-09T00:00:00Z", source: "https://www.data.go.kr/data/15101578/openapi.do", message: "가상 지도 동작 검증 자료", items: [resource("901","좌표 없는 자료 (가상)",null,null),resource("902","같은 위치 A (가상)",127.1,36.2),resource("903","같은 위치 B (가상)",127.1,36.2),resource("904","먼 위치 C (가상)",127.4,36.5)] },
    history: { status: "unavailable", message: "가상 검증 응답 · 이력 없음", unit: "명", metric: "시군구 일별 외지인 방문", source: "https://www.data.go.kr/data/15101972/openapi.do", points: [] } } });
});
const btn = name => page.getByRole("button", { name, exact: true });
const map = () => page.locator(".region-street-map");
const wait = l => l.waitFor({ state: "visible" });
const transform = () => page.locator(".leaflet-map-pane").evaluate(e => e.style.transform);
const tileSources = () => page.locator("img.leaflet-tile").evaluateAll(items => items.map(i=>i.src).sort());
async function checkLabels() {
  const boxes = await page.locator(".map-province").evaluateAll(items => items.map(e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height }; }));
  assert.equal(boxes.length,16);
  const frame = await map().boundingBox();
  for (const b of boxes) assert.ok(b.x>=frame.x && b.x+b.w<=frame.x+frame.width && b.y>=frame.y && b.y+b.h<=frame.y+frame.height,"province label outside map");
  for (let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j]; assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y,"province labels overlap");
  }
}
try {
  mkdirSync("output/playwright", { recursive: true });
  await page.goto(`${base}/regions`);
  if (new URL(base).hostname === "kto.damecasol.com") { const reject=page.getByRole("button",{name:/^(Reject All|모두 거부)$/}); await wait(reject); await reject.click(); }
  await wait(btn("제주특별자치도 선택")); await page.locator("img.leaflet-tile-loaded").first().waitFor();
  assert.equal(apiCalls,0); assert.ok(await map().getByRole("link",{ name:"OpenStreetMap",exact:true }).isVisible());
  await checkLabels();
  await page.screenshot({ path:"output/playwright/map-national-test.png",fullPage:true }); passed.push("national-first-attribution-no-resource-query");
  await btn("충청남도 선택").click(); await wait(btn("논산시")); await btn("논산시").click();
  await wait(btn("가까운 관광자료 2건 펼치기")); assert.equal(await btn("지도에서 좌표 없는 자료 (가상) 상세").count(),0);
  await btn("가까운 관광자료 2건 펼치기").click(); await wait(page.locator(".map-popup-list"));
  await page.locator(".map-popup-list").getByRole("button",{name:"2. 같은 위치 A (가상)",exact:true}).click();
  await wait(page.getByRole("heading",{name:"같은 위치 A (가상)",exact:true})); assert.equal(await page.locator(".map-resource.is-selected").count(),1);
  passed.push("province-district-cluster-selection-and-missing-coordinate-numbering");
  await page.locator(".leaflet-popup-close-button").click();
  const before = await transform(), calls = apiCalls;
  await map().focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(350);
  assert.notEqual(await transform(),before); assert.equal(apiCalls,calls); assert.equal(await page.getByText(/공간 필터 적용 중/).count(),0);
  passed.push("keyboard-pan-does-not-change-query");
  await map().scrollIntoViewIfNeeded(); const box = await map().boundingBox();
  const moved = await transform(); await page.mouse.move(box.x+box.width*.75,box.y+box.height*.8); await page.mouse.down(); await page.mouse.move(box.x+box.width*.55,box.y+box.height*.65,{steps:8}); await page.mouse.up(); await page.waitForTimeout(400);
  assert.notEqual(await transform(),moved); assert.equal(apiCalls,calls); passed.push("drag-pan-keeps-query-explicit");
  await btn("이 영역의 자료 보기").click(); await wait(page.getByText(/공간 필터 적용 중/)); assert.equal(apiCalls,calls);
  assert.ok(await map().locator("path[stroke-dasharray]").count()); passed.push("applied-area-shown-without-extra-api-call");
  await btn("공간 필터 해제").click(); await btn("조회 자료에 맞추기").click();
  await page.getByRole("region",{name:"조회 자료 목록"}).getByRole("button",{name:/^2\. 같은 위치 A/}).click();
  await page.getByLabel("기획에 참고할 이유").fill("개인 메모는 지도 제공자에 보내지 않음");
  await btn("확대").click(); await page.waitForTimeout(350); await btn("이 영역의 자료 보기").click();
  await page.getByRole("region",{name:"조회 자료 목록"}).getByRole("button",{name:/^1\. 좌표 없는/}).click();
  await btn("선택 자료를 기획 근거에 담기").click(); await wait(page.getByText(/기획 근거에 담았습니다/));
  const evidence = await page.evaluate(()=>JSON.parse(localStorage.getItem("fest-compass.region-evidence.v1")).items[0]);
  assert.equal(evidence.selection.mapBounds.length,4); assert.equal(evidence.selection.resourceId,"901"); assert.equal(evidence.note,"개인 메모는 지도 제공자에 보내지 않음");
  passed.push("applied-bounds-and-missing-coordinate-evidence-preserved");
  await btn("공간 필터 해제").click(); await btn("조회 자료에 맞추기").click(); await map().scrollIntoViewIfNeeded();
  const sources = await tileSources(); await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5); await page.mouse.wheel(0,180); await page.waitForTimeout(200); assert.deepEqual(await tileSources(),sources); passed.push("wheel-scroll-does-not-zoom-map");
  await btn("간단 지도").click(); await wait(page.getByText(/육지 윤곽: Natural Earth/)); const count = requests.length;
  await btn("확대").click(); assert.equal(requests.length,count); assert.equal(await map().count(),0); passed.push("simple-map-unmounts-external-background");
  await context.unroute("https://tile.openstreetmap.org/**"); await mockMapTiles(context,{fail:true,requests}); await btn("도로 지도").click();
  // Reload also discards decoded image memory from the earlier successful map.
  await page.reload(); await wait(page.getByText(/배경 지도를 불러오지 못한 부분/));
  await btn("충청남도 선택").click(); await btn("논산시").click();
  await wait(page.getByRole("region",{name:"조회 자료 목록"}).getByRole("button",{name:/^1\. 좌표 없는/}));
  await btn("간단 지도로 보기").click(); await wait(page.getByText(/육지 윤곽: Natural Earth/)); passed.push("tile-failure-keeps-fallback-and-list");
  await context.unroute("https://tile.openstreetmap.org/**"); await mockMapTiles(context,{requests}); await btn("도로 지도").click();
  await page.setViewportSize({width:390,height:844}); await page.getByRole("button",{name:"전국",exact:true}).click(); await wait(btn("제주특별자치도 선택"));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390); assert.equal(await page.getByRole("combobox",{name:"시군구 선택",exact:true}).isDisabled(),true);
  await checkLabels();
  await page.getByRole("combobox",{name:"시도 선택",exact:true}).selectOption("44"); await page.getByRole("combobox",{name:"시군구 선택",exact:true}).selectOption("230"); await wait(btn("가까운 관광자료 2건 펼치기"));
  await map().scrollIntoViewIfNeeded(); await page.screenshot({path:"output/playwright/map-mobile-test.png",fullPage:true}); passed.push("390px-region-select-and-map-no-overflow");
  const touch = await context.newCDPSession(page); await touch.send("Emulation.setTouchEmulationEnabled",{enabled:true});
  const touchBox = await map().boundingBox(), tx=touchBox.x+touchBox.width/2, ty=touchBox.y+touchBox.height/2, beforeTouch=await tileSources();
  const fingers = distance => [{x:tx-distance,y:ty,id:1},{x:tx+distance,y:ty,id:2}];
  await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:fingers(30)});
  for (const d of [40,55,75,95]) await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:fingers(d)});
  await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]}); await page.waitForTimeout(400);
  assert.notDeepEqual(await tileSources(),beforeTouch); await touch.detach(); passed.push("two-finger-touch-zoom");
  assert.ok(requests.length>0); assert.ok(requests.every(r=>/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(r.url)&&r.method==="GET"));
  assert.ok(requests.every(r=>!r.url.includes("개인")&&!r.headers["cache-control"]&&!r.headers.pragma));
  assert.deepEqual(errors,[]); assert.deepEqual(writes,[]); passed.push("tile-only-url-no-personal-payload-or-cache-bypass");
  const result={headless:true,background:"synthetic test tiles; zero requests forwarded to OSMF",passed,browserErrors:errors,appWrites:writes,interceptedTileRequests:requests.length};
  writeFileSync("output/playwright/map-result.json",JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} catch (error) { await page.screenshot({path:"output/playwright/map-failure.png",fullPage:true}); console.error(JSON.stringify({passed,errors,requests:requests.length})); throw error; }
finally { await browser.close(); }
