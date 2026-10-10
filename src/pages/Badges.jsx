import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import BadgeForm from '../components/BadgeForm.jsx';
import { Confirm, Modal } from '../components/ui.jsx';
import { useApp } from '../context.jsx';
import { createBadge, deleteBadge, updateBadge } from '../lib/actions.js';
import { frError } from '../lib/errors.js';
import { computeStatus, formatDateFR, pluralDays } from '../lib/dates.js';

export default function Badges() {
  const { user, profile, badges, today, notify, go, setSelectedId, selected } = useApp();
  const [modal, setModal] = useState(null); // {type:'add'|'edit'|'delete', badge}
  const [busy, setBusy] = useState(false);
  const close = () => !busy && setModal(null);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); setModal(null); notify('success', okMsg); } catch (e) { notify('error', frError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="stack-lg">
      <div className="row between wrap gap">
        <h1>Mes badges</h1>
        <button className="btn primary" onClick={() => setModal({ type: 'add' })}><Plus size={18} aria-hidden /> Ajouter un badge</button>
      </div>
      <ul className="badge-list">
        {badges.map((b) => {
          const s = computeStatus({ lastBadgeDate: b.lastBadgeDate, delayDays: b.delayDays, today });
          return (
            <li key={b.id} className={`card badge-item lvl-${s.level.key}`}>
              <button className="badge-main" onClick={() => { setSelectedId(b.id); go(`dashboard/${b.id}`); }} aria-label={`Ouvrir le compteur de ${b.name}`}>
                <span className="dot" aria-hidden />
                <span>
                  <strong>{b.name}</strong>
                  <span className="muted block">{s.daysLeft > 0 ? `${pluralDays(s.daysLeft)} restants` : s.sub} · échéance le {formatDateFR(s.dueDate, { day: 'numeric', month: 'long' })}</span>
                  <span className="muted block">{s.level.label}{selected?.id === b.id ? ' · badge actif' : ''}</span>
                </span>
              </button>
              <div className="row gap">
                <button className="icon-btn" onClick={() => setModal({ type: 'edit', badge: b })} aria-label={`Modifier ${b.name}`}><Pencil size={18} aria-hidden /></button>
                <button className="icon-btn danger" onClick={() => setModal({ type: 'delete', badge: b })} aria-label={`Supprimer ${b.name}`}><Trash2 size={18} aria-hidden /></button>
              </div>
            </li>
          );
        })}
      </ul>

      {modal?.type === 'add' && (
        <Modal title="Ajouter un badge" onClose={close} wide>
          <BadgeForm today={today} defaultDelay={profile.defaultDelay} submitLabel="Créer mon badge" busy={busy} onCancel={close}
            onSubmit={(v) => run(() => createBadge(user.uid, v), 'Badge créé.')} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title={`Modifier « ${modal.badge.name} »`} onClose={close} wide>
          <p className="hint">Changer la date ou le délai démarre un nouveau cycle de rappels pour ce badge.</p>
          <BadgeForm today={today} initial={modal.badge} submitLabel="Enregistrer" busy={busy} onCancel={close}
            onSubmit={(v) => run(() => updateBadge(user.uid, modal.badge, v), 'Badge mis à jour.')} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Confirm title="Supprimer ce badge ?" danger confirmLabel="Supprimer" busy={busy} onClose={close}
          onConfirm={() => run(() => deleteBadge(user.uid, modal.badge.id), 'Badge supprimé.')}>
          <p>« {modal.badge.name} » et son historique de notifications seront définitivement supprimés. Vos autres badges ne sont pas touchés.</p>
        </Confirm>
      )}
    </div>
  );
}
