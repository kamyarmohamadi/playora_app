import { describe, expect, it } from "vitest";
import { getProgressionSnapshot, leagueForRating, xpRequiredForLevel } from "./progression";

describe("Playora player progression", () => {
  it.each([
    [1, 0],
    [2, 100],
    [3, 250],
    [4, 450],
    [5, 700],
  ])("requires the published XP threshold for level %i", (level, xp) => {
    expect(xpRequiredForLevel(level)).toBe(xp);
  });

  it.each([
    [0, 1, 0, 100, 0],
    [99, 1, 99, 100, 99],
    [100, 2, 0, 150, 0],
    [249, 2, 149, 150, 99],
    [250, 3, 0, 200, 0],
    [450, 4, 0, 250, 0],
  ])("calculates a stable level snapshot at %i XP", (xp, level, into, next, pct) => {
    const result = getProgressionSnapshot(xp, 1000);
    expect(result.level).toBe(level);
    expect(result.xpIntoLevel).toBe(into);
    expect(result.xpForNextLevel).toBe(next);
    expect(result.progressPercent).toBe(pct);
  });

  it("clamps invalid or negative XP and defaults invalid ratings safely", () => {
    expect(getProgressionSnapshot(-10, Number.NaN)).toMatchObject({
      level: 1, xp: 0, rating: 1000, league: "bronze",
    });
  });

  it.each([
    [999, "bronze"],
    [1000, "bronze"],
    [1199, "bronze"],
    [1200, "silver"],
    [1400, "gold"],
    [1600, "platinum"],
    [1800, "diamond"],
    [2000, "master"],
  ])("maps rating %i to league %s", (rating, league) => {
    expect(leagueForRating(rating)).toBe(league);
  });
});
