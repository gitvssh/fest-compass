// Small strict CSV reader for byte-preserved DataLab downloads. Values stay source strings.
export class CsvError extends Error {}

export function parseCsv(text) {
  if (typeof text !== "string") throw new CsvError("CSV input must be text");
  const rows = [];
  let row = [], field = "", i = text.charCodeAt(0) === 0xfeff ? 1 : 0, line = 1, quoted = false, afterQuote = false, started = false;
  const endField = () => { row.push(field); field = ""; quoted = false; afterQuote = false; };
  const endRow = () => { endField(); rows.push(row); row = []; started = false; line++; };
  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else { if (c === "\n") line++; field += c; }
      continue;
    }
    if (c === ",") { endField(); started = true; continue; }
    if (c === "\n") { endRow(); continue; }
    if (c === "\r") {
      if (text[i + 1] !== "\n") throw new CsvError(`Bare carriage return at line ${line}`);
      continue;
    }
    if (afterQuote) throw new CsvError(`Unexpected character after closing quote at line ${line}`);
    if (c === '"') {
      if (field !== "") throw new CsvError(`Quote inside unquoted field at line ${line}`);
      quoted = true; started = true; continue;
    }
    field += c; started = true;
  }
  if (quoted) throw new CsvError(`Unterminated quoted field at line ${line}`);
  if (started || field !== "" || afterQuote || row.length) endRow();
  return rows;
}

/** Parse a CSV whose first row is the header; every row must have exactly the header width. */
export function parseTable(text, expectedHeader) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new CsvError("CSV has no header");
  if (expectedHeader && (header.length !== expectedHeader.length || header.some((h, i) => h !== expectedHeader[i]))) throw new CsvError(`Unexpected header: ${header.join(",")}`);
  rows.forEach((r, i) => { if (r.length !== header.length) throw new CsvError(`Row ${i + 2} has ${r.length} cells; expected ${header.length}`); });
  return { header, rows };
}

const NUMERIC = /^-?(0|[1-9]\d*)(\.\d+)?$/;
/** Empty and "N/A" are missing (null), never zero. Anything else non-numeric is an error. */
export function parseSourceNumber(raw) {
  if (typeof raw !== "string") throw new CsvError("Numeric source value must be a string");
  if (raw === "" || raw === "N/A") return null;
  if (!NUMERIC.test(raw)) throw new CsvError(`Malformed numeric value: ${JSON.stringify(raw)}`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new CsvError(`Non-finite numeric value: ${JSON.stringify(raw)}`);
  return value;
}
