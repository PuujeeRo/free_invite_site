import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Guard for server-side requests to an address a user supplied (the image
// proxy). Without it, "https://169.254.169.254/..." or "https://localhost:5432"
// would make our server talk to its own cloud metadata service or internal
// network on the user's behalf.

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4 written inside IPv6 (::ffff:10.0.0.1) is judged as the IPv4 it is.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPrivateV4(mapped[1]);
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") || // unique local fc00::/7
    lower.startsWith("fd") ||
    /^fe[89ab]/.test(lower) || // link-local fe80::/10
    lower.startsWith("ff") // multicast
  );
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version === 6) return isPrivateV6(ip);
  return true; // not an IP at all: treat as unsafe
}

/**
 * True when every address `hostname` resolves to is a public one.
 *
 * Known limit: the name is resolved here and again by fetch(), so a DNS server
 * that answers differently the second time ("rebinding") could slip past.
 * Closing that needs the connection pinned to the checked address; it is
 * accepted here because the proxy only fetches URLs that are signed, i.e.
 * saved by a signed-in organizer, which is not an anonymous attack surface.
 */
export async function isPublicHost(hostname: string): Promise<boolean> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return !isPrivateAddress(bare);
  try {
    const addresses = await lookup(bare, { all: true });
    return addresses.length > 0 && addresses.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}
