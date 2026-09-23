"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentFor, navLinks } from "@/lib/nav";

export function NavLinks({ showEditorLinks }: { showEditorLinks: boolean }) {
  const pathname = usePathname() ?? "";
  return <>{navLinks(showEditorLinks).map(link => {
    const current = currentFor(pathname, link.href, link.section);
    return <Link key={link.href} href={link.href} aria-current={current} className={current ? "font-bold text-blue underline underline-offset-4" : "hover:text-ink"}>{link.label}</Link>;
  })}</>;
}

/** Storage conditions belong to the recording tools, not the record-free festival journeys. */
export function PublicStorageNotice() {
  const pathname = usePathname() ?? "";
  if (pathname === "/" || ["/existing", "/new"].some(root => pathname === root || pathname.startsWith(`${root}/`))) return null;
  return <aside className="no-print border-b border-blue/20 bg-blue-soft px-5 py-3 text-center text-sm font-bold text-navy" role="status">
    공개 자료는 읽기 전용입니다. 기획 후보와 내 작업공간의 입력은 이 브라우저에만 저장됩니다.
  </aside>;
}
