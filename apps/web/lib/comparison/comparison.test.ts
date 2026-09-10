import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import catalogue from "../../data/festival-editions.json";
import { composition, costReason, currentEditions, filterEditions, overlaps, relativePoints, validRange, visitReason } from "./model";
import { COMPARISON_KEY, encodeComparisons, makeComparison, parseComparisons, storeComparisons, validateEditions } from "./evidence";
import type { Edition, SearchContext } from "./types";
import type { RegionResult } from "../region/types";
const editions = catalogue.editions as Edition[], nonsan = editions.slice(0,3), wonju = editions.at(-1)!;
const q:SearchContext={mode:"archive",regions:[],start:"2022-01-01",end:"2025-12-31",keyword:"",theme:"",dateRule:"overlap",queriedAt:null};
const clone = <T>(v:T):T=>JSON.parse(JSON.stringify(v));

test("current overlap includes continuing and boundary-day events while starts-within excludes earlier starts",()=>{
  const search:SearchContext={...q,mode:"current",start:"2026-10-03",end:"2026-10-05"};
  const items=[['continuing','2026-09-01','2026-10-03'],['ended','2026-09-01','2026-10-02'],['last','2026-10-05','2026-10-06'],['after','2026-10-06','2026-10-07']].map(([id,start,end])=>({...nonsan[0],id,start,end,year:2026,origin:"current" as const}));
  assert.deepEqual(filterEditions(items,search).map(e=>e.id),['continuing','last']);
  const starts={...search,dateRule:"starts-within" as const};
  assert.deepEqual(filterEditions(items,starts).map(e=>e.id),['last']);
});
test("overlap discovery preserves its original rule and period after selecting through another query and exporting",async()=>{
  const search:SearchContext={...q,mode:"current",start:"2025-03-28",end:"2025-03-29",queriedAt:"2026-09-10T00:00:00Z"};
  const item={...clone(nonsan[2]),discoveredWith:clone(search)};
  const evidence=await makeComparison([item],q,{kind:"overview"},"기획 기간 겹침 확인");
  item.discoveredWith.dateRule="starts-within";item.discoveredWith.start="2025-03-29";
  const restored=parseComparisons(encodeComparisons([evidence]))[0];assert.equal(restored.editions[0].discoveredWith!.dateRule,"overlap");assert.equal(restored.editions[0].discoveredWith!.start,"2025-03-28");
  const bad=clone(evidence);bad.editions[0].discoveredWith!.end="2024-01-01";assert.throws(()=>encodeComparisons([bad]));
  const legacy=await makeComparison(nonsan,q,{kind:"overview"},"");assert.deepEqual(parseComparisons(encodeComparisons([legacy])),[legacy]);
});

