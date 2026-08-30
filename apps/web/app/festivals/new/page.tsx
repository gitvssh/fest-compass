import { notFound } from "next/navigation";
import { hasTourKey, searchFestivalsByKeyword } from "@/lib/kto/client";
import { isPublicReadonly } from "@/lib/app-mode";
import { KindBadge } from "@/components/KindBadge";
import {
  KtoFestivalCreateForm,
  ManualFestivalForm,
} from "@/components/forms/FestivalCreateForms";

export default async function NewFestivalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (isPublicReadonly()) notFound();
  const { q } = await searchParams;
  const keyed = hasTourKey();
  const hits = q && keyed ? await searchFestivalsByKeyword(q) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl bg-white p-6 shadow-card">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue">KTO 사전채움</p>
        <h1 className="text-3xl font-extrabold">축제 정보를 불러오거나 직접 입력합니다.</h1>
        <p className="mt-3 text-sm text-muted">
          국문 관광정보 검색은 일정·장소·주제를 채웁니다. 입장객·예산·만족도는 API에 없습니다.
        </p>

        <form action="/festivals/new" className="mt-6 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="축제 이름"
            className="flex-1 rounded-2xl border border-ink/10 bg-paper px-4 py-3"
          />
          <button className="rounded-2xl bg-navy px-4 py-3 text-sm font-bold text-white" type="submit">
            검색
          </button>
        </form>

        {!keyed ? (
          <p className="mt-4 text-sm text-muted">TOUR_API_KEY가 없어 검색을 건너뜁니다. 오른쪽에서 직접 입력하세요.</p>
        ) : null}

        {hits ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <KindBadge kind="observation" />
              <span>
                {hits.kind} · {hits.summary}
              </span>
            </div>
            {(hits.data ?? []).map((item) => (
              <article key={item.contentId || item.title} className="rounded-2xl bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b>{item.title}</b>
                    <p className="text-sm text-muted">{item.addr1 || "주소 없음"}</p>
                    <p className="text-xs text-muted">
                      {item.eventstartdate || "시작일 없음"}–{item.eventenddate || "종료일 없음"}
                    </p>
                  </div>
                  <KtoFestivalCreateForm contentId={item.contentId} />
                </div>
              </article>
            ))}
            {hits.kind === "empty" ? (
              <p className="text-sm text-muted">검색 결과가 없습니다. 직접 입력으로 계속할 수 있습니다.</p>
            ) : null}
            {hits.kind === "error" ? (
              <div className="rounded-2xl bg-coral-soft px-4 py-3 text-sm">
                <p className="font-bold">관광정보를 불러오지 못했습니다. 직접 입력으로 계속하세요.</p>
                <form action="/festivals/new" className="mt-2">
                  <input type="hidden" name="q" value={q ?? ""} />
                  <button type="submit" className="rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-card">
                    다시 시도
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <ManualFestivalForm initialName={q ?? ""} />
    </div>
  );
}
