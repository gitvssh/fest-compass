import type { Metadata } from "next";
import { ResourcesView } from "@/components/new-festival/ResourcesView";
import type { RegionParams } from "../../params";
import { viewMetadata } from "../view-metadata";

export function generateMetadata({ params }: { params: RegionParams }): Promise<Metadata> {
  return viewMetadata(params, "resources");
}

export default function NewResourcesPage() {
  return <ResourcesView />;
}
