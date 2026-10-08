// Dansk talformat (1.234,5). Oprettes én gang og genbruges, fordi Intl.NumberFormat er dyr at oprette.
const hoursFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 });
const krFormat = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 });

export const formatHours = (hours: number) => hoursFormat.format(hours);

/** Med fortegn, fx +62 og −4 (rigtigt minus, ikke bindestreg). Bruges til afvigelser. */
export const formatSignedHours = (hours: number) =>
  (hours > 0 ? '+' : hours < 0 ? '−' : '') + hoursFormat.format(Math.abs(hours));

export const formatKr = (amount: number) => krFormat.format(amount);

// FTE altid med én decimal: 0,6 og 1,0
const fteFormat = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatFte = (fte: number) => fteFormat.format(fte);

// timeZone UTC: datoer fra @db.Date er midnat UTC. I dansk tid ville de ellers kunne blive vist som dagen før.
const shortDateFormat = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Fx "7. okt." (BD: datoer i løbende tekst) */
export const formatShortDate = (date: Date) => shortDateFormat.format(date);

// Tidspunkter (fx createdAt) vises i brugerens tidszone, så brug kun denne i Client Components
const dateTimeFormat = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Fx "7. okt. 14.32" */
export const formatDateTime = (date: Date) => dateTimeFormat.format(date);

/** "i dag", "i går" eller "for 12 dage siden" */
export function formatDaysAgo(date: Date, now = new Date()) {
  const days = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? 'i dag' : days === 1 ? 'i går' : `for ${days} dage siden`;
}
