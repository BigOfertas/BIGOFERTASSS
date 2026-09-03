export function legacyWorkerFallbackAvailable() {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".workers.dev")
  );
}
