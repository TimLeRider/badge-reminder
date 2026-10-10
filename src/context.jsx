import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase.js';
import { createProfileIfMissing } from './lib/actions.js';
import { refreshToken } from './lib/push.js';
import { safeTimeZone, todayInTZ } from './lib/dates.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function useToday(tz) {
  const [today, setToday] = useState(() => todayInTZ(tz));
  useEffect(() => {
    const tick = () => setToday((t) => { const n = todayInTZ(tz); return n === t ? t : n; });
    tick();
    const id = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [tz]);
  return today;
}

function useHashRoute() {
  const parse = () => {
    const [, page = 'dashboard', param = ''] = window.location.hash.replace(/^#/, '').split('?')[0].split('/');
    return { page: page || 'dashboard', param: decodeURIComponent(param) };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((path) => { window.location.hash = `#/${path}`; window.scrollTo(0, 0); }, []);
  return [route, go];
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = chargement
  const [profile, setProfile] = useState(undefined);
  const [badges, setBadges] = useState(undefined);
  const [dataError, setDataError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [selectedId, setSelectedId] = useState(null);
  const [route, go] = useHashRoute();
  const signingUp = useRef(false);
  const creating = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (!u) { setProfile(undefined); setBadges(undefined); } }), []);

  useEffect(() => {
    if (!user) return undefined;
    const onErr = (e) => setDataError(e);
    const u1 = onSnapshot(doc(db, 'users', user.uid), (s) => { setDataError(null); setProfile(s.exists() ? { id: s.id, ...s.data() } : null); }, onErr);
    const u2 = onSnapshot(collection(db, 'users', user.uid, 'badges'), (s) => {
      setBadges(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    }, onErr);
    return () => { u1(); u2(); };
  }, [user]);

  // Profil manquant (rare) : on le recrée une seule fois.
  useEffect(() => {
    if (user && profile === null && !signingUp.current && !creating.current) {
      creating.current = true;
      createProfileIfMissing(user).catch(() => {}).finally(() => { creating.current = false; });
    }
  }, [user, profile]);

  useEffect(() => { if (user && profile?.notifications?.enabled) refreshToken(user.uid); }, [user, profile?.notifications?.enabled]);

  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Thème
  const theme = profile?.theme || 'system';
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') { root.dataset.theme = theme; try { localStorage.setItem('br-theme', theme); } catch { /* ignoré */ } }
    else { delete root.dataset.theme; try { localStorage.removeItem('br-theme'); } catch { /* ignoré */ } }
  }, [theme]);

  const tz = safeTimeZone(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = useToday(tz);

  // Badge sélectionné : paramètre d'URL, sinon dernier choix, sinon premier badge.
  useEffect(() => { if (route.page === 'dashboard' && route.param) setSelectedId(route.param); }, [route]);
  const selected = useMemo(() => (badges || []).find((b) => b.id === selectedId) || (badges || [])[0] || null, [badges, selectedId]);

  const notify = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const value = { user, profile, badges, dataError, today, tz, route, go, selected, setSelectedId, notify, toasts, online, signingUp,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
