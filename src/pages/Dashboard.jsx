import { useMemo, useState } from 'react';
import { BellRing, CalendarCog, CheckCircle2, Plus } from 'lucide-react';
import Counter from '../components/Counter.jsx';
import { Confirm, Modal, Field, Notice } from '../components/ui.jsx';
import { useApp } from '../context.jsx';
import { badgeToday, updateBadge } from '../lib/actions.js';
import { frError } from '../lib/errors.js';
import { computeStatus, formatDateFR, pluralDays } from '../lib/dates.js';
import { upcomingReminders } from '../lib/reminders.js';

export default function Dashboard() {
  const { user, profile, badges, selected, setSelectedId, today, notify, go } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [err, setErr] = useState('');

  const status = useMemo(() => (selected ? computeStatus({ lastBadgeDate: selected.lastBadgeDate, delayDays: selected.delayDays, today }) : null), [selected, today]);
  const next = useMemo(() => {
    if (!selected || !profile.notifications.enabled) return null;
    return upcomingReminders(selected, profile.notifications, today)[0] || null;
  }, [selected, profile, today]);

  if (!selected) {
    return <div className="card center"><h1>Aucun badge</h1><p className="muted">Créez un badge pour lancer un compteur.</p><button className="btn primary" onClick={() => go('badges')}><Plus size={18} aria-hidden /> Ajouter un badge</button></div>;
  }

  const doBadge = async () => {
    if (busy) return;
    if (selected.lastBadgeDate === today) { setConfirm(false); notify('info', 'Votre badgeage du jour est déjà enregistré.'); return; }
    setBusy(true);
    try { await badgeToday(user.uid, selected, today); setConfirm(false); notify('success', 'Badgeage enregistré ! Votre compteur a été réinitialisé.'); }
    catch (e) { notify('error', frError(e)); } finally { setBusy(false); }
  };

  const openEdit = () => { setDate(selected.lastBadgeDate); setErr(''); setEdit(true); };
  const saveDate = async () => {
    if (!date || date > today) { setErr('Choisissez une date valide, au plus tard aujourd’hui.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await updateBadge(user.uid, selected, { name: selected.name, lastBadgeDate: date, delayDays: selected.delayDays });
      setEdit(false); notify('success', 'Date de dernier badgeage mise à jour.');
    } catch (e) { setErr(frError(e)); } finally { setBusy(false); }
  };

  const nextText = !profile.notifications.enabled ? null : next ? `${formatDateFR(next.date, { weekday: 'long', day: 'numeric', month: 'long' })} à ${String(profile.notifications.hour).padStart(2, '0')}:${String(profile.notifications.minute || 0).padStart(2, '0')}` : 'Aucun rappel à venir pour ce cycle';

  return (
    <div className="stack-lg">
      {badges.length > 1 && (
        <div className="badge-picker" role="tablist" aria-label="Badge actif">
          {badges.map((b) => (
            <button key={b.id} role="tab" aria-selected={b.id === selected.id} className={`chip ${b.id === selected.id ? 'on' : ''}`} onClick={() => setSelectedId(b.id)}>{b.name}</button>
          ))}
        </div>
      )}
      <section className="card hero" aria-labelledby="badge-name">
        <h1 id="badge-name" className="badge-title">{selected.name}</h1>
        <Counter status={status} />
        <div className="actions">
          <button className="btn primary big" onClick={() => setConfirm(true)}><CheckCircle2 size={22} aria-hidden /> J’ai badgé aujourd’hui</button>
          <button className="link" onClick={openEdit}><CalendarCog size={16} aria-hidden /> Modifier ma dernière date de badgeage</button>
        </div>
      </section>

      <section className="card" aria-label="Détails du badge">
        <dl className="facts">
          <div><dt>Aujourd’hui</dt><dd>{formatDateFR(today)}</dd></div>
          <div><dt>Dernier badgeage</dt><dd>{formatDateFR(selected.lastBadgeDate)}</dd></div>
          <div><dt>Échéance estimée</dt><dd>{formatDateFR(status.dueDate)}</dd></div>
          <div><dt>Délai configuré</dt><dd>{pluralDays(selected.delayDays)}</dd></div>
          <div><dt>Temps restant</dt><dd>{status.remaining > 0 ? `${status.weeks} sem. et ${status.extraDays} j` : status.sub}</dd></div>
          <div><dt>Prochain rappel</dt><dd>{nextText ?? <button className="link" onClick={() => go('notifications')}><BellRing size={14} aria-hidden /> Notifications désactivées — configurer</button>}</dd></div>
        </dl>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(status.progress * 100)} aria-label="Progression du cycle">
          <div className={`bar-fill lvl-${status.level.key}`} style={{ width: `${status.progress * 100}%` }} />
        </div>
        {!profile.notifications.enabled && <Notice>Configurez vos rappels pour ne pas oublier votre prochaine échéance.</Notice>}
      </section>

      {confirm && (
        <Confirm title="Confirmer le badgeage" confirmLabel="Oui, j’ai badgé" busy={busy} onConfirm={doBadge} onClose={() => !busy && setConfirm(false)}>
          <p>Aujourd’hui ({formatDateFR(today, { day: 'numeric', month: 'long', year: 'numeric' })}) deviendra la date de votre dernier badgeage. Le compteur et le cycle de rappels repartiront de zéro.</p>
        </Confirm>
      )}
      {edit && (
        <Modal title="Modifier ma dernière date de badgeage" onClose={() => !busy && setEdit(false)}>
          <div className="stack">
            <Field label="Date du dernier badgeage" htmlFor="ed-date" error={err}><input id="ed-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
            <p className="hint">Corriger la date démarre un nouveau cycle de rappels.</p>
            <div className="row end gap">
              <button className="btn ghost" onClick={() => setEdit(false)} disabled={busy}>Annuler</button>
              <button className="btn primary" onClick={saveDate} disabled={busy}>Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
