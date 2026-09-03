import { useEffect, useState } from 'react';
import {
  Badge, Text, Group, Card, SimpleGrid,
  Stack, Button, Modal, NumberInput, Avatar, Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRoute, IconClock, IconGauge, IconPlayerPlay, IconFlag, IconCar, IconCalendarEvent } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import dayjs from '../../utils/date';
import { sortieService } from '../../api/sortieService';
import { notifySuccess, notifyError } from '../../utils/toast';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import EmptyState from '../../components/EmptyState';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor, sortieStatusAccent } from '../../utils/labels';

function DriverCard({ sortie, onStart, onArrivee, actionLoading }) {
  return (
    <Card withBorder radius="lg" p="lg" className="driver-card">
      <div className="stat-card-accent" style={{ background: sortieStatusAccent[sortie.status] }} />
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="sm">
          <IconRoute size={20} color="light-dark(var(--mantine-color-brand-6), #7BC88A)" />
          <Text fw={600} size="md">{sortie.destination}</Text>
        </Group>
        <Badge color={statusColor[sortie.status]} variant="light">
          {statusLabel[sortie.status]}
        </Badge>
      </Group>

      <Stack gap={5} mb="md">
        <Group gap="xs">
          <VehicleIcon type={sortie.Vehicle?.type} size={15} color="var(--mantine-color-dimmed)" />
          <Text size="sm" tt="capitalize" fw={500}>{sortie.Vehicle?.type}</Text>
          <Text size="xs" c="dimmed">({sortie.Vehicle?.capacity} places)</Text>
        </Group>
        <Group gap="xs">
          <IconCalendarEvent size={14} color="var(--mantine-color-dimmed)" />
          <Text size="sm">{dayjs(sortie.departure_time).format('DD/MM/YYYY')} á {dayjs(sortie.departure_time).format('HH:mm')}</Text>
        </Group>
        {sortie.departure_km != null && (
          <Group gap="xs">
            <IconGauge size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">Km départ: <Text span fw={600}>{sortie.departure_km} km</Text></Text>
          </Group>
        )}
        {sortie.departed_at && (
          <Group gap="xs">
            <IconClock size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">Départ réel: {dayjs(sortie.departed_at).format('DD/MM/YYYY HH:mm')}</Text>
          </Group>
        )}
        {sortie.arrival_km != null && (
          <Group gap="xs">
            <IconGauge size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">Km arrivée: <Text span fw={600}>{sortie.arrival_km} km</Text></Text>
          </Group>
        )}
        {sortie.distance_km != null && (
          <Text size="sm" c="brandYellow" fw={600}>Distance: {sortie.distance_km} km</Text>
        )}
      </Stack>

      <Divider my="sm" />
      <Text size="xs" c="dimmed" fw={600} mb={6}>
        Passagers ({sortie.Requests?.length || 0})
      </Text>
      {sortie.Requests?.length > 0 ? (
        <Stack gap={6} mb="md">
          {sortie.Requests.map((req) => (
            <Group key={req.id} gap="sm" wrap="nowrap">
              <Avatar color="brand" radius="xl" size="sm">
                {`${req.Employee?.prenom?.[0] || ''}${req.Employee?.nom?.[0] || ''}`}
              </Avatar>
              <Text size="sm" truncate style={{ flex: 1 }}>
                {req.Employee?.prenom} {req.Employee?.nom}
              </Text>
              <Badge size="xs" variant="light" color="gray">{req.nb_personnes}p</Badge>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="xs" c="dimmed" mb="md">Aucun passager</Text>
      )}

      {sortie.status === 'planned' && (
        <Button color="brand" fullWidth leftSection={<IconPlayerPlay size={16} />} onClick={() => onStart(sortie)} loading={actionLoading === 'depart'}>
          Démarrer la sortie
        </Button>
      )}
      {sortie.status === 'ongoing' && (
        <Button color="brand" fullWidth leftSection={<IconFlag size={16} />} onClick={() => onArrivee(sortie)} loading={actionLoading === 'arrivee'}>
          Saisir le KM d'arrivée
        </Button>
      )}
      {sortie.status === 'pending_return' && (
        <Text size="xs" c="orange" fw={500} ta="center">Retour en attente de validation</Text>
      )}
      {sortie.status === 'finished' && (
        <Text size="xs" c="dimmed" ta="center">Terminée le {dayjs(sortie.updatedAt).format('DD/MM/YYYY')}</Text>
      )}
    </Card>
  );
}

function DriverSorties() {
  const [sorties, setSorties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [startOpened, { open: openStart, close: closeStart }] = useDisclosure(false);
  const [startSortie, setStartSortie] = useState(null);
  const [startKm, setStartKm] = useState(0);

  const [arriveeOpened, { open: openArrivee, close: closeArrivee }] = useDisclosure(false);
  const [arriveeSortie, setArriveeSortie] = useState(null);
  const [arriveeKm, setArriveeKm] = useState(0);

  const fetchData = async () => {
    try {
      const { data } = await sortieService.driverMine();
      setSorties(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Impossible de charger vos sorties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStart = async () => {
    const km = Number(startKm);
    if (!km || km <= 0) { notifyError('Saisissez un kilométrage de départ valide supérieur à 0'); return; }
    setActionLoading('depart');
    try {
      await sortieService.driverDepart(startSortie.id, km);
      notifySuccess('Départ enregistré');
      closeStart();
      fetchData();
    } catch (err) {
      notifyError(err.response?.data?.message || "Erreur lors de l'enregistrement du départ");
    } finally {
      setActionLoading(null);
    }
  };

  const handleArrivee = async () => {
    const km = Number(arriveeKm);
    if (!km || km <= 0) { notifyError('Saisissez un kilométrage d\'arrivée valide'); return; }
    if (arriveeSortie?.departure_km != null && km < Number(arriveeSortie.departure_km)) {
      notifyError("Le kilométrage d'arrivée ne peut pas être inférieur au kilométrage de départ");
      return;
    }
    setActionLoading('arrivee');
    try {
      await sortieService.driverArrivee(arriveeSortie.id, km);
      notifySuccess('Arrivée enregistrée - Sortie terminée');
      closeArrivee();
      fetchData();
    } catch (err) {
      notifyError(err.response?.data?.message || "Erreur lors de l'enregistrement de l'arrivée");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <PageLoader />;

  const planned = sorties.filter((s) => s.status === 'planned');
  const ongoing = sorties.filter((s) => s.status === 'ongoing' || s.status === 'pending_return');
  const finished = sorties.filter((s) => s.status === 'finished');

  const renderGroup = (title, color, items) => (
    <>
      {items.length > 0 && (
        <>
          <Text size="sm" fw={600} mb="sm" c={color}>{title} ({items.length})</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" mb="xl">
            {items.map((s) => (
              <DriverCard
                key={s.id}
                sortie={s}
                onStart={(srt) => { setStartSortie(srt); setStartKm(0); openStart(); }}
                onArrivee={(srt) => { setArriveeSortie(srt); setArriveeKm(0); openArrivee(); }}
                actionLoading={actionLoading}
              />
            ))}
          </SimpleGrid>
        </>
      )}
      {sorties.length > 0 && items.length === 0 && title === 'Planifiées' && null}
    </>
  );

  return (
    <div className="page-content">
      <PageHeader title="Mes sorties" subtitle={`${sorties.length} sortie${sorties.length !== 1 ? 's' : ''} affectée${sorties.length !== 1 ? 's' : ''} à vous en tant que chauffeur`} />

      {sorties.length === 0 ? (
        <EmptyState icon={IconCar} message="Aucune sortie ne vous est affectée pour le moment" />
      ) : (
        <>
          {planned.length > 0 && renderGroup('Planifiées', 'dimmed', planned)}
          {ongoing.length > 0 && renderGroup('En cours', 'brand', ongoing)}
          {finished.length > 0 && renderGroup('Terminées', 'dimmed', finished)}
        </>
      )}

      <Modal opened={startOpened} onClose={closeStart} title="Démarrer la sortie" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <Group gap="sm">
            <IconRoute size={18} color="var(--mantine-color-brand-6)" />
            <Text size="md" fw={600}>{startSortie?.destination}</Text>
          </Group>
          <Text size="sm" c="dimmed">Saisissez le kilométrage compteur de la voiture au départ.</Text>
          <NumberInput label="Kilométrage de départ" placeholder="Ex: 125450" min={0}
            value={startKm} onChange={setStartKm} required radius="md"
            leftSection={<IconGauge size={16} />}
          />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeStart} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleStart} loading={actionLoading === 'depart'} radius="md">
              Confirmer le départ
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={arriveeOpened} onClose={closeArrivee} title="Enregistrer l'arrivée" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <Group gap="sm">
            <IconRoute size={18} color="var(--mantine-color-brand-6)" />
            <Text size="md" fw={600}>{arriveeSortie?.destination}</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Km départ: <strong>{arriveeSortie?.departure_km} km</strong>
          </Text>
          <NumberInput label="Kilométrage d'arrivée" placeholder="Ex: 126000" min={0}
            value={arriveeKm} onChange={setArriveeKm} required radius="md"
            leftSection={<IconGauge size={16} />}
          />
          {Number(arriveeSortie?.departure_km) > 0 && Number(arriveeKm) > Number(arriveeSortie.departure_km) && (
            <Text size="sm" c="dimmed">
              Distance parcourue : <strong>{Number(arriveeKm) - Number(arriveeSortie.departure_km)} km</strong>
            </Text>
          )}
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeArrivee} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleArrivee} loading={actionLoading === 'arrivee'} radius="md">
              Confirmer le retour
            </Button>
          </Group>
        </Stack>
      </Modal>

      <style>{`
        .driver-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .driver-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default DriverSorties;
