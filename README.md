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
| GET     | `/api/export/csv`           | Export CSV complet                       |

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
