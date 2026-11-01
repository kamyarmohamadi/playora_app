const INSTALL_ID_KEY = "playora.install-id.v1";
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createInstallId(): string | null {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") return null;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

/**
 * Returns a random, persistent per-install identifier.
 * This is an application install ID, not a hardware fingerprint or attestation.
 */
export function getPlayoraInstallId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(INSTALL_ID_KEY);
    if (current && UUID_V4_RE.test(current)) return current;
    const created = createInstallId();
    if (!created) return null;
    window.localStorage.setItem(INSTALL_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}
