import Link from "next/link";
import { isPublicReadonly } from "@/lib/app-mode";

export function AppShell({ children }: { children: React.ReactNode }) {
  const readOnly = isPublicReadonly();
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-extrabold tracking-[0.08em]">
            <span className="relative h-6 w-6 rounded-full border border-current">
              <i className="absolute left-[10px] top-[4px] h-3 w-1.5 rotate-[24deg] bg-coral [clip-path:polygon(50%_0,100%_100%,50%_72%,0_100%)]" />
            </span>
            FEST <span className="text-blue">Compass</span>
          </Link>
          <nav aria-label="주 메뉴" className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted sm:text-sm">
            <Link href="/" className="hover:text-ink">
              홈
            </Link>
            <Link href="/regions" className="font-bold text-blue">관광지도</Link>
            <Link href="/evidence" className="hover:text-ink">담은 근거</Link>
            <Link href="/workspace" className="font-bold text-blue">내 작업공간</Link>
            {!readOnly ? (
              <>
                <Link href="/festivals/new" className="hover:text-ink">
                  새로 만들기
                </Link>
                <Link href="/logs" className="hover:text-ink">
                  호출 로그
                </Link>
              </>
            ) : null}
            <Link href="/privacy" className="hover:text-ink">
              개인정보·분석
            </Link>
          </nav>
        </div>
      </header>
      {readOnly ? (
        <aside className="no-print border-b border-blue/20 bg-blue-soft px-5 py-3 text-center text-sm font-bold text-navy" role="status">
          공개 자료는 읽기 전용입니다. 내 작업공간의 입력은 이 브라우저에만 저장됩니다.
        </aside>
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
