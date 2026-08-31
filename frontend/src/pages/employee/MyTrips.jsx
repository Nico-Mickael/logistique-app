import { useEffect, useState } from 'react';
import {
  Paper, Title, Badge, Loader, Center, Text, Group, Card, SimpleGrid, Stack, Flex, Button, Modal, NumberInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { useDisclosure } from '@mantine/hooks';
import { IconRoute, IconMapPin, IconClock, IconGauge, IconFlag } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import dayjs from '../../utils/date';
import { sortieService } from '../../api/sortieService';
import { notifySuccess, notifyError } from '../../utils/toast';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor } from '../../utils/labels';

function TripCard({ sortie, onReturn }) {
  const isMoto = sortie.Vehicle?.type === 'moto';
  return (
    <Card withBorder radius="lg" p="lg" className="trip-card">
      <div className="stat-card-accent" style={{
        background: sortie.status === 'planned' ? 'var(--mantine-color-gray-5)' :
                     sortie.status === 'ongoing' ? 'var(--mantine-color-brand-6)' :
                     sortie.status === 'pending_return' ? 'var(--mantine-color-orange-6)' :
                     'var(--mantine-color-brandYellow-6)'
      }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="sm">
          <IconRoute size={20} color="light-dark(var(--mantine-color-brand-6), #7BC88A)" />
          <Text fw={600} size="md">{sortie.destination}</Text>
        </Group>
        <Badge color={statusColor[sortie.status]} variant="light">
          {statusLabel[sortie.status]}
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
  const [loading, setLoading] = useState(true);

  const [returnOpened, { open: openReturn, close: closeReturn }] = useDisclosure(false);
  const [returnSortie, setReturnSortie] = useState(null);
  const [returnDepKm, setReturnDepKm] = useState(0);
  const [returnKm, setReturnKm] = useState(0);
  const [returnedAt, setReturnedAt] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);

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

  useEffect(() => {
    fetchTrips();
  }, []);

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

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  const ongoing = sorties.filter((s) => s.status === 'ongoing');
  const pendingReturn = sorties.filter((s) => s.status === 'pending_return');
  const planned = sorties.filter((s) => s.status === 'planned');
  const finished = sorties.filter((s) => s.status === 'finished');

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Mes trajets</Title>
          <Text size="sm" c="dimmed" mt={2}>
            {sorties.length} trajet{sorties.length !== 1 ? 's' : ''} associé{sorties.length !== 1 ? 's' : ''} à vos demandes
          </Text>
        </div>
      </Flex>

      {sorties.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconRoute size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucun trajet associé à vos demandes</Text>
            </Flex>
          </Center>
        </Paper>
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

      <Modal opened={returnOpened} onClose={closeReturn} title="Marquer le retour" size="sm"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <Text size="sm" mb="sm">
          <Text span fw={600}>{returnSortie?.destination}</Text>
          <Text span c="dimmed"> — Votre moto, saisissez vos kilomètres</Text>
        </Text>
        <DateTimePicker label="Date et heure de retour" value={returnedAt} onChange={setReturnedAt}
          required mb="sm" />
        <NumberInput label="Kilométrage au départ" placeholder="Ex: 12500"
          min={0} value={returnDepKm} onChange={setReturnDepKm} mb="sm" required
        />
        <NumberInput label="Kilométrage au retour" placeholder="Ex: 12750"
          min={Number(returnDepKm) || 0} value={returnKm} onChange={setReturnKm} mb="md" required
        />
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
        .stat-card-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }
        .dashboard-panel {
          animation: panel-in 0.4s ease-out;
        }
        @keyframes panel-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .trip-card, .dashboard-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default MyTrips;
