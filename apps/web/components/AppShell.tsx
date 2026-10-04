import Link from "next/link";
import { isPublicReadonly } from "@/lib/app-mode";
import { siteConfig } from "@/lib/site";
import { ConsentBanner } from "./ConsentBanner";
import { ConsentSettingsButton } from "./ConsentSettingsButton";
import { FooterPrivacyLink, NavLinks, PublicStorageNotice } from "./NavLinks";

export function AppShell({ children }: { children: React.ReactNode }) {
  const readOnly = isPublicReadonly();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="no-print sr-only z-50 rounded-lg bg-navy px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3">본문 바로가기</a>
      <header className="no-print sticky top-0 z-30 border-b border-ink/10 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-full max-w-[1760px] items-center justify-between gap-5 px-5 lg:gap-10 lg:px-8">
          <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 text-base font-extrabold tracking-[0.04em]" aria-label={`${siteConfig.name} 홈`}>
            <span aria-hidden="true" className="relative h-6 w-6 rounded-full border border-current">
              <i className="absolute left-[10px] top-[4px] h-3 w-1.5 rotate-[24deg] bg-coral [clip-path:polygon(50%_0,100%_100%,50%_72%,0_100%)]" />
            </span>
            <span>{siteConfig.name}</span>
          </Link>
          <NavLinks showEditorLinks={!readOnly} />
        </div>
      </header>
      {readOnly ? <PublicStorageNotice /> : null}
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1760px] flex-1 scroll-mt-24 px-5 py-8 lg:px-8">{children}</main>
      <footer className="no-print mt-10 border-t border-ink/10">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1760px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 text-sm text-[#43536a] lg:px-8">
          <span className="font-bold text-ink">{siteConfig.name}</span>
          <span className="flex flex-wrap items-center gap-x-5">
            <FooterPrivacyLink />
            <ConsentSettingsButton className="inline-flex min-h-11 items-center hover:text-ink hover:underline" />
          </span>
        </div>
      </footer>
      {/* Room for a fixed card at the bottom of the screen (useBottomDock), so the footer can scroll above it. */}
      <div aria-hidden="true" className="no-print shrink-0" style={{ height: "var(--bottom-dock, 0px)" }} />
      <ConsentBanner />
    </div>
  );
}
