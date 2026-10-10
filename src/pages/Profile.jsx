import { LogOut, MailCheck, MailWarning } from 'lucide-react';
import { Notice } from '../components/ui.jsx';
import { useApp } from '../context.jsx';
import { logOut, resendVerification } from '../lib/actions.js';
import { frError } from '../lib/errors.js';

export default function Profile() {
  const { user, profile, badges, notify, go } = useApp();
  const created = profile.createdAt?.toDate ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(profile.createdAt.toDate()) : '—';
  const resend = async () => {
    try { await resendVerification(); notify('success', 'E-mail de vérification envoyé.'); } catch (e) { notify('error', frError(e)); }
  };
  return (
    <div className="stack-lg">
      <h1>Mon profil</h1>
      <section className="card stack">
        <dl className="facts">
          <div><dt>Pseudo</dt><dd>{profile.pseudo}</dd></div>
          <div><dt>Adresse e-mail</dt><dd>{user.email}</dd></div>
          <div><dt>Membre depuis</dt><dd>{created}</dd></div>
          <div><dt>Badges</dt><dd>{badges.length}</dd></div>
          <div><dt>Fuseau horaire</dt><dd>{profile.timezone}</dd></div>
        </dl>
        {user.emailVerified
          ? <Notice kind="success"><MailCheck size={16} aria-hidden /> Adresse e-mail vérifiée.</Notice>
          : <Notice><MailWarning size={16} aria-hidden /> Adresse e-mail non vérifiée. <button className="link" onClick={resend}>Renvoyer l’e-mail de vérification</button></Notice>}
        <div className="row gap wrap">
          <button className="btn outline" onClick={() => go('settings')}>Modifier mes paramètres</button>
          <button className="btn ghost" onClick={() => logOut()}><LogOut size={18} aria-hidden /> Déconnexion</button>
        </div>
      </section>
    </div>
  );
}
