import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every minute. Due-date chips and date filters
 * read it; a stable value keeps the memoised layout from recomputing on every
 * render.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
