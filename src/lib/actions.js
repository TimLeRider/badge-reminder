import {
  addDoc, collection, deleteDoc, doc, getDocs, increment, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import {
  EmailAuthProvider, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, deleteUser,
  reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword,
  signOut, updatePassword, updateProfile,
} from 'firebase/auth';
import { auth, db } from './firebase.js';
import { guarded } from './errors.js';
import { DEFAULT_NOTIFICATIONS, DEFAULT_REMINDERS } from './reminders.js';
import { detectTimeZone } from './dates.js';
import { disablePush } from './push.js';

const userRef = (uid) => doc(db, 'users', uid);
const badgesCol = (uid) => collection(db, 'users', uid, 'badges');

// ---------- Authentification ----------
export async function signUp({ pseudo, email, password }, flag) {
  flag.current = true;
  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: pseudo }).catch(() => {});
    await setDoc(userRef(cred.user.uid), {
      pseudo,
      timezone: detectTimeZone(),
      theme: 'system',
      defaultDelay: 42,
      notifications: DEFAULT_NOTIFICATIONS,
      createdAt: serverTimestamp(),
    });
    sendEmailVerification(cred.user).catch(() => {});
    return cred.user;
  } finally {
    flag.current = false;
  }
}

export async function logIn({ email, password, remember }) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export const logOut = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
export const resendVerification = () => sendEmailVerification(auth.currentUser);

export async function changePassword(currentPassword, newPassword) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPassword));
  await updatePassword(u, newPassword);
}

// ---------- Profil et préférences ----------
export const saveUser = (uid, patch) => guarded(() => updateDoc(userRef(uid), patch));

export async function createProfileIfMissing(user) {
  await setDoc(userRef(user.uid), {
    pseudo: (user.displayName || 'Utilisateur').slice(0, 30).padEnd(2, ' '),
    timezone: detectTimeZone(),
    theme: 'system',
    defaultDelay: 42,
    notifications: DEFAULT_NOTIFICATIONS,
    createdAt: serverTimestamp(),
  });
}

// ---------- Badges ----------
export const createBadge = (uid, { name, lastBadgeDate, delayDays }) =>
  guarded(() =>
    addDoc(badgesCol(uid), {
      name: name.trim(),
      lastBadgeDate,
      delayDays,
      cycle: 1,
      reminders: { ...DEFAULT_REMINDERS },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

/** Met à jour un badge. Un changement de date ou de délai démarre un nouveau cycle de rappels. */
export function updateBadge(uid, badge, { name, lastBadgeDate, delayDays }) {
  const newCycle = lastBadgeDate !== badge.lastBadgeDate || delayDays !== badge.delayDays;
  return guarded(() =>
    updateDoc(doc(badgesCol(uid), badge.id), {
      name: name.trim(),
      lastBadgeDate,
      delayDays,
      ...(newCycle ? { cycle: increment(1) } : {}),
      updatedAt: serverTimestamp(),
    })
  );
}

export const badgeToday = (uid, badge, today) =>
  guarded(() =>
    updateDoc(doc(badgesCol(uid), badge.id), { lastBadgeDate: today, cycle: increment(1), updatedAt: serverTimestamp() })
  );

export const setReminder = (uid, badge, threshold, on) =>
  guarded(() =>
    updateDoc(doc(badgesCol(uid), badge.id), {
      reminders: { ...DEFAULT_REMINDERS, ...(badge.reminders || {}), [String(threshold)]: on },
      updatedAt: serverTimestamp(),
    })
  );

export async function deleteBadge(uid, badgeId) {
  await guarded(async () => {
    const rem = await getDocs(collection(db, 'users', uid, 'badges', badgeId, 'reminders'));
    const b = writeBatch(db);
    rem.docs.forEach((d) => b.delete(d.ref));
    b.delete(doc(badgesCol(uid), badgeId));
    await b.commit();
  });
}

export async function loadHistory(uid, badges) {
  const all = [];
  for (const b of badges) {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'badges', b.id, 'reminders'), orderBy('sentAt', 'desc'), limit(10))
    );
    snap.docs.forEach((d) => {
      const x = d.data();
      if (x.status === 'sent' && x.sentAt) all.push({ id: `${b.id}_${d.id}`, badge: b.name, body: x.body, at: x.sentAt.toDate() });
    });
  }
  return all.sort((a, b) => b.at - a.at).slice(0, 20);
}

// ---------- Export / suppression ----------
export async function exportData(uid, profile, badges) {
  const iso = (t) => (t && t.toDate ? t.toDate().toISOString() : null);
  return {
    exportedAt: new Date().toISOString(),
    profil: {
      pseudo: profile.pseudo,
      fuseauHoraire: profile.timezone,
      theme: profile.theme,
      delaiParDefaut: profile.defaultDelay,
      notifications: profile.notifications,
      creeLe: iso(profile.createdAt),
    },
    badges: badges.map((b) => ({
      nom: b.name,
      dernierBadgeage: b.lastBadgeDate,
      delaiJours: b.delayDays,
      rappels: b.reminders,
      creeLe: iso(b.createdAt),
    })),
  };
}

async function deleteCollection(colRef) {
  const snap = await getDocs(colRef);
  for (let i = 0; i < snap.docs.length; i += 400) {
    const b = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

/** Supprime toutes les données de l'utilisateur, puis son compte Firebase Authentication. */
export async function deleteAccount(password) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
  await disablePush(u.uid);
  const badges = await getDocs(badgesCol(u.uid));
  for (const b of badges.docs) await deleteCollection(collection(db, 'users', u.uid, 'badges', b.id, 'reminders'));
  await deleteCollection(badgesCol(u.uid));
  await deleteCollection(collection(db, 'users', u.uid, 'notificationTokens'));
  await deleteDoc(userRef(u.uid));
  await deleteUser(u);
}
