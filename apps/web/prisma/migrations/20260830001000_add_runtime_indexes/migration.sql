-- Indexes for request-time festival reads and append-only evidence/log queries.
CREATE INDEX "Festival_isDemo_createdAt_idx" ON "Festival"("isDemo", "createdAt");
CREATE INDEX "EvidenceSnapshot_festivalId_fetchedAt_idx" ON "EvidenceSnapshot"("festivalId", "fetchedAt");
CREATE INDEX "Assumption_festivalId_version_createdAt_idx" ON "Assumption"("festivalId", "version", "createdAt");
CREATE INDEX "CapacityRule_festivalId_idx" ON "CapacityRule"("festivalId");
CREATE INDEX "Scenario_festivalId_idx" ON "Scenario"("festivalId");
CREATE INDEX "Decision_festivalId_decidedAt_idx" ON "Decision"("festivalId", "decidedAt");
CREATE INDEX "Decision_scenarioId_idx" ON "Decision"("scenarioId");
CREATE INDEX "Outcome_festivalId_idx" ON "Outcome"("festivalId");
CREATE INDEX "ApiCallLog_createdAt_idx" ON "ApiCallLog"("createdAt");
CREATE INDEX "DataQuality_festivalId_idx" ON "DataQuality"("festivalId");
