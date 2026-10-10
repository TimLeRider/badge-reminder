const AUTH = {
  'auth/email-already-in-use': 'Cette adresse e-mail est déjà utilisée. Connectez-vous ou réinitialisez votre mot de passe.',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/weak-password': 'Mot de passe trop faible : utilisez au moins 8 caractères.',
  'auth/user-not-found': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-login-credentials': 'E-mail ou mot de passe incorrect.',
  'auth/too-many-requests': 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  'auth/network-request-failed': 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
  'auth/user-disabled': 'Ce compte a été désactivé.',
  'auth/requires-recent-login': 'Pour des raisons de sécurité, reconnectez-vous puis réessayez.',
  'auth/operation-not-allowed': 'La connexion par e-mail n’est pas activée dans Firebase Authentication.',
};

export const NETWORK_MSG = 'Impossible d’enregistrer vos modifications. Vérifiez votre connexion et réessayez.';

export function frError(e) {
  const code = (e && e.code) || '';
  if (AUTH[code]) return AUTH[code];
  if (code === 'app/network' || code === 'unavailable' || code === 'firestore/unavailable' || code === 'deadline-exceeded') return NETWORK_MSG;
  if (code === 'permission-denied' || code === 'firestore/permission-denied')
    return 'Action refusée par les règles de sécurité. Vérifiez que les règles Firestore du projet sont bien publiées.';
  if (code === 'unauthenticated') return 'Votre session a expiré. Reconnectez-vous.';
  return e && e.message ? `Une erreur est survenue : ${e.message}` : 'Une erreur est survenue. Réessayez.';
}

export function pushErrorFR(e) {
  switch (e && e.code) {
    case 'permission-denied':
      return 'Les notifications sont désactivées dans votre navigateur. Vous pouvez les autoriser depuis les paramètres de votre appareil.';
    case 'unsupported':
      return 'Ce navigateur ou cet appareil ne prend pas en charge les notifications Web Push. Sur iPhone, ajoutez d’abord le site à l’écran d’accueil.';
    case 'no-vapid':
      return 'La clé Web Push (VAPID) n’est pas configurée dans ce déploiement. Voir le README, étape 11.';
    default:
      return frError(e);
  }
}

/** Exécute une écriture Firestore en refusant de « faire semblant » hors connexion. */
export function guarded(fn, ms = 15000) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(Object.assign(new Error('offline'), { code: 'app/network' }));
  }
  return Promise.race([
    fn(),
    new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'app/network' })), ms)),
  ]);
}
