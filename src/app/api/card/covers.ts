// Fetches iTunes cover art server-side and hands Satori a data URI. Any failure returns null and
// the card draws a typeset sleeve instead, so a dead CDN never leaves an empty box.

const ART_HOST = /^is\d+-ssl\.mzstatic\.com$/;
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 4_000;
const KEEP = 48;

// Covers never change; keep the last few per instance so repeat cards skip the network.
const memo = new Map<string, string>();

function imageType(buf: Uint8Array): "image/jpeg" | "image/png" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  return null;
}

export async function coverData(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !ART_HOST.test(u.hostname) || u.port) return null;
  const hit = memo.get(u.href);
  if (hit) return hit;
  try {
    const res = await fetch(u.href, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    // Trust the bytes, not the header: Satori throws on anything that is not a real JPEG or PNG.
    const type = imageType(buf);
    if (!type) return null;
    const uri = `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
    if (memo.size >= KEEP) memo.delete(memo.keys().next().value as string);
    memo.set(u.href, uri);
    return uri;
  } catch {
    return null;
  }
}

/** Test hook: forget fetched covers. */
export function clearCoverMemo(): void {
  memo.clear();
}
