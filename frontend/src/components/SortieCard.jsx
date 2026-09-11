import {
  Card, Group, Text, Stack, Badge, Button, Select,
} from '@mantine/core';
import {
  IconPlayerPlay, IconFlag, IconUsers, IconEye, IconEdit, IconTrash, IconExchange,
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
        {sortie.motif && (
          <Text size="sm">
            <Text span c="dimmed" size="sm">Motif: </Text>{sortie.motif}
          </Text>
        )}
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
      <Group gap="xs">
        {sortie.status === 'planned' && (
          <>
            {!isMoto && (
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
            <Button size="xs" color="brand" leftSection={<IconPlayerPlay size={14} />} onClick={() => onDepart(sortie)} loading={actionLoading === 'depart'}>
              Démarrer
            </Button>
            <Button size="xs" variant="outline" color="brand" leftSection={<IconUsers size={14} />} onClick={() => onSuggestions(sortie.id)}>
              Demandes
            </Button>
            <Button size="xs" variant="subtle" color="blue" leftSection={<IconEye size={14} />} onClick={() => onDetail(sortie)}>
              Détails
            </Button>
            <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />} onClick={() => onEdit(sortie)}>
              Modifier
            </Button>
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
              Supprimer
            </Button>
          </>
        )}
        {sortie.status === 'ongoing' && (
          <Group gap="xs">
            <Button size="xs" color="brand" leftSection={<IconFlag size={14} />} onClick={() => onArrivee(sortie)} loading={actionLoading === 'arrivee'}>
              Saisir arrivée
            </Button>
            <Button size="xs" variant="subtle" color="blue" leftSection={<IconEye size={14} />} onClick={() => onDetail(sortie)}>
              Détails
            </Button>
            <Text size="xs" c="dimmed">En attente du retour de l'employé</Text>
          </Group>
        )}
        {sortie.status === 'pending_return' && (
          <Group gap="xs">
            <Button size="xs" color="orange" leftSection={<IconFlag size={14} />} onClick={onValidateReturn} loading={actionLoading === 'validateReturn'}>
              Valider le retour
            </Button>
            <Button size="xs" variant="subtle" color="blue" leftSection={<IconEye size={14} />} onClick={() => onDetail(sortie)}>
              Détails
            </Button>
          </Group>
        )}
        {sortie.status === 'finished' && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">Terminée le {dayjs(sortie.updatedAt).format('DD/MM/YYYY')}</Text>
            <Button size="xs" variant="subtle" color="blue" leftSection={<IconEye size={14} />} onClick={() => onDetail(sortie)}>
              Détails
            </Button>
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
              Supprimer
            </Button>
          </Group>
        )}
      </Group>
    </Card>
  );
}

export default SortieCard;