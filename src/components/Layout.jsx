import { Bell, BadgeCheck, LayoutDashboard, LogOut, Settings, UserRound, WifiOff } from 'lucide-react';
import { useApp } from '../context.jsx';
import { logOut } from '../lib/actions.js';
import { Disclaimer } from './ui.jsx';

const NAV = [
  ['dashboard', 'Tableau de bord', LayoutDashboard],
  ['badges', 'Mes badges', BadgeCheck],
  ['notifications', 'Notifications', Bell],
  ['settings', 'Paramètres', Settings],
  ['profile', 'Mon profil', UserRound],
];

export default function Layout({ children }) {
  const { route, go, online, profile } = useApp();
  const page = route.page;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><BadgeCheck aria-hidden size={26} /> <span>Badge Reminder</span></div>
        <nav aria-label="Navigation principale">
          {NAV.map(([key, label, Icon]) => (
            <a key={key} href={`#/${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); go(key); }}>
              <Icon size={20} aria-hidden /> <span>{label}</span>
            </a>
          ))}
        </nav>
        <button className="logout" onClick={() => logOut()}><LogOut size={20} aria-hidden /> <span>Déconnexion</span></button>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <div className="brand"><BadgeCheck aria-hidden size={22} /> <span>Badge Reminder</span></div>
          <span className="hello">{profile?.pseudo}</span>
          <button className="icon-btn light" onClick={() => logOut()} aria-label="Déconnexion"><LogOut size={20} aria-hidden /></button>
        </header>
        {!online && <div className="offline" role="status"><WifiOff size={16} aria-hidden /> Vous êtes hors connexion : vos modifications ne seront pas enregistrées.</div>}
        <main id="main" className="content">{children}<Disclaimer /></main>
      </div>
      <nav className="tabbar" aria-label="Navigation mobile">
        {NAV.map(([key, label, Icon]) => (
          <a key={key} href={`#/${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); go(key); }}>
            <Icon size={22} aria-hidden /> <span>{label.replace('Tableau de bord', 'Compteur').replace('Mes badges', 'Badges').replace('Mon profil', 'Profil')}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
