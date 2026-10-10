import { useState } from 'react';
import { BadgeCheck, Loader2, LogIn, UserPlus } from 'lucide-react';
import { Disclaimer, Field, Notice } from '../components/ui.jsx';
import { logIn, resetPassword, signUp } from '../lib/actions.js';
import { frError } from '../lib/errors.js';
import { useApp } from '../context.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Shell({ children, onBack }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand dark"><BadgeCheck size={28} aria-hidden /> <span>Badge Reminder</span></div>
        {children}
        {onBack && <button className="link" onClick={onBack}>← Retour</button>}
      </div>
      <Disclaimer />
    </div>
  );
}

function SignUp({ setView }) {
  const { signingUp, notify } = useApp();
  const [f, setF] = useState({ pseudo: '', email: '', password: '', confirm: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    const pseudo = f.pseudo.trim();
    if (pseudo.length < 2 || pseudo.length > 30) er.pseudo = 'Le pseudo doit contenir de 2 à 30 caractères.';
    if (!EMAIL.test(f.email.trim())) er.email = 'Saisissez une adresse e-mail valide.';
    if (f.password.length < 8) er.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    if (f.confirm !== f.password) er.confirm = 'Les deux mots de passe ne correspondent pas.';
    setErrs(er); setFail('');
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await signUp({ pseudo, email: f.email.trim(), password: f.password }, signingUp);
      notify('success', 'Compte créé ! Configurons votre premier badge.');
    } catch (err) { setFail(frError(err)); } finally { setBusy(false); }
  };

  return (
    <Shell onBack={() => setView('home')}>
      <h1>Créer mon compte</h1>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Pseudo" htmlFor="su-pseudo" error={errs.pseudo}><input id="su-pseudo" autoComplete="nickname" value={f.pseudo} onChange={set('pseudo')} /></Field>
        <Field label="Adresse e-mail" htmlFor="su-email" error={errs.email}><input id="su-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Mot de passe" htmlFor="su-pw" hint="8 caractères minimum." error={errs.password}><input id="su-pw" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <Field label="Confirmer le mot de passe" htmlFor="su-pw2" error={errs.confirm}><input id="su-pw2" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} /></Field>
        {fail && <Notice kind="error">{fail}</Notice>}
        <button className="btn primary big" disabled={busy}>{busy && <Loader2 className="spin" size={18} aria-hidden />} Créer mon compte</button>
      </form>
      <p className="muted">Déjà inscrit ? <button className="link" onClick={() => setView('login')}>Se connecter</button></p>
    </Shell>
  );
}

function Login({ setView }) {
  const { notify } = useApp();
  const [f, setF] = useState({ email: '', password: '', remember: true });
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL.test(f.email.trim()) || !f.password) { setFail('Saisissez votre adresse e-mail et votre mot de passe.'); return; }
    setBusy(true); setFail('');
    try { await logIn({ ...f, email: f.email.trim() }); notify('success', 'Bon retour ! Voici votre prochain rappel de badgeage.'); }
    catch (err) { setFail(frError(err)); } finally { setBusy(false); }
  };
  return (
    <Shell onBack={() => setView('home')}>
      <h1>Se connecter</h1>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Adresse e-mail" htmlFor="li-email"><input id="li-email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Mot de passe" htmlFor="li-pw"><input id="li-pw" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} /> Se souvenir de moi sur cet appareil</label>
        {fail && <Notice kind="error">{fail}</Notice>}
        <button className="btn primary big" disabled={busy}>{busy && <Loader2 className="spin" size={18} aria-hidden />} Se connecter</button>
      </form>
      <p className="muted"><button className="link" onClick={() => setView('reset')}>Mot de passe oublié ?</button></p>
      <p className="muted">Pas encore de compte ? <button className="link" onClick={() => setView('signup')}>Créer un compte</button></p>
    </Shell>
  );
}

function Reset({ setView }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) { setMsg({ kind: 'error', text: 'Saisissez une adresse e-mail valide.' }); return; }
    setBusy(true); setMsg(null);
    try { await resetPassword(email.trim()); setMsg({ kind: 'success', text: 'Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé. Pensez à vérifier vos courriers indésirables.' }); }
    catch (err) { setMsg({ kind: 'error', text: frError(err) }); } finally { setBusy(false); }
  };
  return (
    <Shell onBack={() => setView('login')}>
      <h1>Mot de passe oublié</h1>
      <p className="muted">Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe. Ne l’envoyez jamais par e-mail à qui que ce soit.</p>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Adresse e-mail" htmlFor="rs-email"><input id="rs-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <button className="btn primary big" disabled={busy}>{busy && <Loader2 className="spin" size={18} aria-hidden />} Envoyer le lien</button>
      </form>
    </Shell>
  );
}

export default function AuthPage() {
  const [view, setView] = useState('home');
  if (view === 'signup') return <SignUp setView={setView} />;
  if (view === 'login') return <Login setView={setView} />;
  if (view === 'reset') return <Reset setView={setView} />;
  return (
    <Shell>
      <h1>Ne ratez plus votre prochain badgeage.</h1>
      <p className="lead">Suivez en un coup d’œil le nombre de jours avant votre échéance estimée, et recevez vos rappels même quand le site est fermé.</p>
      <div className="stack">
        <button className="btn primary big" onClick={() => setView('signup')}><UserPlus size={20} aria-hidden /> Créer mon compte</button>
        <button className="btn outline big" onClick={() => setView('login')}><LogIn size={20} aria-hidden /> Se connecter</button>
      </div>
    </Shell>
  );
}
