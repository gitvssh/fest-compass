import type { Metadata } from "next";
import { VisitsView } from "@/components/new-festival/VisitsView";
import type { RegionParams } from "../../params";
import { viewMetadata } from "../view-metadata";

export function generateMetadata({ params }: { params: RegionParams }): Promise<Metadata> {
  return viewMetadata(params, "visits");
}

export default function NewVisitsPage() {
  return <VisitsView />;
}
