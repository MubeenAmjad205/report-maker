// Pakistan Standard Time is a fixed UTC+5 (no daylight saving), so a constant offset is safe.
export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Returns today's date (in Pakistan time) as DD-MM-YYYY.
 * GitHub Actions runners use UTC, so we shift the clock by +5h before reading the date,
 * otherwise the "day" would roll over at 5 AM PKT instead of midnight PKT.
 */
export const getTodayDateString = (): string => {
  const pktNow = new Date(Date.now() + PKT_OFFSET_MS);
  const day = String(pktNow.getUTCDate()).padStart(2, '0');
  const month = String(pktNow.getUTCMonth() + 1).padStart(2, '0');
  const year = pktNow.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Returns the UTC ISO timestamp for the most recent midnight in Pakistan time (PKT, UTC+5).
 * This is the "since" boundary for fetching today's activity, so commits made between
 * PKT midnight and 5 AM are no longer missed (the previous UTC-midnight logic dropped them).
 */
export const getSinceISOString = (): string => {
  const pktNow = new Date(Date.now() + PKT_OFFSET_MS);
  // The UTC Y/M/D fields of the shifted date represent the PKT wall-clock date.
  const pktMidnightAsUtcMs = Date.UTC(
    pktNow.getUTCFullYear(),
    pktNow.getUTCMonth(),
    pktNow.getUTCDate()
  ) - PKT_OFFSET_MS; // convert that PKT-midnight wall clock back to a real UTC instant
  return new Date(pktMidnightAsUtcMs).toISOString();
};
