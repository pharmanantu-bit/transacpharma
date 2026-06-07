import { STATUTS } from '../constants';

function isSansPharmacie(s) {
  const p = (s.pharmacie || '').trim().toLowerCase();
  return p === '' || p === 'aucune' || p === '?' || p.startsWith('liquid');
}

function Kpi({ label, value, color, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-xl px-4 py-3 flex-1 min-w-[150px] hover:shadow-sm transition"
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
    >
      <div className="text-2xl font-extrabold" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
    </button>
  );
}

export default function KpiBar({ sites, onFilterStatut }) {
  const total = sites.length;
  const cibles = sites.filter((s) => s.statut === 'cible').length;
  const surveiller = sites.filter((s) => s.statut === 'surveiller').length;
  const sansPharma = sites.filter(isSansPharmacie).length;
  const aConfirmer = sites.filter((s) => s.statut === 'todo').length;

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <Kpi label="Total sites" value={total} onClick={() => onFilterStatut('')} />
      <Kpi
        label="★ Cibles"
        value={cibles}
        color={STATUTS.cible.text}
        accent={STATUTS.cible.dot}
        onClick={() => onFilterStatut('cible')}
      />
      <Kpi
        label="À surveiller"
        value={surveiller}
        color={STATUTS.surveiller.text}
        accent={STATUTS.surveiller.dot}
        onClick={() => onFilterStatut('surveiller')}
      />
      <Kpi label="Sans pharmacie" value={sansPharma} accent="#9CA3AF" onClick={() => onFilterStatut('')} />
      <Kpi
        label="À confirmer"
        value={aConfirmer}
        color={STATUTS.todo.text}
        accent={STATUTS.todo.dot}
        onClick={() => onFilterStatut('todo')}
      />
    </div>
  );
}
