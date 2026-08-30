import { redirect } from "next/navigation";

export default async function FestivalIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/festivals/${id}/evidence`);
}
