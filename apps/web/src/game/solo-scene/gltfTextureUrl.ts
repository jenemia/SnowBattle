export function createTextureUrlModifier(textureUrls: ReadonlyMap<string, string>) {
  return (requestUrl: string) => {
    const normalized = normalizeTextureRequestPath(requestUrl);
    return textureUrls.get(normalized) ?? requestUrl;
  };
}

export function normalizeTextureRequestPath(requestUrl: string) {
  const withoutQuery = requestUrl.split(/[?#]/, 1)[0] ?? requestUrl;
  const normalized = withoutQuery.replace(/^(\.\/)+/, "");

  if (normalized.startsWith("Textures/")) {
    return normalized;
  }

  try {
    const pathname = new URL(normalized, "https://snowbattle.local").pathname;
    const marker = "/Textures/";
    const markerIndex = pathname.lastIndexOf(marker);

    if (markerIndex >= 0) {
      return pathname.slice(markerIndex + 1);
    }
  } catch {
    // Preserve the original request when URL parsing fails.
  }

  return normalized;
}
