import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ExistingShell } from "@/components/existing/ExistingShell";
import { festivalParam } from "@/components/existing/route-params";

export const dynamic = "force-dynamic";

export default async function ExistingFestivalLayout({ children, params }: { children: ReactNode; params: Promise<{ festival: string }> }) {
  const id = festivalParam((await params).festival);
  if (!id) notFound();
  return <ExistingShell id={id}>{children}</ExistingShell>;
}
