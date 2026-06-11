# TransacPharma

Application web de **prospection de pharmacies en galerie marchande** (Carrefour / Auchan / Leclerc en Île-de-France et alentours).

Suivi des cibles, fiches détaillées, notes internes, historique d'actions, KPI et export CSV.

## Stack

- **Frontend** : React 18 + Vite + TailwindCSS (CSS pur, aucun framework UI externe)
- **Backend** : Node.js + Express
- **Base de données** : libSQL via `@libsql/client` — fichier local `db/pharma.db` en dev, **Turso (cloud, gratuit)** en production
- **Déploiement** : Docker (multi-stage) — hébergement gratuit Render + Turso

## Démarrage rapide (développement)

### Windows — le plus simple : `start.ps1`

```powershell
.\start.ps1
```

Le script installe les dépendances au premier lancement, démarre serveur + client sur le **port 3002** et ouvre http://localhost:5173 dans le navigateur. (Clic droit sur `start.ps1` > « Exécuter avec PowerShell » fonctionne aussi.)

### Manuel (toutes plateformes)

```bash
# 1. Installer les dépendances (racine + client)
npm run install:all

# 2. Lancer serveur + client Vite (port 5173) en parallèle
npm run dev
```

- Front (dev, avec hot-reload) : http://localhost:5173 — le proxy Vite redirige `/api` vers le serveur.
- API : http://localhost:3000/api par défaut.

> **Port 3002** : si le 3000 est déjà occupé par un autre projet, lance avec
> `$env:PORT="3002"; $env:API_PROXY="http://localhost:3002"; npm run dev` (PowerShell)
> ou `PORT=3002 API_PROXY=http://localhost:3002 npm run dev` (bash). C'est ce que fait `start.ps1`.

La base `db/pharma.db` est créée automatiquement au premier lancement et remplie avec les 29 sites de prospection (seed unique : uniquement si la table est vide).

## Reprendre le projet sur un autre poste

Le **code** est sur GitHub ; la **base de données** (`db/*.db`) et le **`.env`** sont locaux à chaque machine (ignorés par Git).

```powershell
git clone https://github.com/pharmanantu-bit/transacpharma.git
cd transacpharma
.\start.ps1          # installe tout puis lance sur le 3002
```

- Tu repars d'une base **neuve** (29 sites de seed) : tes données saisies sur l'autre poste ne sont pas transférées (la donnée locale ne voyage pas avec Git).
- L'enrichissement SIREN marche sans configuration ; pour le bonus Pappers, recopie `.env.example` en `.env` et remets ta clé.
- Réflexe : `git pull` au début d'une session, `git push` à la fin pour faire circuler le code entre les postes.

## Production (Docker)

```bash
docker-compose up --build
```

L'application tourne sur **http://localhost:3000** (le serveur Express sert le front compilé + l'API sur le même port).

La base SQLite est persistée dans le volume Docker `pharma-db`.

## Production (sans Docker)

```bash
npm run install:all
npm run build      # compile le front dans client/dist
npm start          # sert le tout sur http://localhost:3000
```

## Déploiement en ligne (gratuit : Render + Turso)

La base est hébergée sur **Turso** (libSQL cloud, gratuit) ; l'app tourne sur
l'offre **gratuite** de Render. Aucun disque payant nécessaire.

### 1. Créer la base Turso

