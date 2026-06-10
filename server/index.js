const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Charge le fichier .env (ex : PAPPERS_API_TOKEN) s'il existe.
// Node 20.12+/22+ : process.loadEnvFile. Sinon on garde les variables système.
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
  } catch {
    /* pas de .env : on utilise les variables d'environnement système */
  }
}

const { initDb } = require('./db');
const sitesRouter = require('./routes/sites');
const actionsRouter = require('./routes/actions');
const discoveryRouter = require('./routes/discovery');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// --- Authentification simple par mot de passe partagé ---
// Activée uniquement si APP_PASSWORD est défini (donc : ouverte en dev local,
// protégée en production sur Render où la variable est renseignée).
// /api/health reste public pour le health check de l'hébergeur.
const APP_USER = process.env.APP_USER || 'apothical';
const APP_PASSWORD = process.env.APP_PASSWORD;

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

if (APP_PASSWORD) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const hdr = req.headers.authorization || '';
    const [scheme, encoded] = hdr.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
      if (user && pass && safeEqual(user, APP_USER) && safeEqual(pass, APP_PASSWORD)) {
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="TransacPharma", charset="UTF-8"');
    return res.status(401).send('Authentification requise');
  });
  console.log('🔒 Authentification activée (mot de passe partagé).');
} else {
  console.log('🔓 Authentification désactivée (APP_PASSWORD non défini — usage local).');
}

// --- API ---
app.use('/api', actionsRouter); // routes /sites/:id/actions montées en premier
app.use('/api', sitesRouter);
app.use('/api', discoveryRouter);

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

// 404 pour les routes API inconnues
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Route API introuvable' });
});

// --- Front compilé (production / même origin) ---
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// --- Gestion d'erreurs globale ---
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ success: false, error: err.message || 'Erreur serveur' });
});

// Initialise la base (création tables + seed si vide) PUIS démarre le serveur.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ TransacPharma — serveur sur http://localhost:${PORT}`);
      if (!fs.existsSync(distPath)) {
        console.log('ℹ️  Front non compilé : lance le client Vite avec "npm run dev:client" (mode dev).');
      }
    });
  })
  .catch((err) => {
    console.error('[db] Échec de l\'initialisation de la base :', err);
    process.exit(1);
  });
