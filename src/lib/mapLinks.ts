/** Deliberately sends only place names when user clicks an external map link.
 * No GPS coordinates, background route tracking or ETA estimates.
 */
export function externalRouteUrl(
  provider: "google" | "apple",
  origin: string,
  destination: string,
): string | null {
  const from = origin.trim().normalize("NFKC");
  const to = destination.trim().normalize("NFKC");
  if (!from || !to || from.length > 120 || to.length > 120) return null;
  const a = encodeURIComponent(from);
  const b = encodeURIComponent(to);
  return provider === "google"
    ? `https://www.google.com/maps/dir/?api=1&origin=${a}&destination=${b}&travelmode=walking`
    : `https://maps.apple.com/?saddr=${a}&daddr=${b}&dirflg=w`;
}
