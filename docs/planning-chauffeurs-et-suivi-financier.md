# Module 1 : Planning des chauffeurs et disponibilité

## 1. Objectif

Permettre au service logistique de planifier les chauffeurs de manière claire, fiable et sans conflit, tout en rendant visible leur disponibilité, leurs congés, leurs indisponibilités et leurs affectations sur les sorties.

Ce module doit aider à :
- éviter les doubles affectations
- gérer les absences et indisponibilités
- répartir la charge de travail
- améliorer la qualité des sorties planifiées

---

## 2. Problème métier

Aujourd’hui, la plateforme permet de créer des sorties et de gérer des véhicules, mais elle ne gère pas encore de manière structurée la disponibilité réelle des chauffeurs.

Cela provoque :
- des conflits d’affectation
- des sorties créées sans chauffeur disponible
- des oublis de congés ou d’indisponibilités
- une charge de travail inégale entre chauffeurs

---

## 3. Bénéfices attendus

- meilleure organisation des sorties
- réduction des erreurs d’affectation
- meilleure visibilité du planning
- gestion plus rapide des absences
- optimisation de la charge de travail
- meilleure satisfaction des chauffeurs

---

## 4. Utilisateurs concernés

- Chef logistique
- Admin
- Superadmin
- Chauffeur

---

## 5. Fonctionnalités principales

### 5.1 Vue planning hebdomadaire / mensuel

Le chef doit pouvoir visualiser :
- les sorties par jour
- les chauffeurs affectés
- les véhicules associés
- les sorties non assignées
- les absences ou indisponibilités

Les vues possibles :
- calendrier hebdomadaire
- calendrier mensuel
- liste quotidienne

### 5.2 Disponibilité des chauffeurs

Pour chaque chauffeur, on doit pouvoir enregistrer :
- disponible
- indisponible
- congé
- mission externe
- en repos

La disponibilité doit être gérée selon :
- date
- heure de début / fin
- type de disponibilité
- motif

### 5.3 Affectation de chauffeur aux sorties

Le chef doit pouvoir :
- choisir un chauffeur disponible pour une sortie
- valider ou modifier une affectation
- bloquer un chauffeur pour une période donnée
- voir les conflits d’affectation avant validation

### 5.4 Gestion des absences et congés

Le module doit permettre de gérer :
- congés annuels
- congés exceptionnels
- maladie / arrêt
- indisponibilité ponctuelle
- mission hors site

### 5.5 Alertes de conflit

Le système doit automatiquement détecter :
- chauffeur déjà affecté à une autre sortie à la même heure
- véhicule déjà assigné ailleurs
- période de congé ou d’absence en conflit
- dépassement de charge de travail sur la semaine

### 5.6 Charge hebdomadaire

Pour chaque chauffeur, afficher :
- nombre de sorties assignées
- nombre d’heures de conduite estimées
- période la plus chargée
- éventuel signalement de surcharge

---

## 6. Règles métier proposées

1. Un chauffeur ne peut pas être affecté à deux sorties qui se chevauchent.
2. Un chauffeur en congé ou indisponible ne peut pas recevoir d’affectation.
3. Une sortie sans chauffeur affecté est visible comme "À affecter".
4. Une affectation doit être modifiable tant que la sortie n’a pas démarré.
5. Une sortie démarrée ne peut plus être reassigned sans justification.
6. Les modifications d’affectation doivent être tracées dans l’historique.
7. Un chauffeur ne peut pas être assigné à plus de X sorties par semaine sans validation manuelle.

---

## 7. Modèle de données proposé

### 7.1 Table DriverAvailability

Attributs suggérés :
- id
- driver_employee_id
- type (available, unavailable, leave, sick, external_mission)
- start_at
- end_at
- reason
- note
- created_by
- created_at
- updated_at

### 7.2 Table DriverSchedule

Attributs suggérés :
- id
- driver_employee_id
- sortie_id
- assigned_at
- status (assigned, confirmed, changed, cancelled)
- assigned_by
- created_at
- updated_at

### 7.3 Table DriverWorkload

Attributs suggérés :
- id
- driver_employee_id
- week_start
- total_assignments
- total_hours
- overload_flag
- updated_at

---

## 8. Cas d’usage principaux

### Cas d’usage 1 : planifier une sortie

En tant que chef logistique :
- je sélectionne une sortie
- je vois les chauffeurs disponibles pour cette période
- j’affecte un chauffeur
- le système vérifie les conflits
- la sortie est confirmée

### Cas d’usage 2 : enregistrer une indisponibilité

En tant que chef logistique ou chauffeur :
- je déclare une indisponibilité
- je précise le motif, la date et l’intervalle
- le système bloque automatiquement l’accès au planning

### Cas d’usage 3 : constituer le planning hebdo

En tant que chef logistique :
- je consulte le planning de la semaine
- je repère les sorties non assignées
- je répartis les chauffeurs sur la base de la disponibilité
- je valide le planning

