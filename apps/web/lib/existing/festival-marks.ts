// Marks read from a registration's own introduction (TourAPI detailIntro2: programme, side events, age limit, fee).
// A mark only says that the registered text mentions it; each mark carries the words it was read from. Nothing is
// inferred from names, types or other festivals, and a festival whose introduction was not read yet has no marks.
export const MARK_KINDS = [
  { kind: "experience", label: "체험", hint: "체험 프로그램" },
  { kind: "family", label: "어린이·가족", hint: "어린이·가족 프로그램" },
  { kind: "free", label: "무료", hint: "무료 입장" },
] as const;
export type MarkKind = (typeof MARK_KINDS)[number]["kind"];
export type FestivalMark = { kind: MarkKind; label: string; evidence: string };
/** `checkedAt` is when the introduction was read; `items` may be empty (read, nothing found). */
export type FestivalMarks = { checkedAt: string; items: FestivalMark[] };
export type IntroText = { program: string; subevent: string; agelimit: string; fee: string };

export const INTRO_FIELD_MAX = { program: 1200, subevent: 600, agelimit: 120, fee: 300 } as const;
export const isMarkKind = (v: unknown): v is MarkKind => typeof v === "string" && MARK_KINDS.some(m => m.kind === v);
/** Address value `experience,family` → known kinds in display order, duplicates and unknown words dropped. */
export function parseMarkKinds(raw: string | null | undefined): MarkKind[] {
  const asked = new Set((raw ?? "").split(",").map(s => s.trim()));
  return MARK_KINDS.map(m => m.kind).filter(k => asked.has(k));
}

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", middot: "·", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };
/** Provider HTML fragment → plain text: breaks become new lines, tags and control characters go, spacing collapses. */
export function introText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr)>/gi, "\n").replace(/<\/?(td|th)\b[^>]*>/gi, " ").replace(/<[^>]*>/g, "")
    .replace(/&(#\d{1,6}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi, (m, e: string) => {
      if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return n > 31 && n < 0x110000 ? String.fromCodePoint(n) : " "; }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t ]+/g, " ").replace(/ *\n[ \n]*/g, "\n").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Pieces of a programme list: lines, " - " items, numbered items and list punctuation.
// A comma or slash between digits belongs to a number or a date (10,000원 · 10/5), not to the list.
const SEPARATOR = /\n|\s-\s|(?:^|\s)\d{1,2}[.)]\s|(?<!\d)[,/]|[,/](?!\d)|[;·ㆍ•※|]/g;
/** The list piece around one match (text is already normalised: single spaces, lines split), shortened when long. */
function evidenceAt(text: string, index: number, length: number): string {
  let start = 0, end = text.length;
  for (const m of text.matchAll(SEPARATOR)) {
    const at = m.index ?? 0, stop = at + m[0].length;
    if (stop <= index) start = stop;
    else if (at >= index + length) { end = at; break; }
  }
  const raw = text.slice(start, end), head = /^\s*(?:[-•*]\s*|\d{1,2}[.)]\s*)?/.exec(raw)![0];
  const piece = raw.slice(head.length).trim().replace(/[.。]$/, ""), offset = index - start - head.length;
  if (piece.length <= 48) return piece;
  const from = Math.max(0, offset - 20), to = Math.min(piece.length, offset + length + 20);
  return `${from > 0 ? "…" : ""}${piece.slice(from, to).trim()}${to < piece.length ? "…" : ""}`;
}
/** The first mention, preferring one that says more than the word itself (a list heading like "체험" alone says little). */
function firstMatch(fields: string[], pattern: RegExp): string | null {
  let bare: string | null = null;
  for (const text of fields) {
    for (const m of text.matchAll(new RegExp(pattern.source, "g"))) {
      const piece = evidenceAt(text, m.index ?? 0, m[0].length);
      if (piece.length > m[0].length + 2) return piece;
      bare ??= piece;
    }
  }
  return bare;
}

const EXPERIENCE = /체험/;
const FAMILY = /어린이|유아|아동|키즈|가족|패밀리|아이들|아이와|아이랑|꿈나무/;
const FREE = /(입장료|입장|관람료|관람|참가비|참가)?\s*무료/g;
const PAID = /유료|별도|체험비|참가비|이용료|입장료|관람료|요금|\d[\d,]*\s*원/;

/** Marks in display order. `free` reads only the fee text: free alone, or free with something paid ("무료·일부 유료"). */
export function festivalMarks(intro: IntroText): FestivalMark[] {
  const marks: FestivalMark[] = [];
  const experience = firstMatch([intro.program, intro.subevent], EXPERIENCE);
  if (experience) marks.push({ kind: "experience", label: "체험", evidence: experience });
  const family = firstMatch([intro.program, intro.subevent, intro.agelimit], FAMILY);
  if (family) marks.push({ kind: "family", label: "어린이·가족", evidence: family });
  const fee = intro.fee.replace(/\s+/g, " ").trim();
  if (/무료/.test(fee)) {
    const rest = fee.replace(FREE, " ");
    marks.push({ kind: "free", label: PAID.test(rest) ? "무료·일부 유료" : "무료", evidence: fee.length > 60 ? `${fee.slice(0, 59)}…` : fee });
  }
  return marks;
}
export const hasMarks = (marks: FestivalMarks | null | undefined, kinds: readonly MarkKind[]) =>
  !!marks && kinds.every(k => marks.items.some(m => m.kind === k));
