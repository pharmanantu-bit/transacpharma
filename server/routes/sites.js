const express = require('express');
const ExcelJS = require('exceljs');
const router = express.Router();
const { db } = require('../db');
const { computeScore } = require('../scoring');

const FIELDS = [
  'cc', 'departement', 'enseigne', 'siren', 'pharmacie',
  'dirigeant', 'age', 'groupement', 'statut', 'remarques', 'note_interne',
  'relance_at', 'relance_note'
];

// Ajoute le score calculé à une ligne renvoyée par l'API
function withScore(row) {
  if (!row) return row;
  const s = computeScore(row);
  return { ...row, score: s.score, score_label: s.label, score_reasons: s.reasons };
}

// ---------- Enrichissement Pappers (helpers) ----------
function frEuro(n) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString('fr-FR') + ' €';
}

function ageFromBirth(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const a = new Date().getFullYear() - year;
  return a >= 18 && a <= 110 ? a : null;
}

function mapPappers(d) {
  const reps = Array.isArray(d.representants) ? d.representants : [];
  const names = [];
  const ages = [];
  for (const r of reps) {
    const name = r.nom_complet || [r.prenom, r.nom].filter(Boolean).join(' ').trim();
    if (name) names.push(name);
    const birth = r.date_de_naissance_rgpd || r.date_de_naissance_formate || r.date_de_naissance;
    const a = ageFromBirth(birth);
    if (a) ages.push(a);
  }

  let ca = '';
  if (Array.isArray(d.finances) && d.finances.length) {
    const sorted = [...d.finances].sort((a, b) => (b.annee || 0) - (a.annee || 0));
    const latest = sorted.find((f) => f.chiffre_affaires != null);
    if (latest) ca = frEuro(latest.chiffre_affaires);
  } else if (d.chiffre_affaires != null) {
    ca = frEuro(d.chiffre_affaires);
  }

  return {
    denomination: d.nom_entreprise || d.denomination || '',
    dirigeant: names.join(' + '),
    age: ages.join('/'),
    capital: d.capital != null ? frEuro(d.capital) : '',
    forme_juridique: d.forme_juridique || d.libelle_forme_juridique || '',
    date_creation: d.date_creation_formate || d.date_creation || '',
    effectif: d.effectif || d.tranche_effectif || '',
    chiffre_affaires: ca
  };
}

// ---------- Enrichissement gratuit (annuaire des entreprises) ----------
// recherche-entreprises.api.gouv.fr : données officielles INSEE/INPI, sans clé.
const NATURE_JURIDIQUE = {
  '1000': 'Entrepreneur individuel',
  '5410': 'SARL', '5499': 'SARL', '5498': 'SARL (associé unique)',
  '5485': 'SELARL', '5470': 'SELARL',
  '5710': 'SAS', '5720': 'SASU',
  '5785': 'SELAS', '5775': 'SELAFA', '5770': 'SELAFA',
  '6540': 'SCI', '5202': 'SNC'
};
const EFFECTIF = {
  '00': '0 salarié', '01': '1-2 salariés', '02': '3-5 salariés', '03': '6-9 salariés',
  '11': '10-19 salariés', '12': '20-49 salariés', '21': '50-99 salariés', '22': '100-199 salariés',
  '31': '200-249 salariés', '32': '250-499 salariés', '41': '500-999 salariés',
  '42': '1000-1999 salariés', '51': '2000-4999 salariés', '52': '5000-9999 salariés', '53': '10000+ salariés'
};
const DIRIGEANT_RE = /g[ée]rant|pr[ée]sident|directeur|associ[ée]|exploitant|titulaire/i;

