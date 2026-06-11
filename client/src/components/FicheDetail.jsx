import { useState, useEffect, useRef, useCallback } from 'react';
import { STATUTS, STATUT_ORDER, ACTION_TYPES, BODACC_NIVEAUX, ageNumber, formatDate, formatDateShort, relanceStatus, RELANCE_STYLE } from '../constants';
import { Badge, ScoreBadge } from './TableauProspection';
import HistoriqueActions from './HistoriqueActions';

function InfoRow({ label, value, senior }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-100">
      <span className="text-xs font-semibold text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm ${senior ? 'text-red-600 font-bold' : 'text-marine'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function FicheDetail({ site, api, onClose, onUpdate, onEnriched, onEdit, onDelete }) {
  const [note, setNote] = useState(site.note_interne || '');
  const [noteStatus, setNoteStatus] = useState('idle'); // idle | saving | saved
  const [actions, setActions] = useState([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [showActionForm, setShowActionForm] = useState(false);
  const [showStatutMenu, setShowStatutMenu] = useState(false);
  const [form, setForm] = useState({ type: 'contact', auteur: '', contenu: '' });
  const [formError, setFormError] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState(null); // { type: 'ok'|'err', text }

  const [relanceAt, setRelanceAt] = useState(site.relance_at || '');
  const [relanceNote, setRelanceNote] = useState(site.relance_note || '');
  const [relanceSaved, setRelanceSaved] = useState(false);

  const [bodacc, setBodacc] = useState(null); // null = chargement
  const [bodaccCheckedAt, setBodaccCheckedAt] = useState('');
  const [bodaccChecking, setBodaccChecking] = useState(false);
  const [bodaccError, setBodaccError] = useState('');
  const hasSiren = String(site.siren || '').replace(/\D/g, '').length === 9;

  const debounceRef = useRef(null);
  const relanceDebounceRef = useRef(null);
  const ageSenior = ageNumber(site.age) != null && ageNumber(site.age) >= 60;

  // Recharge la note quand on change de site
  useEffect(() => {
    setNote(site.note_interne || '');
    setNoteStatus('idle');
    setRelanceAt(site.relance_at || '');
    setRelanceNote(site.relance_note || '');
    setRelanceSaved(false);
  }, [site.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActions = useCallback(async () => {
    setLoadingActions(true);
    try {
      const res = await fetch(`${api}/sites/${site.id}/actions`);
      const json = await res.json();
      if (json.success) setActions(json.data);
    } finally {
      setLoadingActions(false);
    }
  }, [api, site.id]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const loadBodacc = useCallback(async () => {
    try {
      const res = await fetch(`${api}/sites/${site.id}/bodacc`);
      const json = await res.json();
      if (json.success) {
        setBodacc(json.data);
        setBodaccCheckedAt(json.checked_at || '');
      }
    } catch {
      setBodacc([]);
    }
  }, [api, site.id]);

  useEffect(() => {
    setBodacc(null);
    setBodaccError('');
    loadBodacc();
  }, [loadBodacc]);

  // Vérification BODACC à la demande pour cette fiche : scan du SIREN puis
  // rechargement du site (le signal détecté entre dans le score).
  const checkBodacc = async () => {
    setBodaccChecking(true);
    setBodaccError('');
    try {
      const res = await fetch(`${api}/bodacc/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_ids: [site.id] })
      });
      const json = await res.json();
      if (!json.success) {
        setBodaccError(json.error || 'Échec de la vérification BODACC.');
        return;
      }
      if (json.erreurs && json.erreurs.length) {
        setBodaccError(json.erreurs[0].error);
      }
      await loadBodacc();
      const sres = await fetch(`${api}/sites/${site.id}`);
      const sjson = await sres.json();
      if (sjson.success) onEnriched && onEnriched(sjson.data);
    } catch (e) {
      setBodaccError(e.message);
    } finally {
      setBodaccChecking(false);
    }
  };

  // Autosave de la note interne (debounce 700ms)
  const onNoteChange = (val) => {
    setNote(val);
    setNoteStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await onUpdate(site.id, { note_interne: val });
      setNoteStatus('saved');
      setTimeout(() => setNoteStatus('idle'), 1500);
    }, 700);
  };

  const changeStatut = async (statut) => {
    setShowStatutMenu(false);
    await onUpdate(site.id, { statut });
  };

  const flashRelanceSaved = () => {
    setRelanceSaved(true);
    setTimeout(() => setRelanceSaved(false), 1500);
  };

  // Date de relance : enregistrement immédiat (choix discret)
  const onRelanceDateChange = async (val) => {
    setRelanceAt(val);
    await onUpdate(site.id, { relance_at: val });
    flashRelanceSaved();
  };

  // Note de relance : enregistrement différé (debounce 700ms)
  const onRelanceNoteChange = (val) => {
    setRelanceNote(val);
    if (relanceDebounceRef.current) clearTimeout(relanceDebounceRef.current);
    relanceDebounceRef.current = setTimeout(async () => {
      await onUpdate(site.id, { relance_note: val });
      flashRelanceSaved();
    }, 700);
  };

  const clearRelance = async () => {
    setRelanceAt('');
    setRelanceNote('');
    await onUpdate(site.id, { relance_at: '', relance_note: '' });
    flashRelanceSaved();
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichMsg(null);
    try {
      const res = await fetch(`${api}/sites/${site.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siren: site.siren })
      });
      const json = await res.json();
      if (json.success) {
        onEnriched && onEnriched(json.data);
        setEnrichMsg({
          type: 'ok',
          text: `Fiche enrichie (${json.source || 'annuaire des entreprises'}).`
        });
      } else {
        setEnrichMsg({ type: 'err', text: json.error || 'Échec de l\'enrichissement.' });
      }
    } catch (e) {
      setEnrichMsg({ type: 'err', text: e.message });
    } finally {
      setEnriching(false);
    }
  };

  const submitAction = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.contenu.trim()) {
      setFormError('Le contenu est obligatoire.');
      return;
    }
    try {
      const res = await fetch(`${api}/sites/${site.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (json.success) {
        setForm({ type: 'contact', auteur: form.auteur, contenu: '' });
        setShowActionForm(false);
        loadActions();
      } else {
        setFormError(json.error || 'Erreur');
      }
    } catch (e) {
      setFormError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 fade-anim" onClick={onClose} />

      {/* Drawer */}
      <aside className="relative drawer-anim w-full max-w-[560px] bg-cream h-full overflow-y-auto shadow-2xl">
        {/* Header drawer */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold">{site.cc}</h2>
                <Badge statut={site.statut} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {site.enseigne} · Dép. {site.departement || '—'} · MAJ {formatDate(site.date_maj)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-marine text-2xl leading-none px-1"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          {/* Actions rapides */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowStatutMenu((v) => !v)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                ⇄ Changer le statut
              </button>
              {showStatutMenu && (
                <div className="absolute left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-44">
                  {STATUT_ORDER.map((k) => (
                    <button
                      key={k}
                      onClick={() => changeStatut(k)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUTS[k].dot }} />
                      {STATUTS[k].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              ✎ Modifier la fiche
            </button>
            <button
              onClick={handleEnrich}
              disabled={enriching}
              title="Récupère dirigeants, âges, forme juridique, effectif… depuis le SIREN (annuaire des entreprises, gratuit)"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber text-amber hover:bg-amber/10 disabled:opacity-60"
            >
              {enriching ? '⟳ Enrichissement…' : '⟳ Enrichir (SIREN)'}
            </button>
            <button
              onClick={() => onDelete(site.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 ml-auto"
            >
              🗑 Supprimer
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Score d'opportunité */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Score d'opportunité
              </h3>
              <ScoreBadge score={site.score ?? 0} label={site.score_label} />
            </div>
            <ul className="flex flex-wrap gap-1.5 mt-2">
              {(site.score_reasons || []).map((r, i) => (
                <li
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-cream border border-gray-200 text-gray-600"
                >
                  {r}
                </li>
              ))}
            </ul>
          </section>

          {enrichMsg && (
            <div
              className={`px-4 py-2.5 rounded-lg text-sm border ${
                enrichMsg.type === 'ok'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {enrichMsg.text}
            </div>
          )}

          {/* Infos */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Informations</h3>
            <InfoRow label="SIREN" value={site.siren} />
            <InfoRow label="Pharmacie" value={site.pharmacie} />
            <InfoRow label="Dirigeant" value={site.dirigeant} />
            <InfoRow label="Âge" value={site.age} senior={ageSenior} />
            <InfoRow label="Groupement" value={site.groupement} />
            {(site.forme_juridique || site.capital || site.date_creation || site.effectif || site.chiffre_affaires) && (
              <>
                <InfoRow label="Forme jurid." value={site.forme_juridique} />
                <InfoRow label="Capital" value={site.capital} />
                <InfoRow label="CA" value={site.chiffre_affaires} />
                <InfoRow label="Effectif" value={site.effectif} />
                <InfoRow label="Création" value={site.date_creation} />
              </>
            )}
            {site.enriched_at && (
              <p className="text-[11px] text-gray-400 mt-2">
                Enrichi le {formatDate(site.enriched_at)} via Pappers
              </p>
            )}
            <div className="pt-2">
              <span className="text-xs font-semibold text-gray-400">Remarques</span>
              <p className="text-sm text-marine mt-1 whitespace-pre-wrap">{site.remarques || '—'}</p>
            </div>
          </section>

          {/* Veille BODACC */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
                📰 Annonces BODACC
              </h3>
              <div className="flex items-center gap-2">
                {bodaccCheckedAt && (
                  <span className="text-[11px] text-gray-400">
                    Vérifié le {formatDateShort(bodaccCheckedAt)}
                  </span>
                )}
                {hasSiren && (
                  <button
                    onClick={checkBodacc}
                    disabled={bodaccChecking}
                    title="Interroge le BODACC (annonces commerciales officielles, gratuit)"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber text-amber hover:bg-amber/10 disabled:opacity-60"
                  >
                    {bodaccChecking ? '⟳ Vérification…' : '⟳ Vérifier maintenant'}
                  </button>
                )}
              </div>
            </div>

            {bodaccError && <p className="text-xs text-red-600 mb-2">{bodaccError}</p>}

            {!hasSiren ? (
              <p className="text-sm text-gray-400">
                Renseigne un SIREN sur la fiche pour activer la veille BODACC.
              </p>
            ) : bodacc === null ? (
              <p className="text-sm text-gray-400">Chargement…</p>
            ) : bodacc.length === 0 ? (
              <p className="text-sm text-gray-400">
                Aucune annonce en mémoire — lance « Vérifier maintenant ».
              </p>
            ) : (
              <ul className="space-y-2">
                {bodacc.map((a) => {
                  const cfg = BODACC_NIVEAUX[a.niveau] || BODACC_NIVEAUX.info;
                  return (
                    <li key={a.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}
                        >
                          {cfg.emoji} {a.signal || a.famille_lib}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateShort(a.date_parution)}</span>
                        <span className="text-xs text-gray-400">{a.famille_lib}</span>
                        {a.url && (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-amber hover:underline ml-auto"
                          >
                            Voir l'avis ↗
                          </a>
                        )}
                      </div>
                      {a.descriptif && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-3" title={a.descriptif}>
                          {a.descriptif}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Note interne */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Note interne</h3>
              <span className="text-xs text-gray-400">
                {noteStatus === 'saving' && '💾 Enregistrement…'}
                {noteStatus === 'saved' && '✓ Enregistré'}
              </span>
            </div>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Notes privées modifiables (sauvegarde automatique)…"
              rows={4}
              className="w-full text-sm rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber resize-y"
            />
          </section>

          {/* Relance / rappel */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
                ⏰ Relance / rappel
              </h3>
              <span className="text-xs text-gray-400">{relanceSaved && '✓ Enregistré'}</span>
            </div>
            {(() => {
              const st = relanceStatus(relanceAt);
              return (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={relanceAt ? String(relanceAt).slice(0, 10) : ''}
                      onChange={(e) => onRelanceDateChange(e.target.value)}
                      className="px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber"
                    />
                    {st && (
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-lg"
                        style={{ backgroundColor: RELANCE_STYLE[st.kind].bg, color: RELANCE_STYLE[st.kind].text }}
                      >
                        {st.label}
                      </span>
                    )}
                    {relanceAt && (
                      <button
                        onClick={clearRelance}
                        className="text-xs text-gray-400 hover:text-red-600 ml-auto"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={relanceNote}
                    onChange={(e) => onRelanceNoteChange(e.target.value)}
                    placeholder="Objet du rappel (ex : rappeler le dirigeant, relancer après visite)…"
                    className="w-full mt-2 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber"
                  />
                </>
              );
            })()}
          </section>

          {/* Historique */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Historique des actions
              </h3>
              <button
                onClick={() => setShowActionForm((v) => !v)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-marine text-white hover:bg-[#262640]"
              >
                {showActionForm ? '× Annuler' : '+ Ajouter une action'}
              </button>
            </div>

            {showActionForm && (
              <form onSubmit={submitAction} className="bg-cream border border-gray-200 rounded-lg p-3 mb-4 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 bg-white"
                  >
                    {Object.entries(ACTION_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.emoji} {v.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={form.auteur}
                    onChange={(e) => setForm((f) => ({ ...f, auteur: e.target.value }))}
                    placeholder="Auteur"
                    className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-gray-300"
                  />
                </div>
                <textarea
                  value={form.contenu}
                  onChange={(e) => setForm((f) => ({ ...f, contenu: e.target.value }))}
                  placeholder="Contenu de l'action…"
                  rows={3}
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 resize-y"
                />
                {formError && <p className="text-xs text-red-600">{formError}</p>}
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber text-marine hover:brightness-95"
                >
                  Enregistrer l'action
                </button>
              </form>
            )}

            {loadingActions ? (
              <p className="text-sm text-gray-400">Chargement…</p>
            ) : (
              <HistoriqueActions actions={actions} />
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
