export const PLAYORA_NATIVE_OAUTH_REDIRECT = "com.playora.app://auth/callback";

export type NativeOAuthCallback = {
  code: string | null;
  error: string | null;
};

export function parseNativeOAuthCallback(value: string): NativeOAuthCallback | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "com.playora.app:" ||
    url.hostname !== "auth" ||
    url.pathname !== "/callback"
  ) return null;

  const params = new URLSearchParams(url.search);
  if (url.hash.length > 1) {
    new URLSearchParams(url.hash.slice(1)).forEach((hashValue, key) => {
      if (!params.has(key)) params.set(key, hashValue);
    });
  }

  return {
    code: params.get("code"),
    error: params.get("error_description") ?? params.get("error_code") ?? params.get("error"),
  };
}
