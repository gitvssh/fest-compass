// Decimal input is preserved as text; round once per line using integer arithmetic.
// No tax rate, exchange rate, legal classification or date rule is inferred here.
import type { BudgetLine, Vat } from "./budget-types";

export const MONEY_MAX = Number.MAX_SAFE_INTEGER;
const big = BigInt;
export function decimal(raw: string): { n: bigint; d: bigint } | null {
  if (raw === "") return null;
  if (typeof raw !== "string" || !/^\d{1,16}(?:\.\d{1,6})?$/.test(raw)) throw new Error("숫자는 음수·쉼표 없이 소수 6자리까지 입력하세요.");
  const [whole, fraction = ""] = raw.split("."), d = big(10) ** big(fraction.length), n = big(whole + fraction);
  if (n > big(MONEY_MAX) * d) throw new Error("안전하게 표현할 수 있는 금액 범위를 넘었습니다.");
  return { n, d };
}
export function rounded(n: bigint, d: bigint): number {
  const value = (n * big(2) + d) / (d * big(2));
  if (value > big(MONEY_MAX)) throw new Error("안전하게 표현할 수 있는 합계 범위를 넘었습니다.");
  return Number(value);
}
export function won(raw: string): number | null { const x = decimal(raw); return x ? rounded(x.n, x.d) : null; }
export function sumWon(values: number[]): number {
  const n = values.reduce((sum, v) => sum + big(v), big(0));
  if (n > big(MONEY_MAX)) throw new Error("안전하게 표현할 수 있는 합계 범위를 넘었습니다.");
  return Number(n);
}
export function lineAmount(line: BudgetLine): { amount: number | null; vat: Vat; error: string } {
  try {
    const q = decimal(line.quantity), r = decimal(line.rate), period = decimal(line.periods), tax = decimal(line.taxAmount);
    if (tax && (line.vat !== "excluded" || !line.taxReference.trim())) throw new Error("별도 세금액에는 VAT 별도 기준과 세금액 근거가 필요합니다.");
    if (!q || !r || line.method === "unknown" || (line.method === "period" && (!period || !line.periodUnit.trim()))) return { amount: null, vat: line.vat, error: "" };
    let n = q.n * r.n, d = q.d * r.d;
    if (line.method === "period" && period) { n *= period.n; d *= period.d; }
    if (tax) { n = n * tax.d + tax.n * d; d *= tax.d; }
    return { amount: rounded(n, d), vat: tax ? "included" : line.vat, error: "" };
  } catch (e) { return { amount: null, vat: line.vat, error: (e as Error).message }; }
}
export function recordWon(original: string, unit: string, currency: string): number | null {
  if (!/^\d{1,16}(?:\.\d{1,6})?$/.test(original)) return null;
  try {
    const value = decimal(original);
    if (!value || currency !== "KRW" || !["won", "thousandWon"].includes(unit)) return null;
    return rounded(value.n * big(unit === "thousandWon" ? 1000 : 1), value.d);
  } catch { return null; }
}
export const money = (value: number | null) => value === null ? "미산정" : `${value.toLocaleString("ko-KR")}원`;
