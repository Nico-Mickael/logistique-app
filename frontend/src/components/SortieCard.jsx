import {
  Card, Group, Text, Stack, Badge, Select, Menu, ActionIcon,
} from '@mantine/core';
import {
  IconPlayerPlay, IconFlag, IconUsers, IconEye, IconEdit, IconTrash, IconExchange, IconDotsVertical,
} from '@tabler/icons-react';
import VehicleIcon from './VehicleIcon';
import dayjs from '../utils/date';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor, sortieStatusAccent, vehicleDisplayName } from '../utils/labels';

// Options véhicules proposées lors d'un changement : seuls les véhicules
// disponibles + le véhicule actuel (règle du backend : nouveau véhicule indisponible).
export const vehicleOptionsFor = (vehicles, sortie) => vehicles
  .filter((v) => v.status === 'available' || v.id === sortie.vehicle_id)
  .map((v) => ({ value: String(v.id), label: `${vehicleDisplayName(v)} (${v.capacity} pers.)` }));

export const chauffeurOptions = (chauffeurs) =>
  chauffeurs.map((c) => ({ value: String(c.id), label: `${c.prenom} ${c.nom}`.trim() }));

function DriverSelect({ sortie, chauffeurs, onAssignDriver, disabled }) {
  return (
    <Select
      size="xs"
      placeholder={sortie.driver_name ? `Chauffeur: ${sortie.driver_name}` : 'Affecter un chauffeur'}
      data={chauffeurOptions(chauffeurs)}
      value={sortie.driver_employee_id ? String(sortie.driver_employee_id) : null}
      onChange={(v) => onAssignDriver(sortie, v)}
      clearable searchable radius="md"
      w={{ base: '100%', sm: 170 }}
      disabled={disabled}
      styles={{ input: sortie.driver_employee_id ? {} : { borderColor: 'var(--mantine-color-brand-6)' } }}
    />
  );
}

