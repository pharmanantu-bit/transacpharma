// Veille BODACC — annonces commerciales officielles.
// API opendatasoft du BODACC (DILA) : gratuite, sans clé, comme les autres
// sources du projet. On y détecte les signaux de cession sur les SIREN suivis :
// ventes de fonds, procédures collectives, radiations, modifications
// (capital, forme juridique, dirigeants).

const API_URL =
  'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';

const NIVEAUX = { vendu: 4, critique: 3, important: 2, info: 1 };

function parseMaybe(s) {
  if (!s) return null;
  if (typeof s === 'object') return s;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Texte lisible de l'annonce selon sa famille (chaque famille remplit un
// champ JSON différent : modificationsgenerales, jugement, acte, radiation).
function extractDescriptif(r) {
  const mg = parseMaybe(r.modificationsgenerales);
  if (mg && mg.descriptif) return mg.descriptif;

  const j = parseMaybe(r.jugement);
  if (j) return [j.nature, j.complementJugement].filter(Boolean).join(' — ');

  const acte = parseMaybe(r.acte);
  if (acte) {
    const cat =
      (acte.vente && acte.vente.categorieVente) ||
      (acte.immatriculation && acte.immatriculation.categorieImmatriculation) ||
      (acte.creation && acte.creation.categorieCreation);
    return [cat, acte.descriptif].filter(Boolean).join(' — ');
  }

  const rad = parseMaybe(r.radiationaurcs);
  if (rad) return rad.commentaire || 'Radiation au RCS';

  return '';
}

// Classe une annonce en niveau d'alerte pour la prospection :
//   vendu     — signal rétrospectif : le fonds est vendu ou la société radiée,
//               le site n'est plus une cible (mais la base doit le refléter)
//   critique  — opportunité en cours (procédure collective, conciliation :
//               reprise à la barre / titulaire en difficulté)
//   important — signal avant-coureur (capital, forme juridique, dirigeants,
//               location-gérance : transmission qui se prépare)
//   info      — le reste (immatriculations, créations, modifications mineures)
function classify(famille, familleLib, descriptif) {
  const d = (descriptif || '').toLowerCase();
  const lib = (familleLib || '').toLowerCase();

  if (famille === 'vente' || lib.includes('vente'))
    return { niveau: 'vendu', signal: 'Vente / cession du fonds actée' };
  if (famille === 'collective' || lib.includes('collective'))
    return { niveau: 'critique', signal: 'Procédure collective' };
  if (lib.includes('conciliation') || lib.includes('rétablissement'))
    return { niveau: 'critique', signal: 'Procédure de conciliation' };
  if (famille === 'radiation' || lib.includes('radiation'))
    return { niveau: 'vendu', signal: 'Radiation au RCS' };

  if (famille === 'modification' || lib.includes('modification')) {
    if (/location[- ]g[ée]rance/.test(d))
      return { niveau: 'important', signal: 'Mise en location-gérance' };
    if (/cession|vente/.test(d))
      return { niveau: 'vendu', signal: 'Cession du fonds actée' };
    if (/fonds/.test(d)) return { niveau: 'important', signal: 'Opération sur le fonds' };
    if (/capital/.test(d)) return { niveau: 'important', signal: 'Modification du capital' };
    if (/forme juridique/.test(d))
      return { niveau: 'important', signal: 'Transformation juridique' };
    if (/administration|repr[ée]sentant|g[ée]rant|pr[ée]sident|dirigeant/.test(d))
      return { niveau: 'important', signal: 'Mouvement de dirigeant' };
    return { niveau: 'info', signal: 'Modification au RCS' };
  }

  return { niveau: 'info', signal: '' };
}

// Récupère les annonces BODACC d'un SIREN (hors dépôts de comptes, sans intérêt
// pour la prospection), normalisées et classées. Les plus récentes d'abord.
async function fetchAnnonces(siren) {
  const params = new URLSearchParams({
    where: `registre="${siren}" AND familleavis!="dpc"`,
    order_by: 'dateparution desc',
    limit: '50',
    select:
      'id,dateparution,familleavis,familleavis_lib,typeavis_lib,tribunal,commercant,modificationsgenerales,acte,jugement,radiationaurcs,url_complete'
  });
  const res = await fetch(`${API_URL}?${params}`, {
    headers: { 'User-Agent': 'TransacPharma/1.0 (pharmanantu@gmail.com)' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`BODACC HTTP ${res.status}`);
  const json = await res.json();

  return (json.results || []).map((r) => {
    const descriptif = extractDescriptif(r);
    const { niveau, signal } = classify(r.familleavis, r.familleavis_lib, descriptif);
    return {
      id: r.id,
      siren,
      date_parution: r.dateparution || '',
      famille: r.familleavis || '',
      famille_lib: r.familleavis_lib || '',
      type_lib: r.typeavis_lib || '',
      descriptif,
      niveau,
      signal,
      tribunal: r.tribunal || '',
      url: r.url_complete || ''
    };
  });
}

// Une annonce est « récente » (donc digne d'alerte / de points de score)
// si elle date de moins de maxMonths mois.
function isRecent(dateParution, maxMonths = 24) {
  if (!dateParution) return false;
  const d = new Date(String(dateParution).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  return (Date.now() - d.getTime()) / (30.44 * 86400000) <= maxMonths;
}

// Signal dominant d'une liste d'annonces : le plus sévère parmi les récents,
// à sévérité égale le plus récent. null si rien de notable.
function pickSignal(annonces, maxMonths = 24) {
  const candidates = annonces.filter(
    (a) => a.niveau !== 'info' && isRecent(a.date_parution, maxMonths)
  );
  candidates.sort(
    (a, b) =>
      NIVEAUX[b.niveau] - NIVEAUX[a.niveau] ||
      String(b.date_parution).localeCompare(String(a.date_parution))
  );
  return candidates[0] || null;
}

module.exports = { fetchAnnonces, pickSignal, isRecent };
