# Manuel utilisateur — Plateforme de transport

Application de gestion des demandes de transport, des sorties de véhicules, des chauffeurs et des rapports du service logistique.

---

## 1. Connexion et déconnexion

1. Ouvrez l'adresse de l'application dans votre navigateur (Chrome, Edge ou Firefox de préférence).
2. Saisissez votre **e-mail** et votre **mot de passe**, puis cliquez sur **Connexion**.
3. En cas de mot de passe oublié, contactez le superadministrateur (il peut le réinitialiser).

Pour vous **déconnecter**, cliquez sur votre **avatar en haut à droite**, puis sur **Déconnexion**.

> La session expire automatiquement après une certaine durée d'inactivité : vous serez redirigé vers l'écran de connexion. Votre navigateur peut également être désynchronisé ; rechargez la page (F5).

---

## 2. L'interface

### La barre latérale

Le menu de gauche affiche les pages auxquelles vous avez droit selon **votre rôle**. Un item actif est surligné. Vous pouvez réduire/développer le menu avec le petit bouton rond flottant en haut (ou replier manuellement).

Une **pastille rouge** sur *Demandes* ou *Sorties* indique qu'il y a des éléments à traiter (par exemple des demandes en attente ou des retours à valider).

### L'en-tête

- **Nom du site courant** : affiché à côté du logo (ex. « Site A »). L'icône **« i »** à côté affiche, au survol, des informations sur ce site : nom, code, ville, adresse et statut.
- **Avatar (à droite)** : ouvre votre menu de compte — voir **changer sa disponibilité** (§ 4) et **se déconnecter**.
- **Icône soleil/lune (bas du menu)** : bascule entre le thème clair et sombre.

---

## 3. Rôles et droits

| Rôle | Pages disponibles |
| --- | --- |
| **Employé** | Accueil, Mes demandes, Nouvelle demande, Mes trajets, Sessions, Mes rapports |
| **Chauffeur** | Accueil, Mes sorties, Mes trajets, Sessions, Mes rapports |
| **Chef logistique** | Accueil, Tableau de bord, Demandes (validation), Sorties, Véhicules, Sessions |
| **Superadmin** | Accueil, Tableau de bord, Demandes, Sorties, Utilisateurs, Sites, Véhicules, Sessions |

Les rôles *admin* et *superadmin* héritent des droits du chef logistique.

---

## 4. Votre disponibilité (importante pour les chauffeurs)

La plateforme distingue **la disponibilité professionnelle** (« suis-je disponible pour prendre une sortie ? ») de l'état technique de connexion (être connecté n'est pas être disponible).

Pour la changer :
1. Cliquez sur votre **avatar** en haut à droite.
2. Choisissez l'un des statuts :

| Statut | Signification |
| --- | --- |
| **Disponible** (point vert) | Vous êtes prêt à prendre des sorties. C'est le statut par défaut. |
| **Hors ligne** (point gris) | Vous ne souhaitez pas être affecté pour le moment. |
| **En absence** (point rouge) | Indisponible temporaire (maladie, autorisation…). |
| **En congé** (point orange) | Congé : choisissez une **date de début** et une **date de fin** (format JJ/MM/AAAA), puis validez. |

Règles à connaître :
- **Un chauffeur ne peut être affecté à une sortie que s'il est « Disponible »**. Si votre statut n'est pas disponible, le chef logistique ne pourra pas vous sélectionner.
- Pendant un congé, vous êtes automatiquement remis « Disponible » le **lendemain de la date de fin**, sans action de votre part. Vous pouvez aussi le faire manuellement via **Rendre disponible maintenant**.
- Si votre absence n'a pas de date définie, pensez à revenir sur **Disponible** dès que vous êtes de retour.

---

## 5. Employé : gérer ses demandes de transport

### Créer une nouvelle demande

1. Menu **Nouvelle demande**.
2. Renseignez :
   - **Destination** (obligatoire),
   - **Motif** (obligatoire),
   - **Date souhaitée** (date et heure ; elle ne peut pas être dans le passé),
   - **Nombre de personnes** (1 à 20).
3. Cliquez sur **Envoyer** : la demande part chez le chef logistique pour validation.

### Suivre ses demandes (Mes demandes)

Liste consultable en **cartes** ou **tableau** (bouton de bascule en haut). Chaque demande affiche son statut (§ 9).

Actions possibles selon le statut :

| Statut | Actions |
| --- | --- |
| En attente | **Modifier**, **Annuler**, **Supprimer** |
| Validée | **Annuler** (libère la place sur le véhicule), **Supprimer** |
| Replanifiée | **Accepter** la nouvelle date ou **Refuser** (la demande sera annulée) |
| Refusée / Annulée | **Supprimer** de l'historique |

Cliquez sur une carte (ou une ligne) pour ouvrir le **détail complet** de la demande.

### Mes trajets

Liste des trajets (sorties) auxquels vous êtes rattaché ou que vous pouvez rejoindre.

