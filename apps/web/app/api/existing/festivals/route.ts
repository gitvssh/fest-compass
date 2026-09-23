import { respond } from "@/lib/existing/http";
import { parseFestivalSearch } from "@/lib/existing/request";
import { loadFestivals } from "@/lib/existing/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, p => parseFestivalSearch(p), loadFestivals); }
