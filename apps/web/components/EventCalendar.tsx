"use client";
import { addMonths, eventsOn, inQueryRange, monthDays, monthInRange, monthLabel, WEEKDAYS, type CalendarItem, type Range } from "@/lib/region/calendar";

const MAX_PER_DAY = 3;
// Display only: the month changes what is shown, never the applied query or its results.
export function EventCalendar({ region, items, range, month, selectedId, onSelect, onMonth }: { region: string; items: CalendarItem[]; range: Range; month: string; selectedId: string; onSelect: (id: string) => void; onMonth: (month: string) => void }) {
  const prev = addMonths(month, -1), next = addMonths(month, 1);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className="region-button" aria-label={`이전 달, ${monthLabel(prev)} 보기`} disabled={!monthInRange(prev, range)} onClick={() => onMonth(prev)}>이전 달</button>
      <p className="text-center font-extrabold" aria-live="polite">{monthLabel(month)}</p>
      <button type="button" className="region-button" aria-label={`다음 달, ${monthLabel(next)} 보기`} disabled={!monthInRange(next, range)} onClick={() => onMonth(next)}>다음 달</button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-xs">
        <caption className="mb-2 text-left text-sm font-bold">{region} 행사 달력 · {monthLabel(month)}</caption>
        <thead><tr>{WEEKDAYS.map(d => <th key={d} scope="col" className="py-1 font-bold text-muted">{d}</th>)}</tr></thead>
        <tbody>{monthDays(month).map((week, w) => <tr key={w}>{week.map((date, i) => {
          if (!date) return <td key={`pad-${i}`} className="border border-ink/5 bg-paper/60" />;
          const inside = inQueryRange(date, range), events = eventsOn(items, date, range);
          return <td key={date} className={`h-20 border border-ink/10 p-1 align-top ${inside ? "bg-white" : "bg-paper text-muted"}`}>
            <span className="block font-bold">{Number(date.slice(8))}{!inside && <span className="sr-only"> 조회 기간 밖</span>}</span>
            {events.slice(0, MAX_PER_DAY).map(e => <button key={e.id} type="button" aria-pressed={e.id === selectedId} aria-label={`${date} ${e.title}`} title={e.title} onClick={() => onSelect(e.id)}
              className={`mt-0.5 block min-h-6 w-full truncate rounded px-1 py-0.5 text-left text-xs ${e.id === selectedId ? "bg-blue font-bold text-white ring-2 ring-navy" : "bg-blue-soft text-navy hover:bg-blue/20"}`}>{e.title}</button>)}
            {events.length > MAX_PER_DAY && <span className="mt-0.5 block text-xs text-muted">외 {events.length - MAX_PER_DAY}건</span>}
          </td>;
        })}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}
