"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { currentFor, NAV_LINKS, planningLinks, PRIVACY_LINK, publicStorageNoticeFor, type NavLink } from "@/lib/nav";

export function NavLinks({ showEditorLinks }: { showEditorLinks: boolean }) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const navigationId = useId();
  const toolsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const tools = planningLinks(showEditorLinks);
  const toolsCurrent = tools.some(link => currentFor(pathname, link.href, link.section));

  useEffect(() => {
    setMobileOpen(false);
    setToolsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen && !toolsOpen) return;
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setMobileOpen(false);
        setToolsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (toolsOpen) {
        setToolsOpen(false);
        toolsButtonRef.current?.focus();
      } else {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen, toolsOpen]);

  const renderLink = (link: NavLink) => {
    const current = currentFor(pathname, link.href, link.section);
    return <Link key={link.href} href={link.href} aria-current={current} className={`app-nav-link${current ? " is-current" : ""}`} onClick={() => { setMobileOpen(false); setToolsOpen(false); }}>{link.label}</Link>;
  };

  return <div ref={containerRef} className="app-navigation">
    <button ref={mobileButtonRef} type="button" className="app-nav-toggle" aria-controls={navigationId} aria-expanded={mobileOpen} onClick={() => { setMobileOpen(open => !open); setToolsOpen(false); }}>
      메뉴 <Chevron open={mobileOpen} />
    </button>
    <nav id={navigationId} aria-label="주 메뉴" className={`app-nav-panel${mobileOpen ? " is-open" : ""}`}>
      <div className="app-nav-primary">{NAV_LINKS.map(renderLink)}</div>
      <div className="app-nav-tools">
        <button ref={toolsButtonRef} type="button" className={`app-nav-link app-tools-toggle${toolsCurrent ? " is-current" : ""}`} aria-controls={toolsId} aria-expanded={toolsOpen} onClick={() => setToolsOpen(open => !open)}>
          기획 도구 <Chevron open={toolsOpen} />
        </button>
        <div id={toolsId} className="app-tools-panel" hidden={!toolsOpen}>{tools.map(renderLink)}</div>
      </div>
    </nav>
  </div>;
}

function Chevron({ open }: { open: boolean }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className={open ? "rotate-180" : ""}><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function FooterPrivacyLink() {
  const pathname = usePathname() ?? "";
  return <Link href={PRIVACY_LINK.href} aria-current={currentFor(pathname, PRIVACY_LINK.href)} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">{PRIVACY_LINK.label}</Link>;
}

export function PublicStorageNotice() {
  const pathname = usePathname() ?? "";
  const notice = publicStorageNoticeFor(pathname);
  if (!notice) return null;
  return <aside className="no-print border-b border-ink/10 bg-white px-5 py-2.5 text-sm text-muted lg:px-8" role="status"><p className="mx-auto max-w-[1760px]">{notice}</p></aside>;
}
