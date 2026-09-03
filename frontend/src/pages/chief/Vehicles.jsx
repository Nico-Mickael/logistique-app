import { useEffect, useState } from 'react';
import {
  Paper, Badge, Text, Group, Button, Modal,
  TextInput, Select, NumberInput, Card, SimpleGrid, Stack, SegmentedControl,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTool, IconCar, IconEdit, IconTrash } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import { DateInput } from '@mantine/dates';
import dayjs from '../../utils/date';
import { vehicleService } from '../../api/vehicleService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import { vehicleStatusLabel as statusLabel, vehicleStatusColor as statusColor, VEHICLE_TYPE_OPTIONS } from '../../utils/labels';

function VehicleCard({ vehicle, onMaintenance, onAvailable, onEdit, onDelete, availableLoading }) {
  return (
    <Card withBorder radius="lg" p="lg" className="vehicle-card">
      <div className="stat-card-accent" style={{
        background: vehicle.status === 'available' ? 'var(--mantine-color-brand-6)' :
                     vehicle.status === 'maintenance' ? 'var(--mantine-color-red-6)' :
                     'var(--mantine-color-brandYellow-6)'
      }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="sm">
          <VehicleIcon type={vehicle.type} size={22} color="var(--mantine-color-brand-6)" />
          <Text fw={600} size="md" tt="capitalize">{vehicle.type}</Text>
        </Group>
        <Badge color={statusColor[vehicle.status]} variant="light">
          {statusLabel[vehicle.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm">Capacité: <strong>{vehicle.capacity} pers.</strong></Text>
        {vehicle.maintenance_until && (
          <Text size="sm">Retour prévu: {dayjs(vehicle.maintenance_until).format('DD/MM/YYYY')}</Text>
        )}
        {vehicle.status === 'available' && (
          <Text size="sm">
            <strong>{vehicle.availableSeats ?? vehicle.capacity}</strong> place{(vehicle.availableSeats ?? vehicle.capacity) !== 1 ? 's' : ''} libre(s) / {vehicle.capacity}
          </Text>
        )}
      </Stack>
      <Group gap="xs">
        {vehicle.status !== 'busy' && (
          <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />}
            onClick={() => onEdit(vehicle)}>
            Modifier
          </Button>
        )}
        {vehicle.status !== 'busy' && (
          <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />}
            onClick={() => onDelete(vehicle)}>
            Supprimer
          </Button>
        )}
        {vehicle.status !== 'maintenance' && vehicle.status !== 'busy' && (
          <Button size="xs" variant="outline" color="red" leftSection={<IconTool size={14} />}
            onClick={() => onMaintenance(vehicle)}
          >
            Maintenance
          </Button>
        )}
        {vehicle.status === 'maintenance' && (
          <Button size="xs" color="brand" onClick={() => onAvailable(vehicle.id)} loading={availableLoading}>
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
  const [viewMode, setViewMode] = useState('table');

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [creating, setCreating] = useState(false);

  const [maintOpened, { open: openMaint, close: closeMaint }] = useDisclosure(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [maintenanceUntil, setMaintenanceUntil] = useState(null);
  const [maintaining, setMaintaining] = useState(false);
  const [availableId, setAvailableId] = useState(null);

  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editType, setEditType] = useState('');
  const [editCapacity, setEditCapacity] = useState(4);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVehicles = async () => {
    try {
      const { data } = await vehicleService.getOccupancy();
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
    setCreating(true);
    try {
      await vehicleService.create({ type, capacity });
      notifySuccess('Véhicule ajouté');
      closeCreate();
      setType('');
      setCapacity(4);
      fetchVehicles();
    } catch { notifyError("Erreur lors de l'ajout du véhicule"); }
    finally { setCreating(false); }
  };

  const openMaintenanceModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setMaintenanceUntil(null);
    openMaint();
  };

  const handleSetMaintenance = async () => {
    if (!maintenanceUntil) { notifyError('Choisissez une date de retour'); return; }
    setMaintaining(true);
    try {
      await vehicleService.update(selectedVehicle.id, { status: 'maintenance', maintenance_until: maintenanceUntil });
      notifySuccess('Véhicule mis en maintenance');
      closeMaint();
      fetchVehicles();
    } catch { notifyError('Erreur lors de la mise à jour'); }
    finally { setMaintaining(false); }
  };

  const handleMakeAvailable = async (id) => {
    setAvailableId(id);
    try {
      await vehicleService.update(id, { status: 'available', maintenance_until: null });
      notifySuccess('Véhicule rendu disponible');
      fetchVehicles();
    } catch { notifyError('Erreur lors de la mise à jour'); }
    finally { setAvailableId(null); }
  };

  const openEditModal = (v) => {
    setSelectedVehicle(v);
    setEditType(v.type);
    setEditCapacity(v.capacity);
    openEdit();
  };

  const handleEdit = async () => {
    if (!editType || !editCapacity) { notifyError('Merci de remplir tous les champs'); return; }
    setSaving(true);
    try {
      await vehicleService.update(selectedVehicle.id, { type: editType, capacity: editCapacity });
      notifySuccess('Véhicule modifié');
      closeEdit();
      fetchVehicles();
    } catch { notifyError('Erreur lors de la modification'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await vehicleService.remove(deleteTarget.id);
      notifySuccess('Véhicule supprimé');
      setDeleteTarget(null);
      fetchVehicles();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally { setDeleting(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Véhicules" subtitle={`${vehicles.length} véhicule${vehicles.length !== 1 ? 's' : ''} dans la flotte`}>
        <Group gap="xs">
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            data={[
              { label: 'Cartes', value: 'cards' },
              { label: 'Tableau', value: 'table' },
            ]}
            size="xs"
            color="brand"
          />
          <Button color="brand" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Ajouter un véhicule
          </Button>
        </Group>
      </PageHeader>

      {vehicles.length === 0 ? (
        <EmptyState icon={IconCar} message="Aucun véhicule enregistré" />
      ) : (
        <>
          {viewMode === 'table' ? (
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <DataTable
                withTableBorder
                borderRadius="md"
                highlightOnHover
                verticalSpacing="sm"
                columns={[
                  { accessor: 'type', title: 'Type', sortable: true, render: (v) => <Text tt="capitalize">{v.type}</Text> },
                  { accessor: 'capacity', title: 'Capacité', render: (v) => `${v.capacity} pers.` },
                  { accessor: 'occupied', title: 'Occupé', render: (v) => v.status === 'available' ? ((v.occupiedSeats ?? 0) + ' / ' + v.capacity) : '—' },
                  { accessor: 'status', title: 'Statut', render: (v) => <Badge color={statusColor[v.status]} variant="light">{statusLabel[v.status]}</Badge> },
                  { accessor: 'maintenance_until', title: 'Maintenance jusqu\'au', render: (v) => v.maintenance_until ? dayjs(v.maintenance_until).format('DD/MM/YYYY') : '—' },
                  {
                    accessor: 'actions', title: '',
                    render: (v) => (
                      <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                        {v.status !== 'busy' && (
                          <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />}
                            onClick={() => openEditModal(v)}>Modifier</Button>
                        )}
                        {v.status !== 'busy' && (
                          <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />}
                            onClick={() => setDeleteTarget(v)}>Supprimer</Button>
                        )}
                        {v.status !== 'maintenance' && v.status !== 'busy' && (
                          <Button size="xs" variant="outline" color="red" leftSection={<IconTool size={14} />}
                            onClick={() => openMaintenanceModal(v)}>Maintenance</Button>
                        )}
                        {v.status === 'maintenance' && (
                          <Button size="xs" color="brand" onClick={() => handleMakeAvailable(v.id)} loading={availableId === v.id}>
                            Rendre disponible
                          </Button>
                        )}
                      </Group>
                    ),
                  },
                ]}
                records={vehicles}
                idAccessor="id"
                recordsPerPage={10}
                paginationSize="sm"
                paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
              />
            </Paper>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v}
                  onMaintenance={openMaintenanceModal} onAvailable={handleMakeAvailable}
                  onEdit={openEditModal} onDelete={setDeleteTarget}
                  availableLoading={availableId === v.id}
                />
              ))}
            </SimpleGrid>
          )}
        </>
      )}

      <Modal opened={createOpened} onClose={closeCreate} title="Ajouter un véhicule" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="sm">
          <Select label="Type" placeholder="Choisir un type"
            data={VEHICLE_TYPE_OPTIONS}
            value={type} onChange={setType} required radius="md" w="100%"
          />
          <NumberInput label="Capacité (personnes)" min={1} max={30} value={capacity}
            onChange={setCapacity} required radius="md" w="100%"
          />
        </SimpleGrid>
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeCreate} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleCreate} loading={creating} radius="md">Créer</Button>
          </Group>
      </Modal>

      <Modal opened={maintOpened} onClose={closeMaint} title="Mettre en maintenance" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <TextInput label="Véhicule" value={selectedVehicle?.type || ''} disabled tt="capitalize" radius="md" />
          <DateInput label="Retour prévu le" value={maintenanceUntil} onChange={setMaintenanceUntil}
            minDate={new Date()} radius="md"
          />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeMaint} radius="md">Annuler</Button>
            <Button color="red" onClick={handleSetMaintenance} loading={maintaining} radius="md">Confirmer</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={editOpened} onClose={closeEdit} title="Modifier le véhicule" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="sm">
          <Select label="Type" placeholder="Choisir un type"
            data={VEHICLE_TYPE_OPTIONS}
            value={editType} onChange={setEditType} required radius="md" w="100%"
          />
          <NumberInput label="Capacité (personnes)" min={1} max={30} value={editCapacity}
            onChange={setEditCapacity} required radius="md" w="100%"
          />
        </SimpleGrid>
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeEdit} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleEdit} loading={saving} radius="md">Enregistrer</Button>
          </Group>
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Supprimer ${deleteTarget?.type || ''} (${deleteTarget?.capacity} pers.) ?`}
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
      />

      <style>{`
        .vehicle-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .vehicle-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default Vehicles;
