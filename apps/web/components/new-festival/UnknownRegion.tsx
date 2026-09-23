import Link from "next/link";

/** An address with an unknown region code: keep the user in the journey with a way to choose a region. */
export function UnknownRegion() {
  return <section aria-labelledby="new-unknown-heading" className="space-y-3">
    <h1 id="new-unknown-heading" className="text-2xl font-extrabold">주소의 지역을 찾지 못했어요</h1>
    <p className="text-sm text-muted">시도와 시군구를 다시 골라 주세요.</p>
    <Link href="/new" className="region-primary">지역 다시 고르기</Link>
  </section>;
}
