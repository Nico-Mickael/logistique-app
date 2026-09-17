import { Accordion, Divider, Group, List, Modal, ScrollArea, Table, Text } from '@mantine/core';
import {
  IconBook2, IconLogout, IconUsersGroup, IconUserCircle, IconRoute,
  IconListCheck, IconCar, IconReportAnalytics, IconBuilding,
} from '@tabler/icons-react';

const sectionTitle = (icon, label) => (
  <Group gap="xs" wrap="nowrap">
    {icon}
    <Text size="sm" fw={600}>{label}</Text>
  </Group>
);

function StatusTable({ rows }) {
  return (
    <Table withTableBorder withColumnBorders fontSize="xs" verticalSpacing="xs">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Statut</Table.Th>
          <Table.Th>Signification</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map(([status, meaning]) => (
          <Table.Tr key={status}>
            <Table.Td fw={500}>{status}</Table.Td>
            <Table.Td>{meaning}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function UserManualModal({ opened, onClose }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      radius="lg"
      centered
      transitionProps={{ transition: 'pop', duration: 200 }}
      scrollAreaComponent={ScrollArea.Autosize}
      title={
        <Group gap="xs">
          <IconBook2 size={20} color="var(--mantine-color-brand-6)" />
          <Text fw={600}>Manuel d'utilisation</Text>
        </Group>
      }
    >
      <Accordion variant="separated" radius="md" defaultValue="connexion">
        <Accordion.Item value="connexion">
          <Accordion.Control>{sectionTitle(<IconLogout size={16} color="var(--mantine-color-brand-6)" />, 'Connexion et déconnexion')}</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">
              1. Ouvrez l'adresse de l'application dans votre navigateur, saisissez votre e-mail et votre mot de passe, puis cliquez sur Connexion.
            </Text>
            <Text size="sm" mt="xs">
              La session expire automatiquement après une période d'inactivité : vous serez redirigé vers l'écran de connexion (rechargez la page). Pour vous déconnecter, cliquez sur votre avatar en haut à droite puis sur Déconnexion.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="interface">
          <Accordion.Control>{sectionTitle(<IconBook2 size={16} color="var(--mantine-color-brand-6)" />, 'L\u2019interface')}</Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item><b>Barre latérale (gauche)</b> : les pages auxquelles vous avez droit selon votre rôle. Une pastille rouge sur Demandes ou Sorties signale des éléments à traiter. Le bouton rond flottant réduit/développe le menu, l'icône soleil/lune en bas bascule le thème clair/sombre.</List.Item>
              <List.Item><b>En-tête</b> : nom du site courant et votre avatar (il donne accès à votre disponibilité). La cloche affiche les notifications.</List.Item>
              <List.Item><b>Manuel</b> : accessible depuis la page <b>Sessions</b> (bouton « i » à côté du rafraîchir).</List.Item>
              <List.Item><b>Toasts</b> : les confirmations et erreurs des actions s'affichent en bas à droite de l'écran.</List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="regroupement">
          <Accordion.Control>{sectionTitle(<IconRoute size={16} color="var(--mantine-color-brand-6)" />, 'Comment les demandes deviennent des sorties')}</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" fw={600} mb={4}>Cycle de vie d'une demande</Text>
            <Text size="sm">Une demande suit ce parcours : <b>En attente</b> → (validation chef logistique) → <b>Validée</b> → (affectation véhicule + chauffeur) → <b>Sortie créée automatiquement</b> ou <b>ajoutée à une sortie existante</b> → la sortie suit son propre cycle (planifiée → en cours → terminée).</Text>

            <Divider my="sm" />
            <Text size="sm" fw={600} mb={4}>Règles de regroupement automatique</Text>
            <Text size="sm">Lorsqu'une demande validée reçoit un véhicule, le système tente automatiquement de la <b>regrouper</b> dans une sortie déjà planifiée, selon ces critères :</Text>
            <List spacing="xs" size="sm" mt="xs">
              <List.Item><b>Même jour</b> : les deux demandes doivent être pour le même jour calendaire.</List.Item>
              <List.Item><b>Même destination</b> : les noms sont normalisés (« Tana » = « Antananarivo »), la casse est ignorée.</List.Item>
              <List.Item><b>Écart horaire ≤ 3 heures</b> : la date souhaitée de la demande ne doit pas dépasser 3 heures de l'heure de départ de la sortie existante.</List.Item>
              <List.Item><b>Même véhicule</b> : la sortie et la demande doivent concerner le même véhicule.</List.Item>
              <List.Item><b>Capacité suffisante</b> : le nombre de places restantes doit accueillir le nombre de personnes de la nouvelle demande.</List.Item>
            </List>
            <Text size="sm" mt="xs">Si toutes les conditions sont remplies, la demande rejoint la sortie sans création de sortie supplémentaire. Sinon, une nouvelle sortie est créée pour ce véhicule.</Text>

            <Divider my="sm" />
            <Text size="sm" fw={600} mb={4}>À retenir</Text>
            <List spacing="xs" size="sm">
              <List.Item>L'employé <b>choisit lui-même le véhicule</b> au moment de la demande (plan de sièges en direct). Le regroupement automatique s'applique donc sur ce même véhicule.</List.Item>
              <List.Item><b>Rejoindre une sortie</b> depuis « Mes trajets » crée une <b>demande rattachée directement à la sortie existante</b> : pas de création d'une nouvelle sortie.</List.Item>
            </List>

            <Divider my="sm" />
            <Text size="sm" fw={600} mb={4}>Le rôle du chef logistique</Text>
            <Text size="sm">Le chef logistique peut aussi regrouper manuellement : en validant une demande, il choisit le véhicule et le système propose automatiquement les sorties compatibles du même jour. Il peut aussi <b>replanifier</b> une demande (proposer une nouvelle date à l'employé, qui doit accepter ou refuser).</Text>

            <Divider my="sm" />
            <Text size="sm" fw={600} mb={4}>Cas particulier : la moto</Text>
            <Text size="sm">Lorsqu'une demande est validée et affectée à un <b>moto</b> (véhicule de type « moto », capacité 1 place), les règles sont spécifiques :</Text>
            <List spacing="xs" size="sm" mt="xs">
              <List.Item><b>L'employé est le conducteur</b> : son nom est automatiquement renseigné comme chauffeur de la sortie. Pas besoin de chauffeur séparé.</List.Item>
              <List.Item><b>Le conducteur saisit ses propres kilométrages</b> : dans « Mes sorties », il saisit le KM de départ en démarrant, puis le KM d'arrivée et l'heure de retour en revenant.</List.Item>
              <List.Item><b>Tolérance de 20 minutes</b> : le conducteur peut démarrer la sortie dans les 20 minutes suivant l'heure de départ prévue. Au-delà, la sortie n'est plus accessible.</List.Item>
              <List.Item><b>Validation automatique</b> : dès que tous les conducteurs de moto d'une sortie ont enregistré leur retour, la sortie passe automatiquement en <b>« Retour à valider »</b>, puis le chef logistique la clôture.</List.Item>
              <List.Item><b>Kilométrage final</b> : en cas de sortie multi-motos, le kilométrage le plus élevé enregistré est retenu comme km d'arrivée de la sortie.</List.Item>
            </List>

            <Divider my="sm" />
            <Text size="sm" fw={600} mb={4}>La page « Mes trajets »</Text>
            <Text size="sm">Les employés et chauffeurs peuvent <b>rejoindre une sortie existante</b> directement depuis « Mes trajets », si une place est libre. Le système vérifie la même destination, le même jour et la capacité restante. En cas de départ imminent (dans les 20 minutes), un rappel « préparez-vous » est envoyé par notification push.</Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="disponibilite">
          <Accordion.Control>{sectionTitle(<IconUserCircle size={16} color="var(--mantine-color-brand-6)" />, 'Votre disponibilité')}</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">La plateforme distingue la <b>disponibilité professionnelle</b> (être prêt à prendre une sortie) de l'état de connexion. Pour la changer : cliquez sur votre avatar puis choisissez un statut.</Text>
            <Text size="sm" mt="xs"><b>Un chauffeur ne peut être affecté à une sortie que s'il est « Disponible ».</b></Text>
            <StatusTable rows={[
              ['Disponible (vert)', 'Prêt à prendre des sorties. Statut par défaut.'],
              ['Hors ligne (gris)', 'Ne pas être affecté pour le moment.'],
              ['En absence (rouge)', 'Indisponibilité temporaire (maladie, autorisation…).'],
              ['En congé (orange)', 'Congé : choisir une date de début et une date de fin. Retour automatique à « Disponible » le lendemain de la fin.'],
            ]} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="roles">
          <Accordion.Control>{sectionTitle(<IconUsersGroup size={16} color="var(--mantine-color-brand-6)" />, 'Les rôles')}</Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item><b>Employé</b> : Accueil, Mes demandes, Nouvelle demande, Mes trajets, Mes rapports, Sessions.</List.Item>
              <List.Item><b>Chauffeur</b> : Accueil, Mes sorties, Mes trajets, Mes rapports, Sessions.</List.Item>
              <List.Item><b>Chef logistique</b> : Accueil, Tableau de bord, Demandes (validation), Sorties, Véhicules, Sessions.</List.Item>
              <List.Item><b>Superadmin</b> : tous les outils du chef logistique + Utilisateurs et Sites.</List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="employe">
          <Accordion.Control>{sectionTitle(<IconListCheck size={16} color="var(--mantine-color-brand-6)" />, 'Employé : demandes, trajets et rapports')}</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" fw={600} mb={4}>Nouvelle demande (2 étapes)</Text>
            <List spacing="xs" size="sm" mb="xs">
              <List.Item><b>Étape 1 — choisir un véhicule</b> : chaque carte de véhicule affiche le type, la capacité, son statut et un <b>plan de sièges en direct</b> (vert = libre, jaune = réservé, rouge = occupé, bleu = votre place), les personnes prévues à bord et le compte à rebours vers le prochain départ.</List.Item>
              <List.Item><b>Étape 2 — détails</b> : destination, date et heure de départ (pas dans le passé), motif, et nombre de personnes (limité aux <b>places disponibles</b>, avec jauge de remplissage).</List.Item>
            </List>
            <Text size="sm" fw={600} mb={4}>Mes demandes</Text>
            <Text size="sm">Cartes ou tableau. Actions selon le statut : Modifier (en attente), Annuler (en attente ou validée, libère la place), Supprimer, et pour une demande <b>replanifiée</b> : Accepter la nouvelle date ou Refuser (la demande est annulée). Cliquez sur une carte pour le détail. <b>La demande précise directement le véhicule</b> choisi à l'étape 1.</Text>
            <Text size="sm" fw={600} mb={4}>Mes trajets</Text>
            <List spacing="xs" size="sm" mb="xs">
              <List.Item><b>Sorties disponibles</b> : sorties planifiées à rejoindre avec la jauge de places ; bouton <b>Rejoindre cette sortie</b> (choisir le nombre de personnes → crée une demande rattachée à cette sortie) ou « Complet ».</List.Item>
              <List.Item>Sections <b>En cours / Retour à valider / À venir / Terminés</b>.</List.Item>
              <List.Item><b>Moto</b> : si votre sortie moto est en cours, bouton <b>Saisir mon retour</b> → kilométrages de départ et de retour individuels + date/heure de retour. Sans kilométrage saisi, la mention « Véhicule personnel » s'affiche.</List.Item>
            </List>
            <Text size="sm" fw={600} mb={4}>Mes rapports</Text>
            <Text size="sm">Tableaux de bord personnels (pas d'export) : demandes et validées/en attente/refusées de l'année, kilomètres parcourus par mois, répartition des statuts et vos destinations les plus fréquentes (année au choix).</Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="chauffeur">
          <Accordion.Control>{sectionTitle(<IconRoute size={16} color="var(--mantine-color-brand-6)" />, 'Chauffeur : mes sorties')}</Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item><b>Démarrer une sortie</b> : dans « Planifiées », cliquez sur Démarrer la sortie et saisissez le kilométrage compteur au départ (&gt; 0).</List.Item>
              <List.Item><b>Enregistrer l'arrivée</b> : Saisir le KM d'arrivée (ne peut pas être inférieur au départ) + heure de retour. La distance est calculée automatiquement.</List.Item>
              <List.Item>Après votre arrivée, la sortie passe « Retour à valider » jusqu'à la validation du chef logistique.</List.Item>
              <List.Item>Restez « Disponible » pour être affecté à de nouvelles sorties (voir « Votre disponibilité »).</List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="chef">
          <Accordion.Control>{sectionTitle(<IconCar size={16} color="var(--mantine-color-brand-6)" />, 'Chef logistique')}</Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item><b>Tableau de bord</b> : demandes (total, validées, en attente, refusées), flotte (véhicules, disponibles, maintenance/panne), kilomètres par mois, demandes par statut, top destinations et état de la flotte, pour l'année au choix. Bouton <b>Exporter</b> : Rapports Excel (.xlsx) — flotte et sorties terminées.</List.Item>
              <List.Item><b>Demandes</b> : Valider (le système propose les sorties compatibles et regroupe automatiquement), Refuser, Replanifier (l'employé doit accepter). Export CSV.</List.Item>
              <List.Item><b>Sorties</b> : création/association de sorties, affectation d'un véhicule et d'un chauffeur <b>disponible</b>, suivi des kilométrages, validation des retours. Pour les motos : le conducteur gère ses km, la validation est automatique dès que tous les retours sont enregistrés.</List.Item>
              <List.Item><b>Planning</b> : calendrier <b>mensuel</b> des sorties (pastilles de couleur par statut), filtre par type de véhicule, statistiques du mois et actions rapides depuis un jour : <b>Départ</b>, <b>Arrivée</b> ou <b>Valider retour</b>.</List.Item>
              <List.Item><b>Véhicules</b> : parc (type : voiture, moto, minibus — capacité, statut), ajout/modification/suppression, déclaration maintenance ou panne. Un véhicule avec sorties enregistrées est <b>archivé</b> lors de la suppression : il disparaît du parc et des sélections, mais son historique kilométrique est conservé.</List.Item>
              <List.Item><b>Sessions</b> : appareils connectés, déconnexion à distance éventuelle. Bouton <b>« i »</b> : ouvre ce manuel.</List.Item>
              <List.Item><b>Rapports</b> : <b>Historique kilométrique</b> (vue cartes ou tableau, filtre par véhicule, export CSV, sélection multiple + « Tout sélectionner » pour <b>supprimer des lignes</b> de l'historique) et rapport <b>passagers</b> (export CSV, séparateur « ; »).</List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="superadmin">
          <Accordion.Control>{sectionTitle(<IconBuilding size={16} color="var(--mantine-color-brand-6)" />, 'Superadministrateur')}</Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item><b>Utilisateurs</b> : recherche, vue cartes/tableau. <b>Création</b> : nom, prénom, e-mail, mot de passe (obligatoire), département, rôle (Employé, Chauffeur, Admin, Superadmin) et site (pré-rempli selon le filtre de site en cours). <b>Modification</b> : nom, prénom, e-mail, département, rôle et éventuellement nouveau mot de passe (laissé vide = conservé) ; le site n'est défini qu'à la création. <b>Suppression</b> : possible sauf pour un superadmin. La disponibilité de chacun est affichée à côté de son nom.</List.Item>
              <List.Item><b>Sites</b> : création, modification et suppression (nom, code unique en majuscules, ville, adresse, statut). Un site contenant des données est <b>archivé</b> à la suppression : il passe « Inactif » et disparaît des sélecteurs, mais l'historique est conservé. Le site par défaut (TANA) ne peut pas être supprimé.</List.Item>
              <List.Item>Le sélecteur de site en haut de l'écran filtre l'ensemble de l'application (ou « Tous les sites »).</List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="statuts">
          <Accordion.Control>{sectionTitle(<IconRoute size={16} color="var(--mantine-color-brand-6)" />, 'Récapitulatif des statuts')}</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" fw={600} mb={4}>Demandes</Text>
            <StatusTable rows={[
              ['En attente', 'Soumise, pas encore traitée.'],
              ['Validée', 'Acceptée ; une place / une sortie vous est réservée.'],
              ['Replanifiée', 'Une nouvelle date vous est proposée ; à accepter ou refuser.'],
              ['Refusée', 'Non acceptée (un motif peut être indiqué).'],
              ['Annulée', 'Supprimée ou refusée après replanification.'],
            ]} />
            <Divider my="md" />
            <Text size="sm" fw={600} mb={4}>Sorties</Text>
            <StatusTable rows={[
              ['Sortie prévue', 'Planifiée, en attente du départ.'],
              ['Imminente / Bientôt', 'Départ proche (rappel envoyé au chauffeur).'],
              ['Sortie en cours', 'Démarrée (km de départ enregistré).'],
              ['Retour à valider', 'Retour saisi par le chauffeur, en attente de validation.'],
              ['Sortie terminée', 'Clôturée.'],
              ['Annulée', 'Sortie annulée.'],
            ]} />
            <Divider my="md" />
            <Text size="sm" fw={600} mb={4}>Véhicules</Text>
            <StatusTable rows={[
              ['Disponible', 'Prêt à être affecté.'],
              ['En sortie', 'Automatique pendant une sortie.'],
              ['Maintenance', 'En révision (déclaré manuellement).'],
              ['En panne', 'Indisponible (déclaré manuellement).'],
            ]} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="notifications">
          <Accordion.Control>{sectionTitle(<IconReportAnalytics size={16} color="var(--mantine-color-brand-6)" />, 'Notifications')}</Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">
              Les pastilles rouges du menu signalent des éléments à traiter. Les <b>notifications navigateur (push)</b> rappellent par exemple au chauffeur « préparez-vous » avant un départ imminent. Autorisez les notifications à la demande du navigateur et gardez-le lancé pour les recevoir. En cas de réponse à une replanification, vous êtes également notifié.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="faq">
          <Accordion.Control>{sectionTitle(<IconUserCircle size={16} color="var(--mantine-color-brand-6)" />, 'Questions fréquentes')}</Accordion.Control>
          <Accordion.Panel>
            <List spacing="xs" size="sm">
              <List.Item><b>Le chef logistique ne peut pas me sélectionner comme chauffeur</b> : votre statut n'est pas « Disponible ». Passez-le via votre avatar (ou « Rendre disponible maintenant » en cas de congé).</List.Item>
              <List.Item><b>Le bouton « Rejoindre » affiche « Complet »</b> : toutes les places sont prises, créez une demande séparée.</List.Item>
              <List.Item><b>Le CSV ne s'ouvre pas dans Excel</b> : importer le fichier avec le séparateur point-virgule (« ; »).</List.Item>
              <List.Item><b>Mot de passe oublié</b> : seule une réinitialisation par le superadministrateur est possible (page Utilisateurs).</List.Item>
              <List.Item><b>Je suis sur moto mais la sortie ne m'apparaît pas</b> : la sortie n'est accessible que dans les 20 minutes suivant l'heure de départ prévue. Passez-y à temps.</List.Item>
              <List.Item><b>Je veux rejoindre une sortie depuis Mes trajets</b> : vérifiez que la destination et le jour correspondent, et qu'il reste des places. Si le départ est imminent, vous recevrez un rappel.</List.Item>
            </List>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Modal>
  );
}

export default UserManualModal;