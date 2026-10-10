import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase.js';

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const BASE = import.meta.env.BASE_URL;
const coded = (code) => Object.assign(new Error(code), { code });

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });
}

export async function pushSupport() {
  try {
    return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window && (await isSupported());
  } catch {
    return false;
  }
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function currentToken() {
  const reg = await registerSW();
  await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: reg });
}

export async function saveToken(uid) {
  const token = await currentToken();
  if (!token) throw coded('no-token');
  await setDoc(doc(db, 'users', uid, 'notificationTokens', await sha256(token)), {
    token,
    ua: navigator.userAgent.slice(0, 300),
    updatedAt: serverTimestamp(),
  });
  return token;
}

export async function enablePush(uid) {
  if (!(await pushSupport())) throw coded('unsupported');
  if (!VAPID) throw coded('no-vapid');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw coded('permission-denied');
  await saveToken(uid);
}

export async function disablePush(uid) {
  try {
    const token = await currentToken();
    if (token) await deleteDoc(doc(db, 'users', uid, 'notificationTokens', await sha256(token)));
    await deleteToken(getMessaging(app));
  } catch {
    /* meilleur effort : le planificateur supprime aussi les jetons invalides */
  }
}

/** Rafraîchit le jeton de cet appareil (les jetons FCM peuvent changer). */
export async function refreshToken(uid) {
  try {
    if (VAPID && 'Notification' in window && Notification.permission === 'granted' && (await pushSupport())) await saveToken(uid);
  } catch {
    /* ignoré */
  }
}

/** Test LOCAL : vérifie l'autorisation du navigateur et l'affichage via le service worker (sans FCM). */
export async function localTest() {
  if (!('Notification' in window) || Notification.permission !== 'granted') throw coded('permission-denied');
  const reg = await registerSW();
  await navigator.serviceWorker.ready;
  await reg.showNotification('Badge Reminder', {
    body: 'Test local : l’affichage des notifications fonctionne sur cet appareil.',
    icon: `${BASE}icon-192.png`,
    tag: 'br-local-test',
  });
}
