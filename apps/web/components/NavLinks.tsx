"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentFor, navLinks } from "@/lib/nav";

export function NavLinks({ showEditorLinks }: { showEditorLinks: boolean }) {
  const pathname = usePathname() ?? "";
  return <>{navLinks(showEditorLinks).map(link => {
    const current = currentFor(pathname, link.href);
    return <Link key={link.href} href={link.href} aria-current={current} className={current ? "font-bold text-blue underline underline-offset-4" : "hover:text-ink"}>{link.label}</Link>;
  })}</>;
}
