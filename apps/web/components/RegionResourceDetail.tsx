"use client";
import { ResourceDetails } from "./resources/ResourceDetails";
import { ResourceGallery } from "./resources/ResourceGallery";
import { introKey } from "./resources/ResourceIntro";
import type { RegionRef, ResourceItem } from "@/lib/existing/types";
import type { Query, Region, Resource } from "@/lib/region/types";

/** The map keeps its own selection and evidence flow while sharing the tourism detail presentation. */
export function RegionResourceDetail({ resource, region, kind }: { resource: Resource; region: Region; kind: Query["kind"] }) {
  const facts = <div className="rounded-xl bg-paper p-4 text-sm leading-7">
    <p>{resource.address || "주소 미확보"}</p>
    <p>{resource.start ? `행사 일정: ${resource.start} ~ ${resource.end}` : "현재 등록 관광자원 · 과거 사용 가능 여부 미확인"}</p>
    <p>원천 수정 표기: {resource.modifiedAt ?? "미확보"} · 관광공사 원문 형식</p>
    <p>원천 항목 번호: {resource.id} · 장소 사용 조건은 담당 기관에 확인 필요</p>
  </div>;

  // Festival details are outside the tourism-detail endpoint; their listed photo is still available here.
  if (kind === "15") return <div className="space-y-3">
    <h3 className="text-lg font-extrabold">{resource.title}</h3>
    <ResourceGallery key={resource.id} name={resource.title} photos={resource.photo ? [resource.photo] : []} status={resource.photo ? "complete" : "empty"} />
    {facts}
  </div>;

  const location: RegionRef = {
    province: region.provinceCode,
    district: region.districtCode,
    code: `${region.provinceCode}${region.districtCode}`,
    name: `${region.provinceName} ${region.districtName}`,
    districtName: region.districtName,
  };
  const item: ResourceItem = {
    id: resource.id,
    kind,
    title: resource.title,
    address: resource.address,
    point: resource.latitude !== null && resource.longitude !== null ? { latitude: resource.latitude, longitude: resource.longitude } : null,
    modifiedAt: resource.modifiedAt,
    photo: resource.photo,
  };
  return <div className="space-y-3">
    <h3 className="text-lg font-extrabold">{resource.title}</h3>
    <ResourceDetails key={introKey(location, item)} region={location} item={item}>{facts}</ResourceDetails>
  </div>;
}
