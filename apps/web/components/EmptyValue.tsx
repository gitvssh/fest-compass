import { formatNumber, formatPercent } from "@/lib/format";

export function EmptyValue({
  value,
  kind = "number",
  digits = 0,
  suffix,
}: {
  value: number | string | null | undefined;
  kind?: "number" | "percent" | "text";
  digits?: number;
  suffix?: string;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted">없음</span>;
  }
  if (kind === "text") {
    return <span>{String(value)}</span>;
  }
  const formatted = kind === "percent" ? formatPercent(Number(value)) : formatNumber(Number(value), digits);
  if (formatted === null) return <span className="text-muted">없음</span>;
  return (
    <span>
      {formatted}
      {suffix ? <small className="ml-1 text-sm font-medium text-muted">{suffix}</small> : null}
    </span>
  );
}
