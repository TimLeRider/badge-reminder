import { addDays, computeStatus, localParts } from './dates.js';

export const THRESHOLDS = [42, 28, 21, 14, 7, 3, 2, 1, 0];

const MESSAGES = {
  42: 'Votre nouveau cycle de badgeage commence.',
  28: 'Il vous reste 4 semaines avant votre échéance estimée.',
  21: 'Il vous reste 3 semaines avant votre échéance estimée.',
  14: 'Il vous reste 2 semaines avant votre échéance estimée.',
  7: 'Attention, il vous reste une semaine avant votre échéance estimée.',
  3: 'Attention, il vous reste seulement 3 jours !',
  2: 'Il vous reste 2 jours avant votre échéance estimée.',
  1: 'Dernier jour avant votre échéance estimée.',
  0: 'Votre échéance estimée est aujourd’hui.',
};

export const reminderText = (t) => MESSAGES[t];

export const thresholdLabel = (t) =>
  t === 42 ? 'Début de cycle (42 jours)' : t === 0 ? 'Jour de l’échéance' : `${t} jour${t > 1 ? 's' : ''} restant${t > 1 ? 's' : ''}`;

export const DEFAULT_REMINDERS = Object.fromEntries(THRESHOLDS.map((t) => [String(t), true]));

export const DEFAULT_NOTIFICATIONS = { enabled: false, hour: 9, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] };

export const isThresholdOn = (badge, t) => (badge.reminders ? badge.reminders[String(t)] !== false : true);

/** L'heure choisie par l'utilisateur est-elle atteinte aujourd'hui (jour autorisé) ? */
export function isNotifyTime(notifications, tz, now = new Date()) {
  if (!notifications || !notifications.enabled) return false;
  const lp = localParts(tz, now);
  if (Array.isArray(notifications.days) && !notifications.days.includes(lp.weekday)) return false;
  return lp.hour * 60 + lp.minute >= notifications.hour * 60 + (notifications.minute || 0);
}

/** Seuils à envoyer aujourd'hui pour ce badge (hors vérification « déjà envoyé »). */
export function dueThresholds(badge, tz, now = new Date()) {
  const today = localParts(tz, now).date;
  const { daysLeft } = computeStatus({ lastBadgeDate: badge.lastBadgeDate, delayDays: badge.delayDays, today });
  return THRESHOLDS.filter((t) => t === daysLeft && isThresholdOn(badge, t));
}

export const reminderDocId = (cycle, t) => `${cycle}_${t}`;

/** Liste des prochains rappels (date locale) pour un badge, à partir d'aujourd'hui. */
export function upcomingReminders(badge, notifications, today) {
  const { dueDate } = computeStatus({ lastBadgeDate: badge.lastBadgeDate, delayDays: badge.delayDays, today });
  const out = [];
  for (const t of THRESHOLDS) {
    if (!isThresholdOn(badge, t)) continue;
    const date = addDays(dueDate, -t);
    if (date < today) continue;
    if (notifications && Array.isArray(notifications.days)) {
      const wd = new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
      if (!notifications.days.includes(wd)) continue;
    }
    out.push({ threshold: t, date, text: MESSAGES[t] });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
