import { day, REGIONS } from "../region/model";
import { encodeEvidence } from "../region/evidence";
import { encodeComparisons } from "../comparison/evidence";
import { CONDITIONS, FIELDS, PROGRESS, REVIEW_STATUS, STAGES, VENUE_STATUS } from "./types";
import type { Option, Period, PlanDraft, Planning, ReadinessTask, SourceCopy, Stage, VenueCheck } from "./types";
import { copiedBudget } from "./budget-model";
import { validateBudget } from "./budget-validation";

export const PLANNING_KEY = "fest-compass.planning.v1";
export const MAX_PLANNING_BYTES = 5_000_000;
export const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
export function newOption(name = "후보 A"): Option {
  return { id: uid(), name, theme: "", item: "", audience: "", venue: "", periods: { setup: { start: "", end: "" }, event: { start: "", end: "" }, teardown: { start: "", end: "" } }, assumptions: "", constraints: "", decision: "undecided", reason: "", links: [], venueChecks: [], tasks: [] };
}
export function newPlanning(year: number): Planning {
  return { format: "fest-compass-planning", version: 2, stamp: uid(), updatedAt: new Date().toISOString(), draft: { id: uid(), title: "올해 축제 기획", regionKey: "", year, department: "", purpose: "", continuity: "unknown", period: { start: "", end: "" }, asOf: today(), relations: [], options: [newOption()], evidence: [] }, revisions: [] };
}
export function taskBasis(o: Option): string { return JSON.stringify({ venue: o.venue, item: o.item, audience: o.audience, periods: o.periods }); }
export function venueBasis(o: Option, stage: Stage): string { return JSON.stringify({ venue: o.venue, item: o.item, audience: o.audience, period: o.periods[stage] }); }
export function currentCheck(o: Option, stage: Stage, kind: VenueCheck["kind"]): VenueCheck | undefined {
  // Keep the old record; a changed date/scope requires a new confirmation.
  return o.venueChecks.findLast(c => c.stage === stage && c.kind === kind && c.basis === venueBasis(o, stage));
}
export function taskStatus(o: Option, t: ReadinessTask) {
  const stale = t.basis !== taskBasis(o);
  const blocked = t.dependsOn.filter(id => { const p = o.tasks.find(v => v.id === id)!; return p.basis !== taskBasis(o) || !(p.applies === "no" || p.progress === "done"); });
  return { stale, blocked, review: t.reviews.findLast(r => r.basis === taskBasis(o))?.status ?? "unknown" };
}
export function newTask(o: Option): ReadinessTask {
  return { id: uid(), title: "", owner: "", due: "", needed: "", reference: "", applies: "unknown", naReason: "", decidedAt: "", progress: "todo", dependsOn: [], exceptionReason: "", basis: taskBasis(o), reviews: [] };
}
export function duplicateOption(o: Option): Option {
  const next = copy(o), ids = new Map(o.tasks.map(t => [t.id, uid()]));
  next.id = uid(); next.name = `${o.name} 복사`.slice(0, 200); next.decision = "undecided"; next.reason = ""; next.venueChecks = [];
  next.tasks = next.tasks.map(t => ({ ...t, id: ids.get(t.id)!, dependsOn: t.dependsOn.map(id => ids.get(id)!), due: "", applies: "unknown", naReason: "", decidedAt: "", progress: "todo", exceptionReason: "", reviews: [], basis: taskBasis(next) }));
  if (o.budget) next.budget = copiedBudget(o.budget, next, ids);
  return next;
}
export function connectEvidence(d: PlanDraft, optionId: string, source: SourceCopy, field: keyof typeof FIELDS, reason: string): PlanDraft {
  const next = copy(d), option = next.options.find(o => o.id === optionId);
  if (!option) throw new Error("연결할 후보를 먼저 선택하세요.");
  const existing = next.evidence.find(e => e.key === source.key);
  if (existing && JSON.stringify(existing) !== JSON.stringify(source)) throw new Error("같은 근거 식별자의 내용이 다릅니다. 기존 사본을 확인하세요.");
  if (option.links.some(l => l.sourceKey === source.key && l.field === field)) throw new Error("이 근거가 해당 판단 항목에 이미 연결되어 있습니다.");
  if (!existing) next.evidence.push(copy(source));
  option.links.push({ sourceKey: source.key, field, reason }); return next;
}
export function pruneEvidence(d: PlanDraft) { const used = new Set(d.options.flatMap(o => [...o.links.map(l => l.sourceKey), ...(o.budget?.lines.flatMap(l => l.evidenceKeys) ?? [])])); d.evidence = d.evidence.filter(e => used.has(e.key)); }
export function archive(p: Planning, note: string): Planning {
  const next = copy(p); next.revisions.push({ id: uid(), savedAt: new Date().toISOString(), note, draft: copy(p.draft) });
  validatePlanning(next); return next;
}
export function importPlanning(current: Planning, incoming: Planning): Planning {
  validatePlanning(incoming);
  const next = archive(current, "파일 가져오기 직전 초안");
  for (const r of incoming.revisions) {
    const old = next.revisions.find(x => x.id === r.id);
    if (old && JSON.stringify(old) !== JSON.stringify(r)) throw new Error("같은 보관본 식별자의 내용이 다릅니다. 기존 기획을 유지합니다.");
    if (!old) next.revisions.push(copy(r));
  }
  next.draft = copy(incoming.draft); validatePlanning(next); return next;
}
export function optionIssues(o: Option): string[] {
  const issues: string[] = [];
  for (const [k, label] of [["theme", "주제"], ["item", "아이템"], ["audience", "참여 대상"], ["venue", "장소"]] as const) if (!o[k].trim()) issues.push(`${label} 미정`);
  if (!o.periods.event.start || !o.periods.event.end) issues.push("행사 기간 미정");
  if (o.decision !== "undecided" && !o.reason.trim()) issues.push("선택·제외 이유 미입력");
  if (!o.links.length) issues.push("연결한 자료 없음 · 담당자 가정 단계");
  for (const s of Object.keys(STAGES) as Stage[]) {
    const check = currentCheck(o, s, "use");
    if (!check || check.status === "unknown") issues.push(`${STAGES[s]} 장소 사용 미확인`);
    else if (check.status !== "available") issues.push(`${STAGES[s]} 장소 사용 ${VENUE_STATUS[check.status]}`);
  }
  return issues;
}

