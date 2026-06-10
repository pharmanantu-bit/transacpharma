// Migration des données locales (db/pharma.db) vers la base Turso (cloud).
//
// À lancer UNE FOIS, après avoir créé la base Turso, pour transférer tes
// sites + actions saisis en local vers la base en ligne.
//
//   Windows (PowerShell) :
//     $env:TURSO_DATABASE_URL="libsql://xxxxx.turso.io"
//     $env:TURSO_AUTH_TOKEN="ton_token"
//     node server/migrate-to-turso.js
//
//   (ou renseigne TURSO_DATABASE_URL / TURSO_AUTH_TOKEN dans le fichier .env)
//
// ⚠️ Écrase le contenu des tables `sites` et `actions` côté Turso par tes
// données locales. Les ids sont préservés.

const path = require('path');
const { createClient } = require('@libsql/client');

// Charge .env si présent (Node 20.12+/22+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
  } catch {
    /* pas de .env */
  }
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('❌ TURSO_DATABASE_URL manquant. Renseigne-le avant de lancer la migration.');
  process.exit(1);
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cc TEXT, departement TEXT, enseigne TEXT, siren TEXT, pharmacie TEXT,
    dirigeant TEXT, age TEXT, groupement TEXT, statut TEXT DEFAULT 'todo',
    remarques TEXT, note_interne TEXT DEFAULT '', date_maj TEXT, created_at TEXT,
    capital TEXT DEFAULT '', forme_juridique TEXT DEFAULT '', date_creation TEXT DEFAULT '',
    effectif TEXT DEFAULT '', chiffre_affaires TEXT DEFAULT '', enriched_at TEXT DEFAULT '',
    relance_at TEXT DEFAULT '', relance_note TEXT DEFAULT '',
    latitude REAL, longitude REAL, ville TEXT DEFAULT '', source TEXT DEFAULT 'manuel',
    osm_id TEXT, opportunite_type TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    type TEXT, contenu TEXT, auteur TEXT, created_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_actions_site ON actions(site_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_osm ON sites(osm_id) WHERE osm_id IS NOT NULL;
  CREATE TABLE IF NOT EXISTS discovery_cache (
    departement TEXT PRIMARY KEY, scanned_at TEXT, radius INTEGER,
    osm_json TEXT, candidats_json TEXT
  );
`;

async function copyTable(local, remote, table) {
  const cols = (await local.execute(`PRAGMA table_info(${table})`)).rows.map((c) => c.name);
  const rows = (await local.execute(`SELECT * FROM ${table}`)).rows;
  if (rows.length === 0) return 0;

  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  const stmts = rows.map((r) => ({ sql, args: cols.map((c) => r[c]) }));
  await remote.batch(stmts, 'write');
  return rows.length;
}

(async () => {
  const local = createClient({ url: 'file:' + path.join(__dirname, '..', 'db', 'pharma.db').replace(/\\/g, '/') });
  const remote = createClient({ url, authToken });

  console.log('→ Préparation du schéma sur Turso…');
  await remote.executeMultiple(SCHEMA);

  console.log('→ Nettoyage des tables Turso (sites, actions)…');
  await remote.execute('DELETE FROM actions');
  await remote.execute('DELETE FROM sites');

  const nSites = await copyTable(local, remote, 'sites');
  const nActions = await copyTable(local, remote, 'actions');

  console.log(`✅ Migration terminée : ${nSites} sites et ${nActions} actions transférés vers Turso.`);
  process.exit(0);
})().catch((e) => {
  console.error('❌ Échec de la migration :', e.message);
  process.exit(1);
});
