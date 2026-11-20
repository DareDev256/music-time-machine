// Files under public/ on any host. Since 2026-11-19 the site runs on Cloudflare Workers (OpenNext), where there is no
// filesystem: public/ is served by the ASSETS binding. Under next dev, next build and vitest there is no Cloudflare
// context, assetsBinding() is undefined, and callers read the disk as before.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type Assets = { fetch(req: Request): Promise<Response> };

export function assetsBinding(): Assets | undefined {
  try {
    return (getCloudflareContext().env as unknown as { ASSETS?: Assets }).ASSETS;
  } catch {
    return undefined;
  }
}

/** GET public/<rel> from the binding: null when the file does not exist, throws on any other failure. */
export async function fetchPublic(a: Assets, rel: string): Promise<Response | null> {
  const res = await a.fetch(new Request(`https://assets.local/${rel}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`public/${rel}: HTTP ${res.status}`);
  return res;
}
