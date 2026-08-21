import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Paper, Title, Text, Group, Loader, Center, Badge, Stack, Card, Flex,
  Button, Select, SimpleGrid, Tooltip, Modal, NumberInput,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import {
  IconPlayerPlay, IconFlag,
  IconCalendarEvent, IconCar, IconMotorbike, IconBus, IconCheck,
} from '@tabler/icons-react';

import dayjs from '../../utils/date';
import { sortieService } from '../../api/sortieService';
import { notifySuccess, notifyError } from '../../utils/toast';
import VehicleIcon from '../../components/VehicleIcon';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor } from '../../utils/labels';

const vehicleTypeOptions = [
  { value: 'all', label: 'Tous les véhicules' },
  { value: 'moto', label: 'Moto' },
  { value: 'voiture', label: 'Voiture' },
  { value: 'minibus', label: 'Minibus' },
];

function Planning() {
  const [sorties, setSorties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [vehicleFilter, setVehicleFilter] = useState('all');

  const [actionTarget, setActionTarget] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionKm, setActionKm] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSorties = async () => {
    try {
      const { data } = await sortieService.getAll({ limit: 9999 });
      setSorties(data.data || []);
    } catch {
      notifyError('Impossible de charger les sorties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSorties(); }, []);

  const filteredSorties = useMemo(() => {
    if (vehicleFilter === 'all') return sorties;
    return sorties.filter((s) => s.Vehicle?.type === vehicleFilter);
  }, [sorties, vehicleFilter]);

  const monthStats = useMemo(() => {
    const monthStart = currentMonth.startOf('month');
    const monthEnd = currentMonth.endOf('month');
    const monthSorties = filteredSorties.filter((s) => {
      const d = dayjs(s.departure_time);
      return d.isAfter(monthStart) && d.isBefore(monthEnd);
    });
    return {
      total: monthSorties.length,
      ongoing: monthSorties.filter((s) => s.status === 'ongoing').length,
      planned: monthSorties.filter((s) => s.status === 'planned').length,
      pendingReturn: monthSorties.filter((s) => s.status === 'pending_return').length,
      finished: monthSorties.filter((s) => s.status === 'finished').length,
    };
  }, [filteredSorties, currentMonth]);

  const sortiesByDate = useMemo(() => {
    const map = {};
    filteredSorties.forEach((s) => {
      const key = dayjs(s.departure_time).format('YYYY-MM-DD');
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [filteredSorties]);

  const selectedSorties = useMemo(() => {
    if (!selectedDate) return [];
    const key = dayjs(selectedDate).format('YYYY-MM-DD');
    return sortiesByDate[key] || [];
  }, [selectedDate, sortiesByDate]);

  const goToToday = () => {
    const today = dayjs();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const openAction = (sortie, type) => {
    setActionTarget(sortie);
    setActionType(type);
    setActionKm(0);
  };

  const handleAction = async () => {
    if (!actionTarget) return;
    if (actionType === 'depart' && (!actionKm || actionKm <= 0)) {
      notifyError('Saisissez un kilométrage valide supérieur à 0');
      return;
    }
    if (actionType === 'arrivee') {
      if (!actionKm || actionKm <= 0) { notifyError('Saisissez un kilométrage valide'); return; }
      if (actionKm < actionTarget.departure_km) { notifyError("Le km d'arrivée ne peut pas être inférieur au km de départ"); return; }
    }
    setActionLoading(true);
    try {
      if (actionType === 'depart') {
        await sortieService.depart(actionTarget.id, actionKm);
        notifySuccess('Départ enregistré');
      } else if (actionType === 'arrivee') {
        await sortieService.arrivee(actionTarget.id, actionKm);
        notifySuccess('Arrivée enregistrée');
      } else if (actionType === 'validateReturn') {
        await sortieService.validateReturn(actionTarget.id);
        notifySuccess('Retour validé - Sortie terminée');
      }
      setActionTarget(null);
      setActionType(null);
      fetchSorties();
    } catch {
      notifyError("Erreur lors de l'action");
    } finally {
      setActionLoading(false);
    }
  };

  const renderDay = useCallback((date) => {
    const key = dayjs(date).format('YYYY-MM-DD');
    const daySorties = sortiesByDate[key];

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>{dayjs(date).date()}</div>
        {daySorties?.length > 0 && (
          <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
            {daySorties.some((s) => s.status === 'ongoing') && (
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mantine-color-brand-6)' }} />
            )}
            {daySorties.some((s) => s.status === 'planned') && (
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mantine-color-gray-5)' }} />
            )}
            {daySorties.some((s) => s.status === 'pending_return') && (
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mantine-color-orange-6)' }} />
            )}
            {daySorties.some((s) => s.status === 'finished') && (
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mantine-color-brandYellow-6)' }} />
            )}
          </div>
        )}
      </div>
    );
  }, [sortiesByDate]);

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  const actionModalTitle = actionType === 'depart' ? 'Confirmer le départ'
    : actionType === 'arrivee' ? 'Confirmer l\'arrivée'
    : 'Valider le retour';

  return (
    <div className="page-content">
      <Flex justify="space-between" align="center" mb="lg">
        <Title order={3}>Planning des sorties</Title>
        <Button variant="outline" color="brand" size="sm" onClick={goToToday}>
          Aujourd'hui
        </Button>
      </Flex>

      <Flex gap="md" mb="md" wrap="wrap">
        <Select
          data={vehicleTypeOptions}
          value={vehicleFilter}
          onChange={setVehicleFilter}
          size="sm"
          style={{ width: 220 }}
          leftSection={<IconCar size={16} />}
        />
      </Flex>

      <SimpleGrid cols={{ base: 1, md: 4 }} mb="md" spacing="sm">
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconCalendarEvent size={18} color="var(--mantine-color-dimmed)" />
            <div>
              <Text size="xs" c="dimmed">Total</Text>
              <Text fw={700} size="lg">{monthStats.total}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconMotorbike size={18} color="var(--mantine-color-brand-6)" />
            <div>
              <Text size="xs" c="dimmed">En cours</Text>
              <Text fw={700} size="lg" c="brand">{monthStats.ongoing}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconBus size={18} color="var(--mantine-color-gray-6)" />
            <div>
              <Text size="xs" c="dimmed">Planifiées</Text>
              <Text fw={700} size="lg">{monthStats.planned}</Text>
            </div>
          </Group>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs">
            <IconCheck size={18} color="var(--mantine-color-brandYellow-6)" />
            <div>
              <Text size="xs" c="dimmed">Terminées</Text>
              <Text fw={700} size="lg">{monthStats.finished}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Flex gap="md" wrap="wrap" align="flex-start">
        <Paper p="md" radius="lg" withBorder style={{ flex: '0 0 auto' }}>
          <Calendar
            getDayProps={(date) => ({
              selected: selectedDate && dayjs(date).isSame(dayjs(selectedDate), 'day'),
              onClick: () => setSelectedDate(dayjs(date)),
            })}
            renderDay={renderDay}
            size="md"
            highlightToday
            defaultDate={currentMonth.toDate()}
            onPreviousMonth={(date) => setCurrentMonth(dayjs(date))}
            onNextMonth={(date) => setCurrentMonth(dayjs(date))}
          />
        </Paper>

        <Paper p="md" radius="lg" withBorder style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} mb="sm" size="sm" c="dimmed">
            {selectedDate
              ? `Sorties du ${dayjs(selectedDate).format('DD/MM/YYYY')}`
              : 'Sélectionnez une date pour voir les sorties'}
          </Text>
          {selectedSorties.length === 0 ? (
            <Center h={80}>
              <Text c="dimmed" size="sm">Aucune sortie ce jour</Text>
            </Center>
          ) : (
            <Stack gap="sm">
              {selectedSorties.map((s) => (
                <Card key={s.id} withBorder radius="md" p="sm">
                  <Group justify="space-between" mb={4}>
                    <Text fw={500} size="sm">{s.destination}</Text>
                    <Badge color={statusColor[s.status]} variant="light" size="sm">
                      {statusLabel[s.status]}
                    </Badge>
                  </Group>
                  <Group gap={4} mb={2}>
                    <VehicleIcon type={s.Vehicle?.type} size={12} color="var(--mantine-color-dimmed)" />
                    <Text size="xs" c="dimmed" tt="capitalize">{s.Vehicle?.type || 'N/A'}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {s.driver_name} · {dayjs(s.departure_time).format('HH:mm')}
                  </Text>
                  <Group gap="xs" mt={4}>
                    {s.departure_km != null && (
                      <Text size="xs" c="dimmed">
                        Départ: <b>{s.departure_km.toLocaleString()} km</b>
                      </Text>
                    )}
                    {s.arrival_km != null && (
                      <Text size="xs" c="dimmed">
                        Arrivée: <b>{s.arrival_km.toLocaleString()} km</b>
                      </Text>
                    )}
                    {s.distance_km != null && (
                      <Text size="xs" c="dimmed">
                        Distance: <b>{s.distance_km.toLocaleString()} km</b>
                      </Text>
                    )}
                    {s.return_km != null && (
                      <Text size="xs" c="dimmed">
                        Retour: <b>{s.return_km.toLocaleString()} km</b>
                      </Text>
                    )}
                  </Group>
                  <Group gap="xs" mt="xs">
                    {s.status === 'planned' && (
                      <Tooltip label="Démarrer la sortie">
                        <Button size="xs" color="brand" variant="light"
                          leftSection={<IconPlayerPlay size={12} />}
                          onClick={() => openAction(s, 'depart')}>
                          Départ
                        </Button>
                      </Tooltip>
                    )}
                    {s.status === 'ongoing' && (
                      <Tooltip label="Enregistrer l'arrivée">
                        <Button size="xs" color="green" variant="light"
                          leftSection={<IconFlag size={12} />}
                          onClick={() => openAction(s, 'arrivee')}>
                          Arrivée
                        </Button>
                      </Tooltip>
                    )}
                    {s.status === 'pending_return' && (
                      <Tooltip label="Valider le retour">
                        <Button size="xs" color="orange" variant="light"
                          leftSection={<IconCheck size={12} />}
                          onClick={() => openAction(s, 'validateReturn')}>
                          Valider retour
                        </Button>
                      </Tooltip>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Paper>
      </Flex>

      <Group gap="xs" mt="md">
        <Group gap={4}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-brand-6)' }} /><Text size="xs" c="dimmed">En cours</Text></Group>
        <Group gap={4}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-gray-5)' }} /><Text size="xs" c="dimmed">Planifiée</Text></Group>
        <Group gap={4}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-orange-6)' }} /><Text size="xs" c="dimmed">Retour à valider</Text></Group>
        <Group gap={4}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-brandYellow-6)' }} /><Text size="xs" c="dimmed">Terminée</Text></Group>
      </Group>

      <Modal opened={!!actionTarget} onClose={() => setActionTarget(null)} title={actionModalTitle} size="sm" centered>
        <Stack gap="md">
          {actionTarget && (
            <Text size="sm" c="dimmed">
              {actionTarget.destination} — {actionTarget.driver_name}
            </Text>
          )}
          {(actionType === 'depart' || actionType === 'arrivee') && (
            <NumberInput
              label={actionType === 'depart' ? 'Kilométrage au départ' : "Kilométrage à l'arrivée"}
              value={actionKm}
              onChange={setActionKm}
              min={0}
              hideControls
              placeholder="Ex: 45230"
            />
          )}
          {actionType === 'validateReturn' && (
            <Text size="sm">Confirmez la validation du retour pour cette sortie ?</Text>
          )}
          <Group justify="end">
            <Button variant="subtle" color="gray" onClick={() => setActionTarget(null)}>Annuler</Button>
            <Button color="brand" loading={actionLoading} onClick={handleAction}>Confirmer</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

export default Planning;
