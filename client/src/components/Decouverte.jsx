import { useState, useEffect, useMemo } from 'react';
import { OPPORTUNITY_TYPES } from '../constants';

const API = '/api';
const MAX_DEPS = 5;

function TypeBadge({ type }) {
  const cfg = OPPORTUNITY_TYPES[type] || OPPORTUNITY_TYPES.acquisition;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.emoji} {cfg.label}
    </span>
  );
}

export default function Decouverte({ onImported }) {
  const [departements, setDepartements] = useState([]);
  const [depFilter, setDepFilter] = useState('');
  const [selectedDeps, setSelectedDeps] = useState([]);
  const [radius, setRadius] = useState(300);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [results, setResults] = useState(null); // [{departement,status,error,candidats}]

  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  useEffect(() => {
    fetch(`${API}/discovery/departements`)
      .then((r) => r.json())
      .then((j) => j.success && setDepartements(j.data))
      .catch(() => {});
  }, []);

  const filteredDeps = useMemo(() => {
    const q = depFilter.trim().toLowerCase();
    if (!q) return departements;
    return departements.filter(
      (d) => d.code.toLowerCase().includes(q) || d.nom.toLowerCase().includes(q)
    );
  }, [departements, depFilter]);

  const toggleDep = (code) => {
    setSelectedDeps((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_DEPS) return prev;
      return [...prev, code];
    });
  };

  const candidats = useMemo(() => {
    if (!results) return [];
    return results.filter((r) => r.status === 'ok').flatMap((r) => r.candidats);
  }, [results]);

  const errors = useMemo(
    () => (results ? results.filter((r) => r.status === 'error') : []),
    [results]
  );

  const runScan = async () => {
    if (selectedDeps.length === 0) return;
    setScanning(true);
    setScanError(null);
    setResults(null);
    setSelectedRows(new Set());
    setImportMsg(null);
    try {
      const res = await fetch(`${API}/discovery/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departements: selectedDeps, radius: Number(radius) })
      });
      const json = await res.json();
      if (json.success) setResults(json.results);
      else setScanError(json.error || 'Échec du scan');
    } catch (e) {
      setScanError('Serveur injoignable : ' + e.message);
    } finally {
      setScanning(false);
    }
  };

  const toggleRow = (osmId) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(osmId)) next.delete(osmId);
      else next.add(osmId);
      return next;
    });
  };

  const allSelected = candidats.length > 0 && selectedRows.size === candidats.length;
  const toggleAll = () => {
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(candidats.map((c) => c.osm_id)));
  };

  const importSelection = async () => {
    const sites = candidats.filter((c) => selectedRows.has(c.osm_id));
    if (sites.length === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch(`${API}/sites/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites })
      });
      const json = await res.json();
      if (json.success) {
        setImportMsg({
          type: 'ok',
          text: `${json.inserted} site(s) ajouté(s) à la prospection${
            json.skipped ? `, ${json.skipped} déjà présent(s)` : ''
          }.`
        });
        setSelectedRows(new Set());
        onImported && onImported();
      } else {
        setImportMsg({ type: 'err', text: json.error || 'Échec de l\'import' });
      }
    } catch (e) {
      setImportMsg({ type: 'err', text: e.message });
    } finally {
      setImporting(false);
    }
  };

  const nbCreation = candidats.filter((c) => c.opportunite_type === 'creation').length;
  const nbAcq = candidats.filter((c) => c.opportunite_type === 'acquisition').length;

  return (
    <div className="space-y-5">
      {/* Panneau de scan */}
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-base font-extrabold mb-1">Découverte d'opportunités</h2>
        <p className="text-sm text-gray-500 mb-4">
          Recherche les centres commerciaux (galerie + hypermarché) partout en France et indique
          s'il existe déjà une pharmacie. Données : OpenStreetMap + annuaire des entreprises (gratuit).
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
          {/* Sélecteur de départements */}
          <div>
            <label className="text-xs font-semibold text-gray-500">
              Départements à scanner ({selectedDeps.length}/{MAX_DEPS})
            </label>
            {selectedDeps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 my-2">
                {selectedDeps.map((code) => {
                  const d = departements.find((x) => x.code === code);
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-marine text-white"
                    >
                      {code} {d ? d.nom : ''}
                      <button onClick={() => toggleDep(code)} className="ml-0.5 hover:text-amber">
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <input
              type="text"
              value={depFilter}
              onChange={(e) => setDepFilter(e.target.value)}
              placeholder="Filtrer (code ou nom de département)…"
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber"
            />
            <div className="mt-2 max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredDeps.map((d) => {
                const checked = selectedDeps.includes(d.code);
                const disabled = !checked && selectedDeps.length >= MAX_DEPS;
                return (
                  <label
                    key={d.code}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-cream ${
                      disabled ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleDep(d.code)}
                    />
                    <span className="font-mono text-gray-500 w-8">{d.code}</span>
                    <span>{d.nom}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Paramètres + bouton */}
          <div className="lg:w-56 flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">Rayon pharmacie (m)</label>
              <input
                type="number"
                min="50"
                max="1000"
                step="50"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-300"
              />
            </div>
            <button
              onClick={runScan}
              disabled={scanning || selectedDeps.length === 0}
              className="px-4 py-2.5 text-sm font-bold rounded-lg bg-marine text-white hover:bg-[#262640] disabled:opacity-50"
            >
              {scanning ? '⏳ Scan en cours…' : '🔍 Scanner'}
            </button>
            <p className="text-[11px] text-gray-400 leading-snug">
              Max 5 départements par scan (~30 s chacun) pour respecter les quotas OpenStreetMap.
            </p>
          </div>
        </div>

        {scanError && (
          <div className="mt-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {scanError}
          </div>
        )}
      </section>

      {/* Résultats */}
      {results && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 flex-wrap">
            <div className="text-sm">
              <span className="font-bold">{candidats.length}</span> centre(s) trouvé(s) ·{' '}
              <span className="text-green-700 font-semibold">{nbCreation} création</span> ·{' '}
              <span className="text-amber font-semibold" style={{ color: '#92400E' }}>
                {nbAcq} acquisition
              </span>
            </div>
            <button
              onClick={importSelection}
              disabled={importing || selectedRows.size === 0}
              className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-amber text-marine hover:brightness-95 disabled:opacity-50"
            >
              {importing
                ? 'Import…'
                : `+ Ajouter la sélection (${selectedRows.size}) à la prospection`}
            </button>
          </div>

          {errors.length > 0 && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
              Départements en erreur (réessaie plus tard) :{' '}
              {errors.map((e) => `${e.departement} (${e.error})`).join(', ')}
            </div>
          )}

          {importMsg && (
            <div
              className={`px-4 py-2 text-sm border-b ${
                importMsg.type === 'ok'
                  ? 'bg-green-50 border-green-100 text-green-700'
                  : 'bg-red-50 border-red-100 text-red-700'
              }`}
            >
              {importMsg.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#F4F3F0] border-b border-gray-200 text-left text-gray-600">
                  <th className="px-3 py-2.5 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2.5">Centre</th>
                  <th className="px-3 py-2.5">Ville</th>
                  <th className="px-3 py-2.5 w-14">Dép</th>
                  <th className="px-3 py-2.5">Hyper</th>
                  <th className="px-3 py-2.5">Pharmacie</th>
                  <th className="px-3 py-2.5">SIREN</th>
                  <th className="px-3 py-2.5">Type</th>
                </tr>
              </thead>
              <tbody>
                {candidats.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      Aucun centre trouvé sur cette sélection.
                    </td>
                  </tr>
                )}
                {candidats.map((c, i) => (
                  <tr
                    key={c.osm_id}
                    className={`border-b border-gray-100 ${i % 2 ? 'bg-[#FCFBF9]' : 'bg-white'}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(c.osm_id)}
                        onChange={() => toggleRow(c.osm_id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{c.cc || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.ville || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{c.departement}</td>
                    <td className="px-3 py-2 text-gray-600">{c.enseigne || '—'}</td>
                    <td className="px-3 py-2">
                      {c.pharmacie_presente ? (
                        <span className="text-gray-700">
                          <span className="text-green-700 font-semibold">Oui</span>
                          {c.pharmacie_distance_m != null && (
                            <span className="text-gray-400"> · {c.pharmacie_distance_m} m</span>
                          )}
                          {c.pharmacie_nom && (
                            <span className="block text-xs text-gray-400">{c.pharmacie_nom}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">Non</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{c.siren || '—'}</td>
                    <td className="px-3 py-2">
                      <TypeBadge type={c.opportunite_type} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
