import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Title, Text, Group, Loader, Center, Badge, Stack, Card, Flex,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';

import dayjs from '../../utils/date';
import { sortieService } from '../../api/sortieService';
import { notifyError } from '../../utils/toast';
import VehicleIcon from '../../components/VehicleIcon';

const statusColor = { planned: 'gray', ongoing: 'brand', pending_return: 'orange', finished: 'brandYellow' };
const statusLabel = { planned: 'Planifiée', ongoing: 'En cours', pending_return: 'Retour à valider', finished: 'Terminée' };

function Planning() {
  const [sorties, setSorties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

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

  const sortiesByDate = useMemo(() => {
    const map = {};
    sorties.forEach((s) => {
      const key = dayjs(s.departure_time).format('YYYY-MM-DD');
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sorties]);

  const selectedSorties = useMemo(() => {
    if (!selectedDate) return [];
    const key = dayjs(selectedDate).format('YYYY-MM-DD');
    const daySorties = sortiesByDate[key] || [];

    return daySorties.filter((s, i, arr) =>
      arr.findIndex((x) => x.id === s.id) === i
    );
  }, [selectedDate, sortiesByDate]);

  const renderDay = (date) => {
    const key = dayjs(date).format('YYYY-MM-DD');
    const daySorties = sortiesByDate[key];
    const hasSortie = !!daySorties?.length;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>{dayjs(date).date()}</div>
        {hasSortie && (
          <div style={{
            position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 2,
          }}>
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
  };

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Title order={3} mb="lg">Planning des sorties</Title>

      <Flex gap="md" wrap="wrap" align="flex-start">
        <Paper p="md" radius="lg" withBorder style={{ flex: '0 0 auto' }}>
          <Calendar
            getDayProps={(date) => ({
              selected: selectedDate && dayjs(date).isSame(selectedDate, 'day'),
              onClick: () => setSelectedDate(date),
            })}
            renderDay={renderDay}
            size="md"
            highlightToday
          />
        </Paper>

        <Paper p="md" radius="lg" withBorder style={{ flex: 1, minWidth: 300 }}>
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
    </div>
  );
}

export default Planning;