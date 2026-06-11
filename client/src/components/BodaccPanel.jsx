import { useState, useEffect, useCallback } from 'react';
import { BODACC_NIVEAUX, formatDateShort } from '../constants';

// Bandeau de veille BODACC : alertes non lues (ventes de fonds, procédures,
// modifications de capital / dirigeants…) sur les SIREN suivis, + bouton de
// scan manuel. Toujours visible sur Prospection / Pipeline (contrairement au
// bandeau relances) car il porte le bouton « Scanner ».
export default function BodaccPanel({ api, onOpen, onScanned }) {
  const [alertes, setAlertes] = useState([]);
  const [checkedAt, setCheckedAt] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState(null); // { type: 'ok'|'err', text }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${api}/bodacc/alertes`);
      const json = await res.json();
      if (json.success) {
        setAlertes(json.data);
        setCheckedAt(json.checked_at || '');
      }
    } catch {
      /* serveur injoignable : le bandeau reste vide */
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

  return (
    <div className="mb-5 bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-marine">📰 Veille BODACC</h3>
        {alertes.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="text-xs text-gray-400">
          {checkedAt ? `Dernier scan : ${formatDateShort(checkedAt)}` : 'Jamais scanné'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {alertes.length > 0 && (
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
        <p
          className={`text-xs mt-2 ${scanMsg.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}
        >
          {scanMsg.text}
        </p>
      )}

      {alertes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {alertes.map((a) => {
            const cfg = BODACC_NIVEAUX[a.niveau] || BODACC_NIVEAUX.info;
            return (
              <div
                key={a.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-amber hover:bg-amber/5 transition"
              >
                <button
                  type="button"
                  onClick={() => onOpen(a.site_id)}
                  className="flex items-center gap-2 text-left"
                  title={a.descriptif || ''}
                >
                  <span
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}
                  >
                    {cfg.emoji} {a.signal || a.famille_lib}
                  </span>
                  <span className="text-sm font-medium text-marine max-w-[180px] truncate">
                    {a.cc}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {formatDateShort(a.date_parution)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => marquerLu({ ids: [a.id] })}
                  title="Marquer comme lu"
                  className="text-gray-300 hover:text-marine text-sm leading-none"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
