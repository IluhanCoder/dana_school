export function isBirthdayToday(value?: string | Date): boolean {
  if (!value) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return date.getUTCMonth() === today.getUTCMonth() && date.getUTCDate() === today.getUTCDate();
}