### Cas d’usage 4 : prévenir d’une surcharge

En tant que chef logistique :
- je vois les chauffeurs proches de leur seuil de charge hebdo
- je décide de redistribuer les affectations

---

## 9. API backend proposée

### Endpoints suggérés

- GET /api/drivers/availability
- POST /api/drivers/availability
- PUT /api/drivers/availability/:id
- DELETE /api/drivers/availability/:id

- GET /api/drivers/planning?week=YYYY-MM-DD
- GET /api/drivers/planning/day?date=YYYY-MM-DD
- POST /api/sorties/:id/assign-driver
- PUT /api/sorties/:id/assign-driver

- GET /api/drivers/workload?week=YYYY-MM-DD
- GET /api/drivers/conflicts

---

## 10. Frontend proposé

### Pages à créer

- Planning chauffeur
- Disponibilités
- Gestion des congés / absences
- Détail d’un chauffeur
- Alertes de conflit

### Composants utiles

- calendrier hebdomadaire
- vue liste quotidienne
- badges de disponibilité
- filtre par chauffeur / site / date
- panneau d’alertes

---

## 11. Critères d’acceptation

### Planning
- un chauffeur ne peut pas être affecté à deux sorties concurrents
- les indisponibilités sont visibles dans le calendrier
- les sorties non assignées sont visibles clairement
- le chef peut modifier l’affectation rapidement

### Disponibilité
- les absences sont enregistrées avec motif et période
- les disponibilités sont filtrables par type
- les conflits sont signalés avant validation

### Charge de travail
- chaque chauffeur a une vue de ses affectations hebdomadaires
- les dépassements de charge sont visibles

---

## 12. Priorisation de développement

### Phase 1
- base de disponibilité
- affectation chauffeur
- calendrier hebdomadaire
- conflits simples

### Phase 2
- congés / indisponibilités
- charge de travail
- alertes automatiques
- historique d’affectation

### Phase 3
- optimisation de planification
- suggestions automatiques de chauffeur
- intégration au dashboard global

---

## 13. Points techniques à prévoir

- calcul des horaires dans le fuseau horaire du site
- gestion des conflits avec les sorties déjà créées
- protection des données d’affectation si la sortie est commencée
- index sur les champs date / chauffeur / statut
- historique des changements avec audit

---

## 14. Résumé court

Ce module permet de transformer le planning des chauffeurs de simple liste à un système réellement pilotable, évitant les erreurs humaines, les conflits d’emploi du temps et les mauvaises affectations. C’est un ajout très fort pour la fiabilité opérationnelle de la plateforme.

---

# Module 2 : Suivi financier du parc automobile

## 1. Objectif

Mettre en place un module de suivi de la performance économique du parc automobile afin de mesurer les coûts réels de fonctionnement par véhicule, par type de trajet et par période.

Ce module doit permettre de :
- suivre les consommations de carburant
- mesurer les coûts réels par sortie
- comparer les véhicules entre eux
- analyser la rentabilité de la flotte
- détecter les véhicules trop coûteux ou sous-performants

---

## 2. Problème métier

La plateforme sait déjà mesurer les distances parcourues, les sorties effectuées et la consommation de carburant. Mais il manque un niveau de pilotage financier pour comprendre le vrai coût d’exploitation du parc.

Les problèmes observés :
- absence de vue globale sur le coût de fonctionnement
- difficulté de comparer les véhicules
- pas d’alertes sur surconsommation
- difficulté à planifier le remplacement ou la maintenance

---

## 3. Bénéfices attendus

- meilleure maîtrise des dépenses du parc
- réduction des coûts de carburant
- identification des véhicules coûteux
- optimisation des décisions d’achat / remplacement
- pilotage budgetaire plus rigoureux

---

## 4. Utilisateurs concernés

- Chef logistique
- Admin
- Superadmin
- Direction / gestion

---

## 5. Fonctionnalités principales

### 5.1 Coût par sortie

Pour chaque sortie, calculer :
- distance parcourue
- carburant consommé
- coût du carburant
- coût par km
- coût total de la sortie

### 5.2 Coût par véhicule

Pour chaque véhicule, afficher :
- total km parcourus
- total carburant consommé
- total coût carburant
- coût moyen par km
- nombre de sorties
- dernière sortie effectuée

### 5.3 Analyse par période

Le chef doit pouvoir filtrer par :
- jour
- semaine
- mois
- trimestre
- année
- site
- type de véhicule

### 5.4 Budget et seuils

Le système doit permettre :
- définition d’un budget mensuel ou annuel
- comparaison budget réel vs budget prévu
- alertes en cas de dépassement
- analyse des écarts par véhicule ou par site

### 5.5 Comparaison de performance

Afficher les véhicules classés par :
- coût par km le plus faible
- coût par km le plus élevé
- km parcourus
- consommation moyenne
- efficacité globale

