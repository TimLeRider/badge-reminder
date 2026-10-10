import { useState } from 'react';
import { BellRing, Clock } from 'lucide-react';
import BadgeForm from '../components/BadgeForm.jsx';
import { Disclaimer, Notice } from '../components/ui.jsx';
import { createBadge, saveUser } from '../lib/actions.js';
import { frError } from '../lib/errors.js';
import { useApp } from '../context.jsx';

export default function Wizard() {
  const { user, profile, today, notify, go } = useApp();
  const [step, setStep] = useState('badge');
  const [tz, setTz] = useState(profile.timezone);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');

  const create = async (v) => {
    setBusy(true); setFail('');
    try {
      if (tz !== profile.timezone) await saveUser(user.uid, { timezone: tz });
      await createBadge(user.uid, v);
      notify('success', 'Badge créé. Votre compteur est prêt.');
      setStep('notifs');
    } catch (e) { setFail(frError(e)); } finally { setBusy(false); }
  };

  if (step === 'notifs') {
    return (
      <div className="auth"><div className="auth-card">
        <h1>Voulez-vous des rappels ?</h1>
        <p className="muted">Configurez vos rappels pour ne pas oublier votre prochaine échéance. Vous pourrez le faire plus tard depuis la page Notifications.</p>
        <div className="stack">
          <button className="btn primary big" onClick={() => go('notifications')}><BellRing size={20} aria-hidden /> Configurer les notifications</button>
          <button className="btn outline big" onClick={() => go('dashboard')}><Clock size={20} aria-hidden /> Plus tard</button>
        </div>
      </div><Disclaimer /></div>
    );
  }
  return (
    <div className="auth"><div className="auth-card wide">
      <h1>Créons votre premier badge</h1>
      <p className="muted">Bienvenue {profile.pseudo}. Quelques informations suffisent pour lancer votre compte à rebours.</p>
      {fail && <Notice kind="error">{fail}</Notice>}
      <BadgeForm today={today} defaultDelay={profile.defaultDelay} submitLabel="Créer mon badge" busy={busy} onSubmit={create} timezone={tz} onTimezone={setTz} />
    </div><Disclaimer /></div>
  );
}
