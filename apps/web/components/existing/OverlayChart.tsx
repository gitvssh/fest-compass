"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { EditionHistory } from "@/lib/existing/types";
import { ChartTooltip, CursorAnnouncement, useDayCursor } from "./ChartCursor";
import { dayWithWeekday, editionLabel, rawNumber, WEEKDAY_SHORT } from "./format";

/**
 * One look per compared edition, newest first: colour plus a line pattern and a marker shape, so the editions stay
 * apart without colour too. The same look marks the edition's checkbox and its summary card.
 */
export const EDITION_LOOKS = [
  { color: "#2667e8", dash: undefined, marker: "circle", name: "실선·동그라미" },
  { color: "#c2410c", dash: "8 4", marker: "square", name: "긴 점선·네모" },
  { color: "#0f766e", dash: "2 3", marker: "diamond", name: "짧은 점선·마름모" },
] as const;
export type EditionLook = (typeof EDITION_LOOKS)[number];

const H = 288, L = 52, R = 18, T = 46, B = 30, ROW = 18, MIN_DAY = 26;
const PLOT_H = H - T - B;
const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
/** Days from the edition's first festival day (D). */
export const offsetOf = (start: string, date: string) => Math.round((Date.parse(date) - Date.parse(start)) / 86_400_000);
const dLabel = (o: number) => (o === 0 ? "D" : o < 0 ? `D${o}` : `D+${o}`);

export function LookSwatch({ look, className = "" }: { look: EditionLook; className?: string }) {
  return <svg aria-hidden="true" width="30" height="12" viewBox="0 0 30 12" className={`shrink-0 ${className}`}>
    <line x1="1" x2="29" y1="6" y2="6" stroke={look.color} strokeWidth="2.5" strokeDasharray={look.dash} />
    <Marker look={look} x={15} y={6} r={3.6} />
  </svg>;
}
function Marker({ look, x, y, r, hollow = false }: { look: EditionLook; x: number; y: number; r: number; hollow?: boolean }) {
  const fill = hollow ? "#ffffff" : look.color;
  if (look.marker === "square") return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={fill} stroke={look.color} strokeWidth={1.5} />;
  if (look.marker === "diamond") return <path d={`M${x},${y - r * 1.3}L${x + r * 1.3},${y}L${x},${y + r * 1.3}L${x - r * 1.3},${y}Z`} fill={fill} stroke={look.color} strokeWidth={1.5} />;
  return <circle cx={x} cy={y} r={r} fill={fill} stroke={look.color} strokeWidth={1.5} />;
}

export type OverlaySeries = { edition: EditionHistory; look: EditionLook };

/**
 * Compared editions drawn over one another on a shared scale, lined up on each edition's first festival day (D) so the
 * days before, during and after the festival sit on top of each other. Actual dates differ between editions: each
 * edition's festival span is marked above the plot and its weekdays run in a row under the axis. Missing days break a
 * line and are never drawn as zero. Values per date stay in the table.
 */