function SortieCard({ sortie, chauffeurs, vehicles, onAssignDriver, onChangeVehicle, onDetail, onEdit, onDepart, onSuggestions, onDelete, onValidateReturn, onArrivee, actionLoading }) {
  const isMoto = sortie.Vehicle?.type === 'moto';
  const ds = sortie.displayStatus;
  return (
    <Card withBorder radius="lg" p="lg" className="sortie-card">
      <div className="stat-card-accent" style={{ background: sortieStatusAccent[ds?.key || sortie.status] }} />
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Text fw={600} size="md" style={{ minWidth: 0, wordBreak: 'break-word' }}>{sortie.destination}</Text>
        <Badge color={ds?.color || statusColor[sortie.status]} variant="light">
          {ds?.label || statusLabel[sortie.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm"><Text span c="dimmed" size="sm">Conducteur: </Text>{sortie.driver_name}</Text>
        <Text size="sm">
          <Text span c="dimmed" size="sm">Véhicule: </Text>
          <VehicleIcon type={sortie.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" style={{ verticalAlign: 'middle', marginRight: 4 }} />
          <Text span size="sm">{sortie.Vehicle ? vehicleDisplayName(sortie.Vehicle) : '—'}</Text>
        </Text>
        {!isMoto && sortie.Requests?.some((r) => r.vehicle_id && r.vehicle_id !== sortie.vehicle_id) && (
          <Text size="xs" c="orange" fw={600}>
            <IconExchange size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Véhicule demandé différent du véhicule affecté
          </Text>
        )}
        <Text size="sm"><Text span c="dimmed" size="sm">Départ: </Text>
          {dayjs(sortie.departure_time).format('DD/MM/YYYY HH:mm')}
        </Text>
        {sortie.status === 'finished' && !isMoto && (
          <Text size="sm" fw={600}>
            <Text span c="dimmed" size="sm">Distance: </Text>{sortie.distance_km} km
          </Text>
        )}
        {!isMoto && sortie.departure_km && (
          <Text size="sm"><Text span c="dimmed" size="sm">Km départ: </Text>{sortie.departure_km}</Text>
        )}
        {!isMoto && sortie.return_km && (
          <Text size="sm"><Text span c="dimmed" size="sm">Km retour: </Text>{sortie.return_km}</Text>
        )}
        {!isMoto && sortie.returned_at && (
          <Text size="sm"><Text span c="dimmed" size="sm">Retour le: </Text>{dayjs(sortie.returned_at).format('DD/MM/YYYY HH:mm')}</Text>
        )}
        {!isMoto && sortie.arrival_km && (
          <Text size="sm"><Text span c="dimmed" size="sm">Km arrivée: </Text>{sortie.arrival_km}</Text>
        )}
        {isMoto && sortie.Requests?.length > 0 && (
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={600}>Kilomètres individuels:</Text>
            {sortie.Requests.map((req) => {
              const sr = req.SortieRequest;
              const done = sr?.status === 'finished';
              return (
                <Text key={req.id} size="xs">
                  <Text span c="dimmed">{req.Employee?.prenom} {req.Employee?.nom}: </Text>
                  {done && sr?.departure_km != null && sr?.return_km != null
                    ? `${sr.departure_km} → ${sr.return_km} km (${sr.distance_km} km)`
                    : sr?.status === 'ongoing' ? 'en cours' : '—'}
                </Text>
              );
            })}
          </Stack>
        )}
      </Stack>
      <Group justify="space-between" align="flex-end" gap="xs" wrap="wrap">
        {sortie.status === 'planned' && !isMoto && (
          <Group gap="xs" wrap="wrap">
            <DriverSelect sortie={sortie} chauffeurs={chauffeurs} onAssignDriver={onAssignDriver} disabled={actionLoading === 'assignDriver'} />
            <Select
              size="xs"
              placeholder="Changer de véhicule"
              data={vehicleOptionsFor(vehicles, sortie)}
              value={String(sortie.vehicle_id)}
              onChange={(v) => { if (v && String(v) !== String(sortie.vehicle_id)) onChangeVehicle(sortie, v); }}
              searchable radius="md" w={{ base: '100%', sm: 190 }}
              disabled={actionLoading === 'vehicle'}
              leftSection={<VehicleIcon type={sortie.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />}
            />
          </Group>
        )}
        {sortie.status === 'ongoing' && (
          <Text size="xs" c="dimmed">En attente du retour de l'employé</Text>
        )}
        {sortie.status === 'finished' && (
          <Text size="xs" c="dimmed">Terminée le {dayjs(sortie.updatedAt).format('DD/MM/YYYY')}</Text>
        )}
        <Menu position="bottom-end" withinPortal trigger="hover" openDelay={120} closeDelay={120} shadow="md" width={210}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" radius="md" aria-label="Actions">
              <IconDotsVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {sortie.status === 'planned' && (
              <>
                <Menu.Item leftSection={<IconPlayerPlay size={16} />} onClick={() => onDepart(sortie)}>Démarrer</Menu.Item>
                <Menu.Item leftSection={<IconUsers size={16} />} onClick={() => onSuggestions(sortie.id)}>Demandes</Menu.Item>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onDetail(sortie)}>Détails</Menu.Item>
                <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => onEdit(sortie)}>Modifier</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>Supprimer</Menu.Item>
              </>
            )}
            {sortie.status === 'ongoing' && (
              <>
                <Menu.Item leftSection={<IconFlag size={16} />} onClick={() => onArrivee(sortie)}>Saisir arrivée</Menu.Item>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onDetail(sortie)}>Détails</Menu.Item>
              </>
            )}
            {sortie.status === 'pending_return' && (
              <>
                <Menu.Item leftSection={<IconFlag size={16} />} onClick={onValidateReturn}>Valider le retour</Menu.Item>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onDetail(sortie)}>Détails</Menu.Item>
              </>
            )}
            {sortie.status === 'finished' && (
              <>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onDetail(sortie)}>Détails</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>Supprimer</Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>
  );
}

export default SortieCard;