import { redirect } from "next/navigation";
import { durableParams, viewPath } from "@/components/new-festival/durable";
import { routeCode } from "@/components/new-festival/region-route";
import { regionParam, toParams, type RegionParams, type SearchParams } from "../params";

export default async function NewRegionPage({ params, searchParams }: { params: RegionParams; searchParams: Promise<SearchParams> }) {
  const region = await regionParam(params);
  // An unknown code is answered by the layout's region-selection recovery.
  if (!region) return null;
  redirect(viewPath(routeCode(region), "resources", durableParams(toParams(await searchParams))));
}
