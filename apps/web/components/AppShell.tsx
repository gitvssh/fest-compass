import Link from "next/link";
import { ConsentBanner } from "@/components/ConsentBanner";
import { isPublicReadonly, READ_ONLY_MESSAGE } from "@/lib/app-mode";

export function AppShell({ children }: { children: React.ReactNode }) {
  const readOnly = isPublicReadonly();
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-extrabold tracking-[0.08em]">
            <span className="relative h-6 w-6 rounded-full border border-current">
              <i className="absolute left-[10px] top-[4px] h-3 w-1.5 rotate-[24deg] bg-coral [clip-path:polygon(50%_0,100%_100%,50%_72%,0_100%)]" />
            </span>
            FEST <span className="text-blue">Compass</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-muted">
            <Link href="/" className="hover:text-ink">
              축제
            </Link>
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
        <aside className="border-b border-blue/20 bg-blue-soft px-5 py-3 text-center text-sm font-bold text-navy" role="status">
          공개 읽기 전용 · {READ_ONLY_MESSAGE}
        </aside>
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
      <ConsentBanner />
    </div>
  );
}
