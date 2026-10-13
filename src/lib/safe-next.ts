// Where to send someone after signing in, taken from a `next` query parameter.
//
// The value arrives from the URL, so it is only honoured when it is a plain
// path on this site. Appending an unchecked value to the origin is an open
// redirect: "@evil.example" turns https://site into https://site@evil.example,
// and "//evil.example" is a protocol-relative link to another host.
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !/^\/[A-Za-z0-9\-_/]*$/.test(value) || value.startsWith("//")) return fallback;
  return value;
}
