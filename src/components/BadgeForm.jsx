import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field } from './ui.jsx';
import { computeStatus, formatDateFR, isValidISODate, pluralDays } from '../lib/dates.js';

export const PRESETS = [14, 21, 28, 35, 42];

export function timeZones(current) {
  let list = [];
  try { list = Intl.supportedValuesOf('timeZone'); } catch { list = ['Europe/Paris', 'Europe/London', 'America/New_York', 'UTC']; }
  return list.includes(current) ? list : [current, ...list];
}

export default function BadgeForm({ today, initial, defaultDelay = 42, submitLabel, busy, onSubmit, onCancel, timezone, onTimezone }) {
  const startDelay = initial?.delayDays ?? defaultDelay;
  const [name, setName] = useState(initial?.name ?? 'Mon badge');
  const [date, setDate] = useState(initial?.lastBadgeDate ?? today);
  const [choice, setChoice] = useState(PRESETS.includes(startDelay) ? String(startDelay) : 'custom');
  const [custom, setCustom] = useState(String(startDelay));
  const [touched, setTouched] = useState(false);

  const delay = choice === 'custom' ? Number(custom) : Number(choice);
  const errors = {};
  if (!name.trim() || name.trim().length > 60) errors.name = 'Donnez un nom de 1 à 60 caractères.';
  if (!isValidISODate(date)) errors.date = 'Choisissez une date valide.';
  else if (date > today) errors.date = 'La date du dernier badgeage ne peut pas être dans le futur.';
  if (!Number.isInteger(delay) || delay < 1 || delay > 365) errors.delay = 'Le délai doit être un nombre entier de jours entre 1 et 365.';
  const valid = Object.keys(errors).length === 0;
  const status = useMemo(() => (valid ? computeStatus({ lastBadgeDate: date, delayDays: delay, today }) : null), [valid, date, delay, today]);

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (valid) onSubmit({ name: name.trim(), lastBadgeDate: date, delayDays: delay });
  };
  const show = (k) => (touched ? errors[k] : undefined);

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <Field label="Nom du badge" htmlFor="bf-name" error={show('name')}>
        <input id="bf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Mon badge" />
      </Field>
      <Field label="Date du dernier badgeage" htmlFor="bf-date" error={show('date')}>
        <input id="bf-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Délai avant l’échéance" htmlFor="bf-delay" error={show('delay')}
        hint="Le délai de 42 jours est une valeur par défaut configurable. Vérifiez le délai réellement applicable à votre situation.">
        <div className="chips" role="group" aria-label="Délais proposés">
          {PRESETS.map((p) => (
            <button type="button" key={p} className={`chip ${choice === String(p) ? 'on' : ''}`} aria-pressed={choice === String(p)} onClick={() => setChoice(String(p))}>
              {p} j
            </button>
          ))}
          <button type="button" className={`chip ${choice === 'custom' ? 'on' : ''}`} aria-pressed={choice === 'custom'} onClick={() => setChoice('custom')}>Personnalisé</button>
        </div>
        {choice === 'custom' && (
          <input id="bf-delay" type="number" min="1" max="365" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Durée personnalisée en jours" />
        )}
      </Field>
      {onTimezone && (
        <Field label="Fuseau horaire" htmlFor="bf-tz" hint="Détecté automatiquement, modifiable. Il sert au changement de jour et à l’heure des rappels.">
          <select id="bf-tz" value={timezone} onChange={(e) => onTimezone(e.target.value)}>
            {timeZones(timezone).map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </Field>
      )}
      <div className="recap" aria-live="polite">
        {status ? (
          <dl>
            <div><dt>Badge</dt><dd>{name.trim()}</dd></div>
            <div><dt>Dernier badgeage</dt><dd>{formatDateFR(date)}</dd></div>
            <div><dt>Durée choisie</dt><dd>{pluralDays(delay)}</dd></div>
            <div><dt>Échéance estimée</dt><dd>{formatDateFR(status.dueDate)}</dd></div>
            <div><dt>Jours restants</dt><dd>{status.daysLeft > 0 ? pluralDays(status.daysLeft) : status.sub}</dd></div>
          </dl>
        ) : <p className="hint">Complétez le formulaire pour voir l’échéance estimée.</p>}
      </div>
      <div className="row end gap">
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Annuler</button>}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy && <Loader2 className="spin" size={16} aria-hidden />} {submitLabel}
        </button>
      </div>
    </form>
  );
}
