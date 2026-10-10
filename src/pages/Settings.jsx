import { useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { Confirm, Field, Notice } from '../components/ui.jsx';
import { PRESETS, timeZones } from '../components/BadgeForm.jsx';
import { useApp } from '../context.jsx';
import { changePassword, deleteAccount, exportData, saveUser } from '../lib/actions.js';
import { frError } from '../lib/errors.js';

export default function Settings() {
  const { user, profile, badges, notify } = useApp();
  const [pseudo, setPseudo] = useState(profile.pseudo);
  const [delayChoice, setDelayChoice] = useState(PRESETS.includes(profile.defaultDelay) ? String(profile.defaultDelay) : 'custom');
  const [custom, setCustom] = useState(String(profile.defaultDelay));
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' });
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState('');
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delErr, setDelErr] = useState('');

  const patch = async (key, p, ok) => {
    setBusy(key);
    try { await saveUser(user.uid, p); notify('success', ok); } catch (e) { notify('error', frError(e)); } finally { setBusy(''); }
  };
  const savePseudo = () => {
    const v = pseudo.trim();
    if (v.length < 2 || v.length > 30) { notify('error', 'Le pseudo doit contenir de 2 à 30 caractères.'); return; }
    patch('pseudo', { pseudo: v }, 'Pseudo mis à jour.');
  };
  const saveDelay = () => {
    const d = delayChoice === 'custom' ? Number(custom) : Number(delayChoice);
    if (!Number.isInteger(d) || d < 1 || d > 365) { notify('error', 'Le délai doit être un nombre entier de jours entre 1 et 365.'); return; }
    patch('delay', { defaultDelay: d }, 'Délai par défaut mis à jour (il s’applique aux nouveaux badges).');
  };
  const savePw = async (e) => {
    e.preventDefault(); setPwErr('');
    if (pw.next.length < 8) { setPwErr('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return; }
    if (pw.next !== pw.conf) { setPwErr('Les deux nouveaux mots de passe ne correspondent pas.'); return; }
    setBusy('pw');
    try { await changePassword(pw.cur, pw.next); setPw({ cur: '', next: '', conf: '' }); notify('success', 'Mot de passe modifié.'); }
    catch (er) { setPwErr(frError(er)); } finally { setBusy(''); }
  };
  const doExport = async () => {
    setBusy('export');
    try {
      const data = await exportData(user.uid, profile, badges);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'badge-reminder-mes-donnees.json' });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      notify('success', 'Export téléchargé (sans mot de passe ni secret).');
    } catch (e) { notify('error', frError(e)); } finally { setBusy(''); }
  };
  const doDelete = async () => {
    if (!delPw) { setDelErr('Saisissez votre mot de passe pour confirmer.'); return; }
    setBusy('del'); setDelErr('');
    try { await deleteAccount(delPw); notify('success', 'Votre compte et vos données ont été supprimés.'); }
    catch (e) { setDelErr(frError(e)); } finally { setBusy(''); }
  };

  return (
    <div className="stack-lg">
      <h1>Paramètres</h1>

      <section className="card stack"><h2>Compte</h2>
        <Field label="Pseudo" htmlFor="st-pseudo"><div className="row gap"><input id="st-pseudo" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={30} /><button className="btn primary" onClick={savePseudo} disabled={busy === 'pseudo' || pseudo.trim() === profile.pseudo}>Enregistrer</button></div></Field>
        <form className="stack" onSubmit={savePw}>
          <h3>Changer le mot de passe</h3>
          <Field label="Mot de passe actuel" htmlFor="pw-cur"><input id="pw-cur" type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></Field>
          <div className="grid2">
            <Field label="Nouveau mot de passe" htmlFor="pw-new"><input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="Confirmer" htmlFor="pw-conf"><input id="pw-conf" type="password" autoComplete="new-password" value={pw.conf} onChange={(e) => setPw({ ...pw, conf: e.target.value })} /></Field>
          </div>
          {pwErr && <Notice kind="error">{pwErr}</Notice>}
          <div className="row end"><button className="btn outline" disabled={busy === 'pw' || !pw.cur}>{busy === 'pw' && <Loader2 className="spin" size={16} aria-hidden />} Modifier le mot de passe</button></div>
        </form>
      </section>

      <section className="card stack"><h2>Affichage et valeurs par défaut</h2>
        <Field label="Thème" htmlFor="st-theme">
          <select id="st-theme" value={profile.theme} onChange={(e) => patch('theme', { theme: e.target.value }, 'Thème enregistré.')}>
            <option value="system">Automatique (selon l’appareil)</option><option value="light">Clair</option><option value="dark">Sombre</option>
          </select>
        </Field>
        <Field label="Fuseau horaire" htmlFor="st-tz">
          <select id="st-tz" value={profile.timezone} onChange={(e) => patch('tz', { timezone: e.target.value }, 'Fuseau horaire enregistré.')}>{timeZones(profile.timezone).map((z) => <option key={z}>{z}</option>)}</select>
        </Field>
        <Field label="Délai par défaut des nouveaux badges" htmlFor="st-delay">
          <div className="row gap wrap">
            <select id="st-delay" value={delayChoice} onChange={(e) => setDelayChoice(e.target.value)}>
              {PRESETS.map((p) => <option key={p} value={p}>{p} jours</option>)}<option value="custom">Personnalisé</option>
            </select>
            {delayChoice === 'custom' && <input type="number" min="1" max="365" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Durée personnalisée en jours" />}
            <button className="btn primary" onClick={saveDelay} disabled={busy === 'delay'}>Enregistrer</button>
          </div>
        </Field>
      </section>

      <section className="card stack"><h2>Mes données</h2>
        <p className="muted">Téléchargez un fichier JSON contenant vos préférences et vos badges. Il ne contient ni mot de passe ni secret.</p>
        <div><button className="btn outline" onClick={doExport} disabled={busy === 'export'}><Download size={18} aria-hidden /> Exporter mes données</button></div>
      </section>

      <section className="card stack danger-zone"><h2>Supprimer mon compte</h2>
        <p className="muted">Supprime définitivement votre compte, vos badges, votre historique et vos appareils de notification. Cette action est irréversible.</p>
        <div><button className="btn danger" onClick={() => { setDel(true); setDelPw(''); setDelErr(''); }}><Trash2 size={18} aria-hidden /> Supprimer mon compte</button></div>
      </section>

      {del && (
        <Confirm title="Supprimer définitivement mon compte ?" danger confirmLabel="Supprimer définitivement" busy={busy === 'del'} onConfirm={doDelete} onClose={() => busy !== 'del' && setDel(false)}>
          <p>Pour des raisons de sécurité, confirmez votre identité avec votre mot de passe.</p>
          <Field label="Mot de passe" htmlFor="del-pw" error={delErr}><input id="del-pw" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></Field>
        </Confirm>
      )}
    </div>
  );
}
