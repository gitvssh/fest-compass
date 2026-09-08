/** Personal browser drafts only. These records are never production approvals or model inputs. */
export const WORKSPACE_KEY = "fest-compass.workspace.v1";
export const MAX_FILE_BYTES = 1_000_000;
export type Plan = { id: string; name: string; staff: number | null; shuttles: number | null; sessions: number | null; budget: number | null; note: string };
export type Decision = { id: string; at: string; plan: Plan; name: string; place: string; start: string; end: string; expected: number; basis: string; reason: string; owner: string };
export type FieldRecord = { id: string; at: string; condition: string; action: string; owner: string; done: boolean };
export type Outcome = { actual: number | null; source: string; method: string; lesson: string };
export type Draft = { id: string; name: string; start: string; end: string; place: string; sample: boolean; parent: string | null; expected: number | null; basis: string; plans: Plan[]; decisions: Decision[]; records: FieldRecord[]; outcome: Outcome };
export type Workspace = { schemaVersion: 1; activeId: string; drafts: Draft[] };
export const uid = () => globalThis.crypto.randomUUID();
const blankOutcome = (): Outcome => ({ actual: null, source: "", method: "", lesson: "" });
export function createDraft(sample: boolean): Draft {
  return { id: uid(), name: sample ? "논산딸기축제 · 운영 연습" : "새 축제", start: sample ? "2026-03-26" : "", end: sample ? "2026-03-29" : "", place: sample ? "충남 논산시" : "", sample, parent: null, expected: null, basis: "", plans: ["기본 운영안", "보강 운영안"].map(name => ({ id: uid(), name, staff: null, shuttles: null, sessions: null, budget: null, note: "" })), decisions: [], records: [], outcome: blankOutcome() };
}
export function validDates(start: string, end: string) { return isDate(start) && isDate(end) && start <= end; }
function isDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function decisionProblem(draft: Draft, plan: Plan, reason: string, owner: string): string | null {
  if (draft.outcome.actual !== null || draft.outcome.source || draft.outcome.method || draft.outcome.lesson) return "결과를 기록한 회차의 결정은 보존합니다. 다음 회차에서 새 계획을 기록하세요.";
  if (!draft.name.trim() || !validDates(draft.start, draft.end)) return "축제명과 시작·종료일을 먼저 확인하세요.";
  if (draft.expected === null || !draft.basis.trim()) return "행사 전체 입장 건수 가정과 근거를 먼저 입력하세요.";
  if (!plan.name.trim() || [plan.staff, plan.shuttles, plan.sessions, plan.budget].some(n => n === null)) return "선택할 운영안의 인원·셔틀·회차·예산을 입력하세요. 없는 자원은 0으로 적으세요.";
  if (!reason.trim() || !owner.trim()) return "선택 이유와 기록 담당자를 입력하세요.";
  if (draft.decisions.length >= 30) return "결정 기록은 회차당 30건까지 보관합니다. 파일로 보관한 뒤 다음 회차를 만드세요.";
  return null;
}
export function recordDecision(draft: Draft, planId: string, reason: string, owner: string): Draft {
  const plan = draft.plans.find(p => p.id === planId);
  if (!plan) throw new Error("운영안을 선택하세요.");
  const problem = decisionProblem(draft, plan, reason, owner);
  if (problem) throw new Error(problem);
  const decision: Decision = { id: uid(), at: new Date().toISOString(), plan: { ...plan }, name: draft.name, place: draft.place, start: draft.start, end: draft.end, expected: draft.expected!, basis: draft.basis, reason: reason.trim(), owner: owner.trim() };
  return { ...draft, decisions: [...draft.decisions, decision], outcome: blankOutcome() };
}
export function decisionChanged(draft: Draft): boolean {
  const last = draft.decisions.at(-1);
  return !!last && (last.name !== draft.name || last.place !== draft.place || last.start !== draft.start || last.end !== draft.end || last.expected !== draft.expected || last.basis !== draft.basis || JSON.stringify(last.plan) !== JSON.stringify(draft.plans.find(p => p.id === last.plan.id)));
}
export function outcomeComparison(draft: Draft) {
  const decision = draft.decisions.at(-1), o = draft.outcome;
  if (!decision || o.actual === null || !o.source.trim() || !o.method.trim()) return null;
  return { planned: decision.expected, actual: o.actual, difference: o.actual - decision.expected, rate: decision.expected === 0 ? null : (o.actual - decision.expected) / decision.expected };
}
export function cloneEdition(draft: Draft): Draft {
  return { ...draft, id: uid(), name: `${draft.name.slice(0, 90)} · 다음 회차`, start: "", end: "", sample: draft.sample, parent: draft.id, basis: `이전 회차 가정 · 재확인 필요: ${draft.basis}`.slice(0, 2000), plans: draft.plans.map(p => ({ ...p, id: uid() })), decisions: [], records: [], outcome: blankOutcome() };
}

