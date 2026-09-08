import { parseQuery } from "@/lib/region/model";
import { getRegionData } from "@/lib/region/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let query;
  try { query = parseQuery(new URL(request.url).searchParams); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "조회 조건을 확인하세요." }, { status: 400 }); }
  try { return Response.json(await getRegionData(query), { headers: { "Cache-Control": "private, max-age=30" } }); }
  catch { return Response.json({ error: "자료를 불러오지 못했습니다. 다시 조회하세요." }, { status: 503 }); }
}
