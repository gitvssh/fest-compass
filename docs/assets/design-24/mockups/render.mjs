// Renders the design-24 v2 proposal mockups by adding proposed guide elements to the live public pages.
// Offline review images only, built from the trusted static draft in this folder; nothing here ships in the app.
// v1 mockups were rendered by the previous revision of this script (see git history) and are kept as reviewed.
// Output: docs/assets/design-24/mockup-*-v2.jpg
// Run with Playwright resolvable (for example from apps/web):  node docs/assets/design-24/mockups/render.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..");
const base = process.env.BASE_URL ?? "https://pickday.damecasol.com";
const css = readFileSync(join(here, "guide.css"), "utf8");
const content = JSON.parse(readFileSync(join(here, "content-draft.json"), "utf8"));
const sample = name => `data:image/jpeg;base64,${readFileSync(join(assets, "samples", `${name}-v1.jpg`)).toString("base64")}`;
const purpose = name => `data:image/png;base64,${readFileSync(join(here, "../../../../apps/web/public/images/purpose", `${name}-v2.png`)).toString("base64")}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const kind = k => content.kinds[k];

const tabs = (journey, current) => `<ul class="g-tabs" aria-label="탭">${content[journey].tabs.map((t, i) =>
  `<li class="${i === current ? "current" : ""}"><a href="#">${esc(t.title)}<small>${esc(t.data)}</small></a></li>`).join("")}</ul>`;
function area(journey, index, { variant } = {}) {
  const t = content[journey].tabs[index];
  return `<section class="g2-area"><div><p class="goal">${esc(t.goal)}</p><p class="cannot">${esc(t.essential)}</p>
    <div class="qs"><b>살펴볼 질문</b><ul>${t.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>
    ${variant ? `<p class="g2-variant">${esc(t.variants[variant])}</p>` : ""}</div>
    <div class="g2-help"><span class="g-help-btn">? 길잡이</span><span class="g2-hint">자료 읽는 법과 따로 확인할 일을 볼 수 있어요</span></div></section>`;
}
function side(journey, index) {
  const t = content[journey].tabs[index], p = t.panel;
  return `<aside class="g2-side g-wrap" aria-label="길잡이"><h2>길잡이 <span class="g-btn" style="min-height:36px">닫기 ✕</span></h2>
    <details open><summary>자료 읽는 법</summary><ol>${p.howToRead.map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>
    <details open><summary>따로 확인할 일 (부서·공식 절차)</summary><ul>${p.offline.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>
    <details><summary>예시로 읽기</summary><p>${esc(p.example)}</p></details>
    <details><summary>용어</summary><ul>${p.terms.map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join("")}</ul></details>
    <details open><summary>더 읽어보기</summary><ul class="g-read">${p.readings.map(r => `<li><a href="#">${esc(r.title)} ↗</a><span class="meta">${esc(r.where)}: ${esc(r.why)} · ${esc(r.issuer)} · ${esc(r.date)} · ${esc(r.format)}</span></li>`).join("")}</ul></details></aside>`;
}
const row = (journey, index) => {
  const t = content[journey].tabs, others = t.filter((_, i) => i !== index && i !== index + 1);
  return `<div class="g-wrap"><div class="g2-row"><a class="next" href="#">이어서: ${esc(t[index].next)} →</a><span class="others">${others.map(o => `<span class="g-btn">${esc(o.title)}</span>`).join("")}</span></div></div>`;
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR" });
await context.addInitScript(() => { try { localStorage.setItem("fest-compass.intro-video.v1", "dismissed"); } catch {} });
const page = await context.newPage();
let consent = false;
async function open(path) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (let attempt = 1; ; attempt++) {
    await page.goto(base + path, { waitUntil: "networkidle", timeout: 90000 });
    if (!consent) {
      const reject = page.getByRole("button", { name: /모두 거부|Reject All/ });
      if (await reject.isVisible({ timeout: 6000 }).catch(() => false)) { await reject.click(); consent = true; }
    }
    await page.waitForTimeout(1200);
    // A review image must show the real page styling; retry when the site's stylesheet did not apply.
    const styled = await page.evaluate(() => getComputedStyle(document.body).backgroundColor === "rgb(246, 247, 244)"
      && [...document.images].filter(i => i.getBoundingClientRect().width > 100).every(i => i.complete && i.naturalWidth > 0));
    if (styled) break;
    if (attempt >= 4) throw new Error(`page styles or images did not load: ${path}`);
  }
  await page.addStyleTag({ content: css + "header{position:static!important}" });
  await page.evaluate(() => { const b = document.createElement("div"); b.className = "g-proposal"; b.textContent = "제안 시안 v2 · 구현 전"; document.body.append(b); });
}
async function shoot(name, height, full = false) {
  if (height) await page.setViewportSize({ width: 1440, height });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(assets, `mockup-${name}-v2.jpg`), type: "jpeg", quality: 82, fullPage: full });
  console.log("mockup", name);
}
const replaceNav = (label, html, extraCss = "") => page.evaluate(({ label, html, extraCss }) => {
  document.querySelector(`nav[aria-label="${label}"]`).outerHTML = `<div class="g-wrap">${html}</div>`;
  if (extraCss) { const s = document.createElement("style"); s.textContent = extraCss; document.head.append(s); }
}, { label, html, extraCss });
// The existing bottom cross-links are replaced by one row: continue (emphasised) + the other tabs.
const replaceBottomLinks = (html) => page.evaluate(html => {
  const main = document.querySelector("main");
  const candidates = [...main.querySelectorAll("a,button")].filter(a => /보기$/.test(a.textContent.trim()) && /(흐름|관광자원|시기) 보기/.test(a.textContent));
  const holder = candidates.length ? candidates[candidates.length - 1].parentElement : null;
  if (holder) holder.outerHTML = html; else main.insertAdjacentHTML("beforeend", html);
}, html);

// 1. Home: one line per card (what you get) + entry to the whole-process guide. The two choices stay as clear as today.
await open("/");
await page.evaluate(({ e, n }) => {
  const cards = [...document.querySelectorAll('section[aria-labelledby="purpose-heading"] > ul > li')];
  const line = j => `<p class="g-wrap" style="margin:-8px 0 16px;font-size:14px;color:#2a3a52"><b>얻는 것</b> ${j.outcome}</p>`;
  cards[0].querySelector("p").insertAdjacentHTML("afterend", line(e));
  cards[1].querySelector("p").insertAdjacentHTML("afterend", line(n));
  document.querySelector('section[aria-labelledby="purpose-heading"] > ul').insertAdjacentHTML("afterend",
    `<div class="g-wrap"><div class="g-band"><span><b>축제를 처음 맡으셨나요?</b> 돌아보기부터 예산 관문, 개최 준비, 결과 정리까지 준비 과정과 협의할 곳을 한 번에 보세요.</span><span class="g-btn">축제 준비 전체 과정 보기 →</span></div></div>`);
}, { e: content.existing, n: content.new });
await shoot("home", 1150);

// 2·3. Journey starts: compact flow map reusing the home picture, judgement questions, list stays near the top.
async function start(path, anchor, journey, img, heading) {
  await open(path);
  await page.evaluate(({ anchor, j, img, heading }) => {
    document.querySelector(anchor).insertAdjacentHTML("afterend",
      `<div class="g-wrap"><section class="g2-flow"><img src="${img}" alt=""><div><h2>${heading}</h2><p class="goal">${j.goal}</p>
      <p class="legend">처음이라면 이 순서로 보면 흐름이 이어져요. 순서는 자유이고, 입력 없이 볼 수 있어요.</p>
      <ol class="g2-steps">${j.tabs.map(t => `<li><b>${t.title}</b>${t.goal}</li>`).join("")}</ol>
      <div class="g2-judge"><b>자료만으로는 답할 수 없어 담당자가 판단할 것</b><ul>${j.judgment.map(q => `<li>${q}</li>`).join("")}</ul></div>
      <p class="legend" style="margin:10px 0 0"><b>마치면 얻는 것</b> ${j.outcome}</p></div></section></div>`);
  }, { anchor, j: content[journey], img, heading });
}
await start("/existing/search", 'form[aria-label="기존 축제 찾기"]', "existing", purpose("existing-festival"), "기존 축제 개선은 이렇게 살펴봐요");
await shoot("existing-start", 1250);
await start("/new", 'section[aria-labelledby="new-start-heading"] form', "new", purpose("new-festival"), "새 축제 기획은 이렇게 살펴봐요");
await shoot("new-start", 1100);

// 4. Existing first tab: task tabs, guidance area without a picture, help closed, one bottom row.
await open("/existing/archive%3Anonsan-strawberry/visits");
await replaceNav("축제 탐색 메뉴", tabs("existing", 0) + area("existing", 0, { variant: "editions" }));
await replaceBottomLinks(row("existing", 0));
await shoot("existing-step", 1000, true);

// 5. Same tab with the help panel opened by the button: a column below the header, two sections open.
await open("/existing/archive%3Anonsan-strawberry/visits");
await replaceNav("축제 탐색 메뉴", tabs("existing", 0) + area("existing", 0), "main{padding-right:400px!important}");
await page.evaluate(html => document.body.insertAdjacentHTML("beforeend", html), side("existing", 0));
await shoot("existing-help", 1100);

// 6. Gather tab: only what was chosen, with sources; observed means computed from the page's own daily table.
await open("/existing/archive%3Anonsan-strawberry/visits");
await page.getByRole("button", { name: "수치 표 보기" }).first().click();
await page.waitForTimeout(600);
const editions = await page.evaluate(() => [...document.querySelectorAll("table")].map(t => {
  const rows = [...t.querySelectorAll("tr")].slice(1).map(r => [...r.children].map(c => c.textContent.trim()));
  const value = r => Number(r[3].replace(/,/g, ""));
  const during = rows.filter(r => r[2] === "개최기간"), first = rows.indexOf(during[0]), last = rows.indexOf(during[during.length - 1]);
  const mean = list => Math.round(list.reduce((s, r) => s + value(r), 0) / list.length);
  return { year: rows[0][0].slice(0, 4), start: during[0][0], end: during[during.length - 1][0], days: during.length,
    before: mean(rows.slice(0, first)), during: mean(during), after: mean(rows.slice(last + 1)), beforeDays: first, afterDays: rows.length - last - 1 };
}));
await open("/existing/archive%3Anonsan-strawberry/timing");
await page.evaluate(({ tabsHtml, checks, goal, editions, kinds }) => {
  const nav = document.querySelector('nav[aria-label="축제 탐색 메뉴"]');
  while (nav.nextElementSibling) nav.nextElementSibling.remove();
  const fmt = n => n.toLocaleString("ko-KR");
  nav.outerHTML = `<div class="g-wrap">${tabsHtml}
  <section class="g2-area"><div><p class="goal">${goal}</p><p class="cannot">입력 없이도 지금 고른 내용으로 만들어요. 개인 검토 자료이며 공식 문서가 아니에요. 새로 고치면 탭에서 고른 장소·후보 기간은 다시 골라야 해요.</p></div>
    <div class="g2-help"><span class="g-btn primary">인쇄·PDF로 저장</span></div></section>
  <div class="g-sum">
    <section class="g-card"><h3>방문 흐름 돌아보기</h3>${editions.map(e => `<p><b>${e.year}년 ${e.start.slice(5).replace("-", ".")}–${e.end.slice(5).replace("-", ".")}</b> (${e.days}일)<br>개최 전 ${e.beforeDays}일 <b>${fmt(e.before)}</b> · 개최기간 <b>${fmt(e.during)}</b> · 종료 후 ${e.afterDays}일 <b>${fmt(e.after)}</b> 명/일</p>`).join("")}
      <p class="g-note">논산시 전체 외지인 방문 추정의 관측 일평균 · 한국관광공사 지역별 방문자 · 수집 시각은 인쇄본에 함께 표시</p></section>
    <section class="g-card"><h3>연계 관광 찾기</h3><p>선택한 장소: 강경 옥녀봉 <span class="g-tag">예시 선택</span></p><p>기준점·반경을 정했다면 그 조건도 함께 적혀요.</p><p class="g-note">등록 정보예요. 영업·수용 가능을 뜻하지 않아요.</p></section>
    <section class="g-card"><h3>후보 기간과 등록 일정</h3><p>후보 A <b>2027.3.25(목)–3.28(일)</b> <span class="g-tag">예시 선택</span></p><ul class="g2-overlap"><li>같은 기간 논산시 등록 행사: 지금 등록된 일정 없음(아직 등록 전일 수 있어요)</li><li>공휴일: 이 기간 정보를 불러오지 못해 미확인</li></ul><p class="g-note">등록 일정은 개최 확정이 아니에요. 2026-10-03 조회.</p></section>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:16px;margin-top:16px">
    <section class="g-card"><h3>판단 메모 <span class="g-tag">선택</span></h3><p class="g-note" style="margin:0 0 8px">유지할 점·바꿀 문제와 그 이유를 적으면 인쇄본에 함께 나와요. 비워 둬도 돼요.</p><div style="height:150px;border:1px solid #10233d33;border-radius:10px;background:#fbfbfa"></div></section>
    <section class="g-card"><h3>다음에 확인할 일 <span class="g-tag">선택</span></h3><p class="g-note" style="margin:0 0 6px">표시하지 않아도 모든 기능을 쓸 수 있어요. 이 브라우저에만 남아요. 자세한 절차는 축제 준비 전체 과정에서 볼 수 있어요.</p>
      <ul class="g2-check">${checks.map((c, i) => `<li><span>${c.text}<br><span class="g2-kind">${kinds[c.kind]}</span></span><span class="g2-radios"><span class="${i === 0 ? "on" : ""}">확인함</span><span class="${i === 2 ? "on" : ""}">해당 없음</span><span class="${i === 4 ? "on" : ""}">나중에</span></span></li>`).join("")}</ul></section>
  </div></div>`;
}, { tabsHtml: tabs("existing", 3), checks: content.existing.tabs[3].nextChecks, goal: content.existing.tabs[3].goal, editions, kinds: content.kinds });
await shoot("existing-gather", 1350);

// 7. Whole-process guide: order fixed after review, questions and whom to consult instead of thresholds.
await open("/");
await page.evaluate(({ g, img }) => {
  const main = document.querySelector("main");
  main.innerHTML = `<div class="g-wrap" style="max-width:1440px;margin:auto">
    <section class="g-guide-hero"><div><p style="margin:0;font-size:13px;font-weight:800;color:#2f5fd0">처음 축제를 맡은 담당자를 위해</p>
      <h1 style="font-size:34px;font-weight:800;margin:4px 0 10px">축제 준비 전체 과정</h1><p style="font-size:16px;line-height:1.7;color:#2a3a52">${g.intro}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="g-btn primary">기존 축제 개선 시작 →</span><span class="g-btn">새 축제 기획 시작 →</span></div></div><img src="${img}" alt=""></section>
    <ol class="g-phases">${g.phases.map(p => `<li class="g2-phase ${p.pickdday ? "help" : ""}"><div class="when" style="font-weight:800;font-size:15px">${p.title}<small style="display:block;font-weight:600;color:#5d6b80;font-size:12.5px;margin-top:4px">${p.when}</small>${p.pickdday ? `<span class="g-pd">pickDday로 살펴볼 수 있어요</span>` : ""}</div>
      <div><h4>하는 일</h4><ul>${p.do.map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div><h4>확인할 질문</h4><ul>${p.ask.map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div><h4>협의할 곳</h4><ul>${p.consult.map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div><h4>원문</h4><ul>${p.read.map(x => `<li><u>${x}</u> ↗</li>`).join("")}</ul></div></li>`).join("")}</ol></div>`;
}, { g: content.guide, img: sample("guide-process") });
await shoot("guide", 1000, true);

await browser.close();
