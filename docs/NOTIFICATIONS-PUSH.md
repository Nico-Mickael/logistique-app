# Notifications push téléphone — Web Push (VAPID)

## Mécanisme retenu

**Web Push (Push API + VAPID)** — protocole standard, **gratuit**, sans compte ni
fournisseur payant. La livraison des notifications repose sur les services de
push intégrés des navigateurs, automatiquement sélectionnés par celui-ci :

| Navigateur | Service de push |
|---|---|
| Chrome / Edge (Android, Windows, Linux) | FCM (Firebase Cloud Messaging) |
| Firefox (Android, desktop) | Mozilla autopush |
| Safari (macOS, iOS 16.4+) | APNs (Apple Push Notification service) |

> Choix justifié : l'application est une **SPA web** (React) déjà servie en HTTP(S).
> Une app native (FCM/APNs) demanderait une réécriture mobile hors périmètre, et un
> service tiers payant (OneSignal, Pusher, Expo…) a été écarté : l'existant ne
> dépend d'aucun fournisseur, Web Push s'y branche gratuitement.

## Architecture

Tout transite par le **point d'entrée unique existant** : `createNotification`
(`backend/controllers/notificationController.js`). Il persiste la notification
en base, puis, en parallèle et sans blocage (`fire & forget`) :

