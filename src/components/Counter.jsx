import { CheckCircle2, AlertTriangle } from 'lucide-react';

const R = 118;
const C = 2 * Math.PI * R;

export default function Counter({ status }) {
  const { level, daysLeft, headline, sub, progress } = status;
  const pct = Math.round(progress * 100);
  const text = daysLeft > 0 ? `${headline.toLowerCase()} ${sub}` : sub;
  return (
    <div className={`counter lvl-${level.key}`}>
      <div className="ring" role="img" aria-label={`${text}. Progression du cycle : ${pct} %. État : ${level.label}.`}>
        <svg viewBox="0 0 280 280" aria-hidden>
          <circle className="ring-track" cx="140" cy="140" r={R} />
          <circle className="ring-bar" cx="140" cy="140" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 140 140)" />
        </svg>
        <div className="ring-center" aria-hidden>
          {daysLeft > 0 ? (
            <>
              <span className="pre">Il vous reste</span>
              <span className="big">{daysLeft}</span>
              <span className="unit">{daysLeft > 1 ? 'JOURS' : 'JOUR'}</span>
              <span className="post">avant votre échéance estimée</span>
            </>
          ) : (
            <>
              <span className="big small-big">{daysLeft === 0 ? 'Aujourd’hui' : headline}</span>
              <span className="post">{sub}</span>
            </>
          )}
        </div>
      </div>
      <div className="level-chip">
        {daysLeft <= 3 ? <AlertTriangle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
        <strong>{level.label}</strong>
        <span>· {pct} % du cycle écoulé</span>
      </div>
    </div>
  );
}
