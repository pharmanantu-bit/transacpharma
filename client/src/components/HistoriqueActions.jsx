import { ACTION_TYPES, formatDate } from '../constants';

export default function HistoriqueActions({ actions }) {
  if (!actions || actions.length === 0) {
    return <p className="text-sm text-gray-400 italic py-2">Aucune action enregistrée pour l'instant.</p>;
  }

  return (
    <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4 py-1">
      {actions.map((a) => {
        const cfg = ACTION_TYPES[a.type] || ACTION_TYPES.note;
        return (
          <li key={a.id} className="ml-4">
            <span
              className="absolute -left-[9px] w-4 h-4 rounded-full border-2 border-white"
              style={{ backgroundColor: cfg.color }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: cfg.color + '22', color: cfg.color }}
              >
                {cfg.emoji} {cfg.label}
              </span>
              {a.auteur && <span className="text-xs text-gray-500">par {a.auteur}</span>}
              <span className="text-xs text-gray-400 ml-auto">{formatDate(a.created_at)}</span>
            </div>
            <p className="text-sm text-marine mt-1 whitespace-pre-wrap">{a.contenu}</p>
          </li>
        );
      })}
    </ol>
  );
}
