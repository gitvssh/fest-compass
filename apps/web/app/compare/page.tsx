import type { Metadata } from "next";
import { FestivalComparison } from "@/components/FestivalComparison";
import catalogue from "@/data/festival-editions.json";
import { canonicalUrl } from "@/lib/site";
import { REGIONS } from "@/lib/region/model";
import { validRange } from "@/lib/comparison/model";
import type { Edition, SearchContext } from "@/lib/comparison/types";
export const metadata: Metadata = { title: "주변·과거 축제 비교", description: "출처가 확인된 과거 회차와 현재 등록 행사를 찾아 일정·방문 추세·비용 자료를 비교하고 기획 근거로 보관합니다.", alternates: { canonical: canonicalUrl("/compare") } };
export const dynamic = "force-dynamic";
export default async function ComparePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams, year=Number(new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Seoul",year:"numeric"}));
  const region=REGIONS.find(r=>r.provinceCode===params.province&&r.districtCode===params.district), current=!!region&&params.mode==="current";
  const initial:SearchContext={mode:current?"current":"archive",regions:region?[`${region.provinceCode}/${region.districtCode}`]:[],start:current?`${year}-01-01`:"2022-01-01",end:current?`${year}-12-31`:"2025-12-31",keyword:"",theme:"",dateRule:current?"starts-within":"overlap",queriedAt:null};
  if(typeof params.start==="string"&&typeof params.end==="string")try{validRange(params.start,params.end,current);initial.start=params.start;initial.end=params.end;}catch{/* Keep bounded defaults for invalid deep links. */}
  return <FestivalComparison catalogue={catalogue.editions as Edition[]} initial={initial} year={year}/>;
}
