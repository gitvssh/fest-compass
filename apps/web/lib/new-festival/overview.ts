// Provider overview (TourAPI detailCommon2 `overview`, HTML fragment) → bounded plain text. Pure; never evaluates markup.
export const OVERVIEW_MAX = 3000;
const INPUT_MAX = 50_000;
// Elements whose CONTENT is never descriptive text (code, styling, embedded documents, hidden form data).
const DROP = "script|style|noscript|template|iframe|object|embed|svg|math|head|title|textarea|xmp|select|button|form";
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", middot: "·", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", times: "×", deg: "°", copy: "©", reg: "®", trade: "™",
};

function codePoint(n: number): string {
  // Controls, surrogates and non-characters are dropped rather than decoded.
  if (!Number.isSafeInteger(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff) || (n < 0x20 && n !== 0x0a && n !== 0x09) || (n >= 0x7f && n <= 0x9f)) return "";
  return String.fromCodePoint(n);
}
/** Single-pass decode: `&amp;lt;` becomes the text `&lt;`, never a second-level character. Unknown entities stay literal. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e: string) => {
    if (e[0] === "#") return codePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function overviewText(raw: unknown): { text: string; truncated: boolean } {
  if (typeof raw !== "string") return { text: "", truncated: false };
  let s = raw.slice(0, INPUT_MAX);
  s = s.replace(/<!--[\s\S]*?(-->|$)/g, " ").replace(/<!\[CDATA\[[\s\S]*?(\]\]>|$)/gi, " ");
  // Drop dangerous/hidden elements WITH their content; an unterminated one drops the rest of the input.
  s = s.replace(new RegExp(`<(${DROP})\\b[^>]*>[\\s\\S]*?(<\\/\\1\\s*>|$)`, "gi"), " ").replace(new RegExp(`<\\/?(${DROP})\\b[^>]*>?`, "gi"), " ");
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n").replace(/<\/\s*(p|div|li|h[1-6]|tr|blockquote)\s*>/gi, "\n").replace(/<\s*(p|div|li|h[1-6]|tr|blockquote)\b[^>]*>/gi, "\n");
  s = s.replace(/<[a-z!?/][^>]*(>|$)/gi, ""); // every other (inline) tag and a trailing unterminated one; text joins as written
  s = decodeEntities(s);
  s = s.replace(/\b(?:javascript|vbscript|data|file)\s*:[^\s]*/gi, " ");
  s = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, "");
  s = s.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const chars = Array.from(s);
  if (chars.length <= OVERVIEW_MAX) return { text: s, truncated: false };
  return { text: chars.slice(0, OVERVIEW_MAX).join("").trimEnd(), truncated: true };
}
