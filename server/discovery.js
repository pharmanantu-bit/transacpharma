// Découverte d'opportunités : centres commerciaux (galerie + hypermarché) et
// présence d'une pharmacie, via des APIs publiques gratuites (sans clé).
//   - geo.api.gouv.fr            : bounding box d'un département
//   - Overpass (OpenStreetMap)   : malls, hypermarchés, pharmacies
//   - recherche-entreprises.gouv : confirmation pharmacie + SIREN (NAF 4773Z)

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const RECHERCHE_API = 'https://recherche-entreprises.api.gouv.fr/search';

const { db } = require('./db');

// Liste des départements français (métropole + DOM)
const DEPARTEMENTS = [
  ['01', 'Ain'], ['02', 'Aisne'], ['03', 'Allier'], ['04', 'Alpes-de-Haute-Provence'],
  ['05', 'Hautes-Alpes'], ['06', 'Alpes-Maritimes'], ['07', 'Ardèche'], ['08', 'Ardennes'],
  ['09', 'Ariège'], ['10', 'Aube'], ['11', 'Aude'], ['12', 'Aveyron'],
  ['13', 'Bouches-du-Rhône'], ['14', 'Calvados'], ['15', 'Cantal'], ['16', 'Charente'],
  ['17', 'Charente-Maritime'], ['18', 'Cher'], ['19', 'Corrèze'], ['2A', 'Corse-du-Sud'],
  ['2B', 'Haute-Corse'], ['21', "Côte-d'Or"], ["22", "Côtes-d'Armor"], ['23', 'Creuse'],
  ['24', 'Dordogne'], ['25', 'Doubs'], ['26', 'Drôme'], ['27', 'Eure'],
  ['28', 'Eure-et-Loir'], ['29', 'Finistère'], ['30', 'Gard'], ['31', 'Haute-Garonne'],
  ['32', 'Gers'], ['33', 'Gironde'], ['34', 'Hérault'], ['35', 'Ille-et-Vilaine'],
  ['36', 'Indre'], ['37', 'Indre-et-Loire'], ['38', 'Isère'], ['39', 'Jura'],
  ['40', 'Landes'], ['41', 'Loir-et-Cher'], ['42', 'Loire'], ['43', 'Haute-Loire'],
  ['44', 'Loire-Atlantique'], ['45', 'Loiret'], ['46', 'Lot'], ['47', 'Lot-et-Garonne'],
  ['48', 'Lozère'], ['49', 'Maine-et-Loire'], ['50', 'Manche'], ['51', 'Marne'],
  ['52', 'Haute-Marne'], ['53', 'Mayenne'], ['54', 'Meurthe-et-Moselle'], ['55', 'Meuse'],
  ['56', 'Morbihan'], ['57', 'Moselle'], ['58', 'Nièvre'], ['59', 'Nord'],
  ['60', 'Oise'], ['61', 'Orne'], ['62', 'Pas-de-Calais'], ['63', 'Puy-de-Dôme'],
  ['64', 'Pyrénées-Atlantiques'], ['65', 'Hautes-Pyrénées'], ['66', 'Pyrénées-Orientales'],
  ['67', 'Bas-Rhin'], ['68', 'Haut-Rhin'], ['69', 'Rhône'], ['70', 'Haute-Saône'],
  ['71', 'Saône-et-Loire'], ['72', 'Sarthe'], ['73', 'Savoie'], ['74', 'Haute-Savoie'],
  ['75', 'Paris'], ['76', 'Seine-Maritime'], ['77', 'Seine-et-Marne'], ['78', 'Yvelines'],
  ['79', 'Deux-Sèvres'], ['80', 'Somme'], ['81', 'Tarn'], ['82', 'Tarn-et-Garonne'],
  ['83', 'Var'], ['84', 'Vaucluse'], ['85', 'Vendée'], ['86', 'Vienne'],
  ['87', 'Haute-Vienne'], ['88', 'Vosges'], ['89', 'Yonne'], ['90', 'Territoire de Belfort'],
  ['91', 'Essonne'], ['92', 'Hauts-de-Seine'], ['93', 'Seine-Saint-Denis'], ['94', 'Val-de-Marne'],
  ['95', "Val-d'Oise"], ['971', 'Guadeloupe'], ['972', 'Martinique'], ['973', 'Guyane'],
  ['974', 'La Réunion'], ['976', 'Mayotte']
];
const DEP_NAMES = Object.fromEntries(DEPARTEMENTS);

