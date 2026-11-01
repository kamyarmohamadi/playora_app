import { describe, expect, it } from "vitest";
import { gameList, parseGameRegistry } from "./gameRegistry";

const validEntry = () => ({
  id: "test-game",
  title: { en: "Test Game", fa: "بازی آزمایشی" },
  subtitle: { en: "A safe test game", fa: "بازی امن آزمایشی" },
  category: "puzzle",
  players: { en: "2 players", fa: "۲ بازیکن" },
  iconKey: "puzzle",
  art: "tic",
  color: "violet",
  featured: false,
});

const manifest = (...games: unknown[]) => ({ apiVersion: 1, games });

describe("versioned game registry", () => {
  it("accepts an empty catalog when no game plugins are installed", () => {
    expect(parseGameRegistry({ apiVersion: 1, games: [] })).toEqual([]);
  });

  it("loads the curated bilingual catalogue through the runtime validator", () => {
    expect(gameList).toHaveLength(8);
    expect(gameList.find(game => game.id === "tictactoe")?.title.en).toBe("Tic Tac Toe");
    expect(gameList.find(game => game.id === "tictactoe")?.title.fa).toBe("دوز");
    expect(gameList.find(game => game.id === "chess")?.featured).toBe(true);
  });

  it("rejects unsupported manifest versions and unknown top-level fields", () => {
    expect(() => parseGameRegistry({ apiVersion: 2, games: [validEntry()] })).toThrow();
    expect(() => parseGameRegistry({ apiVersion: 1, games: [validEntry()], remoteScript: "https://evil.test/game.js" })).toThrow();
  });

  it("rejects unknown game fields and non-allowlisted icon names", () => {
    const withUnknownField = { ...validEntry(), html: "<img src=x onerror=alert(1)>" };
    expect(() => parseGameRegistry(manifest(withUnknownField))).toThrow();
    expect(() => parseGameRegistry(manifest({ ...validEntry(), iconKey: "remote-component" }))).toThrow();
  });

  it("rejects duplicate IDs, invalid IDs and excessive manifest size", () => {
    expect(() => parseGameRegistry(manifest(validEntry(), validEntry()))).toThrow(/duplicate game id/i);
    expect(() => parseGameRegistry(manifest({ ...validEntry(), id: "../../admin" }))).toThrow();
    expect(() => parseGameRegistry({ apiVersion: 1, games: Array.from({ length: 65 }, (_, i) => ({ ...validEntry(), id: "game_" + i })) })).toThrow();
  });

  it("rejects empty, oversized or incomplete localized text", () => {
    expect(() => parseGameRegistry(manifest({ ...validEntry(), title: { en: "", fa: "بازی" } }))).toThrow();
    expect(() => parseGameRegistry(manifest({ ...validEntry(), subtitle: { en: "x".repeat(121), fa: "متن" } }))).toThrow();
    expect(() => parseGameRegistry(manifest({ ...validEntry(), players: { en: "2 players" } }))).toThrow();
  });

  it("does not accept external URLs as executable metadata", () => {
    expect(() => parseGameRegistry(manifest({ ...validEntry(), art: "https://evil.test/script.js" }))).toThrow();
    expect(() => parseGameRegistry(manifest({ ...validEntry(), color: "url(javascript:alert(1))" }))).toThrow();
  });
});