// Reconstruct allowed fields: imported data cannot introduce code, arbitrary keys or unbounded collections.
export function parseWorkspace(raw: string): Workspace {
  if (new TextEncoder().encode(raw).length > MAX_FILE_BYTES) throw new Error("파일은 1MB 이하여야 합니다.");
  try {
    const root = object(JSON.parse(raw));
    if (root.schemaVersion !== 1) throw new Error();
    const drafts = array(root.drafts, 20).map(value => {
      const d = object(value);
      if (typeof d.sample !== "boolean") throw new Error();
      const start = date(d.start), end = date(d.end);
      const plans = array(d.plans, 4, 2).map(plan);
      const decisions = array(d.decisions, 30, 0).map(value => {
        const r = object(value), ds = date(r.start), de = date(r.end);
        if (!validDates(ds, de)) throw new Error();
        const selected = plan(r.plan);
        if ([selected.staff, selected.shuttles, selected.sessions, selected.budget].some(n => n === null)) throw new Error();
        return { id: text(r.id, 100, true), at: timestamp(r.at), plan: selected, name: text(r.name, 120, true), place: text(r.place, 300), start: ds, end: de, expected: numeric(r.expected, false)!, basis: text(r.basis, 2000, true), reason: text(r.reason, 2000, true), owner: text(r.owner, 120, true) };
      });
      const records = array(d.records, 100, 0).map(value => { const r = object(value); if (typeof r.done !== "boolean") throw new Error(); return { id: text(r.id, 100, true), at: timestamp(r.at), condition: text(r.condition, 1000, true), action: text(r.action, 1000, true), owner: text(r.owner, 120, true), done: r.done }; });
      const o = object(d.outcome);
      unique(plans); unique(decisions); unique(records);
      return { id: text(d.id, 100, true), name: text(d.name, 120), start, end, place: text(d.place, 300), sample: d.sample, parent: d.parent === null ? null : text(d.parent, 100, true), expected: numeric(d.expected), basis: text(d.basis, 2000), plans, decisions, records, outcome: { actual: numeric(o.actual), source: text(o.source, 2000), method: text(o.method, 2000), lesson: text(o.lesson, 2000) } };
    });
    unique(drafts);
    const activeId = text(root.activeId, 100, true);
    if (!drafts.some(d => d.id === activeId)) throw new Error();
    return { schemaVersion: 1, activeId, drafts };
  } catch { throw new Error("지원하지 않거나 손상된 작업 파일입니다. 기존 기록은 유지됩니다."); }
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; }
function text(value: unknown, max: number, required = false): string { if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(); return value; }
function date(value: unknown): string { const s = text(value, 10); if (s && !isDate(s)) throw new Error(); return s; }
function timestamp(value: unknown): string { const s = text(value, 30, true); if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || Number.isNaN(Date.parse(s))) throw new Error(); return s; }
function numeric(value: unknown, nullable = true): number | null { if (value === null && nullable) return null; if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) throw new Error(); return value; }
function array(value: unknown, max: number, min = 1): unknown[] { if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(); return value; }
function unique(rows: { id: string }[]) { if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error(); }
function plan(value: unknown): Plan { const p = object(value); return { id: text(p.id, 100, true), name: text(p.name, 120), staff: numeric(p.staff), shuttles: numeric(p.shuttles), sessions: numeric(p.sessions), budget: numeric(p.budget), note: text(p.note, 2000) }; }
