# 🚐 Guide de développement — Gestion des sorties logistiques

Stack : **React.js + Mantine UI + react-bootstrap** (front) · **Node.js + Express + Sequelize + PostgreSQL** (back) · **Git/GitHub** · **VSCode**

---

## Étape 0 — Prérequis & organisation

- Node.js LTS installé, PostgreSQL installé (ou via Docker si tu préfères)
- VSCode avec extensions : ESLint, Prettier, PostgreSQL (par exemple `cweijan.vscode-postgresql-client2`), GitLens
- Créer un dossier de projet monorepo :

```
logistique-app/
├── backend/
├── frontend/
└── README.md
```

- Initialiser Git à la racine :

```bash
cd logistique-app
git init
echo "node_modules/\n.env\n.DS_Store" > .gitignore
git add .
git commit -m "init: structure du projet"
```

- Créer le repo sur GitHub, puis :

```bash
git remote add origin https://github.com/<ton-user>/logistique-app.git
git branch -M main
git push -u origin main
```

**Convention de branches conseillée (Scrum) :**
- `main` → stable
- `develop` → intégration
- `feature/xxx` → une feature = une branche = une PR

---

## Étape 0bis — Méthodologie Agile Scrum appliquée au projet

### Organisation

- **Product Backlog** géré dans **GitHub Projects** (board Kanban lié directement aux issues du repo) : `To Do` → `In Progress` → `In Review` → `Done`
- **Sprints** de 1 à 2 semaines, alignés sur les 3 sprints déjà identifiés dans le cahier des charges
- **Definition of Ready** (avant qu'une tâche entre dans un sprint) : user story claire + maquette/wireframe validée si UI concernée
- **Definition of Done** (avant de clore une tâche) : code review passée + tests OK + **CI verte** + **critères IHM respectés** (responsive vérifié, feedback utilisateur présent, cohérence charte graphique)
- **Cérémonies** (même en solo ou petite équipe, à formaliser par écrit) :
  - *Sprint Planning* : découpage du backlog sprint en user stories + tâches techniques
  - *Daily* (ou point rapide) : ce qui a été fait / bloquants
  - *Sprint Review* : démo de ce qui est fonctionnel
  - *Sprint Retrospective* : ce qui a bien/mal fonctionné, ajustements

### Backlog reformulé en user stories (par sprint)

**Sprint 1 — MVP**
- En tant qu'employé, je veux me connecter pour accéder à mon espace personnel
- En tant qu'employé, je veux créer une demande de sortie pour formaliser mon besoin de transport
- En tant qu'employé, je veux voir la liste et le statut de mes demandes pour suivre leur avancement
- En tant que chef logistique, je veux valider/refuser une demande pour contrôler les sorties
- En tant que chef logistique, je veux gérer la liste des véhicules pour connaître la flotte disponible

**Sprint 2 — Sorties & regroupement**
- En tant que chef logistique, je veux créer une sortie et y assigner un véhicule/conducteur
- En tant que chef logistique, je veux regrouper automatiquement les demandes compatibles pour optimiser les trajets
- En tant que chef logistique, je veux proposer une replanification plutôt que refuser directement
- En tant qu'employé, je veux accepter/refuser une replanification proposée
- En tant que chef logistique, je veux déclarer un véhicule en maintenance pour le rendre indisponible

**Sprint 3 — Suivi & temps réel**
- En tant que chef logistique, je veux saisir les km départ/arrivée pour clôturer une sortie
- En tant qu'utilisateur, je veux recevoir une notification à chaque événement me concernant
- En tant qu'administrateur, je veux un dashboard de statistiques pour piloter l'activité

**Sprint 4 — Industrialisation (ajouté au périmètre initial)**
- En tant que devops, je veux dockeriser l'app pour un déploiement reproductible
- En tant que devops, je veux un pipeline CI/CD pour automatiser tests et déploiement
- En tant qu'admin système, je veux déployer sur la VM Debian avec sauvegardes et supervision

### Où s'intègre l'IHM dans le cycle Scrum

L'IHM n'est **pas une étape à part détachée du dev**, elle doit être présente à 3 moments de chaque sprint :

1. **Avant le sprint (Planning)** : wireframe rapide (papier, Figma, ou même un croquis) de chaque écran concerné, validé par rapport aux critères ergonomiques déjà définis (guidage, charge de travail, contrôle explicite...) avant d'écrire du code
2. **Pendant le sprint (dev)** : chaque composant respecte la charte graphique (jaune/vert/blanc) et les règles responsive définies plus haut → checklist à cocher avant de passer une tâche en "In Review"
3. **En fin de sprint (Review)** : test rapide de la fonctionnalité sur mobile/tablette/desktop en plus de la démo fonctionnelle classique

### Checklist "Definition of Done" à utiliser sur chaque ticket UI

- [ ] Fonctionnalité conforme à la user story
- [ ] Responsive testé (mobile / tablette / desktop)
- [ ] Feedback utilisateur présent (toast succès/erreur, confirmation SweetAlert2 si action destructive, état vide, loading)
- [ ] Couleurs conformes à la charte (jaune/vert/blanc + mapping statuts)
- [ ] Pas d'action destructive sans confirmation
- [ ] Code review + CI verte

---

## Étape 1 — Backend : initialisation

```bash
mkdir backend && cd backend
npm init -y
npm install express sequelize pg pg-hstore dotenv cors bcrypt jsonwebtoken
npm install --save-dev nodemon sequelize-cli
```

Structure cible :

```
backend/
├── config/
│   └── config.json (ou config.js avec dotenv)
├── models/
├── controllers/
├── routes/
├── middlewares/
├── migrations/
├── seeders/
├── .env
├── server.js
└── package.json
```

Initialiser Sequelize CLI :

```bash
npx sequelize-cli init
```

`.env` :

```
DB_NAME=logistique_db
DB_USER=postgres
DB_PASSWORD=motdepasse
DB_HOST=127.0.0.1
DB_PORT=5432
JWT_SECRET=change_moi
PORT=5000
```

Créer la base :

```bash
createdb logistique_db
```

---

## Étape 2 — Modèles Sequelize (mapping du cahier des charges)

Génère les modèles avec la CLI (adapte les types), un exemple pour lancer le mouvement :

```bash
npx sequelize-cli model:generate --name Employee --attributes nom:string,prenom:string,email:string,password:string,department:string,role:string

npx sequelize-cli model:generate --name Vehicle --attributes type:string,capacity:integer,status:string,maintenance_until:date

npx sequelize-cli model:generate --name Request --attributes employee_id:integer,destination:string,motif:string,date_souhaitee:date,nb_personnes:integer,status:string

npx sequelize-cli model:generate --name Sortie --attributes vehicle_id:integer,driver_name:string,destination:string,departure_time:date,status:string,departure_km:integer,arrival_km:integer,distance_km:integer

npx sequelize-cli model:generate --name SortieRequest --attributes sortie_id:integer,request_id:integer

npx sequelize-cli model:generate --name Notification --attributes user_id:integer,message:string,type:string,is_read:boolean
```

Puis dans `models/index.js`, définir les **associations** :

- `Employee.hasMany(Request)`
- `Request.belongsTo(Employee)`
- `Sortie.belongsTo(Vehicle)`
- `Sortie.belongsToMany(Request, { through: SortieRequest })`
- `Request.belongsToMany(Sortie, { through: SortieRequest })`
- `Notification.belongsTo(Employee, { foreignKey: 'user_id' })`

Migrer :

```bash
npx sequelize-cli db:migrate
```

---

## Étape 3 — Authentification JWT

- `controllers/authController.js` : `register`, `login` (bcrypt.compare + jwt.sign)
- `middlewares/auth.js` : vérifie le token, injecte `req.user`
- `middlewares/checkRole.js` : `checkRole(['logistics_chief'])` pour protéger les routes sensibles

Routes :

```
POST /api/auth/register   (admin seulement, en pratique)
POST /api/auth/login
GET  /api/auth/me
```

👉 Rôles à gérer : `employee`, `logistics_chief`, `admin` (comme dans le cahier des charges).

---

## Étape 4 — Sprint 1 (MVP) : API demandes + véhicules

Routes principales :

```
POST   /api/requests           (employee)
GET    /api/requests/mine      (employee)
GET    /api/requests           (chief - toutes les demandes)
PATCH  /api/requests/:id/status (chief - approve/reject/reschedule)

GET    /api/vehicles
GET    /api/vehicles/available
POST   /api/vehicles           (admin/chief)
PATCH  /api/vehicles/:id       (maintenance, statut)
```

À ce stade, teste tout avec Postman/Thunder Client avant de toucher au front.

---

## Étape 5 — Frontend : initialisation

```bash
cd ../frontend
npx create-react-app . 
# ou npm create vite@latest . -- --template react   (recommandé, plus rapide)
npm install @mantine/core @mantine/hooks @mantine/form @mantine/dates @mantine/notifications @tabler/icons-react dayjs
npm install react-bootstrap bootstrap axios react-router-dom
```

Dans `index.js` ou `main.jsx`, importer les CSS (l'ordre compte : Mantine puis Bootstrap) :

```js
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';
```

Structure cible :

```
frontend/src/
├── api/          → axios instance + fonctions d'appel API
├── components/
├── pages/
│   ├── Login.jsx
│   ├── employee/
│   │   ├── NewRequest.jsx
│   │   └── MyRequests.jsx
│   └── chief/
│       ├── RequestsToValidate.jsx
│       ├── Vehicles.jsx
│       └── Sorties.jsx
├── context/AuthContext.jsx
├── routes/PrivateRoute.jsx
└── App.jsx
```

**Répartition suggérée des libs UI** :
- **Mantine** → tableaux de données, formulaires complexes (`useForm`), `Select`, `DatePicker` (via `@mantine/dates`), `Badge` de statut, `Modal`, `AppShell` (layout sidebar/header)
- **react-bootstrap** → composants ponctuels de layout simple (`Container`, cartes basiques) si besoin — Mantine a déjà son propre système de grille (`Grid`/`SimpleGrid`), donc en pratique tu peux souvent t'en passer complètement. On le garde ici uniquement si tu as une préférence pour certains composants Bootstrap spécifiques ; sinon, autant tout faire en Mantine pour éviter deux systèmes de design en parallèle.

---

## Étape 6 — Sprint 1 côté front

1. Page Login (JWT stocké en mémoire/contexte, pas en localStorage si tu veux du "propre" — sinon localStorage suffit pour un MVP interne)
2. `AuthContext` + `PrivateRoute` selon le rôle
3. Employé : formulaire de demande (`useForm` de `@mantine/form`) + tableau `Mes demandes` avec `Badge` de statut
4. Chef logistique : tableau des demandes en attente avec actions Valider / Refuser / Replanifier (Mantine `Table` + `Modal`)
5. Liste des véhicules disponibles (Mantine `Table` ou `Card`)

---

## Étape 7 — Sprint 2 : sorties, regroupement, replanification

Backend :
```
POST   /api/sorties                    (chief - créer une sortie)
POST   /api/sorties/:id/add-request    (regrouper une demande)
PATCH  /api/sorties/:id/status         (planned → ongoing → finished)
PATCH  /api/requests/:id/reschedule    (proposition chef)
PATCH  /api/requests/:id/reschedule/respond  (accept/refuse employé)
```

Logique de regroupement à coder côté backend (service dédié `sortieService.js`) :
- même destination
- écart horaire ≤ 30 min
- capacité véhicule non dépassée

Frontend :
- Interface "Créer une sortie" avec sélection multiple de demandes compatibles (filtrées automatiquement)
- Vue calendrier ou liste des sorties planifiées

---

## Étape 7bis — Responsive design & respect de l'IHM

Le système sera utilisé par des employés (potentiellement sur mobile/tablette sur le terrain) et par le chef logistique (plutôt sur poste fixe) → **il faut penser mobile-first** et respecter des règles d'ergonomie claires, pas juste "faire joli".

### Approche responsive technique

- **Mobile-first** : coder d'abord la version mobile, puis élargir avec les breakpoints.
- **Mantine Grid** (`Grid` / `Grid.Col`) gère nativement les breakpoints : `base`, `xs`, `sm`, `md`, `lg`, `xl`.
  ```jsx
  <Grid>
    <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>...</Grid.Col>
  </Grid>
  ```
  Pour des grilles simples et régulières, `SimpleGrid` est souvent plus rapide :
  ```jsx
  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">...</SimpleGrid>
  ```
- Si tu gardes ponctuellement react-bootstrap pour certains composants, n'utilise pas sa grille en parallèle de celle de Mantine sur la même page → un seul système de grille par page pour éviter les conflits de layout.
- Tableaux Mantine (`Table`) sur mobile : envelopper dans `<Table.ScrollContainer minWidth={600}>` pour le scroll horizontal, ou basculer en `Card`/liste en dessous de `md` (les tableaux larges ne passent pas bien en petit écran).
- Formulaires (`useForm` de `@mantine/form`) : les composants Mantine (`TextInput`, `Select`...) sont déjà responsives par défaut ; utiliser `Stack` en vertical sur mobile plutôt que `Group` en ligne pour éviter les labels tronqués.
- Navigation : `AppShell` de Mantine gère nativement le layout header/sidebar responsive avec `AppShell.Navbar` qui se transforme en menu burger (`Burger` component) sur mobile — pas besoin de composant tiers pour ça.
- Tester au minimum sur 3 tailles : mobile (~375px), tablette (~768px), desktop (~1280px), via les DevTools VSCode/Chrome.

### Règles IHM à respecter (critères ergonomiques)

À appliquer systématiquement dans les maquettes et le code front (référence : critères de Bastien & Scapin / heuristiques de Nielsen) :

| Critère | Application concrète dans le projet |
|---|---|
| **Guidage** | Statuts toujours visibles avec code couleur cohérent (`Badge` Mantine : gris=pending, vert=approved, rouge=rejected, jaune=rescheduled) |
| **Charge de travail** | Formulaire de demande minimal (pas de champs inutiles), pré-remplissage quand possible |
| **Contrôle explicite** | Aucune action destructive sans confirmation (`Modal.confirm` avant refus/clôture de sortie) |
| **Adaptabilité** | Vue différente employé / chef logistique selon le rôle, pas la même interface pour tous |
| **Gestion des erreurs** | Messages d'erreur explicites (`form.setFieldError()` de `@mantine/form` sous les champs, toast pour les erreurs API), validation des formulaires avant envoi |
| **Homogénéité/cohérence** | Mêmes composants pour actions similaires partout (boutons, couleurs, icônes) dans toute l'app |
| **Signifiance des codes** | Icônes explicites (véhicule, kilométrage, notification) + libellés, jamais une icône seule sans label sur mobile |
| **Compatibilité** | Vocabulaire métier logistique cohérent avec celui du cahier des charges (pas de mélange FR/EN dans l'UI) |

### Feedback utilisateur (obligatoire, pas optionnel) — avec SweetAlert2 & react-toastify

Plutôt que le système de notifications natif de Mantine (`@mantine/notifications`), on utilise deux libs dédiées pour le feedback, plus simples à personnaliser avec la charte jaune/vert/blanc (Mantine reste utilisé pour tous les autres composants — formulaires, tableaux, modals, layout) :

```bash
npm install sweetalert2 react-toastify
```

**Répartition claire des rôles** (pour ne pas mélanger les deux sans raison) :
- **react-toastify** → notifications courtes et non-bloquantes (succès, erreur, info) : création de demande, validation, erreur API, notification temps réel
- **SweetAlert2** → actions qui nécessitent une **confirmation explicite** de l'utilisateur (contrôle explicite IHM) : refuser une demande, clôturer une sortie, supprimer un véhicule

#### Setup global (une fois, dans `App.jsx`)

```jsx
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <>
      {/* ...routes */}
      <ToastContainer
        position="top-right"
        autoClose={3500}
        theme="light"
      />
    </>
  );
}
```

#### Toasts stylés selon la charte (fichier utilitaire `utils/toast.js`)

```js
import { toast } from 'react-toastify';

const baseStyle = { fontWeight: 500 };

export const notifySuccess = (msg) =>
  toast.success(msg, { style: { ...baseStyle, borderLeft: '4px solid #2E7D32' } });

export const notifyError = (msg) =>
  toast.error(msg, { style: { ...baseStyle, borderLeft: '4px solid #D32F2F' } });

export const notifyInfo = (msg) =>
  toast.info(msg, { style: { ...baseStyle, borderLeft: '4px solid #F5B301' } });
```

Utilisation dans un appel API :

```js
try {
  await api.post('/requests', payload);
  notifySuccess('Demande envoyée avec succès');
} catch (err) {
  notifyError(err.response?.data?.message || 'Erreur lors de l’envoi de la demande');
}
```

#### Confirmations SweetAlert2 (charte jaune/vert/blanc, fichier `utils/confirm.js`)

```js
import Swal from 'sweetalert2';

export const confirmAction = ({
  title = 'Confirmer l’action',
  text = 'Cette action est irréversible.',
  confirmText = 'Confirmer',
}) =>
  Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Annuler',
    confirmButtonColor: '#2E7D32', // vert marque
    cancelButtonColor: '#8C8C8C',
    reverseButtons: true,
  }).then((result) => result.isConfirmed);
```

Utilisation (exemple : refus d'une demande) :

```js
const handleReject = async (id) => {
  const confirmed = await confirmAction({
    title: 'Refuser cette demande ?',
    text: 'L’employé sera notifié du refus.',
    confirmText: 'Oui, refuser',
  });
  if (!confirmed) return;

  try {
    await api.patch(`/requests/${id}/status`, { status: 'rejected' });
    notifySuccess('Demande refusée');
  } catch {
    notifyError('Impossible de refuser la demande');
  }
};
```

- Chargement : `Loader` ou `Skeleton` de Mantine pendant les appels API (pas de conflit avec les deux autres libs, rôle différent)
- Succès/échec d'une action → `notifySuccess` / `notifyError` (react-toastify)
- Confirmation avant action destructive → `confirmAction` (SweetAlert2)
- État vide → composant `Center` + `Text c="dimmed"` de Mantine si aucune demande/sortie ("Aucune demande en attente" plutôt qu'un tableau vide silencieux)

---

## Étape 7ter — Charte graphique (jaune / vert / blanc)

### Palette proposée

| Rôle | Couleur | Hex | Usage |
|---|---|---|---|
| Primaire (marque) | Jaune | `#F5B301` (ou `#FFC107`) | boutons principaux, header, éléments actifs, logo |
| Secondaire (marque) | Vert | `#2E7D32` (ou `#4CAF50` plus clair) | actions positives, validation, statut "approved" |
| Fond | Blanc | `#FFFFFF` | fond principal des pages |
| Fond secondaire | Gris très clair | `#F5F5F5` ou `#FAFAFA` | fond des cartes/sections pour contraster avec le blanc pur |
| Texte principal | Gris foncé | `#1F1F1F` | jamais du noir pur, plus doux à lire |
| Texte secondaire | Gris moyen | `#595959` | labels, sous-titres |

⚠️ Point d'attention important : le **vert de la marque** et le **vert "statut approuvé"** vont probablement se confondre visuellement — c'est en fait une bonne chose ici (cohérence de marque + sémantique), mais il faut garder le **jaune uniquement pour l'identité/actions**, pas pour un statut d'alerte (le jaune est déjà utilisé ailleurs, un statut "pending" en jaune serait noyé dans l'UI). Proposition de mapping des statuts qui reste lisible :

| Statut demande | Couleur | Pourquoi |
|---|---|---|
| `pending` | Gris/bleu neutre (`#8C8C8C` ou `#1677FF`) | neutre, "en attente", ne rentre pas en conflit avec le jaune de marque |
| `approved` | Vert marque (`#2E7D32`) | cohérent avec l'identité + sémantique universelle |
| `rejected` | Rouge (`#D32F2F`) | seule couleur "hors charte" tolérée, car le rouge est universellement compris comme un refus/erreur et n'a pas d'équivalent en jaune/vert |
| `rescheduled` | Jaune marque (`#F5B301`) | attire l'attention = "action requise de l'employé" |

### Configuration Mantine (thème global, une seule fois)

Mantine fonctionne par palettes de 10 nuances (`[0]` très clair → `[9]` très foncé). On définit les nuances jaune et verte de la marque comme couleurs personnalisées :

```jsx
// theme.js
import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'brandYellow',
  colors: {
    brandYellow: [
      '#FFF9E5', '#FFEFBF', '#FFE494', '#FFD968', '#FFCF45',
      '#F5B301', '#E0A400', '#C79000', '#AD7C00', '#946800',
    ],
    brandGreen: [
      '#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A',
      '#2E7D32', '#276B2A', '#205923', '#19471C', '#123515',
    ],
  },
  primaryShade: 5, // correspond à #F5B301 / #2E7D32 dans les palettes ci-dessus
  defaultRadius: 'md',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
});
```

```jsx
// App.jsx
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';

<MantineProvider theme={theme}>
  <App />
  <Notifications />
</MantineProvider>
```

Ensuite, pour utiliser le vert de la marque sur un bouton spécifique (ex : "Valider") sans changer la couleur primaire globale (qui reste le jaune) :

```jsx
<Button color="brandGreen">Valider</Button>
```

### Côté react-bootstrap

Surcharger les variables SCSS de Bootstrap (fichier `custom.scss` importé à la place de `bootstrap/dist/css/bootstrap.min.css`) :

```scss
$primary: #F5B301;
$success: #2E7D32;
$danger: #D32F2F;
$light: #FFFFFF;
$body-color: #1F1F1F;

@import "~bootstrap/scss/bootstrap";
```

### Règle d'accessibilité (contraste)

Le jaune `#F5B301` est **clair** → ne jamais mettre du texte blanc dessus (contraste insuffisant, non conforme WCAG). Sur fond jaune, toujours utiliser du texte foncé (`#1F1F1F`). Sur fond vert `#2E7D32`, le texte blanc passe bien (contraste correct).

- Bouton jaune → texte foncé
- Bouton vert (validation) → texte blanc
- Bandeau/header jaune → logo + texte en gris foncé, pas en blanc

---

## Étape 9 — Dockerisation

### `backend/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

### `frontend/Dockerfile` (build statique servi par nginx)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`frontend/nginx.conf` minimal (SPA + proxy API) :

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://backend:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### `docker-compose.yml` (racine du projet)

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: logistique_db
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    environment:
      DB_HOST: db
    depends_on:
      db:
        condition: service_healthy
    expose:
      - "5000"

  frontend:
    build: ./frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  pgdata:
```

Fichier `.env` à la racine (utilisé par docker-compose, **ne pas commit**) :

```
DB_USER=postgres
DB_PASSWORD=change_moi
```

Ajouter au `.gitignore` racine : `.env`, `**/.env`, `pgdata/`.

Test en local :

```bash
docker compose up --build
```

---

## Étape 10 — CI/CD avec GitHub Actions

Objectif : à chaque push sur `main`, build des images, tests, puis déploiement automatique sur la VM Debian.

### `.github/workflows/ci.yml` — build & tests (sur toute PR/push)

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [develop, main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: logistique_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
        working-directory: backend
      - run: npm test
        working-directory: backend
        env:
          DB_HOST: localhost
          DB_USER: postgres
          DB_PASSWORD: test
          DB_NAME: logistique_test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
```

### `.github/workflows/deploy.yml` — déploiement (sur push `main` uniquement)

Approche simple et robuste pour une VM Debian : GitHub Actions se connecte en SSH et relance `docker compose` depuis le repo cloné sur la VM (pas besoin de registry externe pour un projet interne).

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    needs: []
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VM_HOST }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.VM_SSH_KEY }}
          script: |
            cd /opt/logistique-app
            git pull origin main
            docker compose up -d --build
            docker image prune -f
```

Secrets à créer dans **GitHub → Settings → Secrets and variables → Actions** :
- `VM_HOST` (IP ou domaine de la VM)
- `VM_USER` (utilisateur de déploiement, pas root)
- `VM_SSH_KEY` (clé privée dédiée, générée spécifiquement pour ce déploiement, jamais ta clé perso)

👉 Alternative plus "propre" si tu veux monter en gamme plus tard : build + push des images vers GitHub Container Registry (`ghcr.io`), puis la VM ne fait qu'un `docker compose pull && up -d`. Je peux détailler cette variante si tu préfères éviter de faire tourner `npm ci`/build directement sur la VM de prod.

---

## Étape 11 — Déploiement sur VM Debian

### Préparation de la VM (une seule fois)

```bash
# Mise à jour
sudo apt update && sudo apt upgrade -y

# Docker (méthode officielle)
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Utilisateur de déploiement, sans privilège root direct
sudo adduser deployer
sudo usermod -aG docker deployer
```

### Clé SSH dédiée au déploiement

Sur ta machine, génère une paire de clés dédiée (pas ta clé perso) :

```bash
ssh-keygen -t ed25519 -f deploy_key -C "github-actions-deploy" -N ""
```

- clé **publique** → `~deployer/.ssh/authorized_keys` sur la VM
- clé **privée** → secret `VM_SSH_KEY` dans GitHub

### Firewall (ufw)

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp   # si HTTPS plus tard
sudo ufw enable
```

### Premier déploiement manuel

```bash
sudo mkdir -p /opt/logistique-app
sudo chown deployer:deployer /opt/logistique-app
su - deployer
cd /opt
git clone https://github.com/<ton-user>/logistique-app.git
cd logistique-app
cp backend/.env.example backend/.env   # à adapter avec les vraies valeurs prod
nano .env                               # DB_USER / DB_PASSWORD prod
docker compose up -d --build
```

Ensuite, chaque `git push` sur `main` déclenche automatiquement le pipeline `deploy.yml` qui refait `git pull` + `docker compose up -d --build` sur la VM.

### Points sysadmin à ne pas négliger

- **Sauvegardes PostgreSQL** : cron quotidien avec `pg_dump` dans le conteneur, exporté hors du volume Docker (idéalement hors de la VM) :
  ```bash
  0 2 * * * docker exec -t $(docker compose -f /opt/logistique-app/docker-compose.yml ps -q db) pg_dump -U postgres logistique_db | gzip > /backups/logistique_$(date +\%F).sql.gz
  ```
- **HTTPS** : si la VM a un nom de domaine, ajouter un reverse proxy Nginx/Traefik + Certbot devant le conteneur frontend plutôt que d'exposer directement le port 80 du conteneur.
- **Logs** : `docker compose logs -f backend` en attendant une solution centralisée (Loki/Promtail si tu montes en volume plus tard).
- **Monitoring minimal** : `docker stats`, ou un exporter Prometheus + node_exporter sur la VM si tu veux du monitoring réseau/système en plus de l'appli.
- **Mise à jour du système hôte** : `unattended-upgrades` sur Debian pour les patchs de sécurité, indépendamment du cycle de déploiement applicatif.

---

## Étape 12 — Sprint 3 : kilométrage, notifications, dashboard

Backend :
```
PATCH /api/sorties/:id/depart   (departure_km)
PATCH /api/sorties/:id/arrivee  (arrival_km → calcule distance_km, clôture)
GET   /api/notifications/mine
PATCH /api/notifications/:id/read
```

Temps réel : `socket.io` côté backend, `socket.io-client` côté front, room par `user_id`.

Dashboard admin (composant `StatsCard` custom + `@mantine/charts`, basé sur Recharts sous le capot) :
- nombre de sorties par période
- km parcourus par véhicule
- taux de disponibilité flotte

---

## Ordre de travail recommandé

1. ✅ Backend Sprint 1 (auth + demandes + véhicules) — testé via Postman
2. ✅ Frontend Sprint 1 (login + demandes + validation)
3. ✅ Backend Sprint 2 (sorties + regroupement)
4. ✅ Frontend Sprint 2
5. ✅ Dockerisation (backend + frontend + docker-compose) — validée en local
6. ✅ CI/CD GitHub Actions (ci.yml puis deploy.yml)
7. ✅ Préparation VM Debian + premier déploiement manuel
8. ✅ Sprint 3 (km, notifications, dashboard) — déployé automatiquement via le pipeline

Chaque étape = une branche `feature/xxx`, une PR, un merge dans `develop`, puis `main` en fin de sprint.

---

## Prochaine étape concrète

Dis-moi par laquelle tu veux commencer concrètement (je peux générer le code) :
- le `server.js` + config Sequelize + `.env`
- les modèles + associations complètes
- le contrôleur d'authentification JWT
- le squelette React (routing + `AppShell` Mantine)
