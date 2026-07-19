/** Parse a date-like value; returns null when missing or invalid. */
export function parseValidDate(date: Date | string | number | null | undefined): Date | null {
  if (date == null || date === '') return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Compact relative time (X/Threads style): now, 5m, 4h, 3d, then short date. */
export function formatRelativeTime(date: Date | string | number | null | undefined) {
  const d = parseValidDate(date);
  if (!d) return '';

  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  if (sec < 60) return 'now';
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;

  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Full absolute datetime for title / aria hover hints. */
export function formatAbsoluteDateTime(date: Date | string | number | null | undefined) {
  const d = parseValidDate(date);
  if (!d) return '';

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
