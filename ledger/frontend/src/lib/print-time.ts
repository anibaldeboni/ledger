const durationPattern = /^(?:(\d+)d)?[ \t\n\f\r]*(?:(\d+)h)?[ \t\n\f\r]*(?:(\d+)m)?[ \t\n\f\r]*(?:(\d+)s)?$/i;
const unitSeconds = [86400, 3600, 60, 1];

/** Validates a positive integer duration without converting it for calculation. */
export function isValidPrintDuration(input: string): boolean {
  const match = input.trim().match(durationPattern);
  if (!match || !match.slice(1).some(Boolean)) return false;

  let totalSeconds = 0;
  for (const [index, part] of match.slice(1).entries()) {
    if (!part) continue;
    const value = Number(part);
    const componentSeconds = value * unitSeconds[index];
    if (
      !Number.isSafeInteger(value) ||
      !Number.isSafeInteger(componentSeconds) ||
      totalSeconds > Number.MAX_SAFE_INTEGER - componentSeconds
    ) {
      return false;
    }
    totalSeconds += componentSeconds;
  }
  return totalSeconds > 0;
}
