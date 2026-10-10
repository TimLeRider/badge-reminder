<div align="center">

# Badge Reminder

<img width="200" height="200" alt="icon-512" src="https://github.com/user-attachments/assets/093c6f2e-5d1d-4a6c-8cb7-587ee6f40db6" />

</div>

---

Compte à rebours **personnel et indépendant** avant votre prochain badgeage : comptes utilisateurs, badges multiples, couleurs dynamiques, rappels personnalisables et **notifications Web Push réelles** (même site fermé). Hébergé gratuitement sur GitHub Pages. **Aucune connexion à un système externe** : le calcul repose uniquement sur les dates et délais que vous saisissez.

## 1. Architecture (budget : 0 €)

| Brique | Rôle | Offre utilisée |
|---|---|---|
| GitHub Pages | Héberge le site statique (React + Vite) | gratuit |
| GitHub Actions | Déploiement + planificateur de rappels (cron) | gratuit (dépôt **public**) |
| Firebase Authentication | Comptes e-mail / mot de passe, sessions persistantes | forfait **Spark** |
| Cloud Firestore | Données privées de chaque utilisateur | forfait **Spark** |
| Firebase Cloud Messaging | Envoi des notifications push Web | gratuit |

- **Cloud Functions n'est pas utilisé** : il exige le forfait payant Blaze. Le planificateur est donc un script Node
  (`scripts/send-reminders.mjs`) lancé par GitHub Actions avec le SDK Firebase Admin.
- **Aucune facturation n'est activée** : restez sur Spark, n'ajoutez aucune carte bancaire.
- Les messages push sont envoyés en « data-only » ; le service worker (`public/sw.js`) les affiche lui-même, sans clé ni SDK.

## 2. Limites à connaître (honnêteté)

- **Pas de ponctualité à la minute** : le cron GitHub Actions tourne toutes les 10 min et peut être retardé de plusieurs minutes,
  parfois plus aux heures de pointe. Un rappel part « vers » l'heure choisie (dès que l'heure est atteinte).
