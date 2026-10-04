// Byte-level helpers shared by every DataLab import: hashes and strict UTF-8 text with its BOM and line endings.
import { createHash } from "node:crypto";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const gitBlobId = bytes => createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");

export function describe(bytes) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new Error("Source file is not UTF-8"); }
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const crlf = (text.match(/\r\n/g) ?? []).length, lf = (text.match(/\n/g) ?? []).length;
  return { text: bom ? text.slice(1) : text, encoding: bom ? "utf-8-bom" : "utf-8", lineEnding: lf === 0 ? "none" : crlf === 0 ? "LF" : crlf === lf ? "CRLF" : "mixed" };
}

/** GitHub blob link with every path segment percent-encoded. */
export const blobUrl = (repository, ref, path) => `${repository}/blob/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`;