async function enrichFromGouv(siren) {
  const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}`, {
    headers: { 'User-Agent': 'TransacPharma/1.0 (pharmanantu@gmail.com)' },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return null;
  const json = await res.json();
  // Correspondance EXACTE sur le SIREN demandé. Pas de repli sur le 1er résultat :
  // mieux vaut « aucune donnée » qu'une société au hasard (dirigeant/âge faux).
  const e = (json.results || []).find((r) => r.siren === siren);
  if (!e) return null;

  const dirs = (e.dirigeants || []).filter(
    (d) =>
      d.type_dirigeant === 'personne physique' &&
      DIRIGEANT_RE.test(d.qualite || '') &&
      !/commissaire/i.test(d.qualite || '')
  );
  const names = [];
  const ages = [];
  for (const d of dirs) {
    const nm = [d.prenoms, d.nom].filter(Boolean).join(' ').trim();
    if (nm && !names.includes(nm)) names.push(nm);
    const y = parseInt(d.annee_de_naissance, 10);
    if (y) {
      const a = new Date().getFullYear() - y;
      if (a >= 18 && a <= 110) ages.push(a);
    }
  }

  let ca = '';
  if (e.finances) {
    for (const y of Object.keys(e.finances).sort().reverse()) {
      if (e.finances[y] && e.finances[y].ca > 0) {
        ca = frEuro(e.finances[y].ca);
        break;
      }
    }
  }

  return {
    denomination: e.nom_complet || '',
    dirigeant: names.join(' + '),
    age: ages.join('/'),
    capital: '',
    forme_juridique: NATURE_JURIDIQUE[e.nature_juridique] || (e.nature_juridique ? `Forme ${e.nature_juridique}` : ''),
    date_creation: e.date_creation || '',
    effectif: EFFECTIF[e.tranche_effectif_salarie] || '',
    chiffre_affaires: ca
  };
}

// Pappers (optionnel, seulement si une clé est configurée) — complète capital / CA
async function enrichFromPappers(siren, token) {
  const url = `https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(token)}&siren=${siren}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) return null;
  return mapPappers(await resp.json());
}

// Fusion : on garde la donnée gratuite (officielle), on comble les trous avec Pappers
function mergeEnrich(base, extra) {
  if (!extra) return base;
  const out = { ...base };
  for (const k of Object.keys(extra)) {
    if (!out[k] && extra[k]) out[k] = extra[k];
  }
  return out;
}

// ---------- Routes ----------

