"use client";
import { useId, useRef } from "react";
import type { EditionHistory } from "@/lib/existing/types";
import { ChartTooltip, CursorAnnouncement, useDayCursor } from "./ChartCursor";
import { dayWithWeekday, rawNumber, shortDate, WEEKDAY_SHORT } from "./format";

const H = 214, L = 44, R = 8, T = 24, B = 42, PLOT_H = H - T - B, DAY_W = 16, LABEL_GAP = 34;
const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });

/** A round upper bound shared by every edition chart so heights compare directly. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max)), step = magnitude / 2;
  return Math.ceil(max / step) * step;
}
/** Width for `slots` days at a fixed day spacing, shared by all compared editions. */
export const chartWidth = (slots: number) => L + R + Math.max(1, slots) * DAY_W;

/**
 * One edition: actual dates on a shared day-width axis and shared Y range. Missing days break the line and
 * are never drawn as zero. The festival period is shaded and labelled in text. Long ranges scroll inside
 * their own region at 16px per day instead of squeezing labels.
 */
export function EditionChart({ edition, region, yMax, slots }: { edition: EditionHistory; region: string; yMax: number; slots: number }) {
  const id = useId(), points = edition.points, W = chartWidth(slots);
  const figure = useRef<HTMLElement>(null), scroller = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), cur = useDayCursor();
  const x = (i: number) => L + (i + 0.5) * DAY_W, y = (v: number) => T + (1 - v / yMax) * PLOT_H;
  const festival = points.map((p, i) => (p.inFestival ? i : -1)).filter(i => i >= 0);
  const segments: string[] = [];
  let path = "";
  points.forEach((p, i) => {
    if (p.value === null) { if (path) segments.push(path); path = ""; return; }
    path += `${path ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (path) segments.push(path);
  // Date labels: window and festival edges first, then weekly marks; any label that would collide is skipped.
  const weekly = points.length > 21 ? points.map((_, i) => i).filter(i => i % 7 === 0) : [];
  const wanted = [0, festival[0], festival.at(-1), points.length - 1, ...weekly].filter((i): i is number => i !== undefined && i >= 0 && i < points.length);
  const dateTicks: number[] = [];
  for (const i of wanted) if (!dateTicks.includes(i) && dateTicks.every(t => Math.abs(x(t) - x(i)) >= LABEL_GAP)) dateTicks.push(i);
  const first = points[0]?.date, last = points.at(-1)?.date;
  const missing = points.some(p => p.value === null);
  const title = `${edition.year}년 ${region} 외지인 방문 추이${first && last ? `, ${dayWithWeekday(first)}부터 ${dayWithWeekday(last)}까지` : ""}`;
  // The chart scales with its box: pointer positions are mapped back to the drawing's own units.
  const indexAt = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box || !points.length) return null;
    const sx = (clientX - box.left) * (W / box.width);
    const i = Math.floor((sx - L) / DAY_W);
    return sx < L || i >= points.length ? null : Math.max(0, i);
  };
  const anchor = (index: number) => {
    const el = scroller.current, box = svg.current?.getBoundingClientRect(), frame = figure.current?.getBoundingClientRect();
    if (!el || !box || !frame) return null;
    const scale = box.width / W, cx = x(index) * scale;
    if (cx - DAY_W * scale < el.scrollLeft) el.scrollLeft = cx - DAY_W * scale; else if (cx + DAY_W * scale > el.scrollLeft + el.clientWidth) el.scrollLeft = cx + DAY_W * scale - el.clientWidth;
    const after = svg.current!.getBoundingClientRect();
    return { px: after.left - frame.left + cx, py: after.top - frame.top + T * scale + 8 };
  };
  const hot = cur.cursor ? points[cur.cursor.index] ?? null : null;
  const hotText = hot ? `${edition.year}년 ${dayWithWeekday(hot.date)} ${hot.value === null ? "값 없음" : `${rawNumber(hot.value)}명`}${hot.inFestival ? " 개최기간" : ""}` : "";
  return <figure ref={figure} className="relative min-w-0">
    <div ref={scroller} role="region" aria-label={`${edition.year}년 그래프`} tabIndex={0}
      onKeyDown={e => cur.key(e, points.length, Math.max(0, festival[0] ?? 0), anchor)} onBlur={() => { if (cur.cursor?.via === "keyboard") cur.clear(); }}
      className="overflow-x-auto rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/40">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W }} className="block w-full touch-pan-x" role="img" aria-labelledby={`${id}-t ${id}-d`}
        onPointerMove={e => cur.point(e, indexAt(e.clientX), figure.current)} onPointerDown={e => cur.point(e, indexAt(e.clientX), figure.current)} onPointerLeave={cur.leave}>
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{`${edition.start && edition.end && festival.length ? `개최기간 ${dayWithWeekday(edition.start)}~${dayWithWeekday(edition.end)}. ` : ""}${missing ? "값이 없는 날은 선을 끊었어요. " : ""}날짜별 값은 수치 표에서 볼 수 있어요.`}</desc>
        {festival.length > 0 && <g>
          <rect x={x(festival[0]) - DAY_W / 2} y={T} width={DAY_W * festival.length} height={PLOT_H} fill="#dce8ff" />
          <text x={x(festival[0]) - DAY_W / 2 + 2} y={T - 7} fontSize={11} fontWeight={700} fill="#2667e8">개최기간</text>
        </g>}
        {[0, 0.5, 1].map(r => <g key={r}>
          <line x1={L} x2={W - R} y1={y(yMax * r)} y2={y(yMax * r)} stroke="#d5dce3" />
          <text x={L - 5} y={y(yMax * r) + 4} fontSize={10} textAnchor="end" fill="#4b5b6d">{compact.format(yMax * r)}</text>
        </g>)}
        {segments.map((d, i) => <path key={i} d={d} fill="none" stroke="#071a33" strokeWidth={2} strokeLinejoin="round" />)}
        {points.map((p, i) => p.value !== null && <circle key={p.date} cx={x(i)} cy={y(p.value)} r={2.6} fill={p.inFestival ? "#2667e8" : "#071a33"} />)}
        {points.map((p, i) => <text key={`w-${p.date}`} x={x(i)} y={H - 25} fontSize={9} textAnchor="middle" fill={p.weekday === 0 || p.weekday === 6 ? "#10233d" : "#65738a"} fontWeight={p.weekday === 0 || p.weekday === 6 ? 700 : 400}>{WEEKDAY_SHORT[p.weekday]}</text>)}
        {dateTicks.map(i => <text key={`d-${i}`} x={x(i)} y={H - 8} fontSize={10} textAnchor={i === 0 ? "start" : "middle"} dx={i === 0 ? -DAY_W / 2 : 0} fill="#4b5b6d">{shortDate(points[i].date)}</text>)}
        {cur.cursor && hot && <g aria-hidden="true">
          <line x1={x(cur.cursor.index)} x2={x(cur.cursor.index)} y1={T} y2={T + PLOT_H} stroke="#10233d" strokeWidth={1} strokeDasharray="3 3" />
          {hot.value !== null && <><circle cx={x(cur.cursor.index)} cy={y(hot.value)} r={7} fill={hot.inFestival ? "#2667e8" : "#071a33"} opacity={0.16} />
            <circle cx={x(cur.cursor.index)} cy={y(hot.value)} r={4} fill={hot.inFestival ? "#2667e8" : "#071a33"} /></>}
        </g>}
      </svg>
    </div>
    {cur.cursor && hot && <ChartTooltip cursor={cur.cursor} width={figure.current?.clientWidth ?? W}>
      <p className="text-xs font-bold text-muted">{edition.year}년 {dayWithWeekday(hot.date)}</p>
      <p className="flex items-center gap-2 whitespace-nowrap"><span className="font-extrabold tabular-nums">{hot.value === null ? "값 없음" : `${rawNumber(hot.value)}명`}</span>
        {hot.inFestival && <span className="rounded-full bg-blue-soft px-1.5 text-[11px] font-bold text-[#164ea1]">개최기간</span>}</p>
    </ChartTooltip>}
    <CursorAnnouncement text={cur.cursor?.via === "keyboard" ? hotText : ""} />
    {missing && <figcaption className="mt-1 text-xs text-muted">선이 끊긴 날: 값 없음</figcaption>}
  </figure>;
}
