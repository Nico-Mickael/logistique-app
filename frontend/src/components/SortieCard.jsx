import {
  Card, Group, Text, Stack, Badge, Select, Menu, ActionIcon, Divider,
} from '@mantine/core';
import {
  IconPlayerPlay, IconFlag, IconUsers, IconEye, IconEdit, IconTrash, IconExchange, IconDotsVertical,
} from '@tabler/icons-react';
import VehicleIcon from './VehicleIcon';
import dayjs from '../utils/date';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor, sortieStatusAccent, vehicleDisplayName } from '../utils/labels';
import { vehicleOptionsFor, chauffeurOptions } from '../utils/sortieOptions';

function InfoRow({ label, value, icon }) {
  return (
    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
      <Text size="sm" c="dimmed" w={100} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</Text>
      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
        {icon}
        <Text size="sm" fw={600} truncate style={{ minWidth: 0 }}>{value || '—'}</Text>
      </Group>
    </Group>
  );
}

function DriverSelect({ sortie, chauffeurs, onAssignDriver, disabled }) {
  return (
    <Select
      size="xs"
      placeholder={sortie.driver_name ? `Chauffeur: ${sortie.driver_name}` : 'Affecter un chauffeur'}
      data={chauffeurOptions(chauffeurs)}
      value={sortie.driver_employee_id ? String(sortie.driver_employee_id) : null}
      onChange={(v) => onAssignDriver(sortie, v)}
      clearable searchable radius="md"
      w={{ base: '100%', sm: 140 }}
      disabled={disabled}
      styles={{ input: sortie.driver_employee_id ? {} : { borderColor: 'var(--mantine-color-brand-6)' } }}
      renderOption={({ option }) => (
        <Group gap={8} wrap="nowrap">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: option.dot, flexShrink: 0 }} />
          <Text size="sm">{option.label}</Text>
        </Group>
      )}
    />
  );
}

function SortieCard({ sortie, chauffeurs, vehicles, onAssignDriver, onChangeVehicle, onDetail, onEdit, onDepart, onSuggestions, onDelete, onValidateReturn, onArrivee, actionLoading }) {
  const isMoto = sortie.Vehicle?.type === 'moto';
  const ds = sortie.displayStatus;

  const actionMenu = (
    <Menu position="bottom-end" withinPortal trigger="hover" openDelay={120} closeDelay={120} shadow="md" width={210}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" radius="md" aria-label="Actions" style={{ flexShrink: 0 }}>
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
  );

  return (
    <Card withBorder radius="lg" p="lg" className="sortie-card">
      <div className="stat-card-accent" style={{ background: sortieStatusAccent[ds?.key || sortie.status] }} />
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Text fw={600} size="md" style={{ minWidth: 0, wordBreak: 'break-word' }}>{sortie.destination}</Text>
        <Badge color={ds?.color || statusColor[sortie.status]} variant="light">
          {ds?.label || statusLabel[sortie.status]}
        </Badge>
      </Group>
      {!isMoto && sortie.Requests?.some((r) => r.vehicle_id && r.vehicle_id !== sortie.vehicle_id) && (
        <Text size="xs" c="orange" fw={600} mb="sm">
          <IconExchange size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Véhicule demandé différent du véhicule affecté
        </Text>
      )}
      <Stack gap={6} mb="md">
        <InfoRow label="Conducteur" value={sortie.driver_name} />
        <InfoRow
          label="Véhicule"
          value={sortie.Vehicle ? vehicleDisplayName(sortie.Vehicle) : null}
          icon={<VehicleIcon type={sortie.Vehicle?.type} size={15} color="var(--mantine-color-brand-6)" />}
        />
        <InfoRow label="Départ" value={dayjs(sortie.departure_time).format('DD/MM/YYYY HH:mm')} />
        {sortie.status === 'finished' && sortie.distance_km != null && <InfoRow label="Distance" value={`${sortie.distance_km} km`} />}
        {(sortie.departure_km != null || sortie.return_km != null || sortie.arrival_km != null || sortie.returned_at) && <Divider my={2} />}
        {sortie.departure_km != null && <InfoRow label="Km départ" value={`${sortie.departure_km}`} />}
        {sortie.return_km != null && <InfoRow label="Km retour" value={`${sortie.return_km}`} />}
        {sortie.arrival_km != null && <InfoRow label="Km arrivée" value={`${sortie.arrival_km}`} />}
        {sortie.returned_at && <InfoRow label="Retour le" value={dayjs(sortie.returned_at).format('DD/MM/YYYY HH:mm')} />}
      </Stack>
      {isMoto && sortie.Requests?.length > 0 && (
        <>
          <Divider mb="xs" />
          <Stack gap={2} mb="md">
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
        </>
      )}
      <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
        {sortie.status === 'planned' && !isMoto && (
          <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0, flexWrap: 'nowrap' }}>
            <DriverSelect sortie={sortie} chauffeurs={chauffeurs} onAssignDriver={onAssignDriver} disabled={actionLoading === 'assignDriver'} />
            <Select
              size="xs"
              placeholder="Changer de véhicule"
              data={vehicleOptionsFor(vehicles, sortie)}
              value={String(sortie.vehicle_id)}
              onChange={(v) => { if (v && String(v) !== String(sortie.vehicle_id)) onChangeVehicle(sortie, v); }}
              searchable radius="md" w={{ base: '100%', sm: 140 }}
              disabled={actionLoading === 'vehicle'}
              leftSection={<VehicleIcon type={sortie.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />}
            />
          </Group>
        )}
        {sortie.status === 'ongoing' && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>En attente du retour de l'employé</Text>
        )}
        {sortie.status === 'finished' && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>Terminée le {dayjs(sortie.updatedAt).format('DD/MM/YYYY')}</Text>
        )}
        {actionMenu}
      </Group>
    </Card>
  );
}

export default SortieCard;