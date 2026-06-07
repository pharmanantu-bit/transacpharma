import { OPPORTUNITY_TYPES } from '../constants';

function Row({ label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-100">
      <span className="text-xs font-semibold text-gray-400 w-32 shrink-0 pt-0.5">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-marine break-words">{value}</span>
      )}
    </div>
  );
}

export default function CandidatDetail({ candidat, onClose, onImportOne, importing, onToggleSelection, selected }) {
  const c = candidat;
  const d = c.details || {};
  const cfg = OPPORTUNITY_TYPES[c.opportunite_type] || OPPORTUNITY_TYPES.acquisition;
  const typeLabel = c.type === 'hyper_isole' ? 'Hypermarché (galerie probable)' : 'Centre commercial';

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/30 fade-anim" onClick={onClose} />
      <aside className="relative drawer-anim w-full max-w-[540px] bg-cream h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold">{c.cc}</h2>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: cfg.bg, color: cfg.text }}
                >
                  {cfg.emoji} {cfg.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {typeLabel} · {c.ville || '—'} {c.code_postal ? `(${c.code_postal})` : ''} · Dép. {c.departement}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-marine text-2xl leading-none px-1">
              ×
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => onImportOne(c)}
              disabled={importing}
              className="px-3.5 py-2 text-sm font-bold rounded-lg bg-marine text-white hover:bg-[#262640] disabled:opacity-60"
            >
              {importing ? 'Ajout…' : '+ Ajouter à la prospection'}
            </button>
            <button
              onClick={() => onToggleSelection(c.osm_id)}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              {selected ? '✓ Dans la sélection' : '☐ Ajouter à la sélection'}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Centre commercial */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
              Centre commercial
            </h3>
            <Row label="Nom" value={c.cc} />
            <Row label="Type" value={typeLabel} />
            <Row label="Hypermarché" value={d.hyper && d.hyper.nom ? `${d.hyper.nom} (${c.enseigne})` : c.enseigne} />
            <Row
              label="Dist. hyper"
              value={d.hyper && d.hyper.distance_m != null && d.hyper.distance_m > 0 ? `${d.hyper.distance_m} m` : null}
            />
            <Row label="Opérateur" value={d.centre && d.centre.operator} />
            <Row label="Adresse" value={d.centre && d.centre.adresse} />
            <Row label="Ville" value={c.ville && `${c.ville} ${c.code_postal || ''}`.trim()} />
            <Row label="Horaires" value={d.centre && d.centre.opening_hours} />
            <Row label="Téléphone" value={d.centre && d.centre.phone} href={d.centre && d.centre.phone ? `tel:${d.centre.phone}` : null} />
            <Row label="Site web" value={d.centre && d.centre.website} href={d.centre && d.centre.website} />
            <Row label="Coordonnées" value={`${c.latitude}, ${c.longitude}`} />
            <div className="flex gap-3 pt-2 text-sm">
              {d.maps_url && (
                <a href={d.maps_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  📍 Google Maps
                </a>
              )}
              {d.osm_url && (
                <a href={d.osm_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  🗺️ OpenStreetMap
                </a>
              )}
            </div>
          </section>

          {/* Pharmacie */}
          <section className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Pharmacie</h3>
            {c.pharmacie_presente ? (
              <>
                <Row label="Présence" value="Oui — pharmacie à proximité" />
                <Row label="Nom" value={c.pharmacie_nom} />
                <Row
                  label="Distance"
                  value={c.pharmacie_distance_m != null ? `${c.pharmacie_distance_m} m du centre` : null}
                />
                <Row label="Adresse" value={d.pharmacie && d.pharmacie.adresse} />
                <Row label="Horaires" value={d.pharmacie && d.pharmacie.opening_hours} />
                <Row
                  label="Téléphone"
                  value={d.pharmacie && d.pharmacie.phone}
                  href={d.pharmacie && d.pharmacie.phone ? `tel:${d.pharmacie.phone}` : null}
                />
                <Row label="Site web" value={d.pharmacie && d.pharmacie.website} href={d.pharmacie && d.pharmacie.website} />
                <Row label="SIREN" value={c.siren} />
                {c.siren && (
                  <div className="pt-2 text-sm">
                    <a
                      href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${c.siren}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      🔎 Fiche société (annuaire des entreprises)
                    </a>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-green-700 font-medium">
                🟢 Aucune pharmacie détectée dans le rayon — opportunité de création.
              </p>
            )}
          </section>

          <p className="text-[11px] text-gray-400 leading-snug">
            Données OpenStreetMap (peuvent être incomplètes) · « à proximité » = dans le rayon de scan,
            pas forcément à l'intérieur de la galerie. Vérifie sur Maps avant de te déplacer.
          </p>
        </div>
      </aside>
    </div>
  );
}
