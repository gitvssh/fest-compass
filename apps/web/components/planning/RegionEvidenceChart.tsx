import type { History } from "@/lib/region/types";

export function RegionEvidenceChart({ history: h }: { history: History }) {
  if (!h.points.some(p => p.value !== null)) return <p>방문 추세 그래프 미확보 · 0으로 대체하지 않습니다.</p>;
  const max = Math.max(1, ...h.points.map(p => p.value ?? 0));
  const first = Date.parse(h.points[0].date), span = Math.max(86400000, Date.parse(h.points.at(-1)!.date) - first);
  const x = (date: string) => 70 + (Date.parse(date) - first) / span * 620;
  const y = (value: number) => 200 - value / max * 170;
  const paths: string[] = []; let path = "", previous = "";
  for (const p of h.points) {
    if (p.value === null || (previous && Date.parse(p.date) - Date.parse(previous) !== 86400000)) { if (path) paths.push(path); path = ""; }
    if (p.value !== null) path += `${path ? "L" : "M"}${x(p.date)},${y(p.value)}`;
    previous = p.date;
  }
  if (path) paths.push(path);
  return <section className="space-y-2"><h4 className="font-bold">보관한 지역 방문 추세</h4><p>{h.metric} · {h.unit} · {h.points[0].date} ~ {h.points.at(-1)!.date}<br />0 기준 축 · 날짜별 값 · 결측은 연결하지 않음</p>
    <svg viewBox="0 0 760 250" className="w-full" role="img" aria-label="보관한 지역 방문 추세. 날짜별 원값은 아래 수치 표에서 확인"><line x1="70" x2="690" y1="200" y2="200" stroke="#333" /><text x="5" y="204" fontSize="12">0</text><text x="5" y="30" fontSize="11">{max.toLocaleString("ko-KR")}</text>{paths.map((d, i) => <path key={i} d={d} fill="none" stroke="#1649b8" strokeWidth="2" />)}{h.points.filter(p => p.value !== null).map(p => <circle key={p.date} cx={x(p.date)} cy={y(p.value!)} r="3" fill="#1649b8"><title>{p.date} · {p.value} {h.unit}</title></circle>)}<text x="70" y="230" fontSize="12">{h.points[0].date}</text><text x="690" y="230" fontSize="12" textAnchor="end">{h.points.at(-1)!.date}</text></svg>
  </section>;
}
