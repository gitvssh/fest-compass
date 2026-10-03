// Renders the design-24 proposal mockups by adding proposed guide elements to the live public pages.
// Offline review images only, built from the trusted static draft in this folder; nothing here ships in the app.
// Output: docs/assets/design-24/mockup-*-v1.jpg
// Run from apps/web so Playwright resolves:  node ../../docs/assets/design-24/mockups/render.mjs
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

function tabs(journey, current, seen = []) {
  return `<ul class="g-tabs" aria-label="탭">${content[journey].tabs.map((t, i) =>
    `<li class="${i === current ? "current" : ""} ${t.optional ? "optional" : ""}"><a href="#">${esc(t.title)}${t.optional ? " (선택)" : ""}${seen.includes(i) ? '<span class="seen">봤음</span>' : ""}<small>${esc(t.data)}</small></a></li>`).join("")}</ul>`;
}
function area(journey, index, img, { large = false, open = false } = {}) {
  const t = content[journey].tabs[index];
  return `<section class="g-area ${large ? "large" : ""}">${img ? `<img src="${img}" alt="">` : ""}
    <div><p class="goal">${esc(t.goal)}</p><p class="must"><b>읽을 때</b> ${esc(t.essential)}</p>
    <ul class="g-q"><li class="g-q-label" style="background:none;padding:0;color:#5d6b80">살펴볼 질문</li>${t.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>
    <span class="g-help-btn ${open ? "on" : ""}">? 길잡이${open ? " 열림" : ""}</span></section>`;
}
function side(journey, index) {
  const t = content[journey].tabs[index], p = t.panel;
  return `<aside class="g-side g-wrap" aria-label="길잡이"><span class="g-close">닫기 ✕</span>
    <h2>길잡이 · ${esc(t.title)}</h2><p class="sub">처음 오셨을 때 한 번 열려요. 닫으면 다음부터는 ? 길잡이로 열어요.</p>
    <h3>자료 읽는 법</h3><ol>${p.howToRead.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    <h3>예시로 읽기</h3><p class="ex"><b>예시</b>${esc(p.example)}</p>
    <h3>용어</h3><dl>${p.terms.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <h3>더 읽어보기</h3><ul class="g-read">${p.readings.map(r => `<li><a href="#">${esc(r.title)} ↗</a><span class="meta">${esc(r.what)} · ${esc(r.issuer)} · ${esc(r.date)} · ${esc(r.format)}</span></li>`).join("")}</ul>
    <h3>자료 밖에서 확인할 일</h3><ul>${p.offline.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="g-note">점검은 정리 탭에서 할 수 있어요(선택).</p></aside>`;
}
const next = (journey, index) => `<div class="g-wrap"><div class="g-next"><a href="#">이어서: ${esc(content[journey].tabs[index].next)} <span>→</span></a></div></div>`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ko-KR" });
await context.addInitScript(() => { try { localStorage.setItem("fest-compass.intro-video.v1", "dismissed"); } catch {} });
const page = await context.newPage();
let consent = false;
async function open(path) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 90000 });
  if (!consent) {
    const reject = page.getByRole("button", { name: /모두 거부|Reject All/ });
    if (await reject.isVisible({ timeout: 6000 }).catch(() => false)) { await reject.click(); consent = true; }
  }
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: css + "header{position:static!important}" });
  await page.evaluate(() => { const b = document.createElement("div"); b.className = "g-proposal"; b.textContent = "제안 시안 · 구현 전"; document.body.append(b); });
}
async function shoot(name, height, full = false) {
  if (height) await page.setViewportSize({ width: 1440, height });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(assets, `mockup-${name}-v1.jpg`), type: "jpeg", quality: 82, fullPage: full });
  console.log("mockup", name);
}
const replaceNav = (label, html, extraCss = "") => page.evaluate(({ label, html, extraCss }) => {
  document.querySelector(`nav[aria-label="${label}"]`).outerHTML = `<div class="g-wrap">${html}</div>`;
  if (extraCss) { const s = document.createElement("style"); s.textContent = extraCss; document.head.append(s); }
}, { label, html, extraCss });

