import { useMemo, useState } from 'react';
import { STATUTS, STATUT_ORDER, relanceStatus, RELANCE_STYLE, formatDateShort, ageNumber } from '../constants';
import { ScoreBadge } from './TableauProspection';

function RelanceChip({ dateStr, compact }) {
  const st = relanceStatus(dateStr);
  if (!st) return null;
  const s = RELANCE_STYLE[st.kind];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
      title={`Relance le ${formatDateShort(dateStr)}`}
    >
      ⏰ {compact ? formatDateShort(dateStr) : st.label}
    </span>
  );
}

function Card({ site, onClick, onDragStart, onDragEnd, dragging }) {
  const ageN = ageNumber(site.age);
  const ageSenior = ageN != null && ageN >= 60;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, site.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(site.id)}
      className={`w-full text-left bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-amber/60 transition cursor-grab active:cursor-grabbing ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold leading-snug">{site.cc || '—'}</span>
        <ScoreBadge score={site.score ?? 0} label={site.score_label} compact />
      </div>
      <p className="text-[11px] text-gray-500 mt-1">
        {site.enseigne || '—'} · Dép. {site.departement || '—'}
      </p>
      {site.dirigeant && (
        <p className={`text-xs mt-1 ${ageSenior ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
          {site.dirigeant}
          {site.age ? ` · ${site.age} ans` : ''}
        </p>
      )}
      {site.relance_at && (
        <div className="mt-2">
          <RelanceChip dateStr={site.relance_at} />
        </div>
      )}
    </button>
  );
}

export default function PipelineKanban({ sites, onCardClick, onMoveStatut }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const byStatut = useMemo(() => {
    const map = Object.fromEntries(STATUT_ORDER.map((k) => [k, []]));
    for (const s of sites) {
      const k = STATUTS[s.statut] ? s.statut : 'todo';
      map[k].push(s);
    }
    // Au sein d'une colonne : score décroissant
    for (const k of STATUT_ORDER) map[k].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return map;
  }, [sites]);

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };
  const onDragEnd = () => {
    setDragId(null);
    setOverCol(null);
  };
  const onDrop = (e, statut) => {
    e.preventDefault();
    const id = dragId ?? Number(e.dataTransfer.getData('text/plain'));
    setOverCol(null);
    setDragId(null);
    if (!id) return;
    const site = sites.find((s) => s.id === id);
    if (site && site.statut !== statut) onMoveStatut(id, statut);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
      {STATUT_ORDER.map((k) => {
        const cfg = STATUTS[k];
        const cards = byStatut[k];
        const isOver = overCol === k;
        return (
          <div
            key={k}
            onDragOver={(e) => {
              e.preventDefault();
              if (overCol !== k) setOverCol(k);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setOverCol(null);
            }}
            onDrop={(e) => onDrop(e, k)}
            className={`flex-1 min-w-[230px] max-w-[320px] rounded-xl border transition ${
              isOver ? 'border-amber bg-amber/5' : 'border-gray-200 bg-[#F7F6F3]'
            }`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 sticky top-0">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
              <span className="text-sm font-bold text-marine">{cfg.label}</span>
              <span className="ml-auto text-xs font-semibold text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                {cards.length}
              </span>
            </div>
            <div className="p-2 space-y-2 min-h-[80px]">
              {cards.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-6">
                  {isOver ? 'Déposer ici' : 'Vide'}
                </p>
              )}
              {cards.map((s) => (
                <Card
                  key={s.id}
                  site={s}
                  onClick={onCardClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  dragging={dragId === s.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