1. Compte gratuit sur [turso.tech](https://turso.tech).
2. Créer une base (**Create Database**), région proche (Paris/Frankfurt).
3. Récupérer **l'URL de connexion** (`libsql://…`) et générer un **token**.

### 2. Déployer sur Render

1. Sur [dashboard.render.com](https://dashboard.render.com) → **New +** →
   **Blueprint**, connecter le dépôt `transacpharma`. Render lit `render.yaml`.
2. Renseigner les variables secrètes :
   - **`APP_PASSWORD`** — mot de passe partagé d'accès (obligatoire).
   - **`TURSO_DATABASE_URL`** — l'URL `libsql://…` de Turso.
   - **`TURSO_AUTH_TOKEN`** — le token Turso.
   - `PAPPERS_API_TOKEN` — optionnel (bonus Pappers).
3. Déployer. L'app est servie en HTTPS sur `https://transacpharma.onrender.com`.

> ℹ️ Sur l'offre gratuite, le service se met en veille après ~15 min
> d'inactivité (réveil en ~30 s au prochain accès). **Les données ne sont pas
> perdues** : elles vivent dans Turso, indépendamment de Render.

> 💾 La base Turso démarre vide (29 sites de seed). Pour y transférer ta base
> locale, voir « Migrer ses données locales vers Turso » ci-dessous.

### Authentification

Quand **`APP_PASSWORD`** est défini, toute l'application est protégée par un
identifiant + mot de passe (Basic Auth, fenêtre du navigateur à l'ouverture).
Identifiant par défaut `apothical` (modifiable via `APP_USER`).

En local, laisse `APP_PASSWORD` vide : l'accès reste direct, sans login.

### Migrer ses données locales vers Turso

La base Turso démarre vide. Pour y transférer les sites/actions saisis en local
(`db/pharma.db`), lance une fois, après avoir créé la base Turso :

```powershell
$env:TURSO_DATABASE_URL="libsql://xxxxx.turso.io"
$env:TURSO_AUTH_TOKEN="ton_token"
node server/migrate-to-turso.js
```

Le script crée le schéma, vide les tables `sites`/`actions` côté Turso puis y
copie tes données locales (ids préservés).

## API REST

Toutes les réponses sont au format JSON avec un champ `success: true/false`.

| Méthode | Route                       | Description                              |
|---------|-----------------------------|------------------------------------------|
| GET     | `/api/sites`                | Liste des sites (filtres : `statut`, `enseigne`, `departement`, `q`) |
| GET     | `/api/sites/:id`            | Détail d'un site                         |
| POST    | `/api/sites`                | Créer un site                            |
| PUT     | `/api/sites/:id`            | Mettre à jour un site                    |
| DELETE  | `/api/sites/:id`            | Supprimer un site                        |
| GET     | `/api/sites/:id/actions`    | Historique des actions d'un site         |
| POST    | `/api/sites/:id/actions`    | Ajouter une action                       |
| POST    | `/api/sites/:id/enrich`     | Enrichissement société via SIREN (annuaire gratuit) |
| POST    | `/api/sites/batch`          | Import en masse (depuis la Découverte)   |
| GET     | `/api/discovery/departements` | Liste des départements (sélecteur)     |
| POST    | `/api/discovery/scan`       | Scan d'opportunités par département(s)    |
| POST    | `/api/bodacc/scan`          | Veille BODACC : scan de tous les SIREN (ou `site_ids`) |
| GET     | `/api/bodacc/alertes`       | Alertes BODACC non lues                  |
| POST    | `/api/bodacc/lu`            | Marquer des alertes comme lues (`ids` ou `all`) |
| GET     | `/api/sites/:id/bodacc`     | Historique BODACC d'un site              |
| GET     | `/api/export/csv`           | Export CSV complet (avec score)          |

## Découverte d'opportunités

Onglet **Découverte** : scanne un ou plusieurs départements (partout en France) pour trouver les **centres commerciaux avec galerie + hypermarché** (Carrefour, Auchan, Leclerc, Géant, Cora, Intermarché, Hyper U) et indiquer si une **pharmacie existe déjà** à proximité (rayon configurable, défaut 300 m).

Chaque centre est classé :
- 🟢 **Création** — galerie + hyper *sans* pharmacie (ouvrir une officine) ;
- 🎯 **Acquisition** — pharmacie existante (cible de rachat), avec son SIREN quand il est retrouvé.

Sélectionne des résultats puis « Ajouter la sélection à la prospection » : ils rejoignent le tableau, scorés automatiquement, et les cibles avec SIREN sont enrichissables via Pappers.

Sources **gratuites, sans clé** : OpenStreetMap (Overpass) pour les centres/pharmacies, `recherche-entreprises.api.gouv.fr` pour le SIREN. Limite : max 5 départements par scan (~30 s chacun) pour respecter les quotas Overpass.

**Cache** : chaque département scanné est mémorisé en base (30 j). Un re-scan est **instantané** ; changer le rayon recalcule sans rappeler Overpass. Coche « Forcer un nouveau scan » pour rafraîchir les données.

**Détail d'un centre** : clique une ligne de résultat pour ouvrir une fiche complète (opérateur du centre, site web, horaires, adresse, hyper + distance, pharmacie : nom/tél/horaires/adresse/SIREN, liens OpenStreetMap & Google Maps). Tu peux alors l'ajouter à la prospection à l'unité, ou cocher plusieurs lignes et importer la sélection.

> **Fréquentation annuelle** : non disponible dans OSM/les API entreprises (donnée marketing propriétaire des exploitants). La fiche l'affiche automatiquement via **Wikidata** (propriété « visiteurs par an ») quand le centre y est référencé — c'est rare ; sinon elle propose un lien de recherche.

## Pipeline (Kanban) & relances

Onglet **📋 Pipeline** : vue Kanban avec une colonne par statut (Cible, À surveiller, À confirmer, Opportunité, OK, Exclu). Les cartes sont triées par score décroissant et affichent CC, enseigne/département, dirigeant (âge en rouge si ≥ 60 ans), score et relance éventuelle.

**Glisser-déposer** une carte d'une colonne à l'autre change son statut — le score est recalculé automatiquement.

**Relances / rappels** : chaque fiche a une section « ⏰ Relance / rappel » (date + note, sauvegarde automatique). Un bandeau **« Relances à traiter »** s'affiche en haut des onglets Prospection et Pipeline ; il liste les rappels en retard, du jour et des 7 prochains jours, triés par urgence et cliquables. La date de relance figure aussi dans l'export CSV.

## Veille BODACC

Le bandeau **📰 Veille BODACC** (onglets Prospection et Pipeline) surveille les **annonces commerciales officielles** (bodacc.fr, API DILA gratuite et sans clé) de tous les sites ayant un SIREN. « Scanner maintenant » interroge le BODACC et fait remonter les signaux de cession :

- 🚨 **Critique** — vente / cession du fonds, procédure collective, radiation ;
- ⚠️ **Important** — modification du capital, transformation juridique, mouvement de dirigeant ;
- ℹ️ **Info** — le reste (immatriculations, modifications mineures) — conservé dans l'historique de la fiche, sans alerte.

Les annonces notables de **moins de 24 mois** apparaissent comme alertes (cliquables → fiche) jusqu'à être marquées lues. Le signal dominant de chaque site **entre dans le score** (+25 critique, +10 important) et un 🚨 s'affiche dans le tableau pour les signaux critiques. Chaque fiche a sa section « Annonces BODACC » avec l'historique complet, le lien vers l'avis officiel et un bouton « Vérifier maintenant ». Les dépôts de comptes sont ignorés.

## Scoring d'opportunité

Chaque site reçoit automatiquement un **score 0-100** et un niveau (🔥 Chaud / 🟠 Tiède / ❄️ Froid / ⛔ Exclu), calculé côté serveur (`server/scoring.js`) à partir de :

- l'âge du dirigeant le plus âgé (≥ 65 / sexagénaire / 55-59…) — signal n°1 de cession ;
- des signaux détectés dans les remarques (sans successeur, réduction de capital, transformation juridique, « prioritaire », couple, sortie évoquée…) ;
- du statut courant (cible, surveiller…) ;
- de pénalités (pas de pharmacie à racheter, réseau Apothical, site exclu).

Le tableau est trié par score décroissant par défaut, et la fiche détaille les raisons du score.

## Enrichissement SIREN (gratuit)

Le bouton **« ⟳ Enrichir (SIREN) »** d'une fiche interroge l'**annuaire des entreprises** (`recherche-entreprises.api.gouv.fr`, données officielles INSEE/INPI, **gratuit et sans clé**) et remplit automatiquement : dirigeants, **âges** (depuis l'année de naissance au RNE), forme juridique, date de création, effectif, et chiffre d'affaires quand il est publié.

Aucune configuration nécessaire — ça marche directement.

### Bonus optionnel : Pappers

Pour obtenir en plus le **capital** et un **CA détaillé** (souvent absents de l'annuaire pour les officines), tu peux ajouter une clé [Pappers](https://www.pappers.fr/api) (compte gratuit). Copie `.env.example` en `.env` et renseigne :

```
PAPPERS_API_TOKEN=ta_cle_pappers
```

Le `.env` est chargé automatiquement au démarrage (et ignoré par Git). Sans clé, l'enrichissement gratuit fonctionne normalement.

## Statuts

| Statut       | Signification     | Couleur        |
|--------------|-------------------|----------------|
| `cible`      | Cible             | Amber          |
| `surveiller` | À surveiller      | Coral          |
| `ok`         | OK                | Gris           |
| `opp`        | Opportunité       | Rouge clair    |
| `exclu`      | Exclu             | Gris foncé     |
| `todo`       | À confirmer       | Vert clair     |

## Structure

```
transacpharma/
├── client/              # React frontend (Vite + Tailwind)
├── server/              # API Express + SQLite
│   ├── index.js
│   ├── db.js            # Init + seed
│   └── routes/
├── db/                  # Base SQLite (créée automatiquement, ignorée par Git)
├── start.ps1            # Démarrage rapide Windows (install + lance sur le 3002)
├── Dockerfile
├── docker-compose.yml
└── package.json
```
