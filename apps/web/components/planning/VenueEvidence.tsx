import { venueResource } from "@/lib/planning/venue-evidence";
import type { SourceCopy } from "@/lib/planning/types";

export function VenueEvidence({ source, current, apply }: { source: SourceCopy; current: string; apply: () => void }) {
  const selected = venueResource(source);
  if (!selected || source.kind !== "region") return null;
  const { resource, venue } = selected, { region, resources } = source.value.result;
  return <section className="space-y-3 rounded-xl bg-paper p-4" aria-label="관광자료로 장소 입력">
    <h4 className="font-bold">관광자료로 장소 입력</h4>
    <dl className="space-y-2 break-words text-sm">
      <div><dt className="font-bold">현재 장소</dt><dd>{current || "미입력"}</dd></div>
      <div><dt className="font-bold">가져올 장소</dt><dd>{venue}</dd></div>
      {!resource.address.trim() && <div><dt>주소</dt><dd>주소 미확인 · 자료의 이름만 입력합니다.</dd></div>}
      <div><dt>조회 지역</dt><dd>{region.provinceName} {region.districtName}</dd></div>
      <div><dt>자료 수집 시각</dt><dd>{resources.collectedAt}</dd></div>
      <div><dt>자료의 좌표</dt><dd>{resource.latitude !== null && resource.longitude !== null ? `위도 ${resource.latitude} · 경도 ${resource.longitude}` : "좌표 미확인"}</dd></div>
    </dl>
    <a className="text-sm font-bold text-blue underline" href={resources.source} target="_blank" rel="noreferrer">관광자료 출처 보기</a>
    <p className="text-sm">관광정보 등록은 대관·안전·수용 인원 확인이 아닙니다. 장소가 바뀌면 기존 장소·준비·예산 조건을 다시 확인하세요.</p>
    <button className="region-button" disabled={current === venue} onClick={apply}>{current ? "현재 장소를 이 자료로 바꾸기" : "이 자료로 장소 입력"}</button>
    {current === venue && <p className="text-xs text-muted">같은 장소가 입력되어 있습니다. 추가 참고 자료는 일반 근거 연결을 사용하세요.</p>}
    <p className="text-xs text-muted">장소 입력과 당시 자료의 사본을 함께 연결합니다. 이미 연결한 장소 근거의 판단 이유는 유지됩니다. 적용 후 초안을 저장하세요.</p>
  </section>;
}
