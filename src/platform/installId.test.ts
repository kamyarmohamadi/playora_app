import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlayoraInstallId } from "./installId";

describe("Playora install identifier", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates a random UUID v4 and persists it", () => {
    const first = getPlayoraInstallId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(window.localStorage.getItem("playora.install-id.v1")).toBe(first);
  });

  it("reuses the same identifier on later calls", () => {
    const first = getPlayoraInstallId();
    expect(getPlayoraInstallId()).toBe(first);
  });

  it("replaces a malformed stored identifier", () => {
    window.localStorage.setItem("playora.install-id.v1", "not-a-uuid");
    const next = getPlayoraInstallId();
    expect(next).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(next).not.toBe("not-a-uuid");
  });

  it("fails safely when persistent browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage_disabled");
    });
    expect(getPlayoraInstallId()).toBeNull();
  });
});
