export type LeagueTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";

export type ProgressionSnapshot = {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpRemaining: number;
  progressPercent: number;
  rating: number;
  league: LeagueTier;
};

/**
 * XP required to enter a level. Level 1 starts at 0 XP; the increments grow
 * by 50 XP each level: 100, 150, 200, 250, ...
 */
export function xpRequiredForLevel(level: number): number {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const completedLevels = safeLevel - 1;
  return 25 * completedLevels * (completedLevels + 3);
}

export function leagueForRating(rating: number): LeagueTier {
  const safeRating = Number.isFinite(rating) ? Math.max(0, rating) : 1000;
  if (safeRating >= 2000) return "master";
  if (safeRating >= 1800) return "diamond";
  if (safeRating >= 1600) return "platinum";
  if (safeRating >= 1400) return "gold";
  if (safeRating >= 1200) return "silver";
  return "bronze";
}

export function getProgressionSnapshot(xp: number, rating: number): ProgressionSnapshot {
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const safeRating = Number.isFinite(rating) ? Math.max(0, Math.round(rating)) : 1000;

  // Closed-form estimate plus boundary correction protects exact thresholds
  // from floating-point rounding while avoiding a loop for large XP totals.
  let completedLevels = Math.max(0, Math.floor((-3 + Math.sqrt(9 + safeXp * 0.16)) / 2));
  while (xpRequiredForLevel(completedLevels + 2) <= safeXp) completedLevels += 1;
  while (completedLevels > 0 && xpRequiredForLevel(completedLevels + 1) > safeXp) completedLevels -= 1;

  const level = completedLevels + 1;
  const lowerBound = xpRequiredForLevel(level);
  const upperBound = xpRequiredForLevel(level + 1);
  const xpIntoLevel = safeXp - lowerBound;
  const xpForNextLevel = upperBound - lowerBound;
  const progressPercent = xpForNextLevel > 0
    ? Math.min(100, Math.max(0, Math.floor((xpIntoLevel / xpForNextLevel) * 100)))
    : 0;

  return {
    level,
    xp: safeXp,
    xpIntoLevel,
    xpForNextLevel,
    xpRemaining: Math.max(0, upperBound - safeXp),
    progressPercent,
    rating: safeRating,
    league: leagueForRating(safeRating),
  };
}
