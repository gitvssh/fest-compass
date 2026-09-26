"use client";
import { keepBlock } from "@/components/existing/blocks";
import { useKeyedRequest, type KeyedState } from "@/components/existing/useKeyedRequest";
import { parseResources, resourcesKey } from "@/lib/existing/request";
import type { RegionRef, ResourceKind, ResourcesResponse } from "@/lib/existing/types";

function merge(previous: ResourcesResponse, next: ResourcesResponse): ResourcesResponse {
  if (previous.region?.code !== next.region?.code || !Array.isArray(previous.byType) || !Array.isArray(next.byType)) return next;
  return { ...next, byType: next.byType.map(b => keepBlock(previous.byType.find(p => p.kind === b.kind), b)) };
}
function forRegion(state: KeyedState<ResourcesResponse>, code: string | undefined, kind: ResourceKind): KeyedState<ResourcesResponse> {
  if (!state.data || (state.data.region?.code === code && Array.isArray(state.data.byType) && state.data.byType.some(b => b.kind === kind))) return state;
  // A matching request key alone does not establish the response's region. Keep recovery available,
  // and never expose foreign data or carry it into the successful retry of this condition.
  return { ...state, data: null, failure: state.loading ? null : "network" };
}
function request(region: { province: string; district: string } | null, types: readonly ResourceKind[], kind: ResourceKind) {
  if (!region || !types.includes(kind)) return { url: null, key: null };
  const p = new URLSearchParams({ province: region.province, district: region.district, types: kind });
  return { url: `/api/existing/resources?${p}`, key: resourcesKey(parseResources(p)) };
}

/**
 * One full district request per resource type, always the same four hooks in the same order. A type that is not
 * chosen stays idle; one type's failure, delay or retry never holds back or clears another.
 */
export function useResourceLists(region: Pick<RegionRef, "province" | "district" | "code"> | null, types: readonly ResourceKind[]): Record<ResourceKind, KeyedState<ResourcesResponse>> {
  const r12 = request(region, types, "12"), r14 = request(region, types, "14"), r39 = request(region, types, "39"), r32 = request(region, types, "32");
  const attractions = useKeyedRequest<ResourcesResponse>(r12.url, merge, r12.key);
  const culture = useKeyedRequest<ResourcesResponse>(r14.url, merge, r14.key);
  const food = useKeyedRequest<ResourcesResponse>(r39.url, merge, r39.key);
  const lodging = useKeyedRequest<ResourcesResponse>(r32.url, merge, r32.key);
  return { "12": forRegion(attractions, region?.code, "12"), "14": forRegion(culture, region?.code, "14"), "39": forRegion(food, region?.code, "39"), "32": forRegion(lodging, region?.code, "32") };
}
