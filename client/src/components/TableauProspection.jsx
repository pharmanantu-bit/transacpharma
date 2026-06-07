import { STATUTS, ageNumber } from '../constants';

const COLS = [
  { key: 'cc', label: 'CC', w: 'min-w-[180px]' },
  { key: 'departement', label: 'Dép', w: 'w-14' },
  { key: 'enseigne', label: 'Enseigne', w: 'w-24' },
  { key: 'siren', label: 'SIREN', w: 'min-w-[110px]' },
  { key: 'pharmacie', label: 'Pharmacie', w: 'min-w-[160px]' },
  { key: 'dirigeant', label: 'Dirigeant', w: 'min-w-[160px]' },
  { key: 'age', label: 'Âge', w: 'w-16' },
  { key: 'groupement', label: 'Groupement', w: 'w-28' },
  { key: 'statut', label: 'Statut', w: 'w-32' },
  { key: 'remarques', label: 'Remarques', w: 'min-w-[260px]' }
];

export function Badge({ statut }) {
  const cfg = STATUTS[statut] || STATUTS.todo;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function SortArrow({ active, dir }) {
  if (!active) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="text-amber ml-1">{dir === 'asc' ? '▲' : '▼'}</span>;
}

export default function TableauProspection({ sites, sort, onSort, onRowClick, loading }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F4F3F0] border-b border-gray-200">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  className={`text-left font-semibold text-gray-600 px-3 py-3 cursor-pointer select-none whitespace-nowrap hover:text-marine ${c.w}`}
                >
                  {c.label}
                  <SortArrow active={sort.key === c.key} dir={sort.dir} />
                </th>
              ))}
              <th className="px-3 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            )}

            {!loading && sites.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-gray-400">
                  Aucun site ne correspond aux filtres.
                </td>
              </tr>
            )}

            {!loading &&
              sites.map((s, i) => {
                const ageN = ageNumber(s.age);
                const ageSenior = ageN != null && ageN >= 60;
                return (
                  <tr
                    key={s.id}
                    onClick={() => onRowClick(s.id)}
                    className={`border-b border-gray-100 cursor-pointer transition hover:bg-amber/5 ${
                      i % 2 === 1 ? 'bg-[#FCFBF9]' : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium">{s.cc || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.departement || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{s.enseigne || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{s.siren || '—'}</td>
                    <td className="px-3 py-2.5">{s.pharmacie || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{s.dirigeant || '—'}</td>
                    <td
                      className={`px-3 py-2.5 ${ageSenior ? 'text-red-600 font-bold' : 'text-gray-600'}`}
                    >
                      {s.age || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{s.groupement || '—'}</td>
                    <td className="px-3 py-2.5">
                      <Badge statut={s.statut} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      <span className="line-clamp-2" title={s.remarques}>
                        {s.remarques || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-300 text-center">›</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
