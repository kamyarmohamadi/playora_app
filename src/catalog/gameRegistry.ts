import type { LucideIcon } from "lucide-react";
import { Activity, Crown, Dices, Grid2X2, Puzzle, Spade } from "lucide-react";

export type GameLocale = "en" | "fa";
export type GameCategory = "strategy" | "board" | "cards" | "puzzle";
export type GameArt = "chess" | "pool" | "ludo" | "checkers" | "cards" | "backgammon" | "tic" | "rummy";
export type GameColor = "cyan" | "violet" | "pink" | "blue" | "gold";
type GameIconKey = "activity" | "crown" | "dices" | "grid" | "puzzle" | "spade";

export type CatalogGame = {
  id: string;
  title: Record<GameLocale, string>;
  subtitle: Record<GameLocale, string>;
  category: GameCategory;
  players: Record<GameLocale, string>;
  icon: LucideIcon;
  art: GameArt;
  color: GameColor;
  featured?: boolean;
};

const ICONS: Record<GameIconKey, LucideIcon> = {
  activity: Activity,
  crown: Crown,
  dices: Dices,
  grid: Grid2X2,
  puzzle: Puzzle,
  spade: Spade,
};

const CATEGORIES = new Set<GameCategory>(["strategy", "board", "cards", "puzzle"]);
const ARTS = new Set<GameArt>(["chess", "pool", "ludo", "checkers", "cards", "backgammon", "tic", "rummy"]);
const COLORS = new Set<GameColor>(["cyan", "violet", "pink", "blue", "gold"]);
const ICON_KEYS = new Set<GameIconKey>(["activity", "crown", "dices", "grid", "puzzle", "spade"]);
const ROOT_KEYS = new Set(["apiVersion", "games"]);
const REQUIRED_GAME_KEYS = ["id", "title", "subtitle", "category", "players", "iconKey", "art", "color"] as const;
const GAME_KEYS = new Set([...REQUIRED_GAME_KEYS, "featured"]);

const STATIC_GAME_MANIFEST: unknown = {
  apiVersion: 1,
  games: [
    { id: "chess", title: { en: "Chess", fa: "شطرنج" }, subtitle: { en: "Think three moves ahead", fa: "چند حرکت جلوتر فکر کن" }, category: "strategy", players: { en: "2 players", fa: "۲ بازیکن" }, iconKey: "crown", art: "chess", color: "cyan", featured: true },
    { id: "pool", title: { en: "Pool", fa: "بیلیارد" }, subtitle: { en: "Precision meets pressure", fa: "دقت در اوج هیجان" }, category: "strategy", players: { en: "2 players", fa: "۲ بازیکن" }, iconKey: "activity", art: "pool", color: "violet", featured: true },
    { id: "ludo", title: { en: "Ludo", fa: "منچ" }, subtitle: { en: "A classic, reimagined", fa: "یک بازی کلاسیک با حال‌وهوای تازه" }, category: "board", players: { en: "2–4 players", fa: "۲ تا ۴ بازیکن" }, iconKey: "dices", art: "ludo", color: "pink", featured: true },
    { id: "checkers", title: { en: "Checkers", fa: "چکرز" }, subtitle: { en: "Own the board", fa: "صفحه را در اختیار بگیر" }, category: "board", players: { en: "2 players", fa: "۲ بازیکن" }, iconKey: "grid", art: "checkers", color: "blue" },
    { id: "hokm", title: { en: "Hokm", fa: "حکم" }, subtitle: { en: "Read the table", fa: "میز را هوشمندانه بخوان" }, category: "cards", players: { en: "4 players", fa: "۴ بازیکن" }, iconKey: "spade", art: "cards", color: "gold" },
    { id: "backgammon", title: { en: "Backgammon", fa: "تخته‌نرد" }, subtitle: { en: "Classic strategy, fast turns", fa: "استراتژی کلاسیک و حرکت‌های سریع" }, category: "board", players: { en: "2 players", fa: "۲ بازیکن" }, iconKey: "grid", art: "backgammon", color: "cyan" },
    { id: "tictactoe", title: { en: "Tic Tac Toe", fa: "دوز" }, subtitle: { en: "Quick. Clever. Unpredictable.", fa: "سریع، هوشمندانه و غیرقابل‌پیش‌بینی" }, category: "puzzle", players: { en: "2 players", fa: "۲ بازیکن" }, iconKey: "puzzle", art: "tic", color: "violet" },
    { id: "rummy", title: { en: "Rummy", fa: "رامی" }, subtitle: { en: "Build your winning hand", fa: "دست برنده‌ات را بساز" }, category: "cards", players: { en: "2–4 players", fa: "۲ تا ۴ بازیکن" }, iconKey: "spade", art: "rummy", color: "pink" },
  ],
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every(key => allowed.has(key));
}

function hasRequiredKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return required.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function parseLocalePair(value: unknown, maxLength: number, field: string): Record<GameLocale, string> {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, new Set(["en", "fa"])) ||
      !hasRequiredKeys(value, ["en", "fa"])) {
    throw new Error("Invalid game registry field: " + field);
  }
  for (const locale of ["en", "fa"] as const) {
    const text = value[locale];
    if (typeof text !== "string" || text.trim().length === 0 || text.length > maxLength) {
      throw new Error("Invalid game registry text: " + field + "." + locale);
    }
  }
  return { en: value.en as string, fa: value.fa as string };
}

/**
 * Validate manifest data before it enters the UI. This accepts data only:
 * there are no URLs, executable code, imports, HTML or remote component names.
 */
export function parseGameRegistry(input: unknown): CatalogGame[] {
  if (!isPlainRecord(input) || !hasOnlyKeys(input, ROOT_KEYS) ||
      !hasRequiredKeys(input, ["apiVersion", "games"]) || input.apiVersion !== 1 ||
      !Array.isArray(input.games) || input.games.length < 1 || input.games.length > 64) {
    throw new Error("Unsupported or invalid game registry manifest");
  }

  const seenIds = new Set<string>();
  const games = input.games.map((candidate, index): CatalogGame => {
    if (!isPlainRecord(candidate) || !hasOnlyKeys(candidate, GAME_KEYS) ||
        !hasRequiredKeys(candidate, REQUIRED_GAME_KEYS)) {
      throw new Error("Invalid game manifest entry at index " + index);
    }

    const id = candidate.id;
    if (typeof id !== "string" || !/^[a-z0-9_-]{2,40}$/.test(id) || seenIds.has(id)) {
      throw new Error("Invalid or duplicate game id at index " + index);
    }
    seenIds.add(id);

    if (typeof candidate.category !== "string" || !CATEGORIES.has(candidate.category as GameCategory) ||
        typeof candidate.art !== "string" || !ARTS.has(candidate.art as GameArt) ||
        typeof candidate.color !== "string" || !COLORS.has(candidate.color as GameColor) ||
        typeof candidate.iconKey !== "string" || !ICON_KEYS.has(candidate.iconKey as GameIconKey)) {
      throw new Error("Unsupported game capability at index " + index);
    }
    if (Object.prototype.hasOwnProperty.call(candidate, "featured") && typeof candidate.featured !== "boolean") {
      throw new Error("Invalid featured flag at index " + index);
    }

    const game: CatalogGame = {
      id,
      title: parseLocalePair(candidate.title, 50, "games[" + index + "].title"),
      subtitle: parseLocalePair(candidate.subtitle, 120, "games[" + index + "].subtitle"),
      category: candidate.category as GameCategory,
      players: parseLocalePair(candidate.players, 24, "games[" + index + "].players"),
      icon: ICONS[candidate.iconKey as GameIconKey],
      art: candidate.art as GameArt,
      color: candidate.color as GameColor,
    };
    if (candidate.featured === true) game.featured = true;
    return game;
  });

  return games;
}

export const gameList: CatalogGame[] = parseGameRegistry(STATIC_GAME_MANIFEST);