- **Dépôt public obligatoire pour la gratuité illimitée** : un dépôt privé ne dispose que d'un quota mensuel de minutes Actions
  (2 000 min/mois sur l'offre gratuite) ; dans ce cas, remplacez le cron par `'5 * * * *'` (toutes les heures).
- **Désactivation des crons inactifs** : GitHub désactive les workflows planifiés d'un dépôt public sans aucune activité pendant
  60 jours. Réactivez-le dans l'onglet *Actions*, ou poussez un petit commit de temps en temps.
- **Test push réel différé** : sans serveur, le navigateur ne peut pas déclencher FCM lui-même. Le bouton « Test push réel »
  dépose une demande dans Firestore ; elle est traitée au prochain passage du planificateur (quelques minutes). Le « Test local »
  est immédiat mais ne passe pas par FCM.
- **Rappel manqué = non reporté** : si le planificateur est en panne toute une journée, le rappel de ce jour est perdu (jamais envoyé en retard
  un autre jour). Un jour de la semaine non autorisé n'est pas non plus reporté.
- **Nouveau cycle** : un badgeage, ou la modification de la date/du délai, repart sur un nouveau cycle de rappels.
- **iPhone / iPad** : les notifications Web exigent iOS 16.4+ **et** que le site soit ajouté à l'écran d'accueil (Partager → Sur l'écran d'accueil).
- **Quotas Firestore Spark** (à revérifier sur la page de tarification Firebase, ils peuvent changer) : environ 50 000 lectures
  et 20 000 écritures par jour. Le planificateur lit, à chaque passage et pour chaque utilisateur dont l'heure de rappel est atteinte,
  son profil + ses badges + ses appareils. Estimation : 144 passages/jour × 3 utilisateurs × ~5 lectures ≈ 2 200 lectures/jour.
  Pour beaucoup d'utilisateurs, espacez le cron.
- La configuration web Firebase (`VITE_FIREBASE_*`) **n'est pas un secret** ; la protection des données repose sur `firestore.rules`.
  La clé de compte de service, elle, est **secrète** et ne vit que dans les secrets GitHub.

## 3. Installation pas à pas

### Étapes 1 à 5 : dépôt et poste local
1. **Créer le dépôt** : sur GitHub, *New repository* → nom exact **`badge-reminder`**, visibilité **Public**, sans README.
   (Votre dépôt `timlerider.github.io` reste intact.) Si vous changez le nom, adaptez `VITE_BASE` / `vite.config.js`.
2. **Installer Node.js** (LTS 20 ou plus) depuis <https://nodejs.org>, puis vérifier : `node -v`.
3. **Récupérer le projet** : décompressez l'archive, puis dans le dossier :
   ```bash
   git init -b main
   git add .
   git commit -m "Première version"
   git remote add origin https://github.com/TimLeRider/badge-reminder.git
   ```
   (Ne poussez pas tout de suite : configurez d'abord les secrets, étape 13.)
4. **Installer les dépendances** : `npm install`
5. **Lancer en local** (après avoir créé `.env.local`, étape 11) : `npm run dev`, puis ouvrir l'adresse affichée
   (de la forme `http://localhost:5173/badge-reminder/`).

### Étapes 6 à 12 : Firebase
6. **Créer le projet** : <https://console.firebase.google.com> → *Ajouter un projet* → nom libre → désactivez Google Analytics.
   Restez sur le forfait **Spark** (gratuit).
7. **Activer Authentication** : *Build → Authentication → Commencer → Sign-in method → E-mail/Mot de passe → Activer*.
   Onglet *Settings → Authorized domains* : ajoutez `timlerider.github.io`.
8. **Activer Firestore** : *Build → Firestore Database → Créer une base de données* → **mode production** → région européenne (ex. `eur3`).
9. **Règles de sécurité** : *Firestore → Règles* → remplacez tout le contenu par celui de `firestore.rules` → **Publier**.
   (Alternative CLI : `npx firebase-tools login` puis `npx firebase-tools deploy --only firestore:rules --project VOTRE_PROJECT_ID`.)
   Contrôlez avec l'onglet *Simulateur de règles* (lecture de `users/AUTRE_UID` avec un autre uid doit être **refusée**).
10. **Configurer FCM** : *Paramètres du projet → Cloud Messaging* : l'API *Firebase Cloud Messaging API (V1)* doit être activée (c'est le cas par défaut).
11. **Application web + clé VAPID** :
    - *Paramètres du projet → Général → Vos applications → Web (`</>`)* → nom `badge-reminder`, **ne cochez pas** Firebase Hosting → copiez la configuration.
    - *Paramètres du projet → Cloud Messaging → Configuration Web → Certificats Web Push → Générer une paire de clés* → copiez la **clé publique**.
    - Copiez `.env.example` en `.env.local` et remplissez les 6 valeurs (`VITE_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`,
      `..._MESSAGING_SENDER_ID`, `..._APP_ID`, `VITE_FIREBASE_VAPID_KEY`). Ce fichier est ignoré par Git.
12. **Service worker** : rien à configurer. `public/sw.js` est servi sous `/badge-reminder/sw.js` (portée `/badge-reminder/`) et enregistré automatiquement.
    Il ne contient aucune clé.

### Étapes 13 à 18 : GitHub
13. **Secrets GitHub Actions** : dépôt → *Settings → Secrets and variables → Actions → New repository secret*. Créez :
    `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
    `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY` (mêmes valeurs que `.env.local`) et **`FIREBASE_SERVICE_ACCOUNT`** :
    *Firebase → Paramètres → Comptes de service → Générer une nouvelle clé privée* → collez **tout le contenu du JSON** dans ce secret,
    puis **supprimez le fichier téléchargé** de votre ordinateur. Ne le placez jamais dans le dépôt.
14. **Activer GitHub Pages** : *Settings → Pages → Build and deployment → Source : **GitHub Actions**.*
15. **Premier déploiement** : `git push -u origin main`. Suivez l'onglet *Actions* (workflow « Déploiement GitHub Pages ») : il lance
    les tests, construit le site et le publie sur `https://timlerider.github.io/badge-reminder/`.
16. **Tester une notification** : ouvrez le site, créez un compte et un badge, page *Notifications* → activez l'interrupteur
    (acceptez la demande du navigateur) → *Test local* (immédiat), puis *Test push réel*. Pour ne pas attendre le cron :
    onglet *Actions → Rappels de badgeage → Run workflow* (case *Simulation* décochée).
17. **Vérifier la sauvegarde** : dans la console Firebase, *Firestore* doit montrer `users/{uid}`, `users/{uid}/badges/...` et
    `users/{uid}/notificationTokens/...`. Reconnectez-vous depuis un autre navigateur : vos badges réapparaissent.
18. **Mettre à jour le site** : modifiez le code, puis `git add . && git commit -m "…" && git push`. Le déploiement est automatique.
    Vous pouvez simuler le planificateur en local : `FIREBASE_SERVICE_ACCOUNT="$(cat cle.json)" npm run reminders:dry`
    (`cle.json` ne doit jamais être commité : le `.gitignore` bloque `*-firebase-adminsdk-*.json` et `service-account*.json`).

## 4. Sécurité

- Mots de passe gérés **uniquement** par Firebase Authentication (jamais stockés par l'application).
- Session persistante via Firebase (`browserLocalPersistence`) ; case « Se souvenir de moi » décochée = session de l'onglet.
- Règles Firestore : refus par défaut, accès limité au propriétaire (`request.auth.uid == uid`), champs et types validés,
  historique des rappels en écriture interdite côté client, une seule demande de test push en attente à la fois.
- Aucune clé privée dans le navigateur ni dans le dépôt ; le workflow de rappels n'a **pas** de déclencheur `pull_request`
  (les secrets ne sont jamais exposés à du code externe) et ses permissions sont réduites à `contents: read`.
- Le déduplicage des rappels repose sur une écriture Firestore atomique `create()` d'un document `cycle_seuil` avant l'envoi.

## 5. Structure du projet

```
src/lib/dates.js        calculs calendaires (UTC, insensibles à l'heure d'été), niveaux de couleur
src/lib/reminders.js    seuils 42/28/21/14/7/3/2/1/0, messages, rappels dus (partagé avec le planificateur)
src/lib/actions.js      Auth + Firestore (badges, préférences, export, suppression du compte)
src/lib/push.js         FCM : permission, jeton, test local
src/pages/              Accueil/inscription/connexion, assistant, tableau de bord, badges, notifications, paramètres, profil
public/sw.js            service worker Web Push
scripts/send-reminders.mjs   planificateur (Firebase Admin)
firestore.rules         règles de sécurité
.github/workflows/      deploy.yml (Pages) et reminders.yml (cron)
```

## 6. Checklist de tests

**État vérifié lors de la livraison** (automatisé, sans compte Firebase) :
- ✅ 26 tests unitaires (`npm test`) : 42 jours par défaut, délai personnalisé, jour même, échéance atteinte/dépassée (jamais de nombre négatif),
  progression plafonnée à 100 %, seuils de couleur (22/21/15/14/8/7/4/3/1/0 jours), changement d'heure (29 mars 2026), années bissextiles,
  fuseaux horaires, heure et jours autorisés, seuils activés/désactivés, liste des prochains rappels.
- ✅ Build de production (`npm run build`) ; l'aperçu local sert la page, `sw.js`, le manifeste et les icônes sous `/badge-reminder/`.
- ✅ Aucune clé privée dans `dist/` ; le planificateur refuse de démarrer sans `FIREBASE_SERVICE_ACCOUNT`.

**À valider par vous** (nécessite votre projet Firebase et vos appareils ; **non testé** ici) :
- [ ] Création de compte, adresse déjà utilisée, connexion, déconnexion, mot de passe oublié, persistance après fermeture du navigateur, connexion depuis un autre appareil.
- [ ] Création d'un badge, « J'ai badgé aujourd'hui », modification de la date, plusieurs badges indépendants, suppression d'un badge.
- [ ] Règles Firestore : dans le simulateur, un utilisateur A ne peut ni lire ni écrire les données de B ; un client ne peut pas écrire dans `reminders`.
- [ ] Autorisation accordée / refusée ; test local ; test push réel ; réception site ouvert puis site fermé (Android/Chrome, ordinateur, iPhone installé).
- [ ] Workflow lancé manuellement : en simulation puis en réel ; absence de doublon au second passage ; jeton invalide supprimé.
- [ ] Rappel au bon moment selon fuseau horaire/jour autorisé ; nouveau cycle après badgeage.
- [ ] Export JSON (sans secret), suppression du compte (mot de passe demandé, données et compte supprimés).
- [ ] Onglet *Actions* : déploiements verts ; console du navigateur sans erreur critique.