test("all 45 product observations match the reviewed source bytes and rows",()=>{
  const raw=readFileSync(new URL("../../../../docs/validation/evidence/2026-09-07-nonsan-history.json",import.meta.url));
  assert.equal(createHash("sha256").update(raw).digest("hex"),nonsan[0].visits!.source.sha256);
  const source=JSON.parse(raw.toString());
  for(const e of nonsan)for(const p of e.visits!.points){const row=source.days.find((d:{date:string})=>d.date===p.date);assert.equal(p.value,row.values["2"]);}
  assert.equal(nonsan.flatMap(e=>e.visits!.points).length,45);
  assert.equal(relativePoints(nonsan[2],0,0)[0].value,52671.5);
  for(const e of editions)validateEditions([e]);
});
test("archive filters use date overlap, preserve unknown dates by year and region, never name-merge",()=>{
  assert.deepEqual(filterEditions(editions,{...q,start:"2024-10-04",end:"2024-10-05"}).map(e=>e.id),["imsil-cheese-2024","baekje-gongju-2024"]);
  assert.equal(filterEditions(editions,{...q,start:"2022-08-20",end:"2022-08-21"})[0].id,wonju.id);
  assert.equal(filterEditions(editions,{...q,start:"2025-08-20",end:"2025-08-21"}).length,0);
  const sameName={...nonsan[0],id:"distinct-festival-2023",festivalId:"distinct-festival"};
  assert.equal(filterEditions([...nonsan,sameName],{...q,keyword:"논산",regions:["44/230"]}).length,4);
  assert.equal(filterEditions(editions,{...q,regions:["44/150"],theme:"역사문화"})[0].id,"baekje-gongju-2024");
});
test("calendar overlap cannot be inferred from relative day or cancelled and unknown schedules",()=>{
  assert.equal(overlaps(nonsan[1],nonsan[2]),0);
  assert.equal(overlaps(nonsan[2],{...nonsan[2],start:"2025-03-29",end:"2025-04-01"}),2);
  assert.equal(overlaps(nonsan[2],{...nonsan[2],status:"취소"}),null);
  assert.equal(overlaps(nonsan[2],wonju),null);
});
test("visitor chart compatibility rejects different populations, regions and methods; missing and zero differ",()=>{
  for(const [key,value] of [["metric","행사장 입장"],["regionCode","44150"],["method","다른 계수"]]){const e=clone(nonsan[1]);Object.assign(e.visits!,{[key]:value});assert.match(visitReason(e,nonsan[0])!,/비교 보류/);}
  assert.match(visitReason(wonju,nonsan[0])!,/미확보/);
  const e=clone(nonsan[0]);e.visits!.points[7].value=0;e.visits!.points.splice(8,1);
  assert.deepEqual(relativePoints(e,0,1).map(p=>p.value),[0,null]);
});
test("cost scope, stage, VAT and year gate comparisons; pie requires an exact non-overlapping denominator",()=>{
  const a=nonsan[2].costs[0],b=wonju.costs[1];
  assert.match(costReason(a,b)!,/비교 보류/);
  assert.match(costReason(b,b)!,/세금/);
  assert.match(costReason(a,{...a,year:2024})!,/회계연도/);
  assert.equal(costReason(a,a),null);
  assert.equal(composition(a),null);
  assert.equal(composition(b)!.reduce((sum,p)=>sum+p.amount,0),35118200);
  assert.equal(composition({...b,parts:[...b.parts!,b.parts![0]]}),null);
  assert.equal(composition({...b,amount:0}),null);
  assert.equal(composition({...b,complete:false}),null);
  assert.equal(composition({...b,amount:b.amount+1}),null);
});
test("current provider rows have independent identity and cannot overwrite an archived edition",()=>{
  const r={query:{province:"44",district:"230",kind:"15",start:"2026-01-01",end:"2026-12-31"},region:{provinceName:"충청남도",districtName:"논산시"},resources:{status:"complete",source:"https://www.data.go.kr/data/15101578/openapi.do",collectedAt:"2026-09-08T00:00:00Z",total:1,pages:1,items:[{id:"525292",title:"논산딸기축제",start:"2026-03-26",end:"2026-03-29",modifiedAt:null,address:"논산"}]}} as RegionResult;
  const live=currentEditions(r)[0];assert.notEqual(live.festivalId,nonsan[2].festivalId);assert.notEqual(live.id,nonsan[2].id);assert.equal(live.visits,null);assert.equal(live.costs.length,0);assert.equal(nonsan[2].start,"2025-03-27");
  assert.deepEqual(currentEditions({...r,resources:{...r.resources,status:"unavailable"}}),[]);
});
test("saved comparison keeps selected real values, identities, original query and separate versions",async()=>{
  const copy=clone(nonsan),context=clone(q);copy[0].discoveredWith=clone(q);
  const saved=await makeComparison(copy,context,{kind:"visits",from:0,to:0},"시기 검토");
  copy[2].visits!.points[7].value=1;context.keyword="changed";
  assert.equal(saved.editions[2].visits!.points[0].value,52671.5);assert.equal(saved.context.keyword,"");
  assert.deepEqual(parseComparisons(encodeComparisons([saved])),[saved]);
  assert.equal((await makeComparison(nonsan,q,{kind:"visits",from:0,to:0},"메모 변경")).editions[2].visits!.points[0].value,52671.5);
  assert.notEqual((await makeComparison(copy,q,{kind:"visits",from:0,to:0},"")).id,saved.id);
  await assert.rejects(makeComparison(nonsan,q,{kind:"visits",from:2,to:1},""));
});
test("import rejects unsafe sources, invalid values, duplicate ids and corruption without destroying stored copies",async()=>{
  const item=await makeComparison(nonsan,q,{kind:"overview"},""), store=new Map<string,string>();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)}});
  try{assert.equal(storeComparisons([item,item]).added,1);const before=store.get(COMPARISON_KEY);
    const bad=clone(item);bad.editions[0].source.url="javascript:alert(1)";assert.throws(()=>storeComparisons([{...bad,id:"f".repeat(64)}]));
    assert.equal(store.get(COMPARISON_KEY),before);assert.throws(()=>parseComparisons("{}"));assert.throws(()=>encodeComparisons([item,item]));
    const nonfinite=clone(item);nonfinite.editions[0].visits!.points[0].value=-1;assert.throws(()=>encodeComparisons([nonfinite]));
    assert.throws(()=>validRange("2025-02-30","2025-03-01"));assert.throws(()=>validRange("2023-01-01","2025-12-31",true));
    assert.throws(()=>parseComparisons("a".repeat(2000001)));
  }finally{Reflect.deleteProperty(globalThis,"localStorage");}
});
