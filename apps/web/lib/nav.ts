export type NavLink = { href: string; label: string };
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "홈" },
  { href: "/regions", label: "관광지도" },
  { href: "/compare", label: "축제 비교" },
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
export function navLinks(showEditorLinks: boolean): NavLink[] {
  return [...NAV_LINKS, ...(showEditorLinks ? EDITOR_LINKS : []), PRIVACY_LINK];
}
export function normalizePath(path: string): string {
  const bare = path.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return bare.startsWith("/") ? bare : `/${bare}`;
}
// Exact page is "page"; a nested page (for example /compare/annual) marks its section with "true".
export function currentFor(pathname: string, href: string): "page" | "true" | undefined {
  const path = normalizePath(pathname), target = normalizePath(href);
  if (path === target) return "page";
  if (target !== "/" && path.startsWith(`${target}/`)) return "true";
  return undefined;
}