// 1. Home: goal, first-time order and outcome inside each purpose card + entry to the whole-process guide.
await open("/");
await page.evaluate(({ e, n }) => {
  const cards = [...document.querySelectorAll('section[aria-labelledby="purpose-heading"] > ul > li')];
  const mini = j => `<div class="g-wrap"><div class="g-mini"><b>목표</b> ${j.goal}<div style="margin-top:6px"><b>처음이라면 이 순서</b> <span style="color:#5d6b80">· 순서는 자유예요</span></div><ol>${j.tabs.map(t => `<li>${t.title}${t.optional ? "(선택)" : ""}</li>`).join("")}</ol><div style="margin-top:6px"><b>얻는 것</b> ${j.outcome}</div></div></div>`;
  cards[0].querySelector("p").insertAdjacentHTML("afterend", mini(e));
  cards[1].querySelector("p").insertAdjacentHTML("afterend", mini(n));
  document.querySelector('section[aria-labelledby="purpose-heading"] > ul').insertAdjacentHTML("afterend",
    `<div class="g-wrap"><div class="g-band"><span><b>축제를 처음 맡으셨나요?</b> 지난 회차 돌아보기부터 예산 관문, 개최 준비, 결과 정리까지 준비 과정과 확인할 기준을 한 번에 보세요.</span><span class="g-btn">축제 준비 전체 과정 보기 →</span></div></div>`);
}, { e: content.existing, n: content.new });
await shoot("home", 1300);

// 2. Existing journey start: flow map below the search form.
await open("/existing/search");
await page.evaluate(({ j, img }) => {
  document.querySelector('form[aria-label="기존 축제 찾기"]').insertAdjacentHTML("afterend",
    `<div class="g-wrap"><section class="g-flow"><img src="${img}" alt=""><div><h2>기존 축제 개선은 이렇게 살펴봐요</h2><p class="goal">${j.goal}</p>
    <p class="legend">처음이라면 이 순서로 보면 흐름이 이어져요 · 순서는 자유예요 · 입력 없이 볼 수 있어요</p>
    <ol>${j.tabs.map((t, i) => `<li><span class="num">${i + 1}</span><span><b>${t.title}${t.optional ? " (선택)" : ""}</b>${t.goal}</span></li>`).join("")}</ol>
    <p class="out"><b>마치면 얻는 것</b> ${j.outcome}</p></div></section></div>`);
}, { j: content.existing, img: purpose("existing-festival") });
await shoot("existing-start", 1320);

// 3. Existing first tab, first visit: guidance area with a small picture and the help panel opened once.
await open("/existing/archive%3Anonsan-strawberry/visits");
await replaceNav("축제 탐색 메뉴", tabs("existing", 0) + area("existing", 0, sample("step-existing-review"), { open: true }), "main{padding-right:420px!important}");
await page.evaluate(html => document.body.insertAdjacentHTML("beforeend", html), side("existing", 0));
await shoot("existing-step", 1250);

// 4. Alternative for the owner's decision: a larger picture in the guidance area, help panel closed.
await open("/existing/archive%3Anonsan-strawberry/visits");
await replaceNav("축제 탐색 메뉴", tabs("existing", 0, [1]) + area("existing", 0, sample("step-existing-review"), { large: true }));
await shoot("existing-step-large", 1150);

// 5. New first tab, panel closed, whole page so the continue link at the end is visible.
await open("/new/44230/resources");
await replaceNav("새 축제 탐색 메뉴", tabs("new", 0, [2]) + area("new", 0, sample("step-new-resources")));
await page.evaluate(html => { const main = document.querySelector("main"); main.insertAdjacentHTML("beforeend", html); }, next("new", 0));
await shoot("new-step", 1000, true);

