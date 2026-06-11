import { useState, useEffect, useCallback, useMemo } from 'react';
import KpiBar from './components/KpiBar';
import Filtres from './components/Filtres';
import TableauProspection from './components/TableauProspection';
import FicheDetail from './components/FicheDetail';
import ModalEdition from './components/ModalEdition';
import Tabs from './components/Tabs';
import Decouverte from './components/Decouverte';
import PipelineKanban from './components/PipelineKanban';
import RelancesPanel from './components/RelancesPanel';
import VeilleBodacc from './components/VeilleBodacc';
import { ageNumber } from './constants';

const API = '/api';

export default function App() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({ statut: '', enseigne: '', departement: '' });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' });

  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'new' | 'edit', site? }
  const [activeTab, setActiveTab] = useState('prospection');
  const [exportOpen, setExportOpen] = useState(false);

  // URL d'export qui reprend les filtres + la recherche actifs (même vue qu'à l'écran)
  const exportUrl = useCallback(
    (format) => {
      const params = new URLSearchParams();
      if (filters.statut) params.set('statut', filters.statut);
      if (filters.enseigne) params.set('enseigne', filters.enseigne);
      if (filters.departement) params.set('departement', filters.departement);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString();
      return `${API}/export/${format}${qs ? '?' + qs : ''}`;
    },
    [filters, search]
  );

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.statut) params.set('statut', filters.statut);
      if (filters.enseigne) params.set('enseigne', filters.enseigne);
      if (filters.departement) params.set('departement', filters.departement);
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`${API}/sites?${params.toString()}`);
      const json = await res.json();
      if (json.success) setSites(json.data);
      else setError(json.error || 'Erreur de chargement');
    } catch (e) {
      setError('Serveur injoignable : ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    const t = setTimeout(fetchSites, 200);
    return () => clearTimeout(t);
  }, [fetchSites]);

  const sorted = useMemo(() => {
    const arr = [...sites];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let va = a[key] ?? '';
      let vb = b[key] ?? '';
      if (key === 'age') {
        va = ageNumber(va) ?? -1;
        vb = ageNumber(vb) ?? -1;
      } else if (key === 'score') {
        va = a.score ?? -1;
        vb = b.score ?? -1;
      } else if (key === 'id' || key === 'departement') {
        va = parseInt(va, 10) || 0;
        vb = parseInt(vb, 10) || 0;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [sites, sort]);

  const handleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const selectedSite = sites.find((s) => s.id === selectedId) || null;

  // --- Création / édition complète ---
  const saveSite = async (data) => {
    const isEdit = !!data.id;
    try {
      const res = await fetch(`${API}/sites${isEdit ? '/' + data.id : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        await fetchSites();
        setModal(null);
        if (isEdit) setSelectedId(json.data.id);
        return { success: true };
      }
      return { success: false, error: json.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  // --- Mise à jour partielle (note interne, statut) ---
  const updateSite = async (id, patch) => {
    try {
      const res = await fetch(`${API}/sites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const json = await res.json();
      if (json.success) {
        setSites((prev) => prev.map((s) => (s.id === id ? json.data : s)));
      }
      return json;
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const deleteSite = async (id) => {
    if (!window.confirm('Supprimer définitivement ce site et son historique ?')) return;
    try {
      const res = await fetch(`${API}/sites/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setSelectedId(null);
        fetchSites();
      }
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-marine">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-marine flex items-center justify-center text-amber font-extrabold text-lg">
              T
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight">TransacPharma</h1>
              <p className="text-xs text-gray-500 leading-tight">
                Prospection officines · galeries marchandes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setExportOpen((o) => !o)}
                onBlur={() => setTimeout(() => setExportOpen(false), 150)}
                className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-marine hover:bg-gray-50 transition"
              >
                ⬇ Exporter ▾
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
                  <a
                    href={exportUrl('xlsx')}
                    className="block px-4 py-2.5 text-sm text-marine hover:bg-gray-50 transition"
                  >
                    📊 Excel (.xlsx)
                  </a>
                  <a
                    href={exportUrl('csv')}
                    className="block px-4 py-2.5 text-sm text-marine hover:bg-gray-50 border-t border-gray-100 transition"
                  >
                    📄 CSV (.csv)
                  </a>
                  <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
                    Export de la vue filtrée actuelle
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setModal({ mode: 'new' })}
              className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-marine text-white hover:bg-[#262640] transition"
            >
              + Nouveau site
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { key: 'prospection', label: 'Prospection' },
            { key: 'pipeline', label: '📋 Pipeline' },
            { key: 'veille', label: '📰 Veille' },
            { key: 'decouverte', label: '✨ Découverte' }
          ]}
        />

        {(activeTab === 'prospection' || activeTab === 'pipeline') && (
          <RelancesPanel sites={sites} onOpen={(id) => setSelectedId(id)} />
        )}

        {activeTab === 'prospection' && (
          <>
            <KpiBar sites={sites} onFilterStatut={(statut) => setFilters((f) => ({ ...f, statut }))} />

            <Filtres
              filters={filters}
              setFilters={setFilters}
              search={search}
              setSearch={setSearch}
              count={sites.length}
            />

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <TableauProspection
              sites={sorted}
              sort={sort}
              onSort={handleSort}
              onRowClick={(id) => setSelectedId(id)}
              loading={loading}
            />
          </>
        )}

        {activeTab === 'pipeline' && (
          <>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}
            <p className="text-xs text-gray-500 mb-3">
              Glissez-déposez une carte d'une colonne à l'autre pour changer son statut. Le score et les
              relances sont mis à jour automatiquement.
            </p>
            <PipelineKanban
              sites={sites}
              onCardClick={(id) => setSelectedId(id)}
              onMoveStatut={(id, statut) => updateSite(id, { statut })}
            />
          </>
        )}

        {activeTab === 'veille' && (
          <VeilleBodacc api={API} onOpen={(id) => setSelectedId(id)} onScanned={fetchSites} />
        )}

        {activeTab === 'decouverte' && <Decouverte onImported={fetchSites} />}
      </main>

      {selectedSite && (
        <FicheDetail
          site={selectedSite}
          api={API}
          onClose={() => setSelectedId(null)}
          onUpdate={updateSite}
          onEnriched={(row) => setSites((prev) => prev.map((s) => (s.id === row.id ? row : s)))}
          onEdit={() => setModal({ mode: 'edit', site: selectedSite })}
          onDelete={deleteSite}
        />
      )}

      {modal && (
        <ModalEdition
          mode={modal.mode}
          site={modal.site}
          onClose={() => setModal(null)}
          onSave={saveSite}
        />
      )}
    </div>
  );
}
