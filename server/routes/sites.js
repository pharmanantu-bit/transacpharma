const express = require('express');
const router = express.Router();
const { db } = require('../db');

const FIELDS = [
  'cc', 'departement', 'enseigne', 'siren', 'pharmacie',
  'dirigeant', 'age', 'groupement', 'statut', 'remarques', 'note_interne'
];

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

    const rows = db.prepare(sql).all(...params);
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
    res.json({ success: true, data: row });
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
    res.status(201).json({ success: true, data: row });
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
    res.json({ success: true, data: row });
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

// GET /api/export/csv — export complet
router.get('/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM sites ORDER BY id ASC').all();
    const cols = [
      'id', 'cc', 'departement', 'enseigne', 'siren', 'pharmacie',
      'dirigeant', 'age', 'groupement', 'statut', 'remarques',
      'note_interne', 'date_maj', 'created_at'
    ];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = cols.join(';');
    const lines = rows.map((r) => cols.map((c) => escape(r[c])).join(';'));
    // BOM pour Excel + accents
    const csv = '﻿' + [header, ...lines].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transacpharma_export.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
