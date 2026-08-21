const DEFAULT_NOWGO_ORIGIN = "https://www.nowgoai.com";
const NOWGO_ORIGIN = import.meta.env.VITE_NOWGO_ORIGIN || DEFAULT_NOWGO_ORIGIN;

export function buildNowGoHomeUrl(locale?: string): string {
  const url = new URL("/", NOWGO_ORIGIN);
  if (locale && ["pt", "en", "es"].includes(locale)) {
    url.searchParams.set("locale", locale);
  }
  url.searchParams.set("source", "xavier");
  url.searchParams.set("loggedOut", "1");
  return url.toString();
}

export function redirectToNowGoHome(locale?: string): void {
  window.location.assign(buildNowGoHomeUrl(locale));
}
