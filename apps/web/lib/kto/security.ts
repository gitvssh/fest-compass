function secretVariants(secret: string): string[] {
  const variants = new Set<string>();
  if (secret) {
    variants.add(secret);
    variants.add(encodeURIComponent(secret));
    const encodedBySearchParams = new URLSearchParams({ serviceKey: secret })
      .toString()
      .slice("serviceKey=".length);
    variants.add(encodedBySearchParams);
    try {
      variants.add(decodeURIComponent(secret));
    } catch {
      // The key is already a decoded value or contains a stray percent sign.
    }
  }
  return [...variants].filter(Boolean).sort((a, b) => b.length - a.length);
}

/** Remove raw, percent-encoded, and URLSearchParams-encoded forms of a key. */
export function scrubSecret(value: unknown, secret: string | null | undefined): string {
  let safe = value === null || value === undefined ? "" : String(value);
  if (!secret) return safe;
  for (const variant of secretVariants(secret)) safe = safe.replaceAll(variant, "***");
  return safe;
}

export function maskServiceKeyUrl(url: string): string {
  return url.replace(/([?&]serviceKey=)[^&]*/gi, "$1***");
}
