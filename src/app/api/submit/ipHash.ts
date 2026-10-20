import { createHash } from "node:crypto";

/** sha256(salt:ip). The raw IP is never stored; the salt keeps the hash from being reversed by brute force over IPv4. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
