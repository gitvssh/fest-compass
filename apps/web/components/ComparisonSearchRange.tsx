import { DAY } from "@/lib/comparison/model";
import type { Edition, SearchContext } from "@/lib/comparison/types";

export function ComparisonSearchRange({ query, editions }: { query: SearchContext; editions: Edition[] }) {
  if (query.mode !== "current") return null;
  const items = editions.filter(e => e.start && e.end && e.start <= query.end && e.end >= query.start).slice(0, 20);
  const total = (Date.parse(query.end) - Date.parse(query.start)) / DAY + 1;
  return <section className="rounded-xl border border-ink/10 p-4 text-sm space-y-3" aria-label="기획 기간과 등록 일정 겹침">
    <h3 className="font-bold">{query.dateRule === "overlap" ? "기획 기간과 겹치는 등록 일정" : "기획 기간 안에 시작하는 등록 일정"}</h3>
    <p>기획 기간 · {query.start} ~ {query.end}</p>
    <p className="text-xs leading-6 text-muted">같은 날짜 축에서 기획 기간 안의 일정만 표시합니다. 전체 등록 일정은 각 항목의 날짜를 확인하세요. 제공처에 없는 행사와 실제 개최·취소·변경은 미확인입니다.</p>
    {items.map(e => {
      const start = e.start! > query.start ? e.start! : query.start, end = e.end! < query.end ? e.end! : query.end;
      const days = (Date.parse(end) - Date.parse(start)) / DAY + 1, offset = (Date.parse(start) - Date.parse(query.start)) / DAY;
      const cancelled = e.status === "취소";
      return <div key={e.id} className="space-y-1"><p className="font-bold">{e.name}</p><p className="text-xs">등록 {e.start} ~ {e.end} · {cancelled ? "취소 회차: 겹침 판단 보류" : `기획 기간 내 ${start} ~ ${end} (${days}일)`}</p>{!cancelled && <div aria-hidden="true" className="h-3 rounded bg-paper"><div className="h-3 rounded bg-blue" style={{ marginLeft: `${offset / total * 100}%`, width: `${days / total * 100}%` }}/></div>}</div>;
    })}
    {editions.length > 20 && <p className="text-xs">일정 그림은 검색 결과 순서로 최대 20건입니다. 전체 결과는 아래 목록에서 확인하세요.</p>}
  </section>;
}
