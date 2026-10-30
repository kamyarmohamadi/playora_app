import { describe, expect, it } from "vitest";
import { PLAYORA_NATIVE_OAUTH_REDIRECT, parseNativeOAuthCallback } from "./nativeOAuth";

describe("Playora native OAuth callback", () => {
  it("uses the registered Android callback", () => {
    expect(PLAYORA_NATIVE_OAUTH_REDIRECT).toBe("com.playora.app://auth/callback");
  });
  it("extracts the PKCE authorization code", () => {
    expect(parseNativeOAuthCallback("com.playora.app://auth/callback?code=oauth-code-123"))
      .toEqual({ code: "oauth-code-123", error: null });
  });
  it("surfaces provider errors returned to the app", () => {
    expect(parseNativeOAuthCallback("com.playora.app://auth/callback?error=access_denied&error_description=Login%20cancelled"))
      .toEqual({ code: null, error: "Login cancelled" });
  });
  it("ignores any URL outside the exact Playora callback", () => {
    expect(parseNativeOAuthCallback("https://localhost/")).toBeNull();
    expect(parseNativeOAuthCallback("com.other.app://auth/callback?code=x")).toBeNull();
    expect(parseNativeOAuthCallback("com.playora.app://other/callback?code=x")).toBeNull();
    expect(parseNativeOAuthCallback("not a url")).toBeNull();
  });
});
