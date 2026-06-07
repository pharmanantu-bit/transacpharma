import { STATUTS, STATUT_ORDER, ENSEIGNES, DEPARTEMENTS } from '../constants';

export default function Filtres({ filters, setFilters, search, setSearch, count }) {
  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const reset = () => {
    setFilters({ statut: '', enseigne: '', departement: '' });
    setSearch('');
  };
  const hasActive = filters.statut || filters.enseigne || filters.departement || search;

  const selectCls =
    'px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-marine focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (CC, pharmacie, dirigeant, remarques…)"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber"
        />
      </div>

      <select value={filters.statut} onChange={(e) => update('statut', e.target.value)} className={selectCls}>
        <option value="">Tous les statuts</option>
        {STATUT_ORDER.map((k) => (
          <option key={k} value={k}>
            {STATUTS[k].label}
          </option>
        ))}
      </select>

      <select value={filters.enseigne} onChange={(e) => update('enseigne', e.target.value)} className={selectCls}>
        <option value="">Toutes enseignes</option>
        {ENSEIGNES.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>

      <select
        value={filters.departement}
        onChange={(e) => update('departement', e.target.value)}
        className={selectCls}
      >
        <option value="">Tous départements</option>
        {DEPARTEMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <span className="text-xs text-gray-500 px-1">{count} résultat{count > 1 ? 's' : ''}</span>

      {hasActive && (
        <button
          onClick={reset}
          className="px-3 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 transition"
        >
          ✕ Réinitialiser
        </button>
      )}
    </div>
  );
}
