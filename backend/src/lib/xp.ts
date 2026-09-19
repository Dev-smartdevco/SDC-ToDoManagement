export function levelFromXp(xp: number) {
  const safe = Math.max(0, xp);
  const level = Math.floor(safe / 100) + 1;
  const intoLevel = safe % 100;
  return { level, xp: safe, intoLevel, nextLevelAt: level * 100, progress: intoLevel };
}
