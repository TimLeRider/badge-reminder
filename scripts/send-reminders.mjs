// Planificateur de rappels : exécuté par GitHub Actions (.github/workflows/reminders.yml).
// Utilise le SDK Firebase Admin avec la clé de compte de service stockée dans le secret
// GitHub FIREBASE_SERVICE_ACCOUNT. Cette clé n'est JAMAIS envoyée au navigateur.
//
// Usage : node scripts/send-reminders.mjs [--dry-run]
import admin from 'firebase-admin';
import { localParts, safeTimeZone } from '../src/lib/dates.js';
import { dueThresholds, isNotifyTime, reminderDocId, reminderText } from '../src/lib/reminders.js';

const DRY = process.argv.includes('--dry-run');
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('❌ Variable FIREBASE_SERVICE_ACCOUNT absente (secret GitHub à configurer).');
  process.exit(1);
}
let credentials;
try {
  credentials = JSON.parse(raw);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT n’est pas un JSON valide.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(credentials) });
const db = admin.firestore();
const messaging = admin.messaging();
const { FieldValue } = admin.firestore;

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

let hardErrors = 0;
const stats = { users: 0, sent: 0, skipped: 0, tokensRemoved: 0, tests: 0 };

async function loadTokens(uid) {
  const snap = await db.collection('users').doc(uid).collection('notificationTokens').get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, token: d.data().token })).filter((t) => t.token);
}

/** Envoie un message data-only à tous les appareils ; nettoie les jetons invalides. */
async function push(tokens, data) {
  if (DRY) {
    console.log(`  [dry-run] push → ${tokens.length} appareil(s) :`, data.title, '|', data.body);
    return { success: tokens.length, invalidOnly: false, error: null };
  }
  const res = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    data,
    webpush: { headers: { TTL: '43200', Urgency: 'high' } },
  });
  let invalid = 0;
  const errors = [];
  for (let i = 0; i < res.responses.length; i++) {
    const r = res.responses[i];
    if (r.success) continue;
    const code = r.error && r.error.code;
    if (INVALID_TOKEN_CODES.has(code)) {
      invalid++;
      await tokens[i].ref.delete().catch(() => {});
      stats.tokensRemoved++;
    } else {
      errors.push(code || String(r.error));
    }
  }
  const failures = res.failureCount;
  return {
    success: res.successCount,
    invalidOnly: res.successCount === 0 && failures > 0 && invalid === failures,
    error: errors[0] || (invalid && res.successCount === 0 ? 'Jetons invalides supprimés' : null),
  };
}

// 1) Demandes de test push faites depuis l'application
const tests = await db.collection('users').where('testRequest.status', '==', 'pending').get();
for (const u of tests.docs) {
  stats.tests++;
  const tokens = await loadTokens(u.id);
  let patch;
  if (!tokens.length) {
    patch = { status: 'failed', message: 'Aucun appareil enregistré. Activez les notifications sur cet appareil.' };
  } else {
    const r = await push(tokens, {
      title: 'Badge Reminder',
      body: 'Test réussi : les notifications push fonctionnent sur cet appareil.',
      tag: 'br-test',
      badgeId: '',
    });
    patch = r.success > 0
      ? { status: 'done', message: `Notification envoyée à ${r.success} appareil(s).` }
      : { status: 'failed', message: `Échec de l’envoi : ${r.error || 'erreur inconnue'}.` };
  }
  console.log(`🔔 Test ${u.id}: ${patch.status}`);
  if (!DRY) await u.ref.update({ testRequest: { ...patch, processedAt: FieldValue.serverTimestamp() } });
}

// 2) Rappels programmés
const now = new Date();
const users = await db.collection('users').where('notifications.enabled', '==', true).get();
for (const u of users.docs) {
  const user = u.data();
  const tz = safeTimeZone(user.timezone);
  if (!isNotifyTime(user.notifications, tz, now)) { stats.skipped++; continue; }
  stats.users++;

  const badges = await u.ref.collection('badges').get();
  const work = [];
  for (const b of badges.docs) {
    const badge = b.data();
    for (const t of dueThresholds(badge, tz, now)) work.push({ bref: b.ref, id: b.id, badge, t });
  }
  if (!work.length) continue;

  const tokens = await loadTokens(u.id);
  if (!tokens.length) { console.log(`⚠️  ${u.id}: rappels dus mais aucun appareil enregistré`); continue; }

  for (const { bref, id, badge, t } of work) {
    const rref = bref.collection('reminders').doc(reminderDocId(badge.cycle, t));
    const title = `Badge Reminder — ${badge.name}`;
    const body = reminderText(t);
    try {
      if (!DRY) {
        // create() échoue si le rappel existe déjà : garantit l'absence de doublon.
        await rref.create({ status: 'sending', threshold: t, cycle: badge.cycle, name: badge.name, body, claimedAt: FieldValue.serverTimestamp() });
      }
    } catch (e) {
      if (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message))) continue; // déjà traité
      hardErrors++; console.error(`❌ ${u.id}/${id}/${t}:`, e.message); continue;
    }
    try {
      const r = await push(tokens, { title, body, tag: `br-${id}-${badge.cycle}-${t}`, badgeId: id });
      if (r.success > 0) {
        stats.sent++;
        console.log(`✅ ${u.id}/${badge.name} : rappel ${t} j envoyé (${r.success} appareil(s))`);
        if (!DRY) await rref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp(), devices: r.success });
      } else if (r.invalidOnly) {
        if (!DRY) await rref.update({ status: 'failed', error: r.error, sentAt: FieldValue.serverTimestamp() });
      } else {
        // Erreur transitoire : on libère le rappel pour une nouvelle tentative au prochain passage.
        hardErrors++; console.error(`❌ envoi ${u.id}/${badge.name}/${t} :`, r.error);
        if (!DRY) await rref.delete();
      }
    } catch (e) {
      hardErrors++; console.error(`❌ envoi ${u.id}/${badge.name}/${t} :`, e.message);
      if (!DRY) await rref.delete().catch(() => {});
    }
  }
}

console.log(`Terminé${DRY ? ' (dry-run)' : ''} :`, JSON.stringify(stats), `| erreurs : ${hardErrors}`);
process.exit(hardErrors ? 1 : 0);
