# Déploiement — Logistique ADES

Application de gestion logistique avec un backend **Node/Express/PostgreSQL** et un
frontend **React (Vite)**. Déploiement **"serveur unique"** : un seul processus
Express sert à la fois l'API (`/api`) et l'application React (SPA).

## Architecture

```
frontend/  -> React (Vite). Le build de production est généré dans frontend/dist
backend/   -> Node/Express + Sequelize + PostgreSQL. Sert l'API ET le build frontend.
```

## Pré-requis

- Node.js 18+ (testé sous Node 24)
- PostgreSQL 12+ (base locale ou distante)

## 1. Base de données

Créer la base (elle sera remplie par les migrations) :

```sql
CREATE DATABASE logistique_db;
```

Appliquer toutes les migrations (y compris les plus récentes : audit log,
performance indexes, maintenance, carburant) :

```bash
cd backend
npx sequelize-cli db:migrate
```

> Si des tables/colonnes récentes manquent (`Maintenances`, `Vehicles.fuel_type`,
> `Sorties.fuel_cost`...), c'est que les migrations n'ont pas été jouées :
> relancez `db:migrate`. Le backend plante à la requête si le schéma est incohérent.

## 2. Variables d'environnement

### Backend

```bash
cd backend
cp .env.example .env
# éditez .env : JWT_SECRET (obligatoire), DB_*, SMTP_* (facultatif)
```

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `JWT_SECRET` | **oui** | Signature des jetons. Choisir une longue chaîne aléatoire en prod. |
| `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | oui | Connexion PostgreSQL |
| `PORT` | non | Port HTTP (défaut 5000) |
| `CORS_ORIGIN` | non | Orignes autorisées (défaut `*`) |
| `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM` | non | Email de notification (désactivé si vide) |
| `FRONTEND_DIST` / `SERVE_FRONTEND` | non | Chemin du build frontend / activation du serveur statique |

### Frontend

```bash
cd frontend
cp .env.example .env.local
```

En "serveur unique", laisser `VITE_API_BASE_URL=/api` (même origine, pas de CORS).
Seulement en cas de serveurs séparés, définir `VITE_API_BASE_URL=http://backend:5000/api`.

## 3. Build du frontend

```bash
cd frontend
npm install
npm run build        # produit frontend/dist
```

## 4. Lancement (production)

```bash
cd backend
npm install
npx sequelize-cli db:migrate   # appliquer les migrations
npm start                       # ou : node server.js
```

Au démarrage, le serveur :
1. vérifie la connexion PostgreSQL ;
2. sert l'API et le build frontend (`frontend/dist`) ;
3. lance la vérification périodique des maintenances dues (toutes les 12h).

L'application est alors accessible sur `http://<serveur>:<port>`.

## Structure des fichiers de déploiement

- `backend/.env.example` — modèle des variables backend
- `frontend/.env.example` — modèle des variables frontend
- `backend/DEPLOYMENT.md` (ce fichier)

## Conseils production

- Remplacer `JWT_SECRET` et les identifiants DB par des secrets forts.
- Restreindre `CORS_ORIGIN` au domaine réel.
- Utiliser un process manager (`pm2 start server.js -i max`) ou un container.
- Ajouter des sauvegardes PostgreSQL régulières (`pg_dump`).
