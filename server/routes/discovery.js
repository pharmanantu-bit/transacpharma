const express = require('express');
const router = express.Router();
const { scanDepartements, listDepartements } = require('../discovery');

// GET /api/discovery/departements — liste France pour le sélecteur
router.get('/discovery/departements', (req, res) => {
  try {
    res.json({ success: true, data: listDepartements() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/discovery/scan — scanne 1+ départements et renvoie les candidats classés
router.post('/discovery/scan', async (req, res) => {
  try {
    const b = req.body || {};
    let codes = Array.isArray(b.departements) ? b.departements : [];
    codes = codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (codes.length === 0) {
      return res.status(400).json({ success: false, error: 'Sélectionne au moins un département.' });
    }
    if (codes.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 5 départements par scan (quotas Overpass). Réduis la sélection.'
      });
    }
    let radius = parseInt(b.radius, 10);
    if (Number.isNaN(radius) || radius < 50 || radius > 1000) radius = 300;

    const results = await scanDepartements(codes, radius);
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
