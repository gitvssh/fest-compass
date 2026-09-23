import type { ReactNode } from "react";
import { NewShell } from "@/components/new-festival/NewShell";
import { UnknownRegion } from "@/components/new-festival/UnknownRegion";
import { regionParam, type RegionParams } from "../params";

export const dynamic = "force-dynamic";

export default async function NewRegionLayout({ children, params }: { children: ReactNode; params: RegionParams }) {
  const region = await regionParam(params);
  if (!region) return <UnknownRegion />;
  // Keyed by region: another region mounts a fresh shell, so no selection of the previous region can render.
  return <NewShell key={region.code} region={region}>{children}</NewShell>;
}
