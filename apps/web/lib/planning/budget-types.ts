import type { Period } from "./types";

export const VAT = { included: "VAT 포함", excluded: "VAT 별도", exempt: "면세", unknown: "세금 미확인" } as const;
export const AMOUNT_STAGES = { estimate: "담당자 산출", request: "요구", allocation: "편성", tender: "입찰 기초", contract: "계약", payment: "지급", settlement: "정산 검토" } as const;
export const FUND_STATUS = { confirmed: "확정 기록", planned: "예정", unknown: "미확인" } as const;
export type Vat = keyof typeof VAT;
export type AmountStage = keyof typeof AMOUNT_STAGES;
export type CostScope = { kind: "unknown" | "whole" | "partial"; name: string; includes: string; excludes: string; departments: string; departmentsKnown: boolean };
export type Classification = { year: string; label: string; code: string; guideline: string; status: "unknown" | "reviewed"; date: string };
export type BudgetLine = {
  id: string; name: string; specification: string; quantity: string; unit: string; rate: string;
  method: "unknown" | "quantity" | "period"; periods: string; periodUnit: string; coveredPeriod: string;
  vat: Vat; taxAmount: string; taxReference: string; sourceKind: "unknown" | "assumption" | "quote" | "public";
  reference: string; classification: Classification; evidenceKeys: string[]; taskIds: string[];
};
export type Funding = { id: string; name: string; provider: string; relation: string; sourceId: string; parentId: string; included: boolean; amount: string; status: keyof typeof FUND_STATUS; reference: string; date: string };
export type AmountRecord = {
  id: string; recorded: boolean; name: string; stage: AmountStage; original: string; unit: "won" | "thousandWon" | "unknown";
  currency: string; vat: Vat; scope: CostScope; period: Period; reference: string; page: string; asOf: string;
  missingReason: string; kind: "individual" | "cumulative"; includesIds: string[]; basis: string;
};
export type Budget = {
  basis: string; stage: AmountStage; scope: CostScope; asOf: string;
  limit: string; limitVat: Vat; fundingVat: Vat; fundingMatchesScope: boolean;
  expensesComplete: boolean; expensesUnique: boolean; fundingComplete: boolean; fundingUnique: boolean;
  lines: BudgetLine[]; funds: Funding[]; records: AmountRecord[];
  baselineRevision: string; baselineOption: string;
  changeReasons: { quantity: string; rate: string; period: string; scope: string; reference: string };
};
