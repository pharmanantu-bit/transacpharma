# TransacPharma

Application web de **prospection de pharmacies en galerie marchande** (Carrefour / Auchan / Leclerc en Île-de-France et alentours).

Suivi des cibles, fiches détaillées, notes internes, historique d'actions, KPI et export CSV.

## Stack

- **Frontend** : React 18 + Vite + TailwindCSS (CSS pur, aucun framework UI externe)
- **Backend** : Node.js + Express
- **Base de données** : SQLite via `better-sqlite3` — fichier local `db/pharma.db`
- **Déploiement** : Docker (multi-stage) + docker-compose

## Démarrage rapide (développement)

```bash
# 1. Installer les dépendances (racine + client)
npm run install:all

# 2. Lancer serveur (port 3000) + client Vite (port 5173) en parallèle
npm run dev
```

- API : http://localhost:3000/api
- Front (dev, avec hot-reload) : http://localhost:5173 — le proxy Vite redirige `/api` vers le serveur.

La base `db/pharma.db` est créée automatiquement au premier lancement et remplie avec les 29 sites de prospection (seed unique : uniquement si la table est vide).

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
| GET     | `/api/export/csv`           | Export CSV complet (avec score)          |

## Découverte d'opportunités

Onglet **Découverte** : scanne un ou plusieurs départements (partout en France) pour trouver les **centres commerciaux avec galerie + hypermarché** (Carrefour, Auchan, Leclerc, Géant, Cora, Intermarché, Hyper U) et indiquer si une **pharmacie existe déjà** à proximité (rayon configurable, défaut 300 m).

Chaque centre est classé :
- 🟢 **Création** — galerie + hyper *sans* pharmacie (ouvrir une officine) ;
- 🎯 **Acquisition** — pharmacie existante (cible de rachat), avec son SIREN quand il est retrouvé.

Sélectionne des résultats puis « Ajouter la sélection à la prospection » : ils rejoignent le tableau, scorés automatiquement, et les cibles avec SIREN sont enrichissables via Pappers.

Sources **gratuites, sans clé** : OpenStreetMap (Overpass) pour les centres/pharmacies, `recherche-entreprises.api.gouv.fr` pour le SIREN. Limite : max 5 départements par scan (~30 s chacun) pour respecter les quotas Overpass.

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
├── db/                  # Base SQLite (créée automatiquement)
├── Dockerfile
├── docker-compose.yml
└── package.json
```
