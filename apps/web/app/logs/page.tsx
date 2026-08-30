import Link from "next/link";
import { notFound } from "next/navigation";
import { isPublicReadonly } from "@/lib/app-mode";
import { listApiLogs } from "@/lib/queries";

const kinds = ["all", "success", "empty", "error"] as const;

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  if (isPublicReadonly()) notFound();
  const { kind: requestedKind } = await searchParams;
  const kind = kinds.includes(requestedKind as (typeof kinds)[number])
    ? (requestedKind as (typeof kinds)[number])
    : "all";
  const logs = await listApiLogs({ kind: kind === "all" ? undefined : kind });

  return (
    <div>
      <h1 className="text-3xl font-extrabold">KTO 실호출 로그</h1>
      <p className="mt-2 mb-6 text-sm text-muted">
        서비스키는 마스킹됩니다. 정상·빈결과·오류를 구분해 공모전 증빙으로 남깁니다.
      </p>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="호출 결과 필터">
        {kinds.map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/logs" : `/logs?kind=${value}`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${kind === value ? "bg-navy text-white" : "bg-white text-muted shadow-card"}`}
          >
            {kindLabel(value)}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="px-4 py-3">시각</th>
              <th className="px-4 py-3">오퍼레이션</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">결과</th>
              <th className="px-4 py-3">소요</th>
              <th className="px-4 py-3">요약</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.id} className="border-t border-ink/5">
                <td className="px-4 py-3 whitespace-nowrap">{row.createdAt.toLocaleString("ko-KR")}</td>
                <td className="px-4 py-3">{row.operation}</td>
                <td className="px-4 py-3">{row.status ?? "없음"}</td>
                <td className="px-4 py-3">{row.resultKind}</td>
                <td className="px-4 py-3 whitespace-nowrap">{row.durationMs.toLocaleString("ko-KR")}ms</td>
                <td className="px-4 py-3">
                  <div>{row.summary ?? "없음"}</div>
                  <div className="text-xs text-muted">{row.urlMasked}</div>
                </td>
              </tr>
            ))}
            {!logs.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">이 결과의 호출 로그가 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function kindLabel(kind: (typeof kinds)[number]) {
  if (kind === "success") return "정상";
  if (kind === "empty") return "빈결과";
  if (kind === "error") return "오류";
  return "전체";
}