- **Rejoindre cette sortie** : si une place est libre, indiquez le **nombre de personnes** puis confirmez. Le bouton indique « Complet » lorsqu'il n'y a plus de place.
- Une fois la sortie **terminée**, vous pourrez voir **rapport** la consommation et la distance.
- Un trajet avec départ **imminent** déclenche un rappel « préparez-vous » (notification).

### Mes rapports

Votre tableau de bord personnel : demandes par statut, kilomètres parcourus par mois, répartition des statuts et vos destinations les plus fréquentes (année au choix). Pas d'export.

---

## 6. Chauffeur : mes sorties

La page **Mes sorties** regroupe toutes les sorties qui vous sont affectées, classées en trois groupes : **Planifiées**, **En cours**, **Terminées**.

### Démarrer une sortie

1. Dans la section **Planifiées**, cliquez sur **Démarrer la sortie**.
2. Saisissez le **kilométrage compteur** de la voiture au départ (doit être supérieur à 0) et confirmez.
3. La sortie passe en **En cours** ; votre kilométrage de départ est enregistré.

### Enregistrer l'arrivée

1. Cliquez sur **Saisir le KM d'arrivée**.
2. Renseignez le **kilométrage d'arrivée** (ne peut pas être inférieur à celui de départ) et **l'heure de retour**.
3. Confirmez : la **distance parcourue** est calculée automatiquement et la sortie passe en **Terminée** (après validation du retour par le chef logistique : *Retour à valider*).

Bon à savoir :
- Chaque carte rappelle : destination, véhicule, date/heure de départ, motif, kilométrages, passagers et leur nombre.
- Votre **disponibilité** doit être « Disponible » pour que vous puissiez être affecté à de nouvelles sorties (voir § 4).

### Mes trajets

Vos trajets en tant que passager, avec les mêmes fonctionnalités que l'employé (§ 5).

### Mes rapports

Historique de vos sorties effectuées, exportable en CSV.

---

## 7. Chef logistique

### Tableau de bord

Synthèse chiffrée du jour :
- Statistiques des **demandes** (en attente, validées, replanifiées, refusées, annulées),
- Statistiques des **sorties** (prévues, imminentes, en cours, retours à valider, terminées),
- **Véhicules** disponibles / en sortie / en maintenance / en panne,
- **Plannings** de la semaine et du mois (graphique des sorties par jour),
- **Chauffeurs disponibles** : nombre de chauffeurs prêts à partir (statut « Disponible »).

### Valider les demandes

Dans **Demandes**, vous voyez toutes les demandes en attente avec leur détail (employé, département, destination, motif, date souhaitée, nombre de personnes).