function requireValue(ok: unknown, message = "기획 파일의 구조나 값이 올바르지 않습니다."): asserts ok { if (!ok) throw new Error(message); }
const str = (v: unknown, n = 2000): v is string => typeof v === "string" && v.length <= n;
const id = (v: unknown) => str(v, 80) && /^[a-zA-Z0-9_-]+$/.test(v);
const date = (v: unknown) => str(v, 10) && (v === "" || day(v));
const instant = (v: unknown) => str(v, 40) && Number.isFinite(Date.parse(v));
const member = (v: unknown, keys: object) => typeof v === "string" && Object.hasOwn(keys, v);
function period(p: Period) { requireValue(p && date(p.start) && date(p.end), "날짜 형식을 확인하세요."); requireValue(!p.start || !p.end || p.start <= p.end, "종료일은 시작일보다 빠를 수 없습니다."); }
function list<T>(v: T[], max: number) { requireValue(Array.isArray(v) && v.length <= max, `항목은 최대 ${max}개까지 보관할 수 있습니다.`); }
function unique(ids: unknown[]) { requireValue(new Set(ids).size === ids.length, "같은 식별자나 연결이 중복되어 있습니다."); }
function source(e: SourceCopy) {
  requireValue(e && ["region", "comparison"].includes(e.kind) && e.key === `${e.kind}:${e.value.id}`);
  if (e.kind === "region") encodeEvidence([e.value]); else encodeComparisons([e.value]);
}
function draft(d: PlanDraft) {
  requireValue(d && id(d.id) && str(d.title, 200) && str(d.regionKey, 20) && (d.regionKey === "" || REGIONS.some(r => `${r.provinceCode}/${r.districtCode}` === d.regionKey)));
  requireValue(Number.isInteger(d.year) && d.year >= 2000 && d.year <= 2100, "사업연도는 2000~2100년으로 입력하세요.");
  requireValue(str(d.department, 200) && str(d.purpose) && ["unknown", "new", "continuing"].includes(d.continuity) && date(d.asOf)); period(d.period);
  list(d.relations, 20); unique(d.relations.map(r => r.id));
  for (const r of d.relations) requireValue(id(r.id) && str(r.organization, 200) && ["unknown", "direct", "foundation", "entrust", "service", "subsidy"].includes(r.relation) && str(r.scope) && str(r.reference) && date(r.checkedAt));
  list(d.evidence, 100); unique(d.evidence.map(e => e.key)); d.evidence.forEach(source);
  list(d.options, 6); requireValue(d.options.length > 0, "초안에는 후보가 하나 이상 필요합니다."); unique(d.options.map(o => o.id));
  requireValue(d.options.filter(o => o.decision === "selected").length <= 1, "우선 후보는 하나만 선택하세요.");
  for (const o of d.options) {
    requireValue(id(o.id) && str(o.name, 200) && [o.theme, o.item, o.audience, o.venue, o.assumptions, o.constraints, o.reason].every(v => str(v)) && ["undecided", "selected", "excluded"].includes(o.decision));
    requireValue(o.periods); for (const s of Object.keys(STAGES) as Stage[]) period(o.periods[s]);
    list(o.links, 100); unique(o.links.map(l => `${l.sourceKey}/${l.field}`));
    for (const l of o.links) requireValue(d.evidence.some(e => e.key === l.sourceKey) && member(l.field, FIELDS) && str(l.reason));
    list(o.venueChecks, 100); unique(o.venueChecks.map(c => c.id));
    for (const c of o.venueChecks) {
      requireValue(id(c.id) && member(c.stage, STAGES) && member(c.kind, CONDITIONS) && member(c.status, VENUE_STATUS) && str(c.owner, 200) && date(c.date) && str(c.reference) && str(c.note) && str(c.basis, 10000));
      requireValue(c.status === "unknown" || !!(c.owner.trim() && c.date && c.reference.trim()), "장소 확인에는 담당 조직·역할, 확인일과 참조가 필요합니다.");
      const b = JSON.parse(c.basis); requireValue(str(b.venue) && str(b.item) && str(b.audience)); period(b.period);
      requireValue(c.status === "unknown" || !!(b.venue.trim() && b.period.start && b.period.end), "장소와 적용 기간을 입력한 뒤 확인을 기록하세요.");
    }
    list(o.tasks, 30); unique(o.tasks.map(t => t.id));
    for (const t of o.tasks) {
      requireValue(id(t.id) && str(t.title, 300) && str(t.owner, 200) && date(t.due) && str(t.needed) && str(t.reference) && ["unknown", "yes", "no"].includes(t.applies) && str(t.naReason) && date(t.decidedAt) && member(t.progress, PROGRESS) && str(t.exceptionReason) && str(t.basis, 10000));
      requireValue(t.applies !== "no" || !!(t.naReason.trim() && t.decidedAt), "해당 없음에는 사유와 판단일이 필요합니다.");
      const b = JSON.parse(t.basis); requireValue(str(b.venue) && str(b.item) && str(b.audience) && b.periods); for (const s of Object.keys(STAGES) as Stage[]) period(b.periods[s]);
      list(t.dependsOn, 30); unique(t.dependsOn); requireValue(t.dependsOn.every(dep => dep !== t.id && o.tasks.some(x => x.id === dep)), "선행 과제는 같은 후보의 다른 과제를 선택하세요.");
      list(t.reviews, 30); unique(t.reviews.map(r => r.id));
      for (const r of t.reviews) {
        requireValue(id(r.id) && member(r.status, REVIEW_STATUS) && str(r.owner, 200) && date(r.date) && str(r.reference) && str(r.basis, 10000));
        const b = JSON.parse(r.basis); requireValue(str(b.venue) && str(b.item) && str(b.audience) && b.periods); for (const s of Object.keys(STAGES) as Stage[]) period(b.periods[s]);
        requireValue(r.status !== "confirmed" || !!(r.owner.trim() && r.date && r.reference.trim()), "외부 확인 기록에는 담당 조직·역할, 확인일과 참조가 필요합니다.");
      }
    }
    const visiting = new Set<string>(), done = new Set<string>();
    const visit = (t: ReadinessTask) => { requireValue(!visiting.has(t.id), "선행 과제가 서로를 기다리는 순환 관계입니다."); if (done.has(t.id)) return; visiting.add(t.id); t.dependsOn.forEach(dep => visit(o.tasks.find(x => x.id === dep)!)); visiting.delete(t.id); done.add(t.id); };
    o.tasks.forEach(visit);
    for (const t of o.tasks) requireValue(taskStatus(o, t).stale || t.progress === "todo" || taskStatus(o, t).blocked.length === 0 || !!t.exceptionReason.trim(), "선행 과제가 미완료입니다. 예외 진행 이유를 입력하세요.");
    if (o.budget !== undefined) validateBudget(o.budget, d, o);
  }
}
export function validatePlanning(p: Planning): void {
  requireValue(p && p.format === "fest-compass-planning" && [1, 2].includes(p.version) && id(p.stamp) && instant(p.updatedAt)); draft(p.draft);
  requireValue(p.version === 2 || [...p.draft.options, ...p.revisions.flatMap(r => r.draft.options)].every(o => o.budget === undefined && o.links.every(l => l.field !== "budget")), "예산 기능은 기획 파일 형식 v2가 필요합니다.");
  list(p.revisions, 20); unique(p.revisions.map(r => r.id));
  for (const r of p.revisions) { requireValue(id(r.id) && instant(r.savedAt) && str(r.note)); draft(r.draft); }
  for (const o of p.draft.options) if (o.budget?.baselineRevision) requireValue(p.revisions.some(r => r.id === o.budget!.baselineRevision && r.draft.options.some(b => b.id === o.budget!.baselineOption)), "비교할 예산 보관본·후보를 확인하세요.");
}
export function parsePlanning(raw: string): Planning {
  if (new TextEncoder().encode(raw).length > MAX_PLANNING_BYTES) throw new Error("기획 파일은 5MB 이하여야 합니다.");
  try { const p = JSON.parse(raw, (k, v) => { requireValue(!["__proto__", "prototype", "constructor"].includes(k)); return v; }); validatePlanning(p); return p; }
  catch (e) { throw new Error(`기획을 읽지 못했습니다. ${e instanceof Error ? e.message : "지원하지 않는 형식입니다."} 기존 저장값은 유지됩니다.`); }
}
export function encodePlanning(p: Planning): string { const raw = JSON.stringify(p, null, 2); parsePlanning(raw); return raw; }

export function writePlanning(p: Planning, expected: string | null, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): string {
  const current = storage.getItem(PLANNING_KEY);
  if (current !== expected) throw new Error("다른 창에서 기획이 변경됐습니다. 입력을 파일로 보관한 뒤 저장된 기획을 다시 여세요.");
  if (current) {
    const previous = parsePlanning(current);
    for (const r of previous.revisions) requireValue(p.revisions.some(n => n.id === r.id && JSON.stringify(n) === JSON.stringify(r)), "이미 보관한 버전은 수정하거나 제거할 수 없습니다.");
  }
  const next: Planning = { ...p, version: 2, stamp: uid(), updatedAt: new Date().toISOString() }, raw = encodePlanning(next);
  storage.setItem(PLANNING_KEY, raw); return raw;
}
