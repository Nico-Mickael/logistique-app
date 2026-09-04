import { useEffect, useState, useCallback } from 'react';
import {
  Paper, Badge, Text, Group, Card, SimpleGrid, Stack, Button, Modal, NumberInput, Progress,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { useDisclosure } from '@mantine/hooks';
import { IconRoute, IconMapPin, IconClock, IconGauge, IconFlag, IconCar, IconUsers, IconNote } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import dayjs from '../../utils/date';
import { sortieService } from '../../api/sortieService';
import { notifySuccess, notifyError } from '../../utils/toast';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import EmptyState from '../../components/EmptyState';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor, sortieStatusAccent } from '../../utils/labels';

function TripCard({ sortie, onReturn }) {
  const isMoto = sortie.Vehicle?.type === 'moto';
  const ds = sortie.displayStatus;
  return (
    <Card withBorder radius="lg" p="lg" className="trip-card">
      <div className="stat-card-accent" style={{ background: sortieStatusAccent[ds?.key || sortie.status] }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="sm">
          <IconRoute size={20} color="light-dark(var(--mantine-color-brand-6), #7BC88A)" />
          <Text fw={600} size="md">{sortie.destination}</Text>
        </Group>
        <Badge color={ds?.color || statusColor[sortie.status]} variant="light">
          {ds?.label || statusLabel[sortie.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Group gap="xs">
          <VehicleIcon type={sortie.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />
          <Text size="sm" tt="capitalize">{sortie.Vehicle?.type}</Text>
        </Group>
        <Group gap="xs">
          <IconClock size={14} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{dayjs(sortie.departure_time).format('DD/MM/YYYY HH:mm')}</Text>
        </Group>
        {sortie.motif && (
          <Group gap="xs">
            <IconNote size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm" truncate>{sortie.motif}</Text>
          </Group>
        )}
        {!isMoto && sortie.departure_km && (
          <Group gap="xs">
            <IconGauge size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">Départ: {sortie.departure_km} km</Text>
          </Group>
        )}
        {isMoto && !sortie.departure_km && (
          <Group gap="xs">
            <IconGauge size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">Véhicule personnel</Text>
          </Group>
        )}
        {!isMoto && sortie.return_km && (
          <Group gap="xs">
            <IconGauge size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">Retour: {sortie.return_km} km</Text>
          </Group>
        )}
        {!isMoto && sortie.returned_at && (
          <Group gap="xs">
            <IconClock size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">Retour le {dayjs(sortie.returned_at).format('DD/MM/YYYY HH:mm')}</Text>
          </Group>
        )}
        {!isMoto && sortie.distance_km > 0 && (
          <Text size="sm" c="brandYellow" fw={600}>
            Distance: {sortie.distance_km} km
          </Text>
        )}
        {isMoto && sortie.Requests?.length > 0 && (
          <Group gap="xs">
            <IconGauge size={14} color="var(--mantine-color-brandYellow-6)" />
            <Text size="sm" fw={600}>Kilométrages individuels:</Text>
          </Group>
        )}
      </Stack>
      {isMoto && sortie.Requests?.length > 0 && (
        <Stack gap={4} mb="md">
          {sortie.Requests.map((req) => {
            const sr = req.SortieRequest;
            const done = sr?.status === 'finished';
            return (
              <Group key={req.id} gap="xs">
                <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {req.destination} ({req.nb_personnes}p)
                  {done && sr?.departure_km != null && sr?.return_km != null
                    ? ` — ${sr.departure_km} → ${sr.return_km} km (${sr.distance_km} km)`
                    : sr?.status === 'ongoing' ? ' — en cours' : ''}
                </Text>
              </Group>
            );
          })}
        </Stack>
      )}
      {sortie.status === 'ongoing' && isMoto && (
        <Button size="xs" color="brand" leftSection={<IconFlag size={14} />} onClick={() => onReturn(sortie)} fullWidth mt="sm">
          Saisir mon retour
        </Button>
      )}
      {sortie.status === 'ongoing' && !isMoto && (
        <Text size="xs" c="dimmed" mt="sm" ta="center">
          En cours — le chauffeur enregistre l'arrivée
        </Text>
      )}
      {sortie.status === 'pending_return' && (
        <Text size="xs" c="orange" fw={500} ta="center" mt="sm">
          Retour en attente de validation
        </Text>
      )}
    </Card>
  );
}

function MyTrips() {
  const [sorties, setSorties] = useState([]);
  const [plannedSorties, setPlannedSorties] = useState([]);
  const [loading, setLoading] = useState(true);

  const [returnOpened, { open: openReturn, close: closeReturn }] = useDisclosure(false);
  const [returnSortie, setReturnSortie] = useState(null);
  const [returnDepKm, setReturnDepKm] = useState(0);
  const [returnKm, setReturnKm] = useState(0);
  const [returnedAt, setReturnedAt] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);

  const [joinOpened, { open: openJoin, close: closeJoin }] = useDisclosure(false);
  const [joinSortie, setJoinSortie] = useState(null);
  const [joinNb, setJoinNb] = useState(1);
  const [joinLoading, setJoinLoading] = useState(false);

  const fetchTrips = async () => {
    try {
      const { data } = await sortieService.mine();
      setSorties(Array.isArray(data) ? data : data.data || []);
    } catch {
      notifyError('Impossible de charger vos trajets');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanned = useCallback(async () => {
    try {
      const { data } = await sortieService.planned();
      setPlannedSorties(Array.isArray(data) ? data : []);
    } catch {
      // silently fail — section won't show
    }
  }, []);

  useEffect(() => {
    fetchTrips();
    fetchPlanned();
  }, [fetchPlanned]);

  const openReturnModal = (s) => {
    setReturnSortie(s);
    setReturnDepKm(0);
    setReturnKm(0);
    setReturnedAt(new Date());
    openReturn();
  };

  const handleReturn = async () => {
    const dep = Number(returnDepKm);
    const ret = Number(returnKm);
    if (!dep || dep <= 0) { notifyError('Saisissez votre kilométrage de départ'); return; }
    if (!ret || ret < dep) { notifyError('Le km de retour ne peut pas être inférieur au km de départ'); return; }
    if (!returnedAt) { notifyError('Saisissez la date et heure de retour'); return; }
    setReturnLoading(true);
    try {
      await sortieService.employeeReturn(returnSortie.id, dep, ret, returnedAt);
      notifySuccess('Retour marqué - En attente de validation');
      closeReturn();
      fetchTrips();
    } catch (err) {
      notifyError(err.response?.data?.message || "Erreur lors de l'enregistrement du retour");
    } finally {
      setReturnLoading(false);
    }
  };

  const openJoinModal = (s) => {
    setJoinSortie(s);
    setJoinNb(1);
    openJoin();
  };

  const handleJoin = async () => {
    if (!joinSortie) return;
    setJoinLoading(true);
    try {
      await sortieService.join(joinSortie.id, joinNb);
      notifySuccess('Demande créée pour cette sortie');
      closeJoin();
      fetchTrips();
      fetchPlanned();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Impossible de rejoindre cette sortie');
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  const ongoing = sorties.filter((s) => s.status === 'ongoing');
  const pendingReturn = sorties.filter((s) => s.status === 'pending_return');
  const planned = sorties.filter((s) => s.status === 'planned');
  const finished = sorties.filter((s) => s.status === 'finished');

  return (
    <div className="page-content">
      <PageHeader title="Mes trajets" subtitle={`${sorties.length} trajet${sorties.length !== 1 ? 's' : ''} associé${sorties.length !== 1 ? 's' : ''} à vos demandes`} />

      {plannedSorties.length > 0 && (
        <>
          <Text size="sm" fw={600} mb="sm" c="brand">
            <IconCar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Sorties disponibles ({plannedSorties.length})
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" mb="xl">
            {plannedSorties.map((s) => {
              const capacityPct = s.vehicle?.capacity ? Math.round((s.occupiedSeats / s.vehicle.capacity) * 100) : 0;
              return (
                <Card key={s.id} withBorder radius="lg" p="lg" className="trip-card">
                  <div className="stat-card-accent" style={{ background: s.displayStatus?.color === 'orange' ? 'var(--mantine-color-orange-6)' : 'var(--mantine-color-brandYellow-6)' }} />
                  <Group justify="space-between" mb="xs" wrap="nowrap">
                    <Group gap="sm">
                      <VehicleIcon type={s.vehicle?.type} size={18} color="light-dark(var(--mantine-color-brand-6), #7BC88A)" />
                      <Text fw={600} size="sm" tt="capitalize">{s.vehicle?.type}</Text>
                    </Group>
                    <Badge color={s.displayStatus?.color || 'gray'} variant="light" size="sm">
                      {s.displayStatus?.label || 'Prévue'}
                    </Badge>
                  </Group>
                  <Stack gap={4} mb="md">
                    <Group gap="xs">
                      <IconRoute size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm">{s.destination}</Text>
                    </Group>
                    <Group gap="xs">
                      <IconClock size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm">{dayjs(s.departure_time).format('DD/MM/YYYY HH:mm')}</Text>
                    </Group>
                    {s.motif && (
                      <Group gap="xs">
                        <IconNote size={14} color="var(--mantine-color-dimmed)" />
                        <Text size="sm" truncate>{s.motif}</Text>
                      </Group>
                    )}
                    <Group gap="xs">
                      <IconUsers size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm">{s.passenger_count} / {s.vehicle?.capacity} passagers</Text>
                    </Group>
                  </Stack>
                  <Progress value={capacityPct} color={capacityPct >= 100 ? 'red' : 'brand'} size="xs" mb="sm" radius="xl" />
                  <Button
                    color="brand"
                    fullWidth
                    leftSection={<IconUsers size={14} />}
                    onClick={() => openJoinModal(s)}
                    disabled={s.availableSeats <= 0}
                  >
                    {s.availableSeats <= 0 ? 'Complet' : 'Rejoindre cette sortie'}
                  </Button>
                </Card>
              );
            })}
          </SimpleGrid>
        </>
      )}

      {sorties.length === 0 ? (
        <EmptyState icon={IconRoute} message="Aucun trajet associé à vos demandes" />
      ) : (
        <>
          {ongoing.length > 0 && (
            <>
              <Text size="sm" fw={600} mb="sm" c="brand">En cours</Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="xl">
                {ongoing.map((s) => <TripCard key={s.id} sortie={s} onReturn={openReturnModal} />)}
              </SimpleGrid>
            </>
          )}

          {pendingReturn.length > 0 && (
            <>
              <Text size="sm" fw={600} mb="sm" c="orange">Retour à valider</Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="xl">
                {pendingReturn.map((s) => <TripCard key={s.id} sortie={s} onReturn={openReturnModal} />)}
              </SimpleGrid>
            </>
          )}

          {planned.length > 0 && (
            <>
              <Text size="sm" fw={600} mb="sm" c="dimmed">À venir</Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="xl">
                {planned.map((s) => <TripCard key={s.id} sortie={s} onReturn={openReturnModal} />)}
              </SimpleGrid>
            </>
          )}

          {finished.length > 0 && (
            <>
              <Text size="sm" fw={600} mb="sm" c="dimmed">Terminés</Text>
              <div className="hide-on-mobile">
                <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
                  <DataTable
                    withTableBorder
                    borderRadius="md"
                    highlightOnHover
                    verticalSpacing="sm"
                    columns={[
                      { accessor: 'destination', title: 'Destination', sortable: true },
                      { accessor: 'vehicle', title: 'Véhicule', render: (s) => <Text tt="capitalize">{s.Vehicle?.type}</Text> },
                      { accessor: 'departure_time', title: 'Départ', render: (s) => dayjs(s.departure_time).format('DD/MM/YYYY HH:mm') },
                      { accessor: 'distance_km', title: 'Distance', textAlign: 'right', render: (s) => {
                        const isMoto = s.Vehicle?.type === 'moto';
                        const sr = isMoto && s.Requests?.[0]?.SortieRequest;
                        const dist = isMoto ? (sr?.distance_km || 0) : (s.distance_km || 0);
                        return dist > 0 ? <Badge color="brand" variant="light" size="sm">{dist} km</Badge> : <Text size="sm" c="dimmed">—</Text>;
                      } },
                    ]}
                    records={finished}
                    idAccessor="id"
                    recordsPerPage={10}
                    paginationSize="sm"
                    paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
                  />
                </Paper>
              </div>
              <div className="hide-on-tablet-up">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {finished.map((s) => <TripCard key={s.id} sortie={s} onReturn={openReturnModal} />)}
                </SimpleGrid>
              </div>
            </>
          )}
        </>
      )}

      <Modal opened={joinOpened} onClose={closeJoin} title="Rejoindre cette sortie" size="md"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <Stack gap="md">
          <Group gap="sm">
            <IconRoute size={18} color="var(--mantine-color-brand-6)" />
            <Text size="md" fw={600}>{joinSortie?.destination}</Text>
          </Group>
          <Text size="sm" c="dimmed">
            {joinSortie?.vehicle?.type} — {dayjs(joinSortie?.departure_time).format('DD/MM/YYYY HH:mm')}
          </Text>
          {joinSortie?.motif && (
            <Text size="sm" c="dimmed">Motif: {joinSortie.motif}</Text>
          )}
          <Text size="sm">
            Places disponibles: <strong>{joinSortie?.availableSeats}</strong> / {joinSortie?.vehicle?.capacity}
          </Text>
          <NumberInput
            label="Nombre de personnes"
            min={1}
            max={joinSortie?.availableSeats || 1}
            value={joinNb}
            onChange={setJoinNb}
            required
          />
          <Button color="brand" fullWidth onClick={handleJoin} loading={joinLoading}>
            Confirmer
          </Button>
        </Stack>
      </Modal>

      <Modal opened={returnOpened} onClose={closeReturn} title="Marquer le retour" size="md"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <Text size="sm" mb="sm">
          <Text span fw={600}>{returnSortie?.destination}</Text>
          <Text span c="dimmed"> — Votre moto, saisissez vos kilomètres</Text>
        </Text>
        <DateTimePicker label="Date et heure de retour" value={returnedAt} onChange={setReturnedAt}
          required mb="sm" />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
          <NumberInput label="Kilométrage au départ" placeholder="Ex: 12500"
            min={0} value={returnDepKm} onChange={setReturnDepKm} required
          />
          <NumberInput label="Kilométrage au retour" placeholder="Ex: 12750"
            min={Number(returnDepKm) || 0} value={returnKm} onChange={setReturnKm} required
          />
        </SimpleGrid>
        {Number(returnDepKm) > 0 && Number(returnKm) > Number(returnDepKm) && (
          <Text size="sm" c="dimmed" mb="md">
            Distance parcourue : <strong>{Number(returnKm) - Number(returnDepKm)} km</strong>
          </Text>
        )}
        <Button color="brand" fullWidth onClick={handleReturn} size="md" loading={returnLoading}>Confirmer le retour</Button>
      </Modal>

      <style>{`
        .trip-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .trip-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default MyTrips;