// Marques d'hypermarchés ciblées (shop=supermarket, on filtre par marque/nom)
const HYPER_BRAND_RE = /(carrefour|auchan|leclerc|g[ée]ant|casino|cora|intermarch[ée]|hyper\s*u|hyperu)/i;
// Formats de proximité à exclure (ce ne sont pas des hypermarchés)
const SMALL_FORMAT_RE = /(market|city|express|contact|proxi|u\s*express|utile|montagne|drive|station)/i;

function brandLabel(name = '', brand = '') {
  const s = (brand || name || '').toLowerCase();
  if (s.includes('carrefour')) return 'Carrefour';
  if (s.includes('auchan')) return 'Auchan';
  if (s.includes('leclerc')) return 'Leclerc';
  if (s.includes('géant') || s.includes('geant') || s.includes('casino')) return 'Géant Casino';
  if (s.includes('cora')) return 'Cora';
  if (s.includes('intermarch')) return 'Intermarché';
  if (s.includes('hyper u') || s.includes('hyperu')) return 'Hyper U';
  return brand || name || '';
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Requêtes Overpass via la zone administrative du département (ref:INSEE) ---
// admin_level=6 = département en France ; ref:INSEE = code (ex 31, 2A, 971).
// On segmente par catégorie : les requêtes combinées lourdes se font load-shed (504).
function areaQuery(code, body) {
  return `[out:json][timeout:90];
area["boundary"="administrative"]["admin_level"="6"]["ref:INSEE"="${code}"]->.dep;
(
${body}
);
out center tags;`;
}

const Q_MALLS = [
  '  node["shop"="mall"](area.dep);',
  '  way["shop"="mall"](area.dep);',
  '  relation["shop"="mall"](area.dep);',
  '  node["shop"="shopping_centre"](area.dep);',
  '  way["shop"="shopping_centre"](area.dep);',
  '  relation["shop"="shopping_centre"](area.dep);'
].join('\n');
const Q_SUPER = [
  '  node["shop"="supermarket"](area.dep);',
  '  way["shop"="supermarket"](area.dep);'
].join('\n');
const Q_PHARMA = [
  '  node["amenity"="pharmacy"](area.dep);',
  '  way["amenity"="pharmacy"](area.dep);'
].join('\n');

const USER_AGENT = 'TransacPharma/1.0 (prospection officines; pharmanantu@gmail.com)';

async function postOverpass(endpoint, query, timeout) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT
    },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(timeout)
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  return json.elements || [];
}

// Tentatives multiples sur l'endpoint principal (load-shedding 429/504 fréquent
// mais transitoire), puis bascule sur l'endpoint de secours.
async function runOverpass(query) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await postOverpass(OVERPASS_ENDPOINTS[0], query, 120000);
    } catch (e) {
      lastErr = e;
      await sleep(3000 * attempt);
    }
  }
  try {
    return await postOverpass(OVERPASS_ENDPOINTS[1], query, 90000);
  } catch (e) {
    lastErr = e;
  }
  throw lastErr || new Error('Overpass injoignable');
}