- **socket.io** → fil `notification` (temps réel dans l'app, inchangé) ;
- **email** (si SMTP, inchangé) ;
- **Web Push** → `webPushService.sendToUser()` (nouveau).

Ainsi, **toute** notification ajoutée au système existant devient
automatiquement un push : aucune notification n'est dupliquée manuellement.

```
Événement (sortie créée, rappel imminent, demande validée, annulation…)
   └─ createNotification({ user_id, message, type, entity_type, entity_id })
        ├─ Notification (base)   → anti-doublon (unique user/type/entité)
        ├─ socket.io             → cloche + toast (en ligne)
        ├─ email                 → si SMTP configuré
        └─ PushSubscriptions     → 1 push / appareil abonné
```

Nouveaux fichiers :

- `backend/models/pushSubscription.js` + migration
  `20260910160000-create-push-subscriptions.js`
- `backend/services/webPushService.js` (envoi, tokens, dédup, bornes, erreurs)
- `backend/controllers/pushController.js` + `backend/routes/pushRoutes.js`
- `frontend/public/sw.js` (service worker push), `manifest.webmanifest`,
  `frontend/src/context/PushContext.jsx`, `frontend/src/utils/push.js`,
  `frontend/src/api/pushService.js`,
  `frontend/src/components/PushSettingsPopover.jsx` (UI dans le Header)

### Événements notifiés (interface actuelle)

| Événement | Déclencheur backend |
|---|---|
| Nouvelle sortie | `notificationService.notifySortieCreated` |
| Sortie modifiée / replanifiée (date/heure, destination, véhicule) | `sortieController.update` |
| Affectation / changement de chauffeur | `notifyDriverAssigned` / `notifyDriverChanged` |
| Annulation d'une sortie | `sortieController.remove` |
| Demande validée / refusée / replanifiée / annulée | `requestController` |
| Rappel de sortie imminente (T-30 min) | `sortieScheduler` (déjà en place) |
| Démarrage / fin de sortie | `sortieController` / `driverController` |

## Configuration requise

### 1. HTTPS (obligatoire en production)

Les notifications push exigent une **contexte sécurisé** :
- en production : certifiez votre domaine (Let's Encrypt) **devant** le reverse
  proxy nginx (`frontend/nginx.conf`) — ex. `listen 443 ssl` + un bloc
  de redirection `80 → 443`. Le push et le manifest PWA ne fonctionnent pas en
  HTTP simple sur un téléphone.
- en développement : `localhost` est accepté sans HTTPS.

### 2. Clés VAPID (côté backend)

Générez une paire de clés **une fois** :

```bash
cd backend
npx web-push generate-vapid-keys
```

Ajoutez-les au fichier `backend/.env` (et `backend/.env.example`) :

```ini
VAPID_PUBLIC_KEY=BG3…votre-clé-publique…F81kHU
VAPID_PRIVATE_KEY=MSy…votre-clé-privée…
# Contact affiché par les navigateurs (recommandé)
VAPID_SUBJECT=mailto:logistique@ades.mg
# Optionnel : force l'activation (true) ou la désactivation (false).
# Sans PUSH_ENABLED, l'activation dépend de la présence des deux clés.
PUSH_ENABLED=true
```

Le backend affiche au démarrage :

```
📲 Notifications push activées (Web Push / VAPID)
```
ou
```
📲 Notifications push désactivées — renseignez VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY (.env)
```

La clé publique est exposée publiquement par `GET /api/push/config`
(elle est conçue pour l'être). La clé privée ne quitte jamais le serveur.

### 3. Base de données

```bash
npx sequelize-cli db:migrate
```
Crée la table `PushSubscriptions` (endpoint, clés p256dh/auth, libellé appareil,
index unique `(user_id, endpoint)`).

### 4. Frontend (PWA)

Les fichiers `frontend/public/manifest.webmanifest`, `sw.js`,
`icons/icon-192.png` / `icon-512.png` et les balises dans `index.html` sont déjà
en place. `docker-compose.yml` (nginx) sert automatiquement `/sw.js` **sans cache**
(`location = /sw.js`).

> Pour des icônes d'installation optimales, remplacez les deux PNG par de vrais
> 192×192 et 512×512 (actuellement des copies du logo).

## Utilisation

1. L'utilisateur ouvre l'app sur son téléphone.
2. Il clique sur l'icône **téléphone** du Header (à côté de la cloche).
3. « Activer les alertes sur ce téléphone » → le navigateur demande la
   permission → le token est enregistré sur le serveur.

Les onglets disponibles dans ce panneau :
- **Activer / Désactiver** sur l'appareil courant ;
- **Envoyer un test** (valide le parcours complet jusqu'au téléphone) ;
- Gestion des **permissions** (permission refusée : message explicite, bouton
  « Réessayer » — la réactivation définitive se fait dans les réglages du
  navigateur).

### Limites plateformes (à connaître)

- **Android** : Chrome, Edge, Firefox — support complet.
- **iPhone / iPad** : Web Push n'existe que via **Safari** et **uniquement si
  l'app est installée sur l'écran d'accueil** (PWA : Safari → Partager →
  « Ajouter à l'écran d'accueil »). Chrome sur iOS ne supporte pas le push.
- La notification apparaît même si l'application est fermée (rôle du service
  worker), mais le navigateur peut retenir une notification imprécise selon ses
  budgets de batterie.

## Robustesse & gestion des erreurs

- **Anti-doublon** : l'index unique `(user_id, endpoint)` rend l'abonnement
  idempotent (upsert). Côté notification, la dédup existante par
  `(user, type, entité)` garantit **une** notification par événement. Le
  service worker regroupe les notifications identiques par `tag`.
- **Tokens** : un appareil = une ligne ; borne de **5 tokens par utilisateur**
  (les plus anciens sont purgés). Endpoint `DELETE /api/push/subscribe`.
- **Expiration** : `web-push` renvoie `404/410` quand un token n'est plus
  valable → le token est **automatiquement retiré** de la base.
- **Non-blocage** : `sendToUser` ne lève jamais ; en cas d'échec, le flux
  existant (socket + email + base) continue. Envois parallèles via
  `Promise.allSettled`.
- **Redondance** : le polling 5 s existant reste le filet de sécurité dans
  l'application ; le push téléphone est un canal séparé.
- **Désactivation** : sans clés VAPID (ou `PUSH_ENABLED=false`), toutes les
  fonctions deviennent des no-op — le système de notification existant est
  strictement inchangé.

## API

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/push/config` | non | `{ enabled, vapidPublicKey, maxPerUser }` |
| GET | `/api/push/subscriptions` | oui | appareils abonnés de l'utilisateur |
| POST | `/api/push/subscribe` | oui | enregistre `{ subscription, device }` |
| DELETE | `/api/push/subscribe` | oui | corps `{ endpoint }` |
| POST | `/api/push/test` | oui | notification de test sur les appareils |

## Vérifier de bout en bout

1. `npx sequelize-cli db:migrate`
2. backend : clés VAPID dans `.env`, puis `npm run dev` (log « push activées »).
3. frontend : `npm run build` puis ouvrir l'app en HTTPS/localhost.
4. Dans le Header → icône téléphone → « Activer les alertes » → « Envoyer un
   test » → une notification doit apparaître.
5. Créer une sortie planifiée à moins de 30 min : le rappel d'imminence doit
   arriver sur le téléphone.