import { useEffect, useState, useCallback } from 'react';
import {
  Paper, Title, Badge, Loader, Center, Text, Group, Button, Modal,
  TextInput, Select, Stack, NumberInput, Card, SimpleGrid, Flex, SegmentedControl, Pagination,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconPlayerPlay, IconFlag, IconUsers, IconRoute, IconSearch, IconX, IconEdit, IconTrash, IconDownload } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import dayjs from '../../utils/date';
import { sortieService } from '../../api/sortieService';
import { vehicleService } from '../../api/vehicleService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor } from '../../utils/labels';
import { downloadCSV } from '../../utils/csv';

const statusFilterOptions = [
  { label: 'Toutes', value: 'all' },
  { label: 'Planifiées', value: 'planned' },
  { label: 'En cours', value: 'ongoing' },
  { label: 'Retour à valider', value: 'pending_return' },
  { label: 'Terminées', value: 'finished' },
];

function SortieCard({ sortie, onDepart, onSuggestions, onEdit, onDelete, onValidateReturn, onArrivee, actionLoading }) {
  return (
    <Card withBorder radius="lg" p="lg" className="sortie-card">
      <div className="stat-card-accent" style={{
        background: sortie.status === 'planned' ? 'var(--mantine-color-gray-5)' :
                     sortie.status === 'ongoing' ? 'var(--mantine-color-brand-6)' :
                     sortie.status === 'pending_return' ? 'var(--mantine-color-orange-6)' :
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
        <Text size="sm">
          <Text span c="dimmed" size="sm">Véhicule: </Text>
          <VehicleIcon type={sortie.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" style={{ verticalAlign: 'middle', marginRight: 4 }} />
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
        {sortie.return_km && (
          <Text size="sm"><Text span c="dimmed" size="sm">Km retour: </Text>{sortie.return_km}</Text>
        )}
        {sortie.returned_at && (
          <Text size="sm"><Text span c="dimmed" size="sm">Retour le: </Text>{dayjs(sortie.returned_at).format('DD/MM/YYYY HH:mm')}</Text>
        )}
        {sortie.arrival_km && (
          <Text size="sm"><Text span c="dimmed" size="sm">Km arrivée: </Text>{sortie.arrival_km}</Text>
        )}
      </Stack>
      <Group gap="xs">
        {sortie.status === 'planned' && (
          <>
            <Button size="xs" color="brand" leftSection={<IconPlayerPlay size={14} />} onClick={() => onDepart(sortie)} loading={actionLoading === 'depart'}>
              Démarrer
            </Button>
            <Button size="xs" variant="outline" color="brand" leftSection={<IconUsers size={14} />} onClick={() => onSuggestions(sortie.id)}>
              Demandes
            </Button>
            <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />} onClick={() => onEdit(sortie)}>
              Modifier
            </Button>
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
              Supprimer
            </Button>
          </>
        )}
        {sortie.status === 'ongoing' && (
          <Group gap="xs">
            <Button size="xs" color="brand" leftSection={<IconFlag size={14} />} onClick={() => onArrivee(sortie)} loading={actionLoading === 'arrivee'}>
              Saisir arrivée
            </Button>
            <Text size="xs" c="dimmed">En attente du retour de l'employé</Text>
          </Group>
        )}
        {sortie.status === 'pending_return' && (
          <Button size="xs" color="orange" leftSection={<IconFlag size={14} />} onClick={onValidateReturn} loading={actionLoading === 'validateReturn'}>
            Valider le retour
          </Button>
        )}
        {sortie.status === 'finished' && (
          <>
            <Text size="xs" c="dimmed">Terminée le {dayjs(sortie.updatedAt).format('DD/MM/YYYY')}</Text>
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
              Supprimer
            </Button>
          </>
        )}
      </Group>
    </Card>
  );
}

function Sorties() {
  const navigate = useNavigate();
  const [sorties, setSorties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const limit = 20;

  const [editOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [editSortie, setEditSortie] = useState(null);
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editDepartureTime, setEditDepartureTime] = useState(null);

  const [departOpened, { open: openDepart, close: closeDepart }] = useDisclosure(false);
  const [selectedSortie, setSelectedSortie] = useState(null);
  const [departureKm, setDepartureKm] = useState(0);

  const [arriveeOpened, { open: openArrivee, close: closeArrivee }] = useDisclosure(false);
  const [arrivalKm, setArrivalKm] = useState(0);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpened, { open: openSuggest, close: closeSuggest }] = useDisclosure(false);
  const [adding, setAdding] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  const [actionLoading, setActionLoading] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [validateReturnTarget, setValidateReturnTarget] = useState(null);

  const fetchSorties = useCallback(async (p = page) => {
    try {
      const params = { page: p, limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (vehicleFilter) params.vehicle_id = vehicleFilter;
      if (searchQuery) params.destination = searchQuery;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data } = await sortieService.getAll(params);
      setSorties(data.data || []);
      setTotal(data.total || 0);
    } catch {
      notifyError('Impossible de charger les sorties');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vehicleFilter, searchQuery, dateFrom, dateTo, page]);

  const fetchVehicles = async () => {
    try { const { data } = await vehicleService.getAll(); setVehicles(data || []); } catch { /* ignore */ }
  };

  useEffect(() => { fetchVehicles(); }, []);

  useEffect(() => {
    const t = setTimeout(() => { fetchSorties(); }, 250);
    return () => clearTimeout(t);
  }, [fetchSorties]);

  const clearFilters = () => {
    setStatusFilter('all'); setVehicleFilter(''); setSearchQuery(''); setDateFrom(null); setDateTo(null);
    setPage(1);
  };
  const hasFilters = statusFilter !== 'all' || vehicleFilter || searchQuery || dateFrom || dateTo;

  const openEdit = (s) => {
    setEditSortie(s);
    setEditVehicleId(String(s.vehicle_id));
    setEditDriverName(s.driver_name);
    setEditDestination(s.destination);
    setEditDepartureTime(new Date(s.departure_time));
    openEditModal();
  };

  const handleEditSave = async () => {
    if (!editDestination || !editDriverName || !editDepartureTime) {
      notifyError('Merci de remplir tous les champs'); return;
    }
    try {
      await sortieService.update(editSortie.id, {
        destination: editDestination,
        driver_name: editDriverName,
        departure_time: editDepartureTime,
        vehicle_id: editVehicleId ? parseInt(editVehicleId, 10) : undefined,
      });
      notifySuccess('Sortie modifiée');
      closeEditModal();
      fetchSorties(page);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading('delete');
    try {
      await sortieService.remove(deleteTarget.id);
      notifySuccess('Sortie supprimée');
      setDeleteTarget(null);
      fetchSorties(page);
    } catch { notifyError('Erreur lors de la suppression'); }
    finally { setActionLoading(null); }
  };

  const openDepartModal = (s) => { setSelectedSortie(s); setDepartureKm(s.departure_km || ''); openDepart(); };
  const handleDepart = async () => {
    if (!departureKm || departureKm <= 0) { notifyError('Saisissez un kilométrage valide supérieur à 0'); return; }
    setActionLoading('depart');
    try { await sortieService.depart(selectedSortie.id, departureKm); notifySuccess('Départ enregistré'); closeDepart(); fetchSorties(page); }
    catch { notifyError("Erreur lors de l'enregistrement du départ"); }
    finally { setActionLoading(null); }
  };

  const openArriveeModal = (s) => { setSelectedSortie(s); setArrivalKm(0); openArrivee(); };
  const handleArrivee = async () => {
    if (!arrivalKm || arrivalKm <= 0) { notifyError('Saisissez un kilométrage valide'); return; }
    if (selectedSortie && arrivalKm < selectedSortie.departure_km) { notifyError("Le km d'arrivée ne peut pas être inférieur au km de départ"); return; }
    setActionLoading('arrivee');
    try { await sortieService.arrivee(selectedSortie.id, arrivalKm); notifySuccess('Arrivée enregistrée'); closeArrivee(); fetchSorties(page); }
    catch { notifyError("Erreur lors de l'enregistrement de l'arrivée"); }
    finally { setActionLoading(null); }
  };

  const handleValidateReturn = async () => {
    if (!validateReturnTarget) return;
    setActionLoading('validateReturn');
    try {
      await sortieService.validateReturn(validateReturnTarget.id);
      notifySuccess('Retour validé - Sortie terminée');
      setValidateReturnTarget(null);
      fetchSorties(page);
    } catch { notifyError("Erreur lors de la validation du retour"); }
    finally { setActionLoading(null); }
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

  const exportCSV = async () => {
    try {
      const params = { limit: 9999 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (vehicleFilter) params.vehicle_id = vehicleFilter;
      if (searchQuery) params.destination = searchQuery;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data } = await sortieService.getAll(params);
      const allSorties = data.data || [];

      downloadCSV('sorties.csv',
        ['Destination', 'Conducteur', 'Véhicule', 'Départ prévu', 'Statut', 'Km départ', 'Km arrivée', 'Distance'],
        allSorties.map((s) =>
          [s.destination, s.driver_name, s.Vehicle?.type || '', dayjs(s.departure_time).format('DD/MM/YYYY HH:mm'), statusLabel[s.status] || s.status, s.departure_km || '', s.arrival_km || '', s.distance_km || ''].join(';')
        )
      );
    } catch {
      notifyError("Erreur lors de l'export CSV");
    }
  };

  const columns = [
    { accessor: 'destination', title: 'Destination', sortable: true },
    { accessor: 'driver_name', title: 'Conducteur', sortable: true },
    {
      accessor: 'vehicle', title: 'Véhicule',
      render: (s) => (
        <Group gap={4}>
          <VehicleIcon type={s.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />
          <Text tt="capitalize" size="sm">{s.Vehicle?.type}</Text>
        </Group>
      ),
    },
    {
      accessor: 'departure_time', title: 'Départ prévu', sortable: true,
      render: (s) => dayjs(s.departure_time).format('DD/MM/YYYY HH:mm'),
    },
    {
      accessor: 'status', title: 'Statut', sortable: true,
      render: (s) => <Badge color={statusColor[s.status]} variant="light">{statusLabel[s.status]}</Badge>,
    },
    {
      accessor: 'km', title: 'Km',
      render: (s) => s.status === 'finished'
        ? `${s.departure_km} → ${s.arrival_km} (${s.distance_km} km)`
        : s.departure_km ? `Départ: ${s.departure_km} km` : '—',
    },
    {
      accessor: 'returned_at', title: 'Retour',
      render: (s) => s.returned_at ? dayjs(s.returned_at).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      accessor: 'actions', title: '',
      render: (s) => (
        <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          {s.status === 'planned' && (
            <>
              <Button size="xs" color="brand" leftSection={<IconPlayerPlay size={14} />} onClick={() => openDepartModal(s)} loading={actionLoading === 'depart'}>Démarrer</Button>
              <Button size="xs" variant="outline" color="brand" leftSection={<IconUsers size={14} />} onClick={() => openSuggestionsModal(s.id)}>Demandes</Button>
              <Button size="xs" variant="subtle" color="brand" leftSection={<IconEdit size={14} />} onClick={() => openEdit(s)}>Modifier</Button>
              <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteTarget(s)}>Supprimer</Button>
            </>
          )}
          {s.status === 'ongoing' && (
            <Button size="xs" color="brand" leftSection={<IconFlag size={14} />} onClick={() => openArriveeModal(s)} loading={actionLoading === 'arrivee'}>Saisir arrivée</Button>
          )}
          {s.status === 'pending_return' && (
            <Button size="xs" color="orange" leftSection={<IconFlag size={14} />} onClick={() => setValidateReturnTarget(s)} loading={actionLoading === 'validateReturn'}>Valider le retour</Button>
          )}
          {s.status === 'finished' && (
            <Group gap="xs" wrap="nowrap">
              <Text size="xs" c="dimmed">Terminée</Text>
              <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteTarget(s)}>Supprimer</Button>
            </Group>
          )}
        </Group>
      ),
    },
  ];

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Sorties</Title>
          <Text size="sm" c="dimmed" mt={2}>
            {total} sortie{total !== 1 ? 's' : ''}
            {hasFilters ? ' (filtrées)' : ''}
          </Text>
        </div>
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
          <Button variant="subtle" color="gray" leftSection={<IconDownload size={16} />} onClick={exportCSV} size="sm">
            Export CSV
          </Button>
          <Button color="brand" leftSection={<IconPlus size={16} />} onClick={() => navigate('/creer-sortie')} className="btn-action">
            Nouvelle sortie
          </Button>
        </Group>
      </Flex>

      <Paper p="md" radius="lg" withBorder mb="md" className="filters-panel">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <SegmentedControl value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            data={statusFilterOptions} size="xs" color="brand" />
          <Select placeholder="Véhicule"
            data={vehicles.map((v) => ({ value: String(v.id), label: v.type }))}
            value={vehicleFilter} onChange={(v) => { setVehicleFilter(v || ''); setPage(1); }}
            clearable size="xs" w={140} />
          <TextInput placeholder="Rechercher une destination..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery} onChange={(e) => { setSearchQuery(e.currentTarget.value); setPage(1); }}
            size="xs" w={{ base: '100%', sm: 200 }} />
          <DateTimePicker placeholder="Du" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} size="xs" w={{ base: '100%', sm: 140 }} clearable />
          <DateTimePicker placeholder="Au" value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} size="xs" w={{ base: '100%', sm: 140 }} clearable />
          {hasFilters && (
            <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />} onClick={clearFilters}>
              Effacer
            </Button>
          )}
        </Group>
      </Paper>

      {sorties.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconRoute size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucune sortie trouvée</Text>
            </Flex>
          </Center>
        </Paper>
      ) : (
        <>
          {viewMode === 'table' ? (
            <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
              <DataTable
                withTableBorder
                borderRadius="md"
                highlightOnHover
                verticalSpacing="sm"
                columns={columns}
                records={sorties}
                idAccessor="id"
                page={page}
                onPageChange={setPage}
                totalRecords={total}
                recordsPerPage={limit}
                paginationSize="sm"
                paginationActiveBackgroundColor="var(--mantine-color-brand-6)"
              />
            </Paper>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {sorties.map((s) => (
                  <SortieCard key={s.id} sortie={s}
                    onDepart={openDepartModal} onSuggestions={openSuggestionsModal}
                    onEdit={openEdit} onDelete={() => setDeleteTarget(s)} onValidateReturn={() => setValidateReturnTarget(s)}
                    onArrivee={openArriveeModal} actionLoading={actionLoading}
                  />
                ))}
              </SimpleGrid>
              <Center mt="md">
                <Pagination total={Math.ceil(total / limit)} value={page} onChange={setPage} color="brand" />
              </Center>
            </>
          )}
        </>
      )}

      <Modal opened={editOpened} onClose={closeEditModal} title="Modifier la sortie" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <Select label="Véhicule" placeholder="Choisir un véhicule"
            data={vehicles.map((v) => ({ value: String(v.id), label: `${v.type} (${v.capacity} pers.)` }))}
            value={editVehicleId} onChange={setEditVehicleId} radius="md"
          />
          <TextInput label="Conducteur" placeholder="Nom du conducteur" required value={editDriverName}
            onChange={(e) => setEditDriverName(e.currentTarget.value)} radius="md"
          />
          <TextInput label="Destination" placeholder="Antananarivo" required value={editDestination}
            onChange={(e) => setEditDestination(e.currentTarget.value)} radius="md"
          />
          <DateTimePicker label="Date et heure de départ" placeholder="Choisir une date" required
            value={editDepartureTime} onChange={setEditDepartureTime} radius="md"
          />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeEditModal} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleEditSave} radius="md">Enregistrer</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={departOpened} onClose={closeDepart} title="Démarrer la sortie" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <TextInput label="Destination" value={selectedSortie?.destination || ''} disabled radius="md" />
          <NumberInput label="Kilométrage au départ" placeholder="Ex: 12500" min={0}
            value={departureKm} onChange={setDepartureKm} required radius="md"
          />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeDepart} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleDepart} radius="md">Confirmer le départ</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={arriveeOpened} onClose={closeArrivee} title="Enregistrer l'arrivée" size="md" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        <Stack gap="md" mt="sm">
          <TextInput label="Destination" value={selectedSortie?.destination || ''} disabled radius="md" />
          <NumberInput label="Kilométrage à l'arrivée" placeholder="Ex: 13000" min={0}
            value={arrivalKm} onChange={setArrivalKm} required radius="md"
          />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeArrivee} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleArrivee} radius="md">Confirmer l'arrivée</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={suggestOpened} onClose={closeSuggest} title="Demandes compatibles" size="lg"
        fullScreen={{ base: true, sm: false }}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        {suggestions.length === 0 ? (
          <Center h={80}><Text c="dimmed" size="sm">Aucune demande compatible disponible</Text></Center>
        ) : (
          <DataTable
            withTableBorder
            borderRadius="md"
            highlightOnHover
            verticalSpacing="sm"
            columns={[
              {
                accessor: 'employee', title: 'Employé',
                render: (req) => `${req.Employee?.prenom || ''} ${req.Employee?.nom || ''}`,
              },
              { accessor: 'destination', title: 'Destination' },
              {
                accessor: 'date_souhaitee', title: 'Date',
                render: (req) => dayjs(req.date_souhaitee).format('DD/MM/YYYY HH:mm'),
              },
              { accessor: 'nb_personnes', title: 'Personnes', textAlign: 'center' },
              {
                accessor: 'actions', title: '',
                render: (req) => (
                  <Button size="xs" color="brand" loading={adding} onClick={() => handleAddRequest(req.id)}>
                    Ajouter
                  </Button>
                ),
              },
            ]}
            records={suggestions}
            idAccessor="id"
          />
        )}
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer cette sortie ?"
        message="La sortie sera définitivement supprimée et le véhicule libéré."
        confirmLabel="Supprimer"
        variant="danger"
        loading={actionLoading === 'delete'}
      />

      <ConfirmModal
        opened={!!validateReturnTarget}
        onClose={() => setValidateReturnTarget(null)}
        onConfirm={handleValidateReturn}
        title="Valider le retour ?"
        message={`La sortie vers ${validateReturnTarget?.destination || ''} sera clôturée. Km retour: ${validateReturnTarget?.return_km || ''} km`}
        confirmLabel="Oui, valider"
        variant="question"
        loading={actionLoading === 'validateReturn'}
      />

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
        .filters-panel {
          animation: panel-in 0.3s ease-out;
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
