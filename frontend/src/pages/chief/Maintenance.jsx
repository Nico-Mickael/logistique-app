import { useEffect, useState } from 'react';
import {
  Paper, Title, Text, Group, Button, Badge, Loader, Center, SimpleGrid,
  Modal, Select, NumberInput, Textarea, Alert, Stack,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTool, IconAlertTriangle, IconGasStation, IconTrash, IconEdit, IconCar, IconDownload } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { maintenanceService } from '../../api/maintenanceService';
import { vehicleService } from '../../api/vehicleService';
import { sortieService } from '../../api/sortieService';
import { statsService } from '../../api/statsService';
import { exportService } from '../../api/exportService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';

const MAINT_TYPES = [
  { value: 'révision', label: 'Révision' },
  { value: 'vidange', label: 'Vidange' },
  { value: 'pneumatique', label: 'Pneumatique' },
  { value: 'freins', label: 'Freins' },
  { value: 'réparation', label: 'Réparation' },
  { value: 'contrôle', label: 'Contrôle technique' },
  { value: 'autre', label: 'Autre' },
];

export default function Maintenance() {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [due, setDue] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [form, setForm] = useState({
    vehicle_id: '', type: '', description: '', cost: null, date: null,
    next_due_km: null, next_due_date: null, status: 'done',
  });
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Saisie carburant (pleins sur les sorties terminées)
  const [fuelOpened, { open: openFuel, close: closeFuel }] = useDisclosure(false);
  const [fuelSorties, setFuelSorties] = useState([]);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuel, setFuel] = useState({ sortie_id: '', litres: null, cost: null });
  const [savingFuel, setSavingFuel] = useState(false);
  const [fleetCost, setFleetCost] = useState(0);

  const fetchFleet = () => {
    statsService.fleet()
      .then(({ data }) => setFleetCost(Number(data?.fuel?.totalCost || 0)))
      .catch(() => {});
  };

  const openFuelModal = async () => {
    setFuel({ sortie_id: '', litres: null, cost: null });
    setFuelLoading(true);
    openFuel();
    try {
      const { data } = await sortieService.getAll({ status: 'finished', limit: 200 });
      const rows = Array.isArray(data) ? data : data?.data || [];
      setFuelSorties(rows);
    } catch {
      notifyError('Impossible de charger les sorties');
    } finally {
      setFuelLoading(false);
    }
  };

  const handleRecordFuel = async () => {
    if (!fuel.sortie_id || fuel.litres == null || fuel.cost == null) {
      notifyError('Choisissez la sortie et renseignez litres et coût');
      return;
    }
    setSavingFuel(true);
    try {
      await maintenanceService.recordFuel(fuel.sortie_id, {
        fuel_litres: fuel.litres,
        fuel_cost: fuel.cost,
      });
      notifySuccess('Carburant enregistré');
      closeFuel();
      fetchFleet();
    } catch {
      notifyError("Erreur lors de l'enregistrement du carburant");
    } finally {
      setSavingFuel(false);
    }
  };

  useEffect(() => { fetchFleet(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rec, veh, dueRes] = await Promise.all([
        maintenanceService.list(),
        vehicleService.getAll(),
        maintenanceService.due().catch(() => []),
      ]);
      setRecords(rec.data || []);
      setVehicles(veh.data || []);
      setDue(dueRes.data || []);
    } catch {
      notifyError('Impossible de charger la maintenance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    if (!form.vehicle_id || !form.type || !form.date) {
      notifyError('Veuillez choisir le véhicule, le type et la date');
      return;
    }
    setSaving(true);
    try {
      await maintenanceService.create({
        ...form,
        vehicle_id: Number(form.vehicle_id),
        cost: form.cost ?? null,
        next_due_km: form.next_due_km ?? null,
        next_due_date: form.next_due_date ?? null,
      });
      notifySuccess('Maintenance enregistrée');
      closeCreate();
      setForm({ vehicle_id: '', type: '', description: '', cost: null, date: null, next_due_km: null, next_due_date: null, status: 'done' });
      fetchAll();
    } catch {
      notifyError("Erreur lors de l'enregistrement");
    } finally { setSaving(false); }
  };

  const openEdit = (m) => {
    setEditTarget(m);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await maintenanceService.update(editTarget.id, {
        status: 'done',
        ...(editTarget.next_due_km ? { next_due_km: editTarget.next_due_km } : {}),
      });
      notifySuccess('Maintenance marquée comme réalisée');
      setEditTarget(null);
      fetchAll();
    } catch { notifyError('Erreur'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await maintenanceService.remove(deleteTarget.id);
      notifySuccess('Maintenance supprimée');
      setDeleteTarget(null);
      fetchAll();
    } catch { notifyError('Erreur'); } finally { setDeleting(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Maintenance & carburant" subtitle="Planification, suivi et coûts de la flotte" />

      {due.length > 0 && (
        <Alert title="Maintenances à prévoir" color="red" radius="lg" mb="lg"
          icon={<IconAlertTriangle size={18} />}>
          {due.map((m) => (
            <Text key={m.id} size="sm" mb={2}>
              {m.vehicle?.type} — {m.type}
              {m.next_due_date ? ` · échéance ${dayjs(m.next_due_date).format('DD/MM/YYYY')}` : ''}
              {m.next_due_km ? ` · ${m.vehicle?.current_km ?? '—'} / ${m.next_due_km} km` : ''}
            </Text>
          ))}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg" spacing="md">
        <StatCard icon={IconTool} label="Interventions" value={records.length} color="brand" />
        <StatCard icon={IconCar} label="Véhicules" value={vehicles.length} color="brand" />
        <StatCard icon={IconAlertTriangle} label="À prévoir" value={due.length} color="red" />
        <StatCard icon={IconGasStation}
          label="Coût total carburant"
          value={`${fleetCost.toLocaleString('fr-FR')} Ar`}
          color="brandYellow" />
      </SimpleGrid>

      <Button color="brand" leftSection={<IconPlus size={16} />} onClick={openCreate} mb="md">
        Enregistrer une intervention
      </Button>
      <Button color="brandYellow" leftSection={<IconGasStation size={16} />} onClick={openFuelModal} mb="md" ml="sm">
        Saisir carburant
      </Button>
      <Button variant="subtle" color="gray" leftSection={<IconDownload size={16} />} mb="md" ml="sm"
        onClick={() => exportService.maintenanceReport('xlsx').catch(() => notifyError("Échec de l'export"))}>
        Exporter (.xlsx)
      </Button>

      <Paper p="lg" radius="lg" withBorder>
        <Title order={5} mb="sm">Historique des interventions</Title>
        <DataTable
          withTableBorder
          borderRadius="md"
          highlightOnHover
          verticalSpacing="sm"
          idAccessor="id"
          records={records}
          recordsPerPage={10}
          paginationSize="sm"
          paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
          emptyState={<Text c="dimmed" size="sm">Aucune intervention enregistrée</Text>}
          columns={[
            { accessor: 'date', title: 'Date', render: (m) => dayjs(m.date).format('DD/MM/YYYY') },
            { accessor: 'vehicle', title: 'Véhicule', render: (m) => <Badge variant="light" color="brand">{m.vehicle?.type}</Badge> },
            { accessor: 'type', title: 'Type', render: (m) => <Text tt="capitalize">{m.type}</Text> },
            { accessor: 'cost', title: 'Coût (Ar)', textAlign: 'right', render: (m) => m.cost ? Number(m.cost).toLocaleString('fr-FR') : '—' },
            { accessor: 'next_due_date', title: 'Prochaine échéance', render: (m) => m.next_due_date ? dayjs(m.next_due_date).format('DD/MM/YYYY') : (m.next_due_km ? `${m.next_due_km} km` : '—') },
            {
              accessor: 'actions', title: '',
              render: (m) => (
                <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                  {m.status !== 'done' && (
                    <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />}
                      onClick={() => openEdit(m)}>Réalisée</Button>
                  )}
                  <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />}
                    onClick={() => setDeleteTarget(m)}>Supprimer</Button>
                </Group>
              ),
            },
          ]}
        />
      </Paper>

      {/* Créer */}
      <Modal opened={createOpened} onClose={closeCreate} title="Enregistrer une intervention" size="lg" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }} transitionProps={{ transition: 'pop', duration: 200 }}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="sm">
          <Select label="Véhicule" required placeholder="Choisir"
            data={vehicles.map((v) => ({ value: String(v.id), label: `${v.type} (${v.capacity} pers.)` }))}
            value={form.vehicle_id} onChange={(v) => setForm((f) => ({ ...f, vehicle_id: v }))} />
          <Select label="Type d'intervention" required data={MAINT_TYPES} searchable
            value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v || '' }))} />
          <DateInput label="Date" required value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
          <NumberInput label="Coût (Ar)" min={0} value={form.cost} onChange={(v) => setForm((f) => ({ ...f, cost: v }))} thousandSeparator=" " />
          <DateInput label="Prochaine échéance (date)" value={form.next_due_date} onChange={(v) => setForm((f) => ({ ...f, next_due_date: v }))} />
          <NumberInput label="Ou échéance (km)" min={0} value={form.next_due_km} onChange={(v) => setForm((f) => ({ ...f, next_due_km: v }))} />
        </SimpleGrid>
        <Textarea label="Description" mt="md" minRows={2}
          value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))} />
        <Group justify="end" mt="md">
          <Button variant="default" onClick={closeCreate}>Annuler</Button>
          <Button color="brand" onClick={handleCreate} loading={saving}>Enregistrer</Button>
        </Group>
      </Modal>

      {/* Marquer réalisée */}
      <Modal opened={!!editTarget} onClose={() => setEditTarget(null)} title="Confirmer la réalisation" size="sm" radius="lg" centered>
        <Text size="sm" mb="md">Marquer l'intervention « <strong>{editTarget?.type}</strong> » sur « {editTarget?.vehicle?.type} » comme réalisée ?</Text>
        <Group justify="end">
          <Button variant="default" onClick={() => setEditTarget(null)}>Annuler</Button>
          <Button color="brand" onClick={handleUpdate} loading={saving}>Confirmer</Button>
        </Group>
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer cette intervention ?"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
      />

      {/* Saisie carburant */}
      <Modal opened={fuelOpened} onClose={closeFuel} title="Enregistrer un plein de carburant" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }} transitionProps={{ transition: 'pop', duration: 200 }}>
        <Stack mt="sm">
          {fuelLoading ? (
            <Center h={60}><Loader size="sm" /></Center>
          ) : (
            <Select
              label="Sortie terminée"
              required
              placeholder="Choisir une sortie"
              searchable
              data={fuelSorties
                .filter((s) => s.fuel_litres == null && s.fuel_cost == null)
                .map((s) => ({
                  value: String(s.id),
                  label: `${s.Vehicle?.type || 'Véhicule'} · ${s.destination || '—'} · ${dayjs(s.departure_time).format('DD/MM/YYYY')}`,
                }))}
              value={fuel.sortie_id}
              onChange={(v) => setFuel((f) => ({ ...f, sortie_id: v }))}
              nothingFoundMessage="Aucune sortie terminée sans carburant"
            />
          )}
          <NumberInput label="Litres" required min={0} value={fuel.litres} description="Ex : 40"
            onChange={(v) => setFuel((f) => ({ ...f, litres: v }))} />
          <NumberInput label="Coût (Ar)" required min={0} value={fuel.cost} thousandSeparator=" "
            onChange={(v) => setFuel((f) => ({ ...f, cost: v }))} />
          <Button color="brand" onClick={handleRecordFuel} loading={savingFuel} mt="sm">Enregistrer</Button>
        </Stack>
      </Modal>
    </div>
  );
}

