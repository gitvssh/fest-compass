// `section` marks a menu whose pages live under a different prefix than its entry page.
export type NavLink = { href: string; label: string; section?: string };
export const NAV_LINKS: NavLink[] = [
  { href: "/existing/search", label: "기존 축제", section: "/existing" },
  { href: "/new", label: "새 축제" },
  { href: "/regions", label: "관광지도" },
  { href: "/compare", label: "축제 비교" },
];
export const PLANNING_LINKS: NavLink[] = [
  { href: "/evidence", label: "담은 근거" },
  { href: "/planning/options", label: "기획 후보" },
  { href: "/planning/budget", label: "예산·준비" },
  { href: "/planning/proposal", label: "기획안·출력" },
  { href: "/planning/outcomes", label: "비용·결과" },
  { href: "/workspace", label: "내 작업공간" },
];
export const EDITOR_LINKS: NavLink[] = [
  { href: "/festivals/new", label: "새로 만들기" },
  { href: "/logs", label: "호출 로그" },
];
export const PRIVACY_LINK: NavLink = { href: "/privacy", label: "개인정보·분석" };
export function planningLinks(showEditorLinks: boolean): NavLink[] {
  return [...PLANNING_LINKS, ...(showEditorLinks ? EDITOR_LINKS : [])];
}
export function navLinks(showEditorLinks: boolean): NavLink[] {
  return [...NAV_LINKS, ...planningLinks(showEditorLinks)];
}
export function normalizePath(path: string): string {
  const bare = path.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return bare.startsWith("/") ? bare : `/${bare}`;
}
// Exact page is "page"; a nested page (for example /compare/annual) marks its section with "true".
export function currentFor(pathname: string, href: string, section?: string): "page" | "true" | undefined {
  const path = normalizePath(pathname), target = normalizePath(href);
  if (path === target) return "page";
  if (target !== "/" && path.startsWith(`${target}/`)) return "true";
  const prefix = section ? normalizePath(section) : "";
  if (prefix && prefix !== "/" && (path === prefix || path.startsWith(`${prefix}/`))) return "true";
  return undefined;
}

export function publicStorageNoticeFor(pathname: string): string | undefined {
  const path = normalizePath(pathname);
  if (["/evidence", "/planning", "/workspace"].some(root => path === root || path.startsWith(`${root}/`))) {
    return "여기에 담은 자료와 입력은 이 브라우저에만 저장됩니다.";
  }
  if (path === "/festivals" || path.startsWith("/festivals/")) return "공개 운영 기록은 읽기 전용입니다.";
  return undefined;
}
