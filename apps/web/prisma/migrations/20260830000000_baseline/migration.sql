-- Baseline for databases originally created with `prisma db push`.
-- Existing databases must mark this migration applied before migrate deploy;
-- new databases apply it normally.

CREATE TABLE "Festival" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "place" TEXT,
    "program" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "areaCode" TEXT,
    "sigunguCode" TEXT,
    "ldongRegnCd" TEXT,
    "ldongSignguCd" TEXT,
    "mapX" TEXT,
    "mapY" TEXT,
    "contentId" TEXT,
    "provenance" TEXT NOT NULL DEFAULT 'manual',
    "labelLevel" TEXT NOT NULL DEFAULT 'L0',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isExample" BOOLEAN NOT NULL DEFAULT true,
    "clonedFromId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EvidenceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "baseDate" TEXT,
    "fetchedAt" DATETIME NOT NULL,
    "aggregation" TEXT,
    "kind" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "rawSummary" TEXT,
    "status" TEXT NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "interpretation" TEXT,
    "prohibition" TEXT,
    CONSTRAINT "EvidenceSnapshot_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "minValue" REAL,
    "baseValue" REAL,
    "maxValue" REAL,
    "unit" TEXT,
    "rationale" TEXT,
    "author" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assumption_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CapacityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "approvedCapacity" REAL,
    "dwellHours" REAL,
    "documentRef" TEXT,
    "approver" TEXT,
    CONSTRAINT "CapacityRule_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessions" INTEGER,
    "staffParking" INTEGER,
    "shuttles" INTEGER,
    "zone" TEXT,
    "routeNote" TEXT,
    "resultJson" TEXT,
    "formulaJson" TEXT,
    CONSTRAINT "Scenario_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "changeSummary" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL,
    CONSTRAINT "Decision_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Decision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OperationTrigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "plannedAction" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationTrigger_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FieldAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "triggerId" TEXT,
    "trigger" TEXT NOT NULL,
    "occurredAt" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    CONSTRAINT "FieldAction_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldAction_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "OperationTrigger" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "plannedValue" REAL,
    "actualValue" REAL,
    "unit" TEXT,
    "source" TEXT,
    "measureMethod" TEXT,
    "missingRate" REAL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL,
    "granularity" TEXT NOT NULL DEFAULT 'total',
    "bucketLabel" TEXT,
    CONSTRAINT "Outcome_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation" TEXT NOT NULL,
    "urlMasked" TEXT NOT NULL,
    "status" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "resultKind" TEXT NOT NULL,
    "summary" TEXT
);

CREATE TABLE "DataQuality" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "festivalId" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "DataQuality_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OperationTrigger_festivalId_idx" ON "OperationTrigger"("festivalId");
CREATE INDEX "FieldAction_festivalId_idx" ON "FieldAction"("festivalId");
CREATE INDEX "FieldAction_triggerId_idx" ON "FieldAction"("triggerId");
