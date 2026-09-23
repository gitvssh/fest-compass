import { notFound, redirect } from "next/navigation";
import { festivalParam, festivalPath } from "@/components/existing/route-params";

export default async function ExistingFestivalPage({ params }: { params: Promise<{ festival: string }> }) {
  const id = festivalParam((await params).festival);
  if (!id) notFound();
  redirect(festivalPath(id, "visits"));
}
