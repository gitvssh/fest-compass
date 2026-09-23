import type { Metadata } from "next";
import { TimingView } from "@/components/new-festival/TimingView";
import type { RegionParams } from "../../params";
import { viewMetadata } from "../view-metadata";

export function generateMetadata({ params }: { params: RegionParams }): Promise<Metadata> {
  return viewMetadata(params, "timing");
}

export default function NewTimingPage() {
  return <TimingView />;
}
