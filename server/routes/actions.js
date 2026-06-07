const express = require('express');
const router = express.Router();
const { db } = require('../db');

const TYPES = ['contact', 'relance', 'visite', 'info', 'note'];

// GET /api/sites/:id/actions — historique d'un site
router.get('/sites/:id/actions', (req, res) => {
  try {
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site introuvable' });
    const rows = db
      .prepare('SELECT * FROM actions WHERE site_id = ? ORDER BY created_at DESC, id DESC')
      .all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sites/:id/actions — ajouter une action
router.post('/sites/:id/actions', (req, res) => {
  try {
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site introuvable' });

    const b = req.body || {};
    const type = TYPES.includes(b.type) ? b.type : 'note';
    const contenu = b.contenu != null ? String(b.contenu).trim() : '';
    const auteur = b.auteur != null ? String(b.auteur).trim() : '';
    if (!contenu) {
      return res.status(400).json({ success: false, error: 'Le contenu de l\'action est obligatoire' });
    }
    const now = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO actions (site_id, type, contenu, auteur, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(req.params.id, type, contenu, auteur, now);

    // Met aussi à jour la date de dernière modif du site
    db.prepare('UPDATE sites SET date_maj = ? WHERE id = ?').run(now, req.params.id);

    const row = db.prepare('SELECT * FROM actions WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
