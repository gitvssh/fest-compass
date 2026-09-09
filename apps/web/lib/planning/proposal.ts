import { archive, copy, validatePlanning } from "./model";
import type { PlanDraft, Planning } from "./types";

export function proposalBlockers(d: PlanDraft): string[] {
  const issues: string[] = [];
  if (d.options.length < 2) issues.push("후보를 두 개 이상 작성하세요.");
  const selected = d.options.find(o => o.decision === "selected");
  if (!selected) issues.push("우선 후보를 선택하세요.");
  else if (!selected.reason.trim()) issues.push("우선 후보의 선택 이유를 입력하세요.");
  return issues;
}

export function archiveProposal(p: Planning, note: string): Planning {
  const blockers = proposalBlockers(p.draft);
  if (blockers.length) throw new Error(blockers.join(" "));
  const next = archive({ ...copy(p), version: 3 }, note);
  next.revisions.at(-1)!.proposal = { format: 1 };
  validatePlanning(next);
  return next;
}