### 5.6 Suivi des dépenses annexes

À prévoir selon besoin :
- entretien
- réparation
- pièces
- assurance
- stationnement
- péage
- amortissement

---

## 6. Règles métier proposées

1. Le coût de carburant est calculé sur la base de la distance et des litres consommés.
2. Si les données de carburant sont manquantes, le coût est estimé ou marqué comme incomplet.
3. Un véhicule avec coût par km anormalement élevé est signalé en analyse.
4. Les filtres par période et par site doivent s’appliquer à tous les rapports.
5. Les données financières doivent être conservées avec le même niveau de traçabilité que les sorties.
6. Les sorties incomplètes ou non validées ne doivent pas être prises en compte dans les calculs financiers définitifs.

---

## 7. Modèle de données proposé

### 7.1 Table FleetExpense

Attributs suggérés :
- id
- vehicle_id
- sortie_id
- expense_type (fuel, maintenance, repair, toll, parking, other)
- amount
- currency
- reference_date
- description
- created_by
- created_at

### 7.2 Table FuelMetric

Attributs suggérés :
- id
- vehicle_id
- sortie_id
- distance_km
- fuel_litres
- fuel_cost
- cost_per_km
- reference_date
- created_at

### 7.3 Table FleetBudget

Attributs suggérés :
- id
- site_id
- period_start
- period_end
- total_budget
- remaining_budget
- status
- created_at

---

## 8. Calculs clés

### Coût par km

Formule proposée :

coût par km = coût total / distance totale

### Consommation moyenne

Formule proposée :

consommation moyenne = litres utilisés / km parcourus

### Coût total d’exploitation

Formule proposée :

coût total = carburant + maintenance + entretien + autres dépenses

---

## 9. Cas d’usage principaux

### Cas d’usage 1 : voir le coût global du parc

En tant que chef logistique :
- je accède au tableau de bord financier
- je vois coût total, coût par km, coût par véhicule
- je compare les périodes

### Cas d’usage 2 : analyser un véhicule précis

En tant que chef logistique :
- je sélectionne un véhicule
- je vois ses sorties, coût, km parcourus, consommations
- je détecte les anomalies

### Cas d’usage 3 : comparer les sites

En tant qu’admin :
- je filtre par site
- je vois le coût total et la performance sur chaque site

### Cas d’usage 4 : suivre le budget

En tant qu’admin :
- je fixe un budget mensuel
- je compare budget prévu vs réel
- j’ai une alerte si un seuil est dépassé

---

## 10. API backend proposée

### Endpoints suggérés

- GET /api/finance/overview?period=month&site_id=
- GET /api/finance/vehicles
- GET /api/finance/vehicle/:id
- GET /api/finance/sorties?from=&to=
- GET /api/finance/budget
- POST /api/finance/budget
- POST /api/finance/expenses
- GET /api/finance/alerts

---

## 11. Frontend proposé

### Pages à créer

- Tableau de bord financier
- Analyse par véhicule
- Analyse par période
- Suivi du budget
- Alertes et écarts

### Widgets utiles

- total coût du mois
- coût par km
- top véhicules coûteux
- budget restant
- graphique d’évolution mensuelle

---

## 12. Critères d’acceptation

### Suivi financier
- chaque sortie terminée peut être associée à des coûts de carburant et de dépenses
- le coût par km est calculé automatiquement
- les filtres par véhicule, site et date fonctionnent
- les tableaux de bord reflètent les données réelles

### Analyse
- les véhicules sont classés par performance financière
- les écarts sont visibles
- les budgets mensuels peuvent être suivis

### Alertes
- un dépassement de budget est signalé visuellement
- les véhicules coûteux sont identifiés facilement

---

## 13. Priorisation de développement

### Phase 1
- coût carburant par sortie
- coût par km par véhicule
- vue mensuelle globale

### Phase 2
- budget et écarts
- analyse comparative par véhicule
- alertes sur surconsommation

### Phase 3
- dépenses annexes
- optimisation et prévisions
- intégration au dashboard général

---

## 14. Points techniques à prévoir

- calculs financiers à partir des sorties terminées uniquement
- gestion des périodes avec filtres par dates
- stockage des dépenses dans une table dédiée
- agrégation sur grands volumes
- export Excel / PDF pour reporting
- sécurité sur les données financières

---

## 15. Résumé court

Ce module transforme la flotte d’un simple parc logistique en un outil de pilotage économique. Il permet au management de savoir où l’argent est dépensé, quel véhicule est rentable, et où il faut agir pour réduire les coûts sans perdre la qualité du service.

---

## 16. Recommandation de mise en œuvre

Les deux modules doivent être conçus de manière complémentaire :
- le planning des chauffeurs optimise la disponibilité des ressources
- le suivi financier optimise la performance du parc

Ensemble, ils permettent d’atteindre une vraie gestion operationalisée de la logistique : performances humaines, disponibilité des ressources et maîtrise des coûts.
