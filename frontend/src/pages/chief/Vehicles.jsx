import { useEffect, useState } from 'react';
import {
  Paper, Title, Table, Badge, Loader, Center, Text, Group, Button, Modal,
  TextInput, Select, NumberInput, Card, SimpleGrid, Stack, Flex,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTool, IconCar, IconInbox } from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { vehicleService } from '../../api/vehicleService';
import { notifySuccess, notifyError } from '../../utils/toast';

const statusColor = { available: 'brand', busy: 'brandYellow', maintenance: 'red', broken: 'red' };
const statusLabel = { available: 'Disponible', busy: 'En sortie', maintenance: 'Maintenance', broken: 'En panne' };

function VehicleCard({ vehicle, onMaintenance, onAvailable }) {
  return (
    <Card withBorder radius="lg" p="lg" className="vehicle-card">
      <div className="stat-card-accent" style={{
        background: vehicle.status === 'available' ? 'var(--mantine-color-brand-6)' :
                     vehicle.status === 'maintenance' ? 'var(--mantine-color-red-6)' :
                     'var(--mantine-color-brandYellow-6)'
      }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text fw={600} size="md" tt="capitalize">{vehicle.type}</Text>
        <Badge color={statusColor[vehicle.status]} variant="light">
          {statusLabel[vehicle.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm">Capacité: <strong>{vehicle.capacity} pers.</strong></Text>
        {vehicle.maintenance_until && (
          <Text size="sm">Retour prévu: {dayjs(vehicle.maintenance_until).format('DD/MM/YYYY')}</Text>
        )}
      </Stack>
      <Group gap="xs">
        {vehicle.status !== 'maintenance' && vehicle.status !== 'busy' && (
          <Button size="xs" variant="outline" color="red" leftSection={<IconTool size={14} />}
            onClick={() => onMaintenance(vehicle)}
          >
            Maintenance
          </Button>
        )}
        {vehicle.status === 'maintenance' && (
          <Button size="xs" color="brand" onClick={() => onAvailable(vehicle.id)}>
            Rendre disponible
          </Button>
        )}
      </Group>
    </Card>
  );
}

function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState(4);

  const [maintOpened, { open: openMaint, close: closeMaint }] = useDisclosure(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [maintenanceUntil, setMaintenanceUntil] = useState(null);

  const fetchVehicles = async () => {
    try {
      const { data } = await vehicleService.getAll();
      setVehicles(data);
    } catch {
      notifyError('Impossible de charger les véhicules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const handleCreate = async () => {
    if (!type || !capacity) { notifyError('Merci de remplir tous les champs'); return; }
    try {
      await vehicleService.create({ type, capacity });
      notifySuccess('Véhicule ajouté');
      closeCreate();
      setType('');
      setCapacity(4);
      fetchVehicles();
    } catch { notifyError("Erreur lors de l'ajout du véhicule"); }
  };

  const openMaintenanceModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setMaintenanceUntil(null);
    openMaint();
  };

  const handleSetMaintenance = async () => {
    if (!maintenanceUntil) { notifyError('Choisissez une date de retour'); return; }
    try {
      await vehicleService.update(selectedVehicle.id, { status: 'maintenance', maintenance_until: maintenanceUntil });
      notifySuccess('Véhicule mis en maintenance');
      closeMaint();
      fetchVehicles();
    } catch { notifyError('Erreur lors de la mise à jour'); }
  };

  const handleMakeAvailable = async (id) => {
    try {
      await vehicleService.update(id, { status: 'available' });
      notifySuccess('Véhicule rendu disponible');
      fetchVehicles();
    } catch { notifyError('Erreur lors de la mise à jour'); }
  };

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Véhicules</Title>
          <Text size="sm" c="dimmed" mt={2}>{vehicles.length} véhicule{vehicles.length !== 1 ? 's' : ''} dans la flotte</Text>
        </div>
        <Button color="brand" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Ajouter un véhicule
        </Button>
      </Flex>

      {vehicles.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconCar size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucun véhicule enregistré</Text>
            </Flex>
          </Center>
        </Paper>
      ) : (
        <>
          <div className="hide-on-mobile">
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <Table.ScrollContainer minWidth={500}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Capacité</Table.Th>
                      <Table.Th>Statut</Table.Th>
                      <Table.Th>Maintenance jusqu'au</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {vehicles.map((v) => (
                      <Table.Tr key={v.id}>
                        <Table.Td fw={500} tt="capitalize">{v.type}</Table.Td>
                        <Table.Td>{v.capacity} pers.</Table.Td>
                        <Table.Td>
                          <Badge color={statusColor[v.status]} variant="light">{statusLabel[v.status]}</Badge>
                        </Table.Td>
                        <Table.Td>{v.maintenance_until ? dayjs(v.maintenance_until).format('DD/MM/YYYY') : '—'}</Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            {v.status !== 'maintenance' && v.status !== 'busy' && (
                              <Button size="xs" variant="outline" color="red" leftSection={<IconTool size={14} />}
                                onClick={() => openMaintenanceModal(v)}
                              >
                                Maintenance
                              </Button>
                            )}
                            {v.status === 'maintenance' && (
                              <Button size="xs" color="brand" onClick={() => handleMakeAvailable(v.id)}>
                                Rendre disponible
                              </Button>
                            )}
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
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v}
                  onMaintenance={openMaintenanceModal} onAvailable={handleMakeAvailable}
                />
              ))}
            </SimpleGrid>
          </div>
        </>
      )}

      <Modal opened={createOpened} onClose={closeCreate} title="Ajouter un véhicule" size="sm"
        fullScreen={{ base: true, sm: false }}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <Select label="Type" placeholder="Choisir un type"
          data={[{ value: 'moto', label: 'Moto' }, { value: 'voiture', label: 'Voiture' }, { value: 'minibus', label: 'Minibus' }]}
          value={type} onChange={setType} mb="sm" required
        />
        <NumberInput label="Capacité (nombre de personnes)" min={1} max={30} value={capacity}
          onChange={setCapacity} mb="md" required
        />
        <Button color="brand" fullWidth onClick={handleCreate} size="md">Ajouter</Button>
      </Modal>

      <Modal opened={maintOpened} onClose={closeMaint} title="Mettre en maintenance" size="sm"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <TextInput label="Véhicule" value={selectedVehicle?.type || ''} disabled mb="sm" tt="capitalize" />
        <DateInput label="Retour prévu le" value={maintenanceUntil} onChange={setMaintenanceUntil}
          minDate={new Date()} mb="md"
        />
        <Button color="red" fullWidth onClick={handleSetMaintenance} size="md">Confirmer la maintenance</Button>
      </Modal>

      <style>{`
        .vehicle-card {
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
          .vehicle-card, .dashboard-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default Vehicles;
