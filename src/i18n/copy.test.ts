import { describe, expect, it } from "vitest";
import { copy } from "./copy";

describe("localized app copy", () => {
  it("keeps English and Persian translation keys in sync", () => {
    expect(Object.keys(copy.fa).sort()).toEqual(Object.keys(copy.en).sort());
  });

  it("contains a non-empty string for every translation", () => {
    for (const locale of ["en", "fa"] as const) {
      for (const [key, value] of Object.entries(copy[locale])) {
        expect(value.trim(), locale + "." + key).not.toBe("");
      }
    }
  });
});