export function OverlayChart({ series, yMax, region }: { series: OverlaySeries[]; yMax: number; region: string }) {
  const id = useId(), wrap = useRef<HTMLDivElement>(null), figure = useRef<HTMLElement>(null), svg = useRef<SVGSVGElement>(null);
  const cur = useDayCursor();
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const lined = series.map(s => ({ ...s, points: s.edition.points.map(p => ({ ...p, offset: offsetOf(s.edition.start!, p.date) })) }));
  const offsets = lined.flatMap(s => s.points.map(p => p.offset));
  const first = offsets.length ? Math.min(...offsets) : 0, last = offsets.length ? Math.max(...offsets) : 0, slots = last - first + 1;
  const W = Math.max(width || 960, L + R + slots * MIN_DAY), dayW = (W - L - R) / slots, total = H + lined.length * ROW + 6;
  const x = (o: number) => L + (o - first + 0.5) * dayW, y = (v: number) => T + (1 - v / yMax) * PLOT_H;
  const festival = lined.flatMap(s => s.points.filter(p => p.inFestival).map(p => p.offset));
  const band = festival.length ? { from: Math.min(...festival), to: Math.max(...festival) } : null;
  const labelEvery = dayW >= 34 ? 1 : 2;
  // A chart wider than its box (phones) opens a few days before D, so the festival days are in view first.
  const scrolled = useRef(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !width || scrolled.current || W <= width) return;
    scrolled.current = true;
    el.scrollLeft = Math.max(0, x(Math.max(first, -2)) - L - dayW / 2);
  });
  const missing = lined.some(s => s.points.some(p => p.value === null));
  // Day under the pointer (or chosen by keyboard): index 0 is the first shown day, `first + index` its offset from D.
  const indexAt = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return null;
    const sx = clientX - box.left;
    return sx < L || sx > W - R ? null : Math.min(slots - 1, Math.max(0, Math.floor((sx - L) / dayW)));
  };
  const anchor = (index: number) => {
    const el = wrap.current, box = svg.current?.getBoundingClientRect(), frame = figure.current?.getBoundingClientRect();
    if (!el || !box || !frame) return null;
    const cx = x(first + index);
    if (cx - dayW < el.scrollLeft) el.scrollLeft = cx - dayW; else if (cx + dayW > el.scrollLeft + el.clientWidth) el.scrollLeft = cx + dayW - el.clientWidth;
    const after = svg.current!.getBoundingClientRect();
    return { px: after.left - frame.left + cx, py: after.top - frame.top + T + 8 };
  };
  const day = cur.cursor ? first + cur.cursor.index : null;
  const rows = day === null ? [] : lined.map(s => ({ s, p: s.points.find(p => p.offset === day) ?? null }));
  const said = day === null ? "" : `${dLabel(day)}: ${rows.map(({ s, p }) => p ? `${s.edition.year}년 ${dayWithWeekday(p.date)} ${p.value === null ? "값 없음" : `${rawNumber(p.value)}명`}${p.inFestival ? " 개최기간" : ""}` : `${s.edition.year}년 표시 기간 밖`).join(", ")}`;
  const describe = lined.map(s => `${s.edition.year}년 ${s.edition.start ? dayWithWeekday(s.edition.start) : ""}~${s.edition.end ? dayWithWeekday(s.edition.end) : ""}`).join(", ");
  return <figure ref={figure} className="relative min-w-0">
    <div ref={wrap} role="region" aria-label="겹쳐 보기 그래프" aria-describedby={`${id}-k`} tabIndex={0} style={{ minHeight: total }}
      onKeyDown={e => cur.key(e, slots, Math.min(slots - 1, Math.max(0, -first)), anchor)} onBlur={() => { if (cur.cursor?.via === "keyboard") cur.clear(); }}
      className="overflow-x-auto rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/40">
      {width > 0 && <svg ref={svg} width={W} height={total} viewBox={`0 0 ${W} ${total}`} className="block touch-pan-x" role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}
        onPointerMove={e => cur.point(e, indexAt(e.clientX), figure.current)} onPointerDown={e => cur.point(e, indexAt(e.clientX), figure.current)} onPointerLeave={cur.leave}>
        <title id={`${id}-t`}>{`${region} 외지인 방문 추이 · 회차 겹쳐 보기`}</title>
        <desc id={`${id}-d`}>{`개최 첫날(D)을 맞춰 ${describe}을 겹쳤어요. ${missing ? "값이 없는 날은 선을 끊었어요. " : ""}날짜별 값은 수치 표에서 볼 수 있어요.`}</desc>
        {band && <g>
          <rect x={x(band.from) - dayW / 2} y={T} width={(band.to - band.from + 1) * dayW} height={PLOT_H} fill="#eaf1fe" />
          <text x={x(band.from) - dayW / 2 + 4} y={T - 30} fontSize={12} fontWeight={700} fill="#2667e8">개최기간</text>
        </g>}
        {lined.map((s, i) => { const days = s.points.filter(p => p.inFestival).map(p => p.offset);
          return days.length ? <rect key={`span-${s.edition.editionId}`} x={x(Math.min(...days)) - dayW / 2 + 1} y={T - 22 + i * 6} width={(Math.max(...days) - Math.min(...days) + 1) * dayW - 2} height={4} rx={2} fill={s.look.color} /> : null; })}
        {[0, 0.5, 1].map(r => <g key={r}>
          <line x1={L} x2={W - R} y1={y(yMax * r)} y2={y(yMax * r)} stroke="#d5dce3" />
          <text x={L - 8} y={y(yMax * r) + 4} fontSize={11} textAnchor="end" fill="#4b5b6d">{compact.format(yMax * r)}</text>
        </g>)}
        {lined.map(s => {
          const segments: string[] = []; let path = "";
          for (const p of s.points) {
            if (p.value === null) { if (path) segments.push(path); path = ""; continue; }
            path += `${path ? "L" : "M"}${x(p.offset).toFixed(1)},${y(p.value).toFixed(1)}`;
          }
          if (path) segments.push(path);
          return <g key={s.edition.editionId}>
            {segments.map((d, i) => <path key={i} d={d} fill="none" stroke={s.look.color} strokeWidth={2.5} strokeDasharray={s.look.dash} strokeLinejoin="round" />)}
            {s.points.map(p => p.value !== null && <Marker key={p.date} look={s.look} x={x(p.offset)} y={y(p.value)} r={p.inFestival ? 4 : 3.2} hollow={!p.inFestival} />)}
          </g>;
        })}
        {day !== null && <g aria-hidden="true">
          <line x1={x(day)} x2={x(day)} y1={T} y2={T + PLOT_H} stroke="#10233d" strokeWidth={1} strokeDasharray="3 3" />
          {rows.map(({ s, p }) => p && p.value !== null && <g key={`hot-${s.edition.editionId}`}>
            <circle cx={x(day)} cy={y(p.value)} r={9} fill={s.look.color} opacity={0.16} />
            <Marker look={s.look} x={x(day)} y={y(p.value)} r={5} />
          </g>)}
        </g>}
        {Array.from({ length: slots }, (_, i) => first + i).map(o => (o === 0 || (o - first) % labelEvery === 0) &&
          <text key={`x${o}`} x={x(o)} y={H - 10} fontSize={11} textAnchor="middle" fontWeight={o === 0 ? 800 : 400} fill={o === 0 ? "#10233d" : "#4b5b6d"}>{dLabel(o)}</text>)}
        {lined.map((s, i) => <g key={`wd-${s.edition.editionId}`}>
          <line x1={8} x2={30} y1={H + 6 + i * ROW} y2={H + 6 + i * ROW} stroke={s.look.color} strokeWidth={2.5} strokeDasharray={s.look.dash} />
          <text x={34} y={H + 10 + i * ROW} fontSize={10} fill="#4b5b6d">{String(s.edition.year).slice(2)}</text>
          {s.points.map(p => { const weekend = p.weekday === 0 || p.weekday === 6;
            return <text key={p.date} x={x(p.offset)} y={H + 10 + i * ROW} fontSize={10} textAnchor="middle" fontWeight={weekend ? 800 : 400} fill={weekend ? s.look.color : "#65738a"}>{WEEKDAY_SHORT[p.weekday]}</text>; })}
        </g>)}
      </svg>}
    </div>
    {cur.cursor && day !== null && <ChartTooltip cursor={cur.cursor} width={figure.current?.clientWidth ?? W}>
      <p className="mb-1 text-xs font-extrabold text-ink">{dLabel(day)}{day === 0 ? " · 개최 첫날" : ""}</p>
      <ul className="space-y-1">{rows.map(({ s, p }) => <li key={s.edition.editionId} className="flex items-center gap-2 whitespace-nowrap">
        <LookSwatch look={s.look} />
        {p ? <>
          <span className="text-muted">{s.edition.year}년 {dayWithWeekday(p.date)}</span>
          <span className="font-extrabold tabular-nums">{p.value === null ? "값 없음" : `${rawNumber(p.value)}명`}</span>
          {p.inFestival && <span className="rounded-full bg-blue-soft px-1.5 text-[11px] font-bold text-[#164ea1]">개최기간</span>}
        </> : <span className="text-muted">{s.edition.year}년 · 표시 기간 밖</span>}
      </li>)}</ul>
    </ChartTooltip>}
    <CursorAnnouncement text={cur.cursor?.via === "keyboard" ? said : ""} />
    <figcaption className="mt-1 text-xs text-muted">D = 개최 첫날 · 굵은 요일은 토·일{missing ? " · 선이 끊긴 날: 값 없음" : ""}<span id={`${id}-k`} className="sr-only"> · 그래프를 고른 뒤 ←·→ 키로 날짜별 값을 들을 수 있어요</span></figcaption>
  </figure>;
}

/** Shown editions of the overlay: checkboxes carrying each edition's look. Unchecking only hides the line. */
export function OverlayLegend({ series, hidden, onToggle }: { series: OverlaySeries[]; hidden: ReadonlySet<string>; onToggle: (editionId: string) => void }) {
  return <fieldset className="min-w-0">
    <legend className="sr-only">그래프에 보일 회차</legend>
    <ul className="flex flex-wrap gap-2">
      {series.map(s => { const on = !hidden.has(s.edition.editionId);
        return <li key={s.edition.editionId}><label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${on ? "border-ink/25 bg-white font-bold" : "border-dashed border-ink/20 bg-paper text-muted"}`}>
          <input type="checkbox" checked={on} onChange={() => onToggle(s.edition.editionId)} />
          <LookSwatch look={s.look} className={on ? "" : "opacity-40"} />
          {editionLabel(s.edition)}<span className="sr-only"> 선 보이기</span>
        </label></li>; })}
    </ul>
  </fieldset>;
}
