// Calculs de dates 100 % calendaires (aucun décompte à la seconde).
// Les dates sont des chaînes « AAAA-MM-JJ » : on compare des jours entiers en UTC,
// ce qui évite toute erreur liée aux changements d'heure.

const DAY_MS = 86400000;

export function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, m: mo, d, t };
}

export function isValidISODate(s) {
  return parseISODate(s) !== null;
}

export function dayNumber(s) {
  const p = parseISODate(s);
  if (!p) throw new Error(`Date invalide : ${s}`);
  return Math.round(p.t / DAY_MS);
}

export function toISODate(t) {
  const d = new Date(t * DAY_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(s, n) {
  return toISODate(dayNumber(s) + n);
}

/** Nombre de jours entre a et b (b - a). */
export function diffDays(a, b) {
  return dayNumber(b) - dayNumber(a);
}

export function safeTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: tz });
    return tz;
  } catch {
    return 'Europe/Paris';
  }
}

export function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

/** Date et heure locales dans un fuseau donné. */
export function localParts(tz, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const weekday = new Date(dayNumber(date) * DAY_MS).getUTCDay(); // 0 = dimanche
  return { date, hour: Number(p.hour) % 24, minute: Number(p.minute), weekday };
}

export function todayInTZ(tz, now = new Date()) {
  return localParts(tz, now).date;
}

export const LEVELS = {
  green: { key: 'green', label: 'Large marge' },
  teal: { key: 'teal', label: 'Pas de souci' },
  yellow: { key: 'yellow', label: 'À surveiller' },
  orange: { key: 'orange', label: 'Bientôt' },
  red: { key: 'red', label: 'Urgent' },
  overdue: { key: 'overdue', label: 'Échéance atteinte' },
};

export function levelFor(daysLeft) {
  if (daysLeft <= 0) return LEVELS.overdue;
  if (daysLeft <= 3) return LEVELS.red;
  if (daysLeft <= 7) return LEVELS.orange;
  if (daysLeft <= 14) return LEVELS.yellow;
  if (daysLeft <= 21) return LEVELS.teal;
  return LEVELS.green;
}

/** État complet d'un badge pour un jour donné. */
export function computeStatus({ lastBadgeDate, delayDays, today }) {
  const dueDate = addDays(lastBadgeDate, delayDays);
  const daysLeft = diffDays(today, dueDate); // peut être négatif en interne
  const elapsed = diffDays(lastBadgeDate, today);
  const progress = Math.min(1, Math.max(0, elapsed / delayDays));
  const level = levelFor(daysLeft);
  const remaining = Math.max(0, daysLeft);
  let headline;
  let sub;
  if (daysLeft > 0) {
    headline = `${daysLeft} ${daysLeft > 1 ? 'JOURS' : 'JOUR'}`;
    sub = 'avant votre échéance estimée';
  } else if (daysLeft === 0) {
    headline = 'Aujourd’hui';
    sub = 'Échéance estimée aujourd’hui';
  } else {
    const late = Math.abs(daysLeft);
    headline = `+${late} ${late > 1 ? 'JOURS' : 'JOUR'}`;
    sub = `Échéance dépassée de ${late} ${late > 1 ? 'jours' : 'jour'}`;
  }
  return {
    dueDate,
    daysLeft,
    remaining,
    weeks: Math.floor(remaining / 7),
    extraDays: remaining % 7,
    elapsed,
    progress,
    level,
    headline,
    sub,
  };
}

export function formatDateFR(s, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  const p = parseISODate(s);
  if (!p) return '';
  return new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(new Date(p.t));
}

export const pluralDays = (n) => `${n} ${n > 1 ? 'jours' : 'jour'}`;
