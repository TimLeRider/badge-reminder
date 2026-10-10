import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { useApp } from '../context.jsx';

export const Spinner = ({ label = 'Chargement…' }) => (
  <div className="center-screen" role="status"><Loader2 className="spin" size={28} aria-hidden /> <span>{label}</span></div>
);

export function Modal({ title, children, onClose, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => { if (d && d.open) d.close(); };
  }, []);
  return (
    <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onClose={onClose} onCancel={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="modal-title">
      <div className="modal-body">
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={20} aria-hidden /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Confirm({ title, children, confirmLabel, danger, busy, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack">{children}</div>
      <div className="row end gap">
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annuler</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 className="spin" size={16} aria-hidden />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const icon = { success: <CheckCircle2 size={18} />, error: <AlertTriangle size={18} />, info: <Info size={18} /> };
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          {icon[t.kind]}<span>{t.text}</span>
          <button className="icon-btn" onClick={() => dismissToast(t.id)} aria-label="Fermer le message"><X size={16} aria-hidden /></button>
        </div>
      ))}
    </div>
  );
}

export const Field = ({ label, hint, error, children, htmlFor }) => (
  <div className="field">
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <p className="hint">{hint}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>
);

export const Notice = ({ kind = 'info', children }) => (
  <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'note'}>{children}</div>
);

export const Disclaimer = () => (
  <p className="disclaimer">
    Outil personnel et indépendant. Le calcul repose uniquement
    sur les dates et délais que vous renseignez.
  </p>
);
