import { useEffect, useState } from 'react';
import {
  Paper, Title, Table, Badge, Loader, Center, Text, Group, Button, Modal,
  TextInput, Select, Stack, NumberInput, Card, SimpleGrid, Flex,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconPlayerPlay, IconFlag, IconUsers, IconRoute, IconInbox } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { sortieService } from '../../api/sortieService';
import { vehicleService } from '../../api/vehicleService';
import { notifySuccess, notifyError } from '../../utils/toast';

const statusColor = { planned: 'gray', ongoing: 'brand', finished: 'brandYellow' };
const statusLabel = { planned: 'Planifiée', ongoing: 'En cours', finished: 'Terminée' };

function SortieCard({ sortie, onDepart, onArrivee, onSuggestions }) {
  return (
    <Card withBorder radius="lg" p="lg" className="sortie-card">
      <div className="stat-card-accent" style={{
        background: sortie.status === 'planned' ? 'var(--mantine-color-gray-5)' :
                     sortie.status === 'ongoing' ? 'var(--mantine-color-brand-6)' :
                     'var(--mantine-color-brandYellow-6)'
      }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text fw={600} size="md">{sortie.destination}</Text>
        <Badge color={statusColor[sortie.status]} variant="light">
          {statusLabel[sortie.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm"><Text span c="dimmed" size="sm">Conducteur: </Text>{sortie.driver_name}</Text>
        <Text size="sm"><Text span c="dimmed" size="sm">Véhicule: </Text>
          <Text span tt="capitalize" size="sm">{sortie.Vehicle?.type}</Text>
        </Text>
        <Text size="sm"><Text span c="dimmed" size="sm">Départ: </Text>
          {dayjs(sortie.departure_time).format('DD/MM/YYYY HH:mm')}
        </Text>
        {sortie.status === 'finished' && (
          <Text size="sm" fw={600}>
            <Text span c="dimmed" size="sm">Distance: </Text>{sortie.distance_km} km
          </Text>
        )}
        {sortie.departure_km && (
          <Text size="sm"><Text span c="dimmed" size="sm">Km départ: </Text>{sortie.departure_km}</Text>
        )}
        {sortie.arrival_km && (
          <Text size="sm"><Text span c="dimmed" size="sm">Km arrivée: </Text>{sortie.arrival_km}</Text>
        )}
      </Stack>
      <Group gap="xs">
        {sortie.status === 'planned' && (
          <>
            <Button size="xs" color="brand" leftSection={<IconPlayerPlay size={14} />} onClick={() => onDepart(sortie)}>
              Démarrer
            </Button>
            <Button size="xs" variant="outline" color="brand" leftSection={<IconUsers size={14} />} onClick={() => onSuggestions(sortie.id)}>
              Demandes
            </Button>
          </>
        )}
        {sortie.status === 'ongoing' && (
          <Button size="xs" color="brand" leftSection={<IconFlag size={14} />} onClick={() => onArrivee(sortie)}>
            Saisir arrivée
          </Button>
        )}
        {sortie.status === 'finished' && (
          <Text size="xs" c="dimmed">Terminée le {dayjs(sortie.updatedAt).format('DD/MM/YYYY')}</Text>
        )}
      </Group>
    </Card>
  );
}

function Sorties() {
  const [sorties, setSorties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState(null);

  const [departOpened, { open: openDepart, close: closeDepart }] = useDisclosure(false);
  const [selectedSortie, setSelectedSortie] = useState(null);
  const [departureKm, setDepartureKm] = useState(0);

  const [arriveeOpened, { open: openArrivee, close: closeArrivee }] = useDisclosure(false);
  const [arrivalKm, setArrivalKm] = useState(0);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpened, { open: openSuggest, close: closeSuggest }] = useDisclosure(false);
  const [adding, setAdding] = useState(false);

  const fetchSorties = async () => {
    try {
      const { data } = await sortieService.getAll();
      setSorties(data);
    } catch {
      notifyError('Impossible de charger les sorties');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try { const { data } = await vehicleService.getAvailable(); setVehicles(data); } catch { /* ignore */ }
  };

  useEffect(() => { fetchSorties(); }, []);

  const handleCreate = async () => {
    if (!vehicleId || !driverName || !destination || !departureTime) {
      notifyError('Merci de remplir tous les champs'); return;
    }
    try {
      const { data } = await sortieService.create({
        vehicle_id: parseInt(vehicleId, 10), driver_name: driverName,
        destination, departure_time: departureTime,
      });
      notifySuccess('Sortie créée');
      closeCreate();
      setVehicleId(''); setDriverName(''); setDestination(''); setDepartureTime(null);
      fetchSorties();
      openSuggestionsModal(data.id);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const openCreateModal = () => { fetchVehicles(); openCreate(); };
  const openDepartModal = (s) => { setSelectedSortie(s); setDepartureKm(0); openDepart(); };
  const handleDepart = async () => {
    if (!departureKm || departureKm <= 0) { notifyError('Saisissez un kilométrage valide'); return; }
    try { await sortieService.depart(selectedSortie.id, departureKm); notifySuccess('Départ enregistré'); closeDepart(); fetchSorties(); }
    catch { notifyError("Erreur lors de l'enregistrement du départ"); }
  };

  const openArriveeModal = (s) => { setSelectedSortie(s); setArrivalKm(0); openArrivee(); };
  const handleArrivee = async () => {
    if (!arrivalKm || arrivalKm <= 0) { notifyError('Saisissez un kilométrage valide'); return; }
    if (arrivalKm < selectedSortie.departure_km) { notifyError("Le km d'arrivée ne peut pas être inférieur au km de départ"); return; }
    try { await sortieService.arrivee(selectedSortie.id, arrivalKm); notifySuccess('Arrivée enregistrée - Sortie terminée'); closeArrivee(); fetchSorties(); }
    catch { notifyError("Erreur lors de l'enregistrement de l'arrivée"); }
  };

  const openSuggestionsModal = async (sortieId) => {
    try { const { data } = await sortieService.suggestions(sortieId); setSuggestions(data); setSelectedSortie({ id: sortieId }); openSuggest(); }
    catch { notifyError('Impossible de charger les suggestions'); }
  };

  const handleAddRequest = async (requestId) => {
    setAdding(true);
    try { await sortieService.addRequest(selectedSortie.id, requestId); notifySuccess('Demande ajoutée à la sortie'); const { data } = await sortieService.suggestions(selectedSortie.id); setSuggestions(data); }
    catch { notifyError("Erreur lors de l'ajout de la demande"); }
    finally { setAdding(false); }
  };

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Sorties</Title>
          <Text size="sm" c="dimmed" mt={2}>{sorties.length} sortie{sorties.length !== 1 ? 's' : ''}</Text>
        </div>
        <Button color="brand" leftSection={<IconPlus size={16} />} onClick={openCreateModal} className="btn-action">
          Nouvelle sortie
        </Button>
      </Flex>

      {sorties.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconRoute size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucune sortie planifiée</Text>
            </Flex>
          </Center>
        </Paper>
      ) : (
        <>
          <div className="hide-on-mobile">
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <Table.ScrollContainer minWidth={700}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Destination</Table.Th>
                      <Table.Th>Conducteur</Table.Th>
                      <Table.Th>Véhicule</Table.Th>
                      <Table.Th>Départ prévu</Table.Th>
                      <Table.Th>Statut</Table.Th>
                      <Table.Th>Km</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sorties.map((s) => (
                      <Table.Tr key={s.id}>
                        <Table.Td fw={500}>{s.destination}</Table.Td>
                        <Table.Td>{s.driver_name}</Table.Td>
                        <Table.Td tt="capitalize">{s.Vehicle?.type}</Table.Td>
                        <Table.Td>{dayjs(s.departure_time).format('DD/MM/YYYY HH:mm')}</Table.Td>
                        <Table.Td>
                          <Badge color={statusColor[s.status]} variant="light">{statusLabel[s.status]}</Badge>
                        </Table.Td>
                        <Table.Td>
                          {s.status === 'finished'
                            ? `${s.departure_km} → ${s.arrival_km} (${s.distance_km} km)`
                            : s.departure_km ? `Départ: ${s.departure_km} km` : '—'}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            {s.status === 'planned' && (
                              <>
                                <Button size="xs" color="brand" leftSection={<IconPlayerPlay size={14} />} onClick={() => openDepartModal(s)}>Démarrer</Button>
                                <Button size="xs" variant="outline" color="brand" leftSection={<IconUsers size={14} />} onClick={() => openSuggestionsModal(s.id)}>Demandes</Button>
                              </>
                            )}
                            {s.status === 'ongoing' && (
                              <Button size="xs" color="brand" leftSection={<IconFlag size={14} />} onClick={() => openArriveeModal(s)}>Saisir arrivée</Button>
                            )}
                            {s.status === 'finished' && <Text size="xs" c="dimmed">Terminée</Text>}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </div>

          <div className="hide-on-tablet-up">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {sorties.map((s) => (
                <SortieCard key={s.id} sortie={s}
                  onDepart={openDepartModal} onArrivee={openArriveeModal} onSuggestions={openSuggestionsModal}
                />
              ))}
            </SimpleGrid>
          </div>
        </>
      )}

      <Modal opened={createOpened} onClose={closeCreate} title="Nouvelle sortie" size="md"
        fullScreen={{ base: true, sm: false }} className="modal-modern"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <Stack>
          <Select label="Véhicule" placeholder="Choisir un véhicule"
            data={vehicles.map((v) => ({ value: String(v.id), label: `${v.type} (${v.capacity} pers.)` }))}
            value={vehicleId} onChange={setVehicleId} required
          />
          <TextInput label="Conducteur" placeholder="Nom du conducteur" required value={driverName}
            onChange={(e) => setDriverName(e.currentTarget.value)}
          />
          <TextInput label="Destination" placeholder="Antananarivo" required value={destination}
            onChange={(e) => setDestination(e.currentTarget.value)}
          />
          <DateTimePicker label="Date et heure de départ" placeholder="Choisir une date" required
            value={departureTime} onChange={setDepartureTime} minDate={new Date()}
          />
          <Button color="brand" fullWidth onClick={handleCreate} size="md">Créer la sortie</Button>
        </Stack>
      </Modal>

      <Modal opened={departOpened} onClose={closeDepart} title="Démarrer la sortie" size="sm"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <TextInput label="Destination" value={selectedSortie?.destination || ''} disabled mb="sm" />
        <NumberInput label="Kilométrage au départ" placeholder="Ex: 12500" min={0}
          value={departureKm} onChange={setDepartureKm} mb="md" required
        />
        <Button color="brand" fullWidth onClick={handleDepart} size="md">Confirmer le départ</Button>
      </Modal>

      <Modal opened={arriveeOpened} onClose={closeArrivee} title="Saisir l'arrivée" size="sm"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <TextInput label="Destination" value={selectedSortie?.destination || ''} disabled mb="sm" />
        <TextInput label="Km de départ" value={selectedSortie?.departure_km ? `${selectedSortie.departure_km} km` : ''} disabled mb="sm" />
        <NumberInput label="Kilométrage à l'arrivée" placeholder="Ex: 12750"
          min={selectedSortie?.departure_km || 0} value={arrivalKm} onChange={setArrivalKm} mb="md" required
        />
        {selectedSortie?.departure_km && arrivalKm > selectedSortie.departure_km && (
          <Text size="sm" c="dimmed" mb="md">
            Distance parcourue : <strong>{arrivalKm - selectedSortie.departure_km} km</strong>
          </Text>
        )}
        <Button color="brand" fullWidth onClick={handleArrivee} size="md">Clôturer la sortie</Button>
      </Modal>

      <Modal opened={suggestOpened} onClose={closeSuggest} title="Demandes compatibles" size="lg"
        fullScreen={{ base: true, sm: false }}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        {suggestions.length === 0 ? (
          <Center h={80}><Text c="dimmed" size="sm">Aucune demande compatible disponible</Text></Center>
        ) : (
          <Table.ScrollContainer minWidth={400}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Employé</Table.Th>
                  <Table.Th>Destination</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Personnes</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {suggestions.map((req) => (
                  <Table.Tr key={req.id}>
                    <Table.Td>{req.Employee?.prenom} {req.Employee?.nom}</Table.Td>
                    <Table.Td>{req.destination}</Table.Td>
                    <Table.Td>{dayjs(req.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Table.Td>
                    <Table.Td>{req.nb_personnes}</Table.Td>
                    <Table.Td>
                      <Button size="xs" color="brand" loading={adding} onClick={() => handleAddRequest(req.id)}>
                        Ajouter
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Modal>

      <style>{`
        .sortie-card {
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
          .sortie-card, .dashboard-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default Sorties;
