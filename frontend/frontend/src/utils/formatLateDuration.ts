/** Human-readable late duration: 15 min, 30 min, 1h, 2h 15 min */
export function formatLateDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins <= 0) return "";

  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;

  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder} min`;
}