Pour chaque demande :
- **Valider** : regroupe plusieurs demandes vers une même destination/date pour former une **sortie commune**.
- **Refuser** : précisez éventuellement un motif (visible par l'employé).
- **Replanifier** : proposez une **nouvelle date/heure** à l'employé (avec un motif). L'employé doit l'**accepter** ; s'il refuse, la demande est annulée.
- L'export **CSV** télécharge la liste filtrée.

### Gérer les sorties

La page **Sorties** liste toutes les sorties avec leur statut (§ 9) et leurs passagers.

- **Créer ou rejoindre la sortie** : à partir de demandes validées, créez une sortie en choisissant le véhicule et le chauffeur (voir *Création de sortie*).
- **Affecter un chauffeur** : seuls les chauffeurs affichés **« Disponible »** (point vert) peuvent être sélectionnés. Un chauffeur indisponible (hors ligne, en congé, en absence) est grisé/absent de la liste.
- Suivi des **kilométrages départ/arrivée**, des **distances** et des **passagers embarqués**.
- En cas de sortie *Retour à valider*, validez le retour saisi par le chauffeur pour clôturer la sortie.

### Créer une sortie

1. Choisissez la **destination** et la **date/heure de départ**.
2. Sélectionnez le **véhicule** (avec sa capacité et son statut).
3. Sélectionnez le **chauffeur** parmi ceux **disponibles**.
4. Ajoutez les **passagers** (demandes validées) et complétez le **motif**.
5. Enregistrez : les demandes sont rattachées à la sortie.

### Véhicules

- Liste du parc avec **type** (moto, voiture, minibus), **capacité**, **statut** et immatriculation.
- **Ajouter / modifier / supprimer** un véhicule. Un véhicule qui a des sorties enregistrées est **archivé** à la suppression : il disparaît du parc et des sélections, mais son **historique kilométrique est conservé**.
- Statuts : **Disponible**, **En sortie** (auto), **Maintenance**, **En panne** — à mettre à jour manuellement pour maintenance/panne.

### Planning

Vue d'ensemble des sorties planifiées sur la semaine ou le mois (selon le filtre choisi), utile pour anticiper les conflits de véhicules ou de chauffeurs.

### Sessions

Liste des **sessions connectées** (appareils actifs de tous les utilisateurs) : voir qui est connecté, sur quel appareil, depuis quand, et éventuellement **déconnecter** une session à distance.

### Rapports

- **Tableau de bord** : synthèse par période (demandes, flotte, kilomètres par mois, top destinations) + export **Excel**.
- **Historique kilométrique** : sorties terminées d'une période, avec distances et véhicules. Vue **cartes** ou **tableau**, filtre par véhicule, export **CSV** (séparateur `;`). Cochez une ou plusieurs lignes (ou **Tout sélectionner**) puis **Supprimer** pour retirer les sorties de l'historique.
- **Rapport passagers** : détails par passager (trajets, kilométrages) → export **CSV**.

---

## 8. Superadministrateur

L'administrateur dispose de tous les outils du chef logistique, plus :

### Utilisateurs

- **Lister** les comptes (avec leur **disponibilité** affichée à côté du nom et leurs rapports).
- **Créer un utilisateur** : nom, prénom, e-mail, mot de passe, **rôle** (employé, chauffeur, chef logistique, admin, superadmin), **département** et **site**.
- **Modifier** un compte (y compris réinitialiser un mot de passe) et changer son **statut** (actif / inactif).

### Sites

- **Lister les sites** (nom, code, ville, adresse, statut).
- **Créer / modifier / supprimer** un site. Le **code** est unique et toujours enregistré en majuscules. Un site contenant des données (utilisateurs, véhicules, demandes ou sorties) est **archivé** à la suppression : il passe « **Inactif** », disparaît des sélecteurs, et son **historique est conservé**. Le site par défaut (TANA) ne peut pas être supprimé.

---

## 9. Récapitulatif des statuts

### Demandes

| Statut | Couleur | Signification |
| --- | --- | --- |
| En attente | gris | Soumise, pas encore traitée |
| Validée | vert | Acceptée ; une place/sortie vous est réservée |
| Replanifiée | jaune | Une nouvelle date vous est proposée ; à accepter ou refuser |
| Refusée | rouge | Non acceptée (un motif peut être indiqué) |
| Annulée | gris | Supprimée ou refusée après replanification |

### Sorties

| Statut | Signification |
| --- | --- |
| Sortie prévue | Planifiée, dans l'attente du départ |
| Sortie imminente / Bientôt | Départ proche (rappel envoyé au chauffeur) |
| Sortie en cours | Démarrée (km de départ enregistré) |
| Retour à valider | Le chauffeur a saisi le retour ; le chef logistique doit valider |
| Sortie terminée | Clôturée |
| Annulée | Sortie annulée |

### Véhicules

| Statut | Signification |
| --- | --- |
| Disponible | Prêt à être affecté |
| En sortie | Automatiquement attribué pendant une sortie |
| Maintenance | En atelier/révision (à déclarer manuellement) |
| En panne | Indisponible (à déclarer manuellement) |

---

## 10. Notifications

- **Badges rouges** dans le menu : nouveaux éléments à traiter (demandes à valider, retours à valider).
- **Notifications navigateur (push)** : rappels « préparez-vous » envoyés aux chauffeurs avant un départ imminent, et alertes de replanification.
- Autorisez les notifications lorsque le navigateur le demande, et gardez l'onglet ouvert (ou le navigateur lancé) pour les recevoir.
- Les confirmations/erreurs des actions (valider, annuler, envoyer…) s'affichent sous forme de **toasts** en bas à droite de l'écran.

---

## 11. Questions fréquentes

**Je suis chauffeur mais le chef logistique ne peut pas me sélectionner.**
Votre statut n'est probablement pas « Disponible ». Ouvrez votre avatar et passez le statut sur **Disponible** (ou terminez votre congé via *Rendre disponible maintenant*).

**Ma demande peut-elle être modifiée après validation ?**
Seule la *replanification* par le chef logistique est possible après validation. Vous pouvez l'**annuler** pour libérer la place.

**Le bouton « Rejoindre » affiche « Complet ».**
Toutes les places du véhicule sont prises. Vous pouvez créer une demande qui sera traitée séparément.

**L'export CSV ne s'ouvre pas dans Excel.**
Téléchargez le fichier, puis dans Excel choisissez *Données → Importer un fichier CSV* avec le séparateur point-virgule (`;`).

**J'ai oublié mon mot de passe.**
Contactez le superadministrateur : il peut réinitialiser votre mot de passe depuis la page **Utilisateurs**.

---

## 12. Conseils de bon usage

- Gardez votre **disponibilité à jour** : c'est le critère le plus important pour l'attribution des sorties.
- Pour un déplacement, alimentez votre demande le **plus tôt possible** et indiquez le nombre **exact** de personnes.
- En cas de sortie d'un véhicule en maintenance ou en panne, informez le chef logistique pour mise à jour rapide du statut.
- Pensez à la **déconnexion** en fin de journée sur un poste partagé.