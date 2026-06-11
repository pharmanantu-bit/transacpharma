const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { scanAll } = require('../bodacc-scan');

// POST /api/bodacc/scan — vérifie tous les sites avec SIREN (ou body.site_ids).
router.post('/bodacc/scan', async (req, res) => {
  try {
    const ids = Array.isArray(req.body && req.body.site_ids) ? req.body.site_ids : null;
    const r = await scanAll(ids);
    res.json({ success: true, ...r });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/bodacc/annonces — journal complet de la veille : toutes les
// annonces (lues ou non) jointes à leur site, les 300 plus récentes.
router.get('/bodacc/annonces', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT b.*, s.cc, s.pharmacie
      FROM bodacc_annonces b
      JOIN sites s ON s.id = b.site_id
      ORDER BY b.date_parution DESC
      LIMIT 300
    `).all();
    const { checked_at } = await db
      .prepare('SELECT MAX(bodacc_checked_at) AS checked_at FROM sites')
      .get();
    res.json({ success: true, data: rows, checked_at: checked_at || '' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/bodacc/alertes — annonces non lues, jointes à leur site.
router.get('/bodacc/alertes', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT b.*, s.cc, s.pharmacie
      FROM bodacc_annonces b
      JOIN sites s ON s.id = b.site_id
      WHERE b.lu = 0
      ORDER BY b.date_parution DESC
    `).all();
    const { checked_at } = await db
      .prepare('SELECT MAX(bodacc_checked_at) AS checked_at FROM sites')
      .get();
    res.json({ success: true, data: rows, checked_at: checked_at || '' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/bodacc/lu — marque des annonces comme lues ({ ids } ou { all: true }).
router.post('/bodacc/lu', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.all) {
      const info = await db.prepare('UPDATE bodacc_annonces SET lu = 1 WHERE lu = 0').run();
      return res.json({ success: true, updated: info.changes });
    }
    const ids = Array.isArray(b.ids) ? b.ids : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids (tableau) ou all:true requis' });
    }
    const info = await db
      .prepare(`UPDATE bodacc_annonces SET lu = 1 WHERE id IN (${ids.map(() => '?').join(',')})`)
      .run(...ids);
    res.json({ success: true, updated: info.changes });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/sites/:id/bodacc — historique BODACC d'un site (récentes d'abord).
router.get('/sites/:id/bodacc', async (req, res) => {
  try {
    const site = await db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site introuvable' });
    const rows = await db.prepare(`
      SELECT * FROM bodacc_annonces WHERE site_id = ? ORDER BY date_parution DESC
    `).all(req.params.id);
    res.json({ success: true, data: rows, checked_at: site.bodacc_checked_at || '' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