// 6. Existing summary tab with the optional readiness check (DO-CONFIRM, no counts).
await open("/existing/archive%3Anonsan-strawberry/timing");
await page.evaluate(({ tabsHtml, checks, goal }) => {
  const nav = document.querySelector('nav[aria-label="축제 탐색 메뉴"]');
  while (nav.nextElementSibling) nav.nextElementSibling.remove();
  const states = ["on", "", "", "", "", "", ""], pick = i => i === 0 ? 0 : i === 3 ? 1 : i === 5 ? 2 : -1;
  nav.outerHTML = `<div class="g-wrap">${tabsHtml}
  <section class="g-area"><div style="grid-column:1/3"><p class="goal">${goal}</p><p class="must"><b>읽을 때</b> 지금 탭에서 고른 내용만 모았어요. 개인 검토 자료이며 공식 결재 문서가 아니에요.</p></div>
    <div style="display:flex;gap:8px"><span class="g-btn primary">인쇄·PDF로 저장</span><span class="g-btn">기획 후보로 이어서 작성 →</span></div></section>
  <div class="g-sum">
    <section class="g-card"><h3>지난 회차 돌아보기</h3><p>비교한 회차: <b>2025년 3.27–3.30(목–일)</b>, <b>2024년 3.21–3.24(목–일)</b></p><p>개최기간 일평균(논산시 외지인 방문 추정)<br>2025년 <span class="big">85,213</span>명/일 · 2024년 <span class="big">90,413</span>명/일</p><p class="g-note">시군구 전체 방문 추정이에요. 축제장 입장객이 아니에요.</p></section>
    <section class="g-card"><h3>연계 관광 찾기</h3><p>기준점: 강경 옥녀봉 · 반경 5km <span class="g-tag">예시 선택</span></p><p>함께 본 곳: 강경근대거리, 강경역사관, 관촉사(논산)</p><p class="g-note">등록 정보예요. 영업·수용 가능을 뜻하지 않아요.</p></section>
    <section class="g-card"><h3>다음 개최 시기 검토</h3><p>후보 기간 A: <b>2026.3.26(목)–3.29(일)</b> <span class="g-tag">예시 선택</span></p><p>후보 기간 B: <b>2026.4.2(목)–4.5(일)</b></p><p class="g-note">공휴일·같은 지역 등록 행사는 달력에서 확인했어요.</p></section>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1.25fr;gap:16px;margin-top:16px">
    <section class="g-card"><h3>메모 <span class="g-tag">선택</span></h3><p class="g-note" style="margin:0 0 8px">유지할 것·바꿀 것을 적으면 인쇄본에 함께 나와요. 비워 둬도 돼요.</p><div style="height:120px;border:1px solid #10233d33;border-radius:10px;background:#fbfbfa"></div></section>
    <section class="g-card"><h3>준비 점검 <span class="g-tag">선택</span></h3><p class="g-note" style="margin:0 0 6px">자료 밖에서 확인할 일이에요. 체크하지 않아도 모든 기능을 쓸 수 있어요. 이 브라우저에만 남아요.</p>
      <ul class="g-checks">${checks.map((c, i) => `<li><span>${c.text}<span class="layer">${c.layer}</span></span><span class="g-seg"><span class="${pick(i) === 0 ? "on" : ""}">확인함</span><span class="${pick(i) === 1 ? "on" : ""}">해당 없음</span><span class="${pick(i) === 2 ? "on" : ""}">나중에</span></span></li>`).join("")}</ul></section>
  </div></div>`;
}, { tabsHtml: tabs("existing", 3, [0, 1, 2]), checks: content.existing.tabs[3].checks, goal: content.existing.tabs[3].goal });
await shoot("existing-summary", 1400);

// 7. Whole-process guide for first-time officers.
await open("/");
await page.evaluate(({ g, img }) => {
  const main = document.querySelector("main");
  main.innerHTML = `<div class="g-wrap" style="max-width:1440px;margin:auto">
    <section class="g-guide-hero"><div><p style="margin:0;font-size:13px;font-weight:800;color:#2f5fd0">처음 축제를 맡은 담당자를 위해</p>
      <h1 style="font-size:34px;font-weight:800;margin:4px 0 10px">축제 준비 전체 과정</h1><p style="font-size:16px;line-height:1.7;color:#2a3a52">${g.intro}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="g-btn primary">기존 축제 개선 시작 →</span><span class="g-btn">새 축제 기획 시작 →</span></div>
      <p class="g-legend"><span><i>법령</i>지켜야 하는 기준</span><span><i>행정규칙</i>예규·훈령</span><span><i>매뉴얼·편람</i>권고·평가 기준</span><span><i>정책</i>정부 방침</span><span>· 2026-10-03 확인 기준</span></p></div><img src="${img}" alt=""></section>
    <ol class="g-phases">${g.phases.map(p => `<li class="g-phase ${p.pickdday ? "help" : ""}"><div class="when">${p.title}<small>${p.when}</small>${p.pickdday ? `<span class="g-pd">pickDday로 살펴볼 수 있어요</span>` : ""}</div>
      <div><h4>하는 일·만드는 자료</h4><ul>${p.do.map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div><h4>확인할 기준</h4><ul>${p.check.map(x => `<li>${x}</li>`).join("")}</ul></div>
      <div><h4>읽을거리</h4><ul>${p.read.map(x => `<li><u>${x}</u> ↗</li>`).join("")}</ul><span class="g-btn ghost" style="min-height:28px;padding:4px 0">준비 점검(선택) 펼치기</span></div></li>`).join("")}</ol></div>`;
}, { g: content.guide, img: sample("guide-process") });
await shoot("guide", 1000, true);

await browser.close();