function coordOf(el) {
  if (typeof el.lat === 'number') return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

// --- Confirmation SIREN d'une pharmacie via recherche-entreprises ---
async function findPharmacieSiren(nom, codePostal, dep) {
  try {
    const q = nom && nom.trim().length > 2 ? nom.trim() : '';
    if (!q) return null; // sans nom de pharmacie, la recherche n'est pas fiable
    const params = new URLSearchParams({ q, per_page: '3' });
    if (codePostal) params.set('code_postal', codePostal);
    else if (dep) params.set('departement', dep);
    const res = await fetch(`${RECHERCHE_API}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = (json.results || [])[0];
    if (!r) return null;
    return { siren: r.siren || null, nom_complet: r.nom_complet || null };
  } catch {
    return null;
  }
}

// --- Récupération OSM brute (partie lente : Overpass) ---
async function fetchOSM(code) {
  // 3 requêtes séparées (plus légères, moins de load-shedding) avec pauses
  const mallEls = await runOverpass(areaQuery(code, Q_MALLS));
  await sleep(900);
  const superEls = await runOverpass(areaQuery(code, Q_SUPER));
  await sleep(900);
  const pharmaEls = await runOverpass(areaQuery(code, Q_PHARMA));

  const malls = [];
  const hypers = [];
  const pharmacies = [];
  for (const el of [...mallEls, ...superEls, ...pharmaEls]) {
    const tags = el.tags || {};
    const pos = coordOf(el);
    if (!pos) continue;
    const item = { id: `${el.type}/${el.id}`, ...pos, tags };
    if (tags.shop === 'mall' || tags.shop === 'shopping_centre') {
      malls.push(item);
    } else if (tags.shop === 'supermarket') {
      const label = `${tags.brand || ''} ${tags.name || ''}`;
      if (HYPER_BRAND_RE.test(label) && !SMALL_FORMAT_RE.test(label)) hypers.push(item);
    } else if (tags.amenity === 'pharmacy') {
      pharmacies.push(item);
    }
  }
  return { malls, hypers, pharmacies };
}

// --- Construction des candidats (rapide) + confirmation SIREN ---
async function buildCandidats(osm, code, radius) {
  const { malls, hypers, pharmacies } = osm;

  const nearestPharma = (lat, lon) => {
    let best = null;
    for (const p of pharmacies) {
      const d = haversine(lat, lon, p.lat, p.lon);
      if (d <= radius && (!best || d < best.d)) best = { d, p };
    }
    return best;
  };
  const nearestHyper = (lat, lon) => {
    let best = null;
    for (const h of hypers) {
      const d = haversine(lat, lon, h.lat, h.lon);
      if (d <= radius && (!best || d < best.d)) best = { d, h };
    }
    return best;
  };

  const candidats = [];
  const usedHypers = new Set();

  // 1) Centres commerciaux (mall) avec un hypermarché à proximité
  for (const m of malls) {
    const nh = nearestHyper(m.lat, m.lon);
    if (!nh) continue; // on ne garde que les galeries avec hyper
    usedHypers.add(nh.h.id);
    const t = m.tags;
    candidats.push(makeCandidat({
      anchor: m,
      type: 'centre_commercial',
      cc: t.name || `Centre commercial ${t['addr:city'] || ''}`.trim(),
      enseigne: brandLabel(nh.h.tags.name, nh.h.tags.brand),
      code,
      radius
    }, nearestPharma(m.lat, m.lon), nh));
  }

  // 2) Hypermarchés isolés (galerie souvent attenante, non taggée mall dans OSM)
  for (const h of hypers) {
    if (usedHypers.has(h.id)) continue;
    candidats.push(makeCandidat({
      anchor: h,
      type: 'hyper_isole',
      cc: h.tags.name || `${brandLabel(h.tags.name, h.tags.brand)} ${h.tags['addr:city'] || ''}`.trim(),
      enseigne: brandLabel(h.tags.name, h.tags.brand),
      code,
      radius
    }, nearestPharma(h.lat, h.lon), null));
  }

  // 3) Confirmation SIREN pour les candidats avec pharmacie (throttle, max 25)
  let lookups = 0;
  for (const c of candidats) {
    if (c.pharmacie_presente && lookups < 25) {
      lookups++;
      const found = await findPharmacieSiren(c.pharmacie_nom, c.code_postal, c.departement);
      if (found) {
        c.siren = found.siren;
        if (!c.pharmacie_nom && found.nom_complet) c.pharmacie_nom = found.nom_complet;
      }
      finalizeStatut(c);
      await sleep(170);
    }
  }
  return candidats;
}

function makeCandidat({ anchor, type, cc, enseigne, code, radius }, pharmaHit, hyperHit) {
  const t = anchor.tags;
  const pt = pharmaHit ? pharmaHit.p.tags : {};
  // Les nœuds centre/hyper OSM manquent souvent d'adresse → on complète avec
  // celle de la pharmacie trouvée à proximité (utile pour l'affichage + le SIREN).
  const ville = t['addr:city'] || pt['addr:city'] || '';
  const codePostal = t['addr:postcode'] || pt['addr:postcode'] || '';
  const hyperTags = hyperHit ? hyperHit.h.tags : type === 'hyper_isole' ? t : {};

  const details = {
    centre: {
      operator: t.operator || t.brand || '',
      website: t.website || t['contact:website'] || '',
      opening_hours: t.opening_hours || '',
      phone: t.phone || t['contact:phone'] || '',
      adresse: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
      wikidata: t.wikidata || '',
      wikipedia: t.wikipedia || ''
    },
    hyper: {
      nom: hyperTags.name || '',
      enseigne,
      distance_m: hyperHit ? hyperHit.d : type === 'hyper_isole' ? 0 : null
    },
    pharmacie: pharmaHit
      ? {
          nom: pt.name || '',
          distance_m: pharmaHit.d,
          phone: pt.phone || pt['contact:phone'] || '',
          opening_hours: pt.opening_hours || '',
          website: pt.website || pt['contact:website'] || '',
          adresse: [pt['addr:housenumber'], pt['addr:street'], pt['addr:postcode'], pt['addr:city']]
            .filter(Boolean)
            .join(' ')
        }
      : null,
    osm_url: `https://www.openstreetmap.org/${anchor.id}`,
    maps_url: `https://www.google.com/maps/search/?api=1&query=${anchor.lat},${anchor.lon}`
  };

  const c = {
    osm_id: anchor.id,
    cc: cc || 'Centre commercial',
    ville,
    code_postal: codePostal,
    departement: code,
    enseigne,
    latitude: anchor.lat,
    longitude: anchor.lon,
    type,
    pharmacie_presente: !!pharmaHit,
    pharmacie_nom: pharmaHit ? pt.name || '' : '',
    pharmacie_distance_m: pharmaHit ? pharmaHit.d : null,
    siren: '',
    opportunite_type: pharmaHit ? 'acquisition' : 'creation',
    radius,
    details
  };
  finalizeStatut(c);
  return c;
}

function finalizeStatut(c) {
  if (!c.pharmacie_presente) c.statut = 'opp';
  else c.statut = c.siren ? 'cible' : 'todo';
}

// --- Cache persistant en base (les données OSM changent rarement) ---
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

function readCache(code) {
  return db.prepare('SELECT * FROM discovery_cache WHERE departement = ?').get(code);
}
function writeCache(code, osm, candidats, radius) {
  db.prepare(`
    INSERT INTO discovery_cache (departement, scanned_at, radius, osm_json, candidats_json)
    VALUES (@departement, @scanned_at, @radius, @osm_json, @candidats_json)
    ON CONFLICT(departement) DO UPDATE SET
      scanned_at = excluded.scanned_at, radius = excluded.radius,
      osm_json = excluded.osm_json, candidats_json = excluded.candidats_json
  `).run({
    departement: code,
    scanned_at: new Date().toISOString(),
    radius,
    osm_json: JSON.stringify(osm),
    candidats_json: JSON.stringify(candidats)
  });
}

// Scan d'un département. Mode renvoyé dans `cached` :
//   true        -> servi tel quel depuis le cache (instantané)
//   'recompute' -> OSM en cache, recalcul rapide (rayon changé)
//   false       -> requêtes Overpass effectuées
async function scanDepartement(code, radius = 300, forceRefresh = false) {
  const row = readCache(code);
  const fresh = row && Date.now() - new Date(row.scanned_at).getTime() < CACHE_TTL;

  if (row && fresh && !forceRefresh) {
    if (row.radius === radius) {
      return {
        departement: code, status: 'ok', cached: true,
        scanned_at: row.scanned_at, candidats: JSON.parse(row.candidats_json)
      };
    }
    // Rayon différent : recalcul depuis l'OSM en cache (aucun appel Overpass)
    const osm = JSON.parse(row.osm_json);
    const candidats = await buildCandidats(osm, code, radius);
    writeCache(code, osm, candidats, radius);
    return { departement: code, status: 'ok', cached: 'recompute', scanned_at: row.scanned_at, candidats };
  }

  // Pas de cache / périmé / forcé : on interroge Overpass
  const osm = await fetchOSM(code);
  const candidats = await buildCandidats(osm, code, radius);
  writeCache(code, osm, candidats, radius);
  return {
    departement: code, status: 'ok', cached: false,
    scanned_at: new Date().toISOString(), candidats
  };
}

async function scanDepartements(codes, radius = 300, forceRefresh = false) {
  const results = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    let res;
    try {
      res = await scanDepartement(code, radius, forceRefresh);
    } catch (e) {
      res = { departement: code, status: 'error', error: e.message };
    }
    results.push(res);
    // Pause anti-quota uniquement si on a réellement interrogé Overpass
    if (i < codes.length - 1 && res.cached === false) await sleep(1500);
  }
  return results;
}

function listDepartements() {
  return DEPARTEMENTS.map(([code, nom]) => ({ code, nom }));
}

module.exports = { scanDepartements, listDepartements, DEP_NAMES };
