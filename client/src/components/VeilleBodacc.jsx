import { useState, useEffect, useCallback, useMemo } from 'react';
import { BODACC_NIVEAUX, formatDateShort } from '../constants';

// Onglet Veille BODACC : journal complet des annonces officielles sur les
// SIREN suivis (ventes de fonds, procédures, mouvements de dirigeants…),
// avec filtres par niveau, alertes non lues mises en avant et scan manuel.
export default function VeilleBodacc({ api, onOpen, onScanned }) {
  const [annonces, setAnnonces] = useState([]);
  const [checkedAt, setCheckedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState(null); // { type: 'ok'|'err', text }
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [nonLuesSeules, setNonLuesSeules] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${api}/bodacc/annonces`);
      const json = await res.json();
      if (json.success) {
        setAnnonces(json.data);
        setCheckedAt(json.checked_at || '');
      }
    } catch {
      /* serveur injoignable : la page reste vide */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch(`${api}/bodacc/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const json = await res.json();
      if (json.success) {
        setScanMsg({
          type: 'ok',
          text:
            `${json.scanned} SIREN vérifié${json.scanned > 1 ? 's' : ''} · ` +
            (json.nouveaux > 0
              ? `${json.nouveaux} nouvelle${json.nouveaux > 1 ? 's' : ''} alerte${json.nouveaux > 1 ? 's' : ''}`
              : 'rien de nouveau') +
            (json.erreurs.length ? ` · ${json.erreurs.length} erreur(s)` : '')
        });
        await load();
        onScanned && onScanned();
      } else {
        setScanMsg({ type: 'err', text: json.error || 'Échec du scan BODACC.' });
      }
    } catch (e) {
      setScanMsg({ type: 'err', text: e.message });
    } finally {
      setScanning(false);
    }
  };

  const marquerLu = async (payload) => {
    try {
      await fetch(`${api}/bodacc/lu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      load();
    } catch {
      /* ignore : re-tentable au prochain clic */
    }
  };

  const nonLues = useMemo(() => annonces.filter((a) => a.lu === 0), [annonces]);

  const parNiveau = useMemo(() => {
    const n = { vendu: 0, critique: 0, important: 0, info: 0 };
    for (const a of annonces) if (n[a.niveau] != null) n[a.niveau]++;
    return n;
  }, [annonces]);

  const visibles = useMemo(
    () =>
      annonces.filter(
        (a) => (!filtreNiveau || a.niveau === filtreNiveau) && (!nonLuesSeules || a.lu === 0)
      ),
    [annonces, filtreNiveau, nonLuesSeules]
  );

  const chip = (key, label) => {
    const active = filtreNiveau === key;
    const cfg = key ? BODACC_NIVEAUX[key] : null;
    const count = key ? parNiveau[key] : annonces.length;
    return (
      <button
        key={key || 'tous'}
        onClick={() => setFiltreNiveau(active ? '' : key)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
          active ? 'border-marine bg-marine text-white' : 'border-gray-300 text-marine hover:bg-gray-50'
        }`}
      >
        {cfg ? `${cfg.emoji} ` : ''}
        {label} ({count})
      </button>
    );
  };

  return (
    <div>
      {/* En-tête : état de la veille + actions */}
      <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-marine">📰 Veille BODACC</h3>
          {nonLues.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {nonLues.length} alerte{nonLues.length > 1 ? 's' : ''} non lue{nonLues.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {checkedAt
              ? `Dernier scan : ${formatDateShort(checkedAt)} (automatique chaque jour)`
              : 'Jamais scanné'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {nonLues.length > 0 && (
              <button
                onClick={() => marquerLu({ all: true })}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
              >
                ✓ Tout marquer lu
              </button>
            )}
            <button
              onClick={scan}
              disabled={scanning}
              title="Interroge le BODACC (annonces officielles, gratuit) pour tous les sites avec un SIREN"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber text-amber hover:bg-amber/10 disabled:opacity-60"
            >
              {scanning ? '⟳ Scan en cours…' : '🔍 Scanner maintenant'}
            </button>
          </div>
        </div>
        {scanMsg && (
          <p className={`text-xs mt-2 ${scanMsg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
            {scanMsg.text}
          </p>
        )}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {chip('', 'Toutes')}
        {chip('vendu', 'Vendu/Radié')}
        {chip('critique', 'Critique')}
        {chip('important', 'Important')}
        {chip('info', 'Info')}
        <label className="ml-2 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={nonLuesSeules}
            onChange={(e) => setNonLuesSeules(e.target.checked)}
            className="accent-marine"
          />
          Non lues seulement
        </label>
      </div>

      {/* Journal */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">Chargement…</p>
        ) : visibles.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">
            {annonces.length === 0
              ? 'Aucune annonce en base : lance un scan pour interroger le BODACC.'
              : 'Aucune annonce ne correspond aux filtres.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200 bg-[#FCFBF9]">
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Signal</th>
                <th className="px-3 py-2.5 font-semibold">Site</th>
                <th className="px-3 py-2.5 font-semibold">Pharmacie</th>
                <th className="px-3 py-2.5 font-semibold">Détail</th>
                <th className="px-3 py-2.5 font-semibold w-20">Annonce</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => {
                const cfg = BODACC_NIVEAUX[a.niveau] || BODACC_NIVEAUX.info;
                const nonLue = a.lu === 0;
                return (
                  <tr
                    key={a.id}
                    className={`border-b border-gray-100 transition hover:bg-amber/5 ${
                      nonLue ? 'bg-amber/10 font-medium' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {formatDateShort(a.date_parution)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{ backgroundColor: cfg.bg, color: cfg.text }}
                      >
                        {cfg.emoji} {a.signal || a.famille_lib || cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpen(a.site_id)}
                        className="text-marine font-medium hover:underline text-left"
                      >
                        {a.cc || '—'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{a.pharmacie || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[380px]">
                      <span className="line-clamp-2" title={a.descriptif || ''}>
                        {a.descriptif || a.type_lib || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-amber hover:underline"
                        >
                          Voir ↗
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {nonLue && (
                        <button
                          type="button"
                          onClick={() => marquerLu({ ids: [a.id] })}
                          title="Marquer comme lu"
                          className="text-gray-300 hover:text-marine text-sm leading-none"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
