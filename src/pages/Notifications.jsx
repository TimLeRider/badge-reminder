import { useEffect, useMemo, useState } from 'react';
import { BellRing, Loader2, Send, Smartphone } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import { Field, Notice } from '../components/ui.jsx';
import { timeZones } from '../components/BadgeForm.jsx';
import { useApp } from '../context.jsx';
import { loadHistory, saveUser, setReminder } from '../lib/actions.js';
import { frError, pushErrorFR } from '../lib/errors.js';
import { disablePush, enablePush, localTest, pushSupport } from '../lib/push.js';
import { THRESHOLDS, isThresholdOn, reminderText, thresholdLabel, upcomingReminders } from '../lib/reminders.js';
import { formatDateFR } from '../lib/dates.js';

const DAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
const pad = (n) => String(n).padStart(2, '0');
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;

export default function Notifications() {
  const { user, profile, badges, selected, setSelectedId, today, notify } = useApp();
  const n = profile.notifications;
  const [draft, setDraft] = useState({ hour: n.hour, minute: n.minute || 0, days: n.days, tz: profile.timezone });
  const [supported, setSupported] = useState(null);
  const [perm, setPerm] = useState('Notification' in window ? Notification.permission : 'unsupported');
  const [busy, setBusy] = useState('');
  const [history, setHistory] = useState(null);

  useEffect(() => { pushSupport().then(setSupported); }, []);
  const refreshHistory = () => loadHistory(user.uid, badges).then(setHistory).catch(() => setHistory([]));
  useEffect(() => { refreshHistory(); /* eslint-disable-next-line */ }, [badges.length]);

  const dirty = draft.hour !== n.hour || draft.minute !== (n.minute || 0) || draft.tz !== profile.timezone || JSON.stringify([...draft.days].sort()) !== JSON.stringify([...n.days].sort());

  const toggle = async (on) => {
    setBusy('toggle');
    try {
      if (on) { await enablePush(user.uid); setPerm(Notification.permission); }
      await saveUser(user.uid, { notifications: { ...n, enabled: on } });
      if (!on) await disablePush(user.uid);
      notify('success', on ? 'Notifications activées sur cet appareil.' : 'Notifications désactivées.');
    } catch (e) { setPerm('Notification' in window ? Notification.permission : perm); notify('error', pushErrorFR(e)); } finally { setBusy(''); }
  };

  const saveSchedule = async () => {
    if (!draft.days.length) { notify('error', 'Choisissez au moins un jour de réception.'); return; }
    setBusy('save');
    try {
      await saveUser(user.uid, { timezone: draft.tz, notifications: { ...n, hour: draft.hour, minute: draft.minute, days: draft.days } });
      notify('success', 'Préférences de notification enregistrées.');
    } catch (e) { notify('error', frError(e)); } finally { setBusy(''); }
  };

  const doLocal = async () => {
    setBusy('local');
    try { await localTest(); } catch (e) { notify('error', pushErrorFR(e)); } finally { setBusy(''); }
  };
  const doPush = async () => {
    setBusy('push');
    try { await saveUser(user.uid, { testRequest: { status: 'pending', requestedAt: serverTimestamp() } }); notify('info', 'Demande envoyée. Le planificateur la traitera à son prochain passage.'); }
    catch (e) { notify('error', e.code === 'permission-denied' ? 'Un test est déjà en attente. Patientez quelques minutes.' : frError(e)); } finally { setBusy(''); }
  };

  const tr = profile.testRequest;
  const upcoming = useMemo(() => (selected ? upcomingReminders(selected, n, today) : []), [selected, n, today]);

  return (
    <div className="stack-lg">
      <h1>Mes notifications</h1>
      {supported === false && <Notice kind="error">Ce navigateur ne prend pas en charge les notifications Web Push. {isIOS && 'Sur iPhone, ajoutez d’abord le site à l’écran d’accueil (Partager → Sur l’écran d’accueil), iOS 16.4 minimum.'}</Notice>}
      {isIOS && !standalone && supported !== false && <Notice><Smartphone size={16} aria-hidden /> Sur iPhone, les notifications ne fonctionnent que si le site est installé sur l’écran d’accueil.</Notice>}
      {perm === 'denied' && <Notice kind="error">Les notifications sont désactivées dans votre navigateur. Vous pouvez les autoriser depuis les paramètres de votre appareil.</Notice>}

      <section className="card stack">
        <div className="row between gap">
          <div><h2>Recevoir les rappels sur cet appareil</h2><p className="muted">Notifications push, même lorsque le site est fermé.</p></div>
          <label className="switch"><input type="checkbox" role="switch" checked={n.enabled} disabled={busy === 'toggle' || supported === false} onChange={(e) => toggle(e.target.checked)} aria-label="Activer les notifications" /><span /></label>
        </div>
        {!n.enabled && <Notice>Configurez vos rappels pour ne pas oublier votre prochaine échéance.</Notice>}
      </section>

      <section className="card stack">
        <h2>Quand ?</h2>
        <div className="grid2">
          <Field label="Heure de réception" htmlFor="nt-time"><input id="nt-time" type="time" value={`${pad(draft.hour)}:${pad(draft.minute)}`} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); if (!Number.isNaN(h)) setDraft({ ...draft, hour: h, minute: m || 0 }); }} /></Field>
          <Field label="Fuseau horaire" htmlFor="nt-tz"><select id="nt-tz" value={draft.tz} onChange={(e) => setDraft({ ...draft, tz: e.target.value })}>{timeZones(draft.tz).map((z) => <option key={z}>{z}</option>)}</select></Field>
        </div>
        <fieldset className="days"><legend>Jours autorisés</legend>
          {DAYS.map(([v, l]) => (
            <label key={v} className={`chip ${draft.days.includes(v) ? 'on' : ''}`}>
              <input type="checkbox" checked={draft.days.includes(v)} onChange={(e) => setDraft({ ...draft, days: e.target.checked ? [...draft.days, v] : draft.days.filter((d) => d !== v) })} />{l}
            </label>
          ))}
        </fieldset>
        <p className="hint">Les rappels partent « vers » l’heure choisie : le planificateur gratuit peut avoir quelques minutes de retard. Un rappel dont le jour n’est pas autorisé n’est pas reporté.</p>
        <div className="row end"><button className="btn primary" disabled={!dirty || busy === 'save'} onClick={saveSchedule}>{busy === 'save' && <Loader2 className="spin" size={16} aria-hidden />} Enregistrer</button></div>
      </section>

      <section className="card stack">
        <div className="row between wrap gap"><h2>Rappels par badge</h2>
          {badges.length > 1 && <select aria-label="Badge" value={selected?.id} onChange={(e) => setSelectedId(e.target.value)}>{badges.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        </div>
        {selected && <>
          <p className="muted">Badge : <strong>{selected.name}</strong>. Chaque seuil peut être activé ou désactivé.</p>
          <ul className="thresholds">
            {THRESHOLDS.map((t) => (
              <li key={t}>
                <label className="switch"><input type="checkbox" role="switch" checked={isThresholdOn(selected, t)} aria-label={thresholdLabel(t)}
                  onChange={(e) => setReminder(user.uid, selected, t, e.target.checked).catch((er) => notify('error', frError(er)))} /><span /></label>
                <div><strong>{thresholdLabel(t)}</strong><span className="muted block">{reminderText(t)}</span></div>
              </li>
            ))}
          </ul>
          <h3>Prochains rappels</h3>
          {n.enabled ? (upcoming.length ? <ul className="plain">{upcoming.map((r) => <li key={r.threshold}><strong>{formatDateFR(r.date, { weekday: 'short', day: 'numeric', month: 'long' })}</strong> à {pad(n.hour)}:{pad(n.minute || 0)} — {r.text}</li>)}</ul> : <p className="muted">Aucun rappel à venir pour ce cycle.</p>) : <p className="muted">Activez les notifications pour programmer vos rappels.</p>}
        </>}
      </section>

      <section className="card stack">
        <h2>Tester mes notifications</h2>
        <div className="row gap wrap">
          <button className="btn outline" onClick={doLocal} disabled={busy === 'local' || perm !== 'granted'}><BellRing size={18} aria-hidden /> Test local (immédiat)</button>
          <button className="btn primary" onClick={doPush} disabled={busy === 'push' || tr?.status === 'pending' || !n.enabled}><Send size={18} aria-hidden /> Test push réel</button>
        </div>
        <p className="hint">Le test local vérifie l’autorisation et l’affichage sur cet appareil. Le test push réel passe par Firebase Cloud Messaging : il est envoyé par le planificateur GitHub Actions, donc reçu après quelques minutes (parfois davantage).</p>
        {tr?.status === 'pending' && <Notice>En attente du prochain passage du planificateur…</Notice>}
        {tr?.status === 'done' && <Notice kind="success">{tr.message}</Notice>}
        {tr?.status === 'failed' && <Notice kind="error">{tr.message}</Notice>}
      </section>

      <section className="card stack">
        <div className="row between gap"><h2>Historique</h2><button className="link" onClick={refreshHistory}>Actualiser</button></div>
        {history === null ? <p className="muted">Chargement…</p> : history.length === 0 ? <p className="muted">Aucune notification envoyée pour le moment.</p> :
          <ul className="plain">{history.map((h) => <li key={h.id}><strong>{h.badge}</strong> — {h.body}<span className="muted block">{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(h.at)}</span></li>)}</ul>}
      </section>
    </div>
  );
}
