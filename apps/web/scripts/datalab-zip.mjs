// Small strict ZIP reader for byte-preserved official DataLab downloads: single disk, no ZIP64, no encryption,
// stored or deflated entries, UTF-8 names. Every entry is inflated and checked against its size and CRC-32.
import { crc32, inflateRawSync } from "node:zlib";

export class ZipError extends Error {}

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;

/** Entries in central-directory order: { name, method, crc32, size, bytes }. */
export function readZip(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new ZipError("ZIP input must be a Buffer");
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) if (buffer.readUInt32LE(i) === EOCD) { end = i; break; }
  if (end < 0) throw new ZipError("No end of central directory");
  if (buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw new ZipError("Multi-disk ZIP");
  const count = buffer.readUInt16LE(end + 10), size = buffer.readUInt32LE(end + 12), offset = buffer.readUInt32LE(end + 16);
  if (count !== buffer.readUInt16LE(end + 8) || offset + size !== end) throw new ZipError("Central directory does not end at its record");
  const entries = [];
  let p = offset;
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(p) !== CENTRAL) throw new ZipError(`Bad central directory entry ${n}`);
    const flags = buffer.readUInt16LE(p + 8), method = buffer.readUInt16LE(p + 10), crc = buffer.readUInt32LE(p + 16);
    const packed = buffer.readUInt32LE(p + 20), unpacked = buffer.readUInt32LE(p + 24);
    const nameLength = buffer.readUInt16LE(p + 28), extraLength = buffer.readUInt16LE(p + 30), commentLength = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42), rawName = buffer.subarray(p + 46, p + 46 + nameLength);
    if (flags & 1) throw new ZipError("Encrypted entry");
    if ([packed, unpacked, local].includes(0xffffffff)) throw new ZipError("ZIP64 entry");
    if (method !== 0 && method !== 8) throw new ZipError(`Unsupported compression method ${method}`);
    const ascii = rawName.every(b => b < 0x80);
    if (!(flags & 0x800) && !ascii) throw new ZipError("Entry name is not marked UTF-8");
    let name;
    try { name = new TextDecoder("utf-8", { fatal: true }).decode(rawName); } catch { throw new ZipError("Entry name is not UTF-8"); }
    if (!name || name.includes("/") || name.includes("\\") || name.startsWith(".")) throw new ZipError(`Entry is not a plain file name: ${name}`);
    if (buffer.readUInt32LE(local) !== LOCAL) throw new ZipError(`Bad local header: ${name}`);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + packed);
    if (data.length !== packed) throw new ZipError(`Truncated entry: ${name}`);
    const bytes = method === 0 ? Buffer.from(data) : inflateRawSync(data);
    if (bytes.length !== unpacked || crc32(bytes) !== crc) throw new ZipError(`Entry size or CRC-32 mismatch: ${name}`);
    if (entries.some(e => e.name === name)) throw new ZipError(`Repeated entry: ${name}`);
    entries.push({ name, method, crc32: crc, size: unpacked, bytes });
    p += 46 + nameLength + extraLength + commentLength;
  }
  if (p !== end) throw new ZipError("Central directory size mismatch");
  return entries;
}
