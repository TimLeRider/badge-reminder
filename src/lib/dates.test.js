import { describe, it, expect } from 'vitest';
import { addDays, computeStatus, diffDays, levelFor, localParts, todayInTZ, isValidISODate } from './dates.js';
import { dueThresholds, isNotifyTime, upcomingReminders, DEFAULT_REMINDERS } from './reminders.js';

describe('dates calendaires', () => {
  it('ajoute 42 jours', () => expect(addDays('2026-01-01', 42)).toBe('2026-02-12'));
  it('est insensible au changement d’heure (Europe/Paris, 29 mars 2026)', () => {
    expect(diffDays('2026-03-20', '2026-04-01')).toBe(12);
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-20', 10)).toBe('2026-10-30');
  });
  it('gère les années bissextiles et dates invalides', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(isValidISODate('2026-02-30')).toBe(false);
  });
  it('calcule la date locale selon le fuseau', () => {
    const now = new Date('2026-06-15T23:30:00Z');
    expect(todayInTZ('Europe/Paris', now)).toBe('2026-06-16');
    expect(todayInTZ('America/New_York', now)).toBe('2026-06-15');
    expect(localParts('Europe/Paris', now)).toMatchObject({ hour: 1, minute: 30 });
  });
});

describe('compteur', () => {
  const base = { lastBadgeDate: '2026-01-01', delayDays: 42 };
  it('premier jour : 42 jours, 0 %', () => {
    const s = computeStatus({ ...base, today: '2026-01-01' });
    expect(s.daysLeft).toBe(42);
    expect(s.progress).toBe(0);
    expect(s.level.key).toBe('green');
    expect(s.headline).toBe('42 JOURS');
  });
  it('mi-parcours ≈ 50 %', () => {
    expect(computeStatus({ ...base, today: '2026-01-22' }).progress).toBe(0.5);
  });
  it.each([
    [22, 'green'], [21, 'teal'], [15, 'teal'], [14, 'yellow'], [8, 'yellow'],
    [7, 'orange'], [4, 'orange'], [3, 'red'], [1, 'red'], [0, 'overdue'], [-5, 'overdue'],
  ])('%i jours restants → %s', (n, key) => expect(levelFor(n).key).toBe(key));
  it('aujourd’hui : jamais de nombre négatif, progression 100 %', () => {
    const s = computeStatus({ ...base, today: '2026-02-12' });
    expect(s.daysLeft).toBe(0);
    expect(s.sub).toBe('Échéance estimée aujourd’hui');
    expect(s.progress).toBe(1);
  });
  it('dépassée : texte dédié, progression plafonnée, remaining = 0', () => {
    const s = computeStatus({ ...base, today: '2026-02-17' });
    expect(s.sub).toBe('Échéance dépassée de 5 jours');
    expect(s.remaining).toBe(0);
    expect(s.progress).toBe(1);
  });
  it('délai personnalisé et semaines/jours', () => {
    const s = computeStatus({ lastBadgeDate: '2026-01-01', delayDays: 10, today: '2026-01-01' });
    expect(s.dueDate).toBe('2026-01-11');
    expect(computeStatus({ ...base, today: '2026-01-01' })).toMatchObject({ weeks: 6, extraDays: 0 });
  });
  it('singulier pour 1 jour', () => {
    expect(computeStatus({ ...base, today: '2026-02-11' }).headline).toBe('1 JOUR');
  });
});

describe('rappels', () => {
  const badge = { lastBadgeDate: '2026-01-01', delayDays: 42, reminders: { ...DEFAULT_REMINDERS } };
  const notif = { enabled: true, hour: 9, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] };
  const at = (iso) => new Date(iso);
  it('envoie le rappel 7 jours à J-7', () => {
    expect(dueThresholds(badge, 'Europe/Paris', at('2026-02-05T10:00:00Z'))).toEqual([7]);
    expect(dueThresholds(badge, 'Europe/Paris', at('2026-02-06T10:00:00Z'))).toEqual([]);
  });
  it('rappel de début de cycle quand le délai est de 42 jours', () => {
    expect(dueThresholds(badge, 'Europe/Paris', at('2026-01-01T10:00:00Z'))).toEqual([42]);
  });
  it('respecte l’activation individuelle des seuils', () => {
    const b = { ...badge, reminders: { ...DEFAULT_REMINDERS, 7: false } };
    expect(dueThresholds(b, 'Europe/Paris', at('2026-02-05T10:00:00Z'))).toEqual([]);
  });
  it('respecte l’heure, le fuseau et les jours autorisés', () => {
    expect(isNotifyTime(notif, 'Europe/Paris', at('2026-02-05T07:59:00Z'))).toBe(false);
    expect(isNotifyTime(notif, 'Europe/Paris', at('2026-02-05T08:00:00Z'))).toBe(true);
    expect(isNotifyTime(notif, 'America/New_York', at('2026-02-05T08:00:00Z'))).toBe(false);
    expect(isNotifyTime({ ...notif, days: [1] }, 'Europe/Paris', at('2026-02-05T10:00:00Z'))).toBe(false);
    expect(isNotifyTime({ ...notif, enabled: false }, 'Europe/Paris', at('2026-02-05T10:00:00Z'))).toBe(false);
  });
  it('liste les prochains rappels, sans les dates passées', () => {
    const list = upcomingReminders(badge, notif, '2026-02-01');
    expect(list.map((r) => r.threshold)).toEqual([7, 3, 2, 1, 0]);
    expect(list[0].date).toBe('2026-02-05');
  });
});
