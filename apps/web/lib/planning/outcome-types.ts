import type { Period } from "./types";
import type { Vat } from "./budget-types";

export const RESULT_ORIGINS = { unknown: "출처 미확인", manual: "담당자 내부 기록", public: "공개 자료 전사 · 담당자 입력" } as const;
export const RESULT_STAGES = { unknown: "단계 미확인", payment: "지급 기록", settlement: "정산 검토 자료" } as const;
export const EVIDENCE_KINDS = { unknown: "종류 미확인", quote: "견적", contract: "계약", payment: "지급 증빙", settlement: "정산 자료", observation: "현장 기록" } as const;
export type ResultValue = { value: string; origin: keyof typeof RESULT_ORIGINS; reference: string; missingReason: string };
export type ResultMetric = { id: string; name: string; planned: string; planReference: string; planDefinition: string; actualDefinition: string; planUnit: string; actualUnit: string; period: Period; actual: ResultValue };
export type FundResult = { id: string; fundId: string; stage: keyof typeof RESULT_STAGES; scopeMatches: boolean; scope: string; vat: Vat; actual: ResultValue; balance: ResultValue; returned: ResultValue; interest: ResultValue };
export type ResultEvidence = { id: string; kind: keyof typeof EVIDENCE_KINDS; scope: string; reference: string; status: "unknown" | "reviewing" | "confirmed"; reviewer: string; checkedAt: string; note: string };
export type Improvement = { id: string; problem: string; action: string; nextTask: string; nextBudget: string; reference: string };
export type OutcomeDraft = { id: string; proposalId: string; asOf: string; operations: string; metrics: ResultMetric[]; funds: FundResult[]; evidence: ResultEvidence[]; improvements: Improvement[] };
export type OutcomeRevision = { id: string; savedAt: string; note: string; draft: OutcomeDraft };
export type OutcomeStore = { draft: OutcomeDraft | null; revisions: OutcomeRevision[] };
