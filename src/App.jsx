import { AppProvider, useApp } from './context.jsx';
import { firebaseConfigured } from './lib/firebase.js';
import { Notice, Spinner, Toasts } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Wizard from './pages/Wizard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Badges from './pages/Badges.jsx';
import Notifications from './pages/Notifications.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';

const PAGES = { dashboard: Dashboard, badges: Badges, notifications: Notifications, settings: Settings, profile: Profile };

function Router() {
  const { user, profile, badges, route, dataError } = useApp();
  if (user === undefined) return <Spinner />;
  if (!user) return <AuthPage />;
  if (dataError) {
    return <div className="auth"><div className="auth-card"><h1>Données inaccessibles</h1><Notice kind="error">
      Impossible de lire vos données ({dataError.code}). Vérifiez votre connexion et que les règles Firestore sont publiées.</Notice></div></div>;
  }
  if (!profile || !badges) return <Spinner label="Chargement de vos données…" />;
  if (badges.length === 0) return <Wizard />;
  const Page = PAGES[route.page] || Dashboard;
  return <Layout><Page /></Layout>;
}

export default function App() {
  if (!firebaseConfigured) {
    return (
      <div className="auth"><div className="auth-card">
        <h1>Configuration Firebase manquante</h1>
        <Notice kind="error">Les variables VITE_FIREBASE_* ne sont pas définies. Copiez « .env.example » en « .env.local » et renseignez-les (README, étapes 6 à 11), ou ajoutez les secrets GitHub pour le déploiement.</Notice>
      </div></div>
    );
  }
  return <AppProvider><Router /><Toasts /></AppProvider>;
}
