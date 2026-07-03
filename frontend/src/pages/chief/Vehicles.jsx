import { useEffect, useState } from 'react';
import { Paper, Title, Table, Badge, Loader, Center, Text, Group, Button, Modal, TextInput, Select, NumberInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTool } from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { vehicleService } from '../../api/vehicleService';
import { notifySuccess, notifyError } from '../../utils/toast';

const statusColor = { available: 'brand', busy: 'brand.3', maintenance: 'red', broken: 'red' };
const statusLabel = { available: 'Disponible', busy: 'En sortie', maintenance: 'Maintenance', broken: 'En panne' };

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
    } catch (err) {
      notifyError('Impossible de charger les véhicules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleCreate = async () => {
    if (!type || !capacity) {
      notifyError('Merci de remplir tous les champs');
      return;
    }
    try {
      await vehicleService.create({ type, capacity });
      notifySuccess('Véhicule ajouté');
      closeCreate();
      setType('');
      setCapacity(4);
      fetchVehicles();
    } catch (err) {
      notifyError('Erreur lors de l’ajout du véhicule');
    }
  };

  const openMaintenanceModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setMaintenanceUntil(null);
    openMaint();
  };

  const handleSetMaintenance = async () => {
    if (!maintenanceUntil) {
      notifyError('Choisissez une date de retour');
      return;
    }
    try {
      await vehicleService.update(selectedVehicle.id, {
        status: 'maintenance',
        maintenance_until: maintenanceUntil,
      });
      notifySuccess('Véhicule mis en maintenance');
      closeMaint();
      fetchVehicles();
    } catch (err) {
      notifyError('Erreur lors de la mise à jour');
    }
  };

  const handleMakeAvailable = async (id) => {
    try {
      await vehicleService.update(id, { status: 'available' });
      notifySuccess('Véhicule rendu disponible');
      fetchVehicles();
    } catch (err) {
      notifyError('Erreur lors de la mise à jour');
    }
  };

  if (loading) {
    return (
      <Center h={200}>
        <Loader color="brand" />
      </Center>
    );
  }

  return (
    <Paper p="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={4}>Véhicules</Title>
        <Button color="brand" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Ajouter un véhicule
        </Button>
      </Group>

      {vehicles.length === 0 ? (
        <Center h={120}>
          <Text c="dimmed" size="sm">Aucun véhicule enregistré</Text>
        </Center>
      ) : (
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
                <Table.Td style={{ textTransform: 'capitalize' }}>{v.type}</Table.Td>
                <Table.Td>{v.capacity} pers.</Table.Td>
                <Table.Td>
                  <Badge color={statusColor[v.status]} variant="light">
                    {statusLabel[v.status]}
                  </Badge>
                </Table.Td>
                <Table.Td>{v.maintenance_until ? new Date(v.maintenance_until).toLocaleDateString('fr-FR') : '—'}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {v.status !== 'maintenance' && v.status !== 'busy' && (
                      <Button size="xs" variant="outline" color="red" leftSection={<IconTool size={14} />} onClick={() => openMaintenanceModal(v)}>
                        Mettre en maintenance
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
      )}

      {/* Modal création */}
      <Modal opened={createOpened} onClose={closeCreate} title="Ajouter un véhicule">
        <Select
          label="Type"
          placeholder="Choisir un type"
          data={[
            { value: 'moto', label: 'Moto' },
            { value: 'voiture', label: 'Voiture' },
            { value: 'minibus', label: 'Minibus' },
          ]}
          value={type}
          onChange={setType}
          mb="sm"
          required
        />
        <NumberInput
          label="Capacité (nombre de personnes)"
          min={1}
          max={30}
          value={capacity}
          onChange={setCapacity}
          mb="md"
          required
        />
        <Button color="brand" fullWidth onClick={handleCreate}>
          Ajouter
        </Button>
      </Modal>

      {/* Modal maintenance */}
      <Modal opened={maintOpened} onClose={closeMaint} title="Mettre en maintenance">
        <TextInput label="Véhicule" value={selectedVehicle?.type || ''} disabled mb="sm" style={{ textTransform: 'capitalize' }} />
        <DateInput
          label="Retour prévu le"
          value={maintenanceUntil}
          onChange={setMaintenanceUntil}
          minDate={new Date()}
          mb="md"
        />
        <Button color="red" fullWidth onClick={handleSetMaintenance}>
          Confirmer la maintenance
        </Button>
      </Modal>
    </Paper>
  );
}

export default Vehicles;