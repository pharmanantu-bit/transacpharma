const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// --- Emplacement de la base ---
const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'pharma.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// --- Données de seed (insérées uniquement si la table est vide) ---
const SEED = [
  { cc: "Carrefour Chambourcy", departement: "78", enseigne: "Carrefour", siren: "527 767 578", pharmacie: "SELAS Ph. CC Chambourcy", dirigeant: "Fanny M'SIKA + Jean BLANCHOT", age: "66/67", groupement: "?", statut: "cible", remarques: "DEUX sexagénaires cogérants · Stéphane BELIN (48 ans) associé actif à désintéresser · Réduction capital juin 2025 · Holding SPFPLAS 2021 · CONTACT PRIORITAIRE" },
  { cc: "Carrefour Villejuif 7", departement: "94", enseigne: "Carrefour", siren: "499 376 168", pharmacie: "Ph. CC Carrefour", dirigeant: "Gilbert SAKELLIS", age: "74", groupement: "?", statut: "cible", remarques: "Né 07/1951 · Transformation SARL→SELARL juin 2025 · Fils Nicolas Sakellis impliqué · CONTACT PRIORITAIRE" },
  { cc: "Carrefour Villiers-en-Bière", departement: "77", enseigne: "Carrefour", siren: "", pharmacie: "Aucune", dirigeant: "", age: "", groupement: "", statut: "opp", remarques: "Klépierre 01 64 87 96 00 · Candidat Ph. Écoles Pringy SIREN 850266941" },
  { cc: "Carrefour Venette (Compiègne)", departement: "60", enseigne: "Carrefour", siren: "", pharmacie: "Aucune", dirigeant: "", age: "", groupement: "", statut: "opp", remarques: "Carmila · 3,75M visites/an · Dir. galerie Denis Pasco · Email rédigé" },
  { cc: "Carrefour Pontault-Combault", departement: "77", enseigne: "Carrefour", siren: "791 193 022", pharmacie: "Ph. La Francilienne", dirigeant: "A. SUOS + B. CHAUPAL", age: "?", groupement: "Pharmabest", statut: "ok", remarques: "2 co-gérants actifs depuis 2013" },
  { cc: "Carrefour Flins-sur-Seine", departement: "78", enseigne: "Carrefour", siren: "918 038 688", pharmacie: "Pharmacie Flins", dirigeant: "Hélène CLOATRE", age: "38", groupement: "?", statut: "ok", remarques: "Née 12/1986 · Rachetée 2022 · Jeune titulaire" },
  { cc: "Carrefour Sartrouville", departement: "78", enseigne: "Carrefour", siren: "825 109 945", pharmacie: "Ph. Moreno", dirigeant: "Jean-Marc MORENO", age: "?", groupement: "?", statut: "ok", remarques: "Fonds revendu 3,6M€ à sa SELARL 2017 · 4 pharmaciens · Actif et investi" },
  { cc: "Carrefour Nanteuil-lès-Meaux", departement: "77", enseigne: "Carrefour", siren: "514 690 734", pharmacie: "Ph. des Saints Pères", dirigeant: "Philippe MASCHI", age: "?", groupement: "?", statut: "ok", remarques: "Dirige aussi 2 pharmacies à Soissons · Multi-sites actif" },
  { cc: "CC 3 Fontaines Cergy", departement: "95", enseigne: "Carrefour", siren: "799 829 601", pharmacie: "Ph. de l'Étoile", dirigeant: "Simon DUPUIT", age: "55", groupement: "Elsie Santé", statut: "surveiller", remarques: "Né 12/1970 · Réduction capital 55K€ nov. 2024 · Lié aussi Ph. Pharma-Cergy" },
  { cc: "Carrefour Évry 2", departement: "91", enseigne: "Carrefour", siren: "917 832 107", pharmacie: "Ph. Centrale Évry 2", dirigeant: "Maxime VIBERT", age: "37", groupement: "Apothical", statut: "exclu", remarques: "Réseau Adrien Soumet · Ouverture 2024 après travaux" },
  { cc: "Carrefour Lieusaint (Sénart)", departement: "77", enseigne: "Carrefour", siren: "844 111 682", pharmacie: "Apothical Carré Sénart", dirigeant: "Adrien SOUMET", age: "37", groupement: "Apothical", statut: "exclu", remarques: "Co-fondateur Apothical · 1225m² · 31 salariés · Investissement massif" },
  { cc: "Carrefour Meaux / Nanteuil", departement: "77", enseigne: "Carrefour", siren: "518 897 004", pharmacie: "Ph. Meaux Victoire", dirigeant: "A. DA SILVA + M. YAHYAOUI", age: "?", groupement: "?", statut: "todo", remarques: "2 co-dirigeants identifiés · Âges à préciser" },
  { cc: "Carrefour Corbeil-Essonnes", departement: "91", enseigne: "Carrefour", siren: "", pharmacie: "Liquidée 2025", dirigeant: "", age: "", groupement: "", statut: "todo", remarques: "Ph. Corbeil Centre SELARL liquidée fév. 2025 · Autre Carrefour à vérifier" },
  { cc: "Auchan Plaisir (Grand Plaisir)", departement: "78", enseigne: "Auchan", siren: "344 767 496", pharmacie: "Ph. Grand Plaisir", dirigeant: "Didier UZAN", age: "~54", groupement: "?", statut: "ok", remarques: "CA 9,84M€ · 34 salariés · Changement président déc. 2025" },
  { cc: "Auchan Boissénart (Cesson)", departement: "77", enseigne: "Auchan", siren: "479 918 054", pharmacie: "Grande Ph. Boissenart", dirigeant: "Mikaël COHEN", age: "~38", groupement: "Giphar", statut: "ok", remarques: "Né 1986 · Lié Parapharmacie Monge · Actif" },
  { cc: "Auchan O'Parinor (Aulnay)", departement: "93", enseigne: "Auchan", siren: "908 374 127", pharmacie: "Pharmacie Parinor", dirigeant: "?", age: "?", groupement: "?", statut: "ok", remarques: "SELAS créée 2022 · 20-49 salariés · Dirigeant à identifier" },
  { cc: "Auchan Val Fontenay", departement: "94", enseigne: "Auchan", siren: "803 745 215", pharmacie: "Ph. Val de Fontenay", dirigeant: "Christophe DROCOURT", age: "?", groupement: "Pharmabest", statut: "ok", remarques: "Dupuit parti 2019 · Capital 350K€" },
  { cc: "Auchan Vélizy (Vélizy 2)", departement: "78", enseigne: "Auchan", siren: "502 816 309", pharmacie: "La Pharmacie du Centre", dirigeant: "Géraldine MARTIN", age: "?", groupement: "Pharmabest", statut: "surveiller", remarques: "Capital réduit 1,36M€ juil. 2023 · Départ cogérant · Âge à confirmer" },
  { cc: "Auchan Creil / Nogent-sur-Oise", departement: "60", enseigne: "Auchan", siren: "921 525 424", pharmacie: "Pharmacie Noto", dirigeant: "Quentin NOTO", age: "~47", groupement: "?", statut: "ok", remarques: "Né ~01/1978 · SELAS 2022 · Titulaire actif" },
  { cc: "Auchan Buchelay (Porte de Normandie)", departement: "78", enseigne: "Auchan", siren: "?", pharmacie: "Ph. des Portes de Normandie", dirigeant: "?", age: "?", groupement: "Aprium", statut: "ok", remarques: "Groupement Aprium · Dirigeant à identifier" },
  { cc: "Auchan Senlis", departement: "60", enseigne: "Auchan", siren: "?", pharmacie: "?", dirigeant: "?", age: "?", groupement: "?", statut: "todo", remarques: "Pas d'Auchan confirmé à Senlis · Hors cible probable" },
  { cc: "Leclerc Mareuil-lès-Meaux", departement: "77", enseigne: "Leclerc", siren: "519 048 714", pharmacie: "Ph. Principale Mareuil", dirigeant: "?", age: "?", groupement: "?", statut: "ok", remarques: "SELARL capital 300K€ · Dirigeant à identifier" },
  { cc: "Leclerc Dammarie-les-Lys", departement: "77", enseigne: "Leclerc", siren: "817 810 591", pharmacie: "Ph. du Centre", dirigeant: "Sorya YEN", age: "~43", groupement: "Apothical", statut: "ok", remarques: "Née 03/1982 · Fonds 3,25M€ 2016 · 25 salariés · Jeune" },
  { cc: "Leclerc Barjouville (Chartres)", departement: "28", enseigne: "Leclerc", siren: "815 309 752", pharmacie: "Ph. de Barjouville", dirigeant: "Avril / Bernard / Cornely", age: "?", groupement: "?", statut: "surveiller", remarques: "Contentieux ARS Centre-Val-de-Loire 2025 · Âges à confirmer" },
  { cc: "Leclerc Dreux (Les Bâtes)", departement: "28", enseigne: "Leclerc", siren: "790 578 520", pharmacie: "Pharmacie des Bâtes", dirigeant: "Anne-Laure FERRIO", age: "?", groupement: "?", statut: "ok", remarques: "CA 3,99M€ · Co-présidente CPTS · Profil très actif · Âge à confirmer" },
  { cc: "Leclerc Osny / Valony", departement: "95", enseigne: "Leclerc", siren: "450 520 697", pharmacie: "Pharmacie Briel", dirigeant: "M. BRIEL + M. BRIEL", age: "60", groupement: "Elsie Santé", statut: "surveiller", remarques: "Marielle née 06/07/1965 (60 ans) · En poste depuis 2003 (22 ans) · Couple sans successeur · Sortie 3-5 ans" },
  { cc: "Leclerc Montataire / Creil", departement: "60", enseigne: "Leclerc", siren: "907 716 369", pharmacie: "Ph. du Thérain", dirigeant: "Élodie LEMOINE", age: "?", groupement: "?", statut: "ok", remarques: "Gérante depuis mars 2023 · Fonds racheté 1,1M€ 2022 · Jeune titulaire" },
  { cc: "Leclerc Nemours", departement: "77", enseigne: "Leclerc", siren: "", pharmacie: "", dirigeant: "", age: "", groupement: "", statut: "todo", remarques: "Leclerc Drive/supermarché · Pas de galerie marchande confirmée" },
  { cc: "Leclerc Fontainebleau", departement: "77", enseigne: "Leclerc", siren: "", pharmacie: "", dirigeant: "", age: "", groupement: "", statut: "todo", remarques: "Pharmacies en ville · Pas de galerie Leclerc confirmée" }
];

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cc TEXT,
      departement TEXT,
      enseigne TEXT,
      siren TEXT,
      pharmacie TEXT,
      dirigeant TEXT,
      age TEXT,
      groupement TEXT,
      statut TEXT DEFAULT 'todo',
      remarques TEXT,
      note_interne TEXT DEFAULT '',
      date_maj TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      type TEXT,
      contenu TEXT,
      auteur TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_actions_site ON actions(site_id);
  `);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM sites').get();
  if (n === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO sites
        (cc, departement, enseigne, siren, pharmacie, dirigeant, age, groupement, statut, remarques, note_interne, date_maj, created_at)
      VALUES
        (@cc, @departement, @enseigne, @siren, @pharmacie, @dirigeant, @age, @groupement, @statut, @remarques, @note_interne, @date_maj, @created_at)
    `);
    const insertMany = db.transaction((rows) => {
      for (const r of rows) {
        insert.run({
          cc: r.cc || '',
          departement: r.departement || '',
          enseigne: r.enseigne || '',
          siren: r.siren || '',
          pharmacie: r.pharmacie || '',
          dirigeant: r.dirigeant || '',
          age: r.age || '',
          groupement: r.groupement || '',
          statut: r.statut || 'todo',
          remarques: r.remarques || '',
          note_interne: '',
          date_maj: now,
          created_at: now
        });
      }
    });
    insertMany(SEED);
    console.log(`[db] Seed inséré : ${SEED.length} sites.`);
  }
}

module.exports = { db, initDb };
