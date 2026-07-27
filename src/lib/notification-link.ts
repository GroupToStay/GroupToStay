export function getSafeNotificationHref(link: string | null | undefined) {
  if (!link || !link.startsWith("/dashboard") || link.startsWith("//")) return null;
  return link;
}
