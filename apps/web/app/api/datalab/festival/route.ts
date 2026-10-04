import { parseFestivalBundleRequest } from "@/lib/datalab/festival-bundle-types";
import { festivalBundle } from "@/lib/datalab/festival-bundles";
import { respond } from "@/lib/existing/http";
import { NotFound } from "@/lib/existing/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return respond(request, parseFestivalBundleRequest, async ({ festival }) => { const bundle = festivalBundle(festival); if (!bundle) throw new NotFound("festival"); return bundle; });
}