// Construit la requête SELECT filtrée (statut, enseigne, departement, q),
// partagée par la liste et les exports pour qu'ils restent cohérents.
function filteredSitesQuery(query) {
  const { statut, enseigne, departement, q } = query || {};
  let sql = 'SELECT * FROM sites WHERE 1=1';
  const params = [];

  if (statut) { sql += ' AND statut = ?'; params.push(statut); }
  if (enseigne) { sql += ' AND enseigne = ?'; params.push(enseigne); }
  if (departement) { sql += ' AND departement = ?'; params.push(departement); }
  if (q) {
    sql += ' AND (cc LIKE ? OR pharmacie LIKE ? OR dirigeant LIKE ? OR remarques LIKE ? OR groupement LIKE ? OR siren LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  sql += ' ORDER BY id ASC';
  return { sql, params };
}

// GET /api/sites — liste avec filtres optionnels (statut, enseigne, departement, q)
router.get('/sites', async (req, res) => {
  try {
    const { sql, params } = filteredSitesQuery(req.query);
    const rows = (await db.prepare(sql).all(...params)).map(withScore);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/sites/:id — détail
router.get('/sites/:id', async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Site introuvable' });
    res.json({ success: true, data: withScore(row) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sites — créer
router.post('/sites', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.cc || !b.cc.trim()) {
      return res.status(400).json({ success: false, error: 'Le champ "CC" est obligatoire' });
    }
    const now = new Date().toISOString();
    const data = {};
    for (const f of FIELDS) data[f] = b[f] != null ? String(b[f]) : '';
    if (!data.statut) data.statut = 'todo';

    const stmt = db.prepare(`
      INSERT INTO sites
        (cc, departement, enseigne, siren, pharmacie, dirigeant, age, groupement, statut, remarques, note_interne, date_maj, created_at)
      VALUES
        (@cc, @departement, @enseigne, @siren, @pharmacie, @dirigeant, @age, @groupement, @statut, @remarques, @note_interne, @date_maj, @created_at)
    `);
    const info = await stmt.run({ ...data, date_maj: now, created_at: now });
    const row = await db.prepare('SELECT * FROM sites WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: withScore(row) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sites/batch — import en masse (depuis la Découverte)
router.post('/sites/batch', async (req, res) => {
  try {
    const b = req.body || {};
    const sites = Array.isArray(b.sites) ? b.sites : [];
    if (sites.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun site à importer' });
    }
    const now = new Date().toISOString();

    // Déduplication applicative (nom + ville) en plus de l'index unique osm_id
    const existing = await db.prepare('SELECT cc, ville FROM sites').all();
    const key = (cc, ville) => `${(cc || '').toLowerCase().trim()}|${(ville || '').toLowerCase().trim()}`;
    const seen = new Set(existing.map((r) => key(r.cc, r.ville)));

    const insert = db.prepare(`
      INSERT OR IGNORE INTO sites
        (cc, ville, departement, enseigne, siren, pharmacie, statut, remarques, note_interne,
         latitude, longitude, osm_id, source, opportunite_type, date_maj, created_at)
      VALUES
        (@cc, @ville, @departement, @enseigne, @siren, @pharmacie, @statut, @remarques, '',
         @latitude, @longitude, @osm_id, @source, @opportunite_type, @date_maj, @created_at)
    `);

    const insertedIds = [];
    let skipped = 0;
    for (const r of sites) {
      const cc = (r.cc || '').toString().trim();
      if (!cc) { skipped++; continue; }
      const ville = (r.ville || '').toString().trim();
      const k = key(cc, ville);
      if (seen.has(k)) { skipped++; continue; }

      const dist = r.pharmacie_distance_m;
      const remarques = r.remarques
        ? String(r.remarques)
        : `Découverte OSM · ${r.opportunite_type === 'creation' ? 'opportunité création' : 'pharmacie existante'}` +
          (dist != null ? ` · pharmacie à ${dist} m` : '');

      const info = await insert.run({
        cc,
        ville,
        departement: (r.departement || '').toString(),
        enseigne: (r.enseigne || '').toString(),
        siren: (r.siren || '').toString(),
        pharmacie: (r.pharmacie || r.pharmacie_nom || '').toString(),
        statut: r.statut || (r.opportunite_type === 'creation' ? 'opp' : 'todo'),
        remarques,
        latitude: typeof r.latitude === 'number' ? r.latitude : parseFloat(r.latitude) || null,
        longitude: typeof r.longitude === 'number' ? r.longitude : parseFloat(r.longitude) || null,
        osm_id: r.osm_id ? String(r.osm_id) : null,
        source: r.source || 'discovery',
        opportunite_type: r.opportunite_type || '',
        date_maj: now,
        created_at: now
      });
      if (info.changes > 0) {
        insertedIds.push(info.lastInsertRowid);
        seen.add(k);
      } else {
        skipped++; // bloqué par l'index unique osm_id
      }
    }

    const rows = insertedIds.length
      ? (await db
          .prepare(`SELECT * FROM sites WHERE id IN (${insertedIds.map(() => '?').join(',')})`)
          .all(...insertedIds)
        ).map(withScore)
      : [];
    res.status(201).json({ success: true, inserted: insertedIds.length, skipped, sites: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/sites/:id — mise à jour (partielle ou complète)
router.put('/sites/:id', async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Site introuvable' });

    const b = req.body || {};
    const updates = [];
    const params = [];
    for (const f of FIELDS) {
      if (f in b) {
        updates.push(`${f} = ?`);
        params.push(b[f] != null ? String(b[f]) : '');
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à mettre à jour' });
    }
    updates.push('date_maj = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    await db.prepare(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const row = await db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: withScore(row) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/sites/:id
router.delete('/sites/:id', async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Site introuvable' });
    await db.prepare('DELETE FROM actions WHERE site_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sites/:id/enrich — enrichissement via l'annuaire des entreprises
// (gratuit, sans clé), complété par Pappers seulement si une clé est configurée.
router.post('/sites/:id/enrich', async (req, res) => {
  try {
    const site = await db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site introuvable' });

    const sirenRaw = (req.body && req.body.siren) || site.siren || '';
    const siren = String(sirenRaw).replace(/\D/g, '');
    if (siren.length !== 9) {
      return res.status(400).json({
        success: false,
        error: 'SIREN invalide : 9 chiffres requis. Renseigne d\'abord le SIREN sur la fiche.'
      });
    }

    // 1) Source gratuite officielle (INSEE/INPI)
    let m;
    try {
      m = await enrichFromGouv(siren);
    } catch (e) {
      return res
        .status(502)
        .json({ success: false, error: 'Annuaire des entreprises injoignable : ' + e.message });
    }
    if (!m) {
      return res.status(404).json({ success: false, error: 'Aucune entreprise trouvée pour ce SIREN.' });
    }
    let source = 'annuaire-entreprises';

    // 2) Pappers si une clé est configurée : source PRIORITAIRE (dirigeants/âges
    //    complets, capital, CA détaillé). L'annuaire gratuit comble les trous.
    const token = process.env.PAPPERS_API_TOKEN;
    if (token) {
      try {
        const p = await enrichFromPappers(siren, token);
        if (p) {
          m = mergeEnrich(p, m); // p (Pappers) gagne, m (annuaire) en secours
          source = 'pappers + annuaire';
        }
      } catch {
        /* on conserve la donnée gratuite */
      }
    }

    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE sites SET
        siren = ?,
        dirigeant = CASE WHEN ? <> '' THEN ? ELSE dirigeant END,
        age = CASE WHEN ? <> '' THEN ? ELSE age END,
        capital = ?,
        forme_juridique = ?,
        date_creation = ?,
        effectif = ?,
        chiffre_affaires = ?,
        enriched_at = ?,
        date_maj = ?
      WHERE id = ?
    `).run(
      siren,
      m.dirigeant, m.dirigeant,
      m.age, m.age,
      m.capital, m.forme_juridique, m.date_creation, m.effectif, m.chiffre_affaires,
      now, now, req.params.id
    );

    const row = await db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: withScore(row), source });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Colonnes exportées (clé technique + en-tête lisible), partagées CSV + Excel.
const EXPORT_COLS = [
  { key: 'id', label: 'ID' },
  { key: 'cc', label: 'CC' },
  { key: 'departement', label: 'Dép' },
  { key: 'enseigne', label: 'Enseigne' },
  { key: 'siren', label: 'SIREN' },
  { key: 'pharmacie', label: 'Pharmacie' },
  { key: 'dirigeant', label: 'Dirigeant' },
  { key: 'age', label: 'Âge' },
  { key: 'groupement', label: 'Groupement' },
  { key: 'statut', label: 'Statut' },
  { key: 'score', label: 'Score' },
  { key: 'score_label', label: 'Niveau' },
  { key: 'capital', label: 'Capital' },
  { key: 'forme_juridique', label: 'Forme juridique' },
  { key: 'date_creation', label: 'Création' },
  { key: 'effectif', label: 'Effectif' },
  { key: 'chiffre_affaires', label: 'CA' },
  { key: 'relance_at', label: 'Relance le' },
  { key: 'relance_note', label: 'Note relance' },
  { key: 'remarques', label: 'Remarques' },
  { key: 'note_interne', label: 'Note interne' },
  { key: 'enriched_at', label: 'Enrichi le' },
  { key: 'date_maj', label: 'Maj le' },
  { key: 'created_at', label: 'Créé le' }
];

// Lignes filtrées + scorées, utilisées par les deux exports.
async function exportRows(query) {
  const { sql, params } = filteredSitesQuery(query);
  return (await db.prepare(sql).all(...params)).map(withScore);
}

// GET /api/export/csv — respecte les filtres actifs (statut, enseigne, departement, q)
router.get('/export/csv', async (req, res) => {
  try {
    const rows = await exportRows(req.query);
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = EXPORT_COLS.map((c) => c.label).join(';');
    const lines = rows.map((r) => EXPORT_COLS.map((c) => escape(r[c.key])).join(';'));
    const csv = '﻿' + [header, ...lines].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transacpharma_export.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/export/xlsx — vrai fichier Excel mis en forme (respecte les filtres)
router.get('/export/xlsx', async (req, res) => {
  try {
    const rows = await exportRows(req.query);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'TransacPharma';
    const ws = wb.addWorksheet('Prospection', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    ws.columns = EXPORT_COLS.map((c) => ({
      header: c.label,
      key: c.key,
      width: Math.min(Math.max(c.label.length + 2, 10), 40)
    }));

    // En-tête : fond marine, texte ambre, gras
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFE8A838' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2B45' } };
    head.alignment = { vertical: 'middle' };
    head.height = 20;

    // Couleur de fond du score selon le niveau (Chaud/Tiède/Froid/Exclu)
    const SCORE_FILL = {
      Chaud: 'FFFCE0E0',
      Tiède: 'FFFDEBC8',
      Froid: 'FFE5EAF1',
      Exclu: 'FFE5E7EB'
    };

    for (const r of rows) {
      const row = ws.addRow(r);
      const fill = SCORE_FILL[r.score_label];
      if (fill) {
        const cell = row.getCell('score');
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
      }
    }

    ws.autoFilter = { from: 'A1', to: { row: 1, column: EXPORT_COLS.length } };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="transacpharma_export.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
