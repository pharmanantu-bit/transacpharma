import { useMemo } from 'react';
import { relanceStatus, RELANCE_STYLE, formatDateShort } from '../constants';

// Bandeau des relances à traiter : en retard, aujourd'hui, ou dans les 7 jours.
// Masqué s'il n'y a rien d'imminent.
export default function RelancesPanel({ sites, onOpen }) {
  const due = useMemo(() => {
    return sites
      .map((s) => ({ s, st: relanceStatus(s.relance_at) }))
      .filter((x) => x.st && x.st.kind !== 'later')
      .sort((a, b) => a.st.days - b.st.days);
  }, [sites]);

  if (due.length === 0) return null;

  const overdue = due.filter((x) => x.st.kind === 'overdue').length;
  const today = due.filter((x) => x.st.kind === 'today').length;

  return (
    <div className="mb-5 bg-white border border-amber/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-bold text-marine">⏰ Relances à traiter</h3>
        {overdue > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {overdue} en retard
          </span>
        )}
        {today > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {today} aujourd'hui
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">{due.length} au total (≤ 7 j)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {due.map(({ s, st }) => {
          const style = RELANCE_STYLE[st.kind];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpen(s.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-amber hover:bg-amber/5 transition text-left"
              title={s.relance_note || ''}
            >
              <span
                className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{ backgroundColor: style.bg, color: style.text }}
              >
                {st.label}
              </span>
              <span className="text-sm font-medium text-marine max-w-[180px] truncate">{s.cc}</span>
              <span className="text-[11px] text-gray-400">{formatDateShort(s.relance_at)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
