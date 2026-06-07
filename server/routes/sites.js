const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { computeScore } = require('../scoring');

const FIELDS = [
  'cc', 'departement', 'enseigne', 'siren', 'pharmacie',
  'dirigeant', 'age', 'groupement', 'statut', 'remarques', 'note_interne'
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

// ---------- Routes ----------

// GET /api/sites — liste avec filtres optionnels (statut, enseigne, departement, q)
router.get('/sites', (req, res) => {
  try {
    const { statut, enseigne, departement, q } = req.query;
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

    const rows = db.prepare(sql).all(...params).map(withScore);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/sites/:id — détail
router.get('/sites/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Site introuvable' });
    res.json({ success: true, data: withScore(row) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sites — créer
router.post('/sites', (req, res) => {
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
    const info = stmt.run({ ...data, date_maj: now, created_at: now });
    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: withScore(row) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sites/batch — import en masse (depuis la Découverte)
router.post('/sites/batch', (req, res) => {
  try {
    const b = req.body || {};
    const sites = Array.isArray(b.sites) ? b.sites : [];
    if (sites.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun site à importer' });
    }
    const now = new Date().toISOString();

    // Déduplication applicative (nom + ville) en plus de l'index unique osm_id
    const existing = db.prepare('SELECT cc, ville FROM sites').all();
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
    const tx = db.transaction((rows) => {
      for (const r of rows) {
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

        const info = insert.run({
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
    });
    tx(sites);

    const rows = insertedIds.length
      ? db
          .prepare(`SELECT * FROM sites WHERE id IN (${insertedIds.map(() => '?').join(',')})`)
          .all(...insertedIds)
          .map(withScore)
      : [];
    res.status(201).json({ success: true, inserted: insertedIds.length, skipped, sites: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/sites/:id — mise à jour (partielle ou complète)
router.put('/sites/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
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

    db.prepare(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: withScore(row) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/sites/:id
router.delete('/sites/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Site introuvable' });
    db.prepare('DELETE FROM actions WHERE site_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sites/:id/enrich — enrichissement via l'API Pappers (SIREN)
router.post('/sites/:id/enrich', async (req, res) => {
  try {
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site introuvable' });

    const sirenRaw = (req.body && req.body.siren) || site.siren || '';
    const siren = String(sirenRaw).replace(/\D/g, '');
    if (siren.length !== 9) {
      return res.status(400).json({
        success: false,
        error: 'SIREN invalide : 9 chiffres requis. Renseigne d\'abord le SIREN sur la fiche.'
      });
    }

    const token = process.env.PAPPERS_API_TOKEN;
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Clé API Pappers absente. Crée un compte gratuit sur pappers.fr/api puis définis la variable d\'environnement PAPPERS_API_TOKEN avant de relancer le serveur.'
      });
    }

    const url = `https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(token)}&siren=${siren}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return res.status(502).json({
        success: false,
        error: `Pappers a répondu ${resp.status}. ${txt.slice(0, 200)}`
      });
    }
    const data = await resp.json();
    const m = mapPappers(data);
    const now = new Date().toISOString();

    db.prepare(`
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

    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: withScore(row), source: m });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/export/csv — export complet (avec score)
router.get('/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM sites ORDER BY id ASC').all();
    const cols = [
      'id', 'cc', 'departement', 'enseigne', 'siren', 'pharmacie',
      'dirigeant', 'age', 'groupement', 'statut', 'score', 'score_label',
      'capital', 'forme_juridique', 'date_creation', 'effectif', 'chiffre_affaires',
      'remarques', 'note_interne', 'enriched_at', 'date_maj', 'created_at'
    ];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = cols.join(';');
    const lines = rows.map((r) => {
      const scored = withScore(r);
      return cols.map((c) => escape(scored[c])).join(';');
    });
    const csv = '﻿' + [header, ...lines].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transacpharma_export.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
