import { useEffect, useState, useCallback } from 'react';
import {
  Paper, Badge, Center, Text, Group, Button, Modal,
  TextInput, Select, Stack, NumberInput, SimpleGrid, Flex, SegmentedControl, Pagination, ScrollArea, Menu, ActionIcon,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconPlus, IconPlayerPlay, IconFlag, IconUsers, IconRoute, IconSearch, IconX, IconEdit, IconTrash, IconDownload, IconNote, IconEye, IconDotsVertical } from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import SortieDetailModal from '../../components/SortieDetailModal';
import SortieCard, { vehicleOptionsFor, chauffeurOptions } from '../../components/SortieCard';
import dayjs from '../../utils/date';
import { sortieService } from '../../api/sortieService';
import { vehicleService } from '../../api/vehicleService';
import { employeeService } from '../../api/employeeService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import FloatingPanel from '../../components/FloatingPanel';
import { useNavigate } from 'react-router-dom';
import { sortieStatusLabel as statusLabel, sortieStatusColor as statusColor, vehicleDisplayName } from '../../utils/labels';
import { downloadCSV } from '../../utils/csv';

const statusFilterOptions = [
  { label: 'Toutes', value: 'all' },
  { label: 'Planifiées', value: 'planned' },
  { label: 'En cours', value: 'ongoing' },
  { label: 'Retour à valider', value: 'pending_return' },
  { label: 'Terminées', value: 'finished' },
];

// Export CSV + détection des départs dépassés : borne haute pour récupérer
// toutes les lignes correspondant aux filtres.
const CSV_EXPORT_LIMIT = 9999;

function Sorties() {
  const navigate = useNavigate();
  const [sorties, setSorties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const limit = 20;
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [editOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [editSortie, setEditSortie] = useState(null);
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverEmployeeId, setEditDriverEmployeeId] = useState('');
  const [chauffeurs, setChauffeurs] = useState([]);
  const [editDestination, setEditDestination] = useState('');
  const [editMotif, setEditMotif] = useState('');
  const [editDepartureTime, setEditDepartureTime] = useState(null);
  const [editRescheduleReason, setEditRescheduleReason] = useState('');

  const [departOpened, { open: openDepart, close: closeDepart }] = useDisclosure(false);
  const [selectedSortie, setSelectedSortie] = useState(null);
  const [departureKm, setDepartureKm] = useState(0);

  const [arriveeOpened, { open: openArrivee, close: closeArrivee }] = useDisclosure(false);
  const [arrivalKm, setArrivalKm] = useState(0);
  const [saving, setSaving] = useState(false);

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

  const [detailSortie, setDetailSortie] = useState(null);
  const [detailOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const openDetail = (s) => { setDetailSortie(s); openDetailModal(); };

  // Filtres communs à la pagination, à l'export CSV et aux départs dépassés.
  const buildFilterParams = (extra = {}) => {
    const params = { ...extra };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (vehicleFilter) params.vehicle_id = vehicleFilter;
    if (searchQuery) params.destination = searchQuery;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return params;
  };

  const fetchSorties = useCallback(async (p = page) => {
    try {
      const params = { page: p, limit, ...buildFilterParams() };
      const { data } = await sortieService.getAll(params);
      setSorties(data.data || []);
      setTotal(data.total || 0);
    } catch {
      notifyError('Impossible de charger les sorties');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vehicleFilter, searchQuery, dateFrom, dateTo, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const [overdue, setOverdue] = useState([]);
  const fetchOverdue = useCallback(async () => {
    try {
      const { data } = await sortieService.getAll({ status: 'planned', limit: CSV_EXPORT_LIMIT });
      const now = new Date();
      setOverdue((data.data || []).filter((s) => new Date(s.departure_time) < now));
    } catch {
      // Section non bloquante : on l'ignore silencieusement en cas d'échec
    }
  }, []);

  useEffect(() => { fetchOverdue(); }, [fetchOverdue]);

  const fetchVehicles = useCallback(async () => {
    const [vehRes, chRes] = await Promise.allSettled([
      vehicleService.getAll(),
      employeeService.listChauffeurs(),
    ]);
    if (vehRes.status === 'fulfilled') setVehicles(vehRes.value.data || []);
    if (chRes.status === 'fulfilled') setChauffeurs(chRes.value.data || []);
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

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
    setEditDriverEmployeeId(s.driver_employee_id ? String(s.driver_employee_id) : '');
    setEditDestination(s.destination);
    setEditMotif(s.motif || '');
    setEditDepartureTime(new Date(s.departure_time));
    setEditRescheduleReason('');
    openEditModal();
  };

  const handleEditSave = async () => {
    if (!editDestination || !editDepartureTime) {
      notifyError('Merci de remplir tous les champs'); return;
    }
    const departureChanged = editSortie && editDepartureTime &&
      new Date(editDepartureTime).getTime() !== new Date(editSortie.departure_time).getTime();
    if (departureChanged && !editRescheduleReason) {
      notifyError('Un motif de replanification est requis quand la date change');
      return;
    }
    const chauffeurAcc = chauffeurs.find((c) => String(c.id) === String(editDriverEmployeeId));
    const effectiveName = chauffeurAcc ? `${chauffeurAcc.prenom} ${chauffeurAcc.nom}`.trim() : editDriverName;
    setSaving(true);
    try {
      await sortieService.update(editSortie.id, {
        destination: editDestination,
        motif: editMotif,
        driver_name: effectiveName,
        departure_time: editDepartureTime,
        vehicle_id: editVehicleId ? parseInt(editVehicleId, 10) : undefined,
        driver_employee_id: chauffeurAcc ? chauffeurAcc.id : null,
        ...(departureChanged ? { reschedule_reason: editRescheduleReason } : {}),
      });
      notifySuccess('Sortie modifiée');
      closeEditModal();
      fetchSorties(page);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la modification');
    } finally { setSaving(false); }
  };

  const handleAssignDriver = async (sortie, driverId) => {
    const chauffeurAcc = chauffeurs.find((c) => String(c.id) === String(driverId));
    const driverName = chauffeurAcc ? `${chauffeurAcc.prenom} ${chauffeurAcc.nom}`.trim() : '';
    setActionLoading('assignDriver');
    try {
      await sortieService.update(sortie.id, {
        driver_employee_id: chauffeurAcc ? chauffeurAcc.id : null,
        driver_name: driverName,
      });
      notifySuccess(chauffeurAcc ? `Chauffeur affecté: ${driverName}` : 'Chauffeur retiré');
      fetchSorties(page);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de l\'affectation du chauffeur');
    } finally { setActionLoading(null); }
  };

  const handleChangeVehicle = async (sortie, vehicleId) => {
    setActionLoading('vehicle');
    try {
      await sortieService.update(sortie.id, { vehicle_id: parseInt(vehicleId, 10) });
      notifySuccess('Véhicule modifié');
      fetchSorties(page);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors du changement de véhicule');
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading('delete');
    try {
      await sortieService.remove(deleteTarget.id);
      notifySuccess('Sortie supprimée');
      setDeleteTarget(null);
      fetchSorties(page);
      fetchOverdue();
    } catch { notifyError('Erreur lors de la suppression'); }
    finally { setActionLoading(null); }
  };

  const openDepartModal = (s) => { setSelectedSortie(s); setDepartureKm(s.departure_km || ''); openDepart(); };
  const handleDepart = async () => {
    const km = Number(departureKm);
    if (!km || km <= 0) { notifyError('Saisissez un kilométrage valide supérieur à 0'); return; }
    setActionLoading('depart');
    try { await sortieService.depart(selectedSortie.id, km); notifySuccess('Départ enregistré'); closeDepart(); fetchSorties(page); fetchOverdue(); }
    catch { notifyError("Erreur lors de l'enregistrement du départ"); }
    finally { setActionLoading(null); }
  };

  const openArriveeModal = (s) => { setSelectedSortie(s); setArrivalKm(0); openArrivee(); };
  const handleArrivee = async () => {
    const km = Number(arrivalKm);
    if (!km || km <= 0) { notifyError('Saisissez un kilométrage valide'); return; }
    if (selectedSortie && km < Number(selectedSortie.departure_km)) { notifyError("Le km d'arrivée ne peut pas être inférieur au km de départ"); return; }
    setActionLoading('arrivee');
    try { await sortieService.arrivee(selectedSortie.id, km); notifySuccess('Arrivée enregistrée'); closeArrivee(); fetchSorties(page); }
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
      const params = buildFilterParams({ limit: CSV_EXPORT_LIMIT });
      const { data } = await sortieService.getAll(params);
      const allSorties = data.data || [];

      downloadCSV('sorties.csv',
        ['Destination', 'Conducteur', 'Véhicule', 'Départ prévu', 'Statut', 'Km départ', 'Km arrivée', 'Distance'],
        allSorties.map((s) =>
          [s.destination, s.driver_name, s.Vehicle ? vehicleDisplayName(s.Vehicle) : '', dayjs(s.departure_time).format('DD/MM/YYYY HH:mm'), statusLabel[s.status] || s.status, s.departure_km || '', s.arrival_km || '', s.distance_km || ''].join(';')
        )
      );
    } catch {
      notifyError("Erreur lors de l'export CSV");
    }
  };

  const allColumns = [
    { accessor: 'destination', title: 'Destination', sortable: true },
    {
      accessor: 'driver_name', title: 'Conducteur', sortable: true,
      render: (s) => (
        s.status === 'planned' && s.Vehicle?.type !== 'moto' ? (
          <Select
            size="xs"
            placeholder={s.driver_name ? s.driver_name : 'Affecter un chauffeur'}
            data={chauffeurOptions(chauffeurs)}
            value={s.driver_employee_id ? String(s.driver_employee_id) : null}
            onChange={(v) => handleAssignDriver(s, v)}
            clearable searchable radius="md" w={{ base: 130, sm: 170 }}
            disabled={actionLoading === 'assignDriver'}
            styles={{ input: s.driver_employee_id ? {} : { borderColor: 'var(--mantine-color-brand-6)' } }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Text size="sm">{s.driver_name || '—'}</Text>
        )
      ),
    },
    {
      accessor: 'vehicle', title: 'Véhicule',
      render: (s) => (
        s.status === 'planned' && s.Vehicle?.type !== 'moto' ? (
          <Select
            size="xs"
            placeholder="Changer de véhicule"
            data={vehicleOptionsFor(vehicles, s)}
            value={String(s.vehicle_id)}
            onChange={(v) => { if (v && String(v) !== String(s.vehicle_id)) handleChangeVehicle(s, v); }}
            searchable radius="md" w={{ base: 140, sm: 180 }}
            disabled={actionLoading === 'vehicle'}
            leftSection={<VehicleIcon type={s.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Group gap={4}>
            <VehicleIcon type={s.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm">{s.Vehicle ? vehicleDisplayName(s.Vehicle) : '—'}</Text>
            {s.Vehicle?.capacity != null && <Text size="xs" c="dimmed">({s.Vehicle.capacity} pers.)</Text>}
          </Group>
        )
      ),
    },
    {
      accessor: 'departure_time', title: 'Départ prévu', sortable: true,
      render: (s) => dayjs(s.departure_time).format('DD/MM/YYYY HH:mm'),
    },
    {
      accessor: 'status', title: 'Statut', sortable: true,
      render: (s) => <Badge color={s.displayStatus?.color || statusColor[s.status]} variant="light">{s.displayStatus?.label || statusLabel[s.status]}</Badge>,
    },
    {
      accessor: 'km', title: 'Km',
      render: (s) => {
        if (s.Vehicle?.type === 'moto') {
          const done = (s.Requests || []).filter((r) => r.SortieRequest?.status === 'finished');
          const anyDone = done.some((r) => r.SortieRequest?.departure_km != null && r.SortieRequest?.return_km != null);
          if (anyDone) {
            return <Text size="sm">{done.map((r) => `${r.SortieRequest.departure_km}→${r.SortieRequest.return_km}`).join(', ')}</Text>;
          }
          return s.status === 'ongoing' ? <Text size="xs" c="dimmed">individuels en cours</Text> : '—';
        }
        return s.status === 'finished'
          ? `${s.departure_km} → ${s.arrival_km} (${s.distance_km} km)`
          : s.departure_km ? `Départ: ${s.departure_km} km` : '—';
      },
    },
    {
      accessor: 'actions', title: '',
      render: (s) => (
        <Menu position="bottom-end" withinPortal trigger="hover" openDelay={120} closeDelay={120}
          shadow="md" width={210}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" radius="md" aria-label="Actions"
              onClick={(e) => e.stopPropagation()}>
              <IconDotsVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            {s.status === 'planned' && (
              <>
                <Menu.Item leftSection={<IconPlayerPlay size={16} />} onClick={() => openDepartModal(s)}>Démarrer</Menu.Item>
                <Menu.Item leftSection={<IconUsers size={16} />} onClick={() => openSuggestionsModal(s.id)}>Demandes</Menu.Item>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => openDetail(s)}>Détails</Menu.Item>
                <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => openEdit(s)}>Modifier</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleteTarget(s)}>Supprimer</Menu.Item>
              </>
            )}
            {s.status === 'ongoing' && (
              <>
                <Menu.Item leftSection={<IconFlag size={16} />} onClick={() => openArriveeModal(s)}>Saisir arrivée</Menu.Item>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => openDetail(s)}>Détails</Menu.Item>
              </>
            )}
            {s.status === 'pending_return' && (
              <>
                <Menu.Item leftSection={<IconFlag size={16} />} onClick={() => setValidateReturnTarget(s)}>Valider le retour</Menu.Item>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => openDetail(s)}>Détails</Menu.Item>
              </>
            )}
            {s.status === 'finished' && (
              <>
                <Menu.Item leftSection={<IconEye size={16} />} onClick={() => openDetail(s)}>Détails</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleteTarget(s)}>Supprimer</Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ];

  // Colonnes secondaires masquées sur mobile : le tableau reste lisible
  // sans forcer le scroll horizontal (contenu détaillé dans les cartes / détails).
  const hiddenOnMobile = ['km', 'departure_time'];
  const columns = isMobile ? allColumns.filter((c) => !hiddenOnMobile.includes(c.accessor)) : allColumns;

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Sorties" subtitle={`${total} sortie${total !== 1 ? 's' : ''}${hasFilters ? ' (filtrées)' : ''}`}>
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
      </PageHeader>

      <Paper p={{ base: 'xs', sm: 'md' }} radius="lg" withBorder mb="md" className="filters-panel">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <SegmentedControl value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            data={statusFilterOptions} size="xs" color="brand" w={{ base: '100%', sm: 'auto' }} fullWidth={isMobile} />
          <Select placeholder="Véhicule"
            data={vehicles.map((v) => ({ value: String(v.id), label: vehicleDisplayName(v) }))}
            value={vehicleFilter} onChange={(v) => { setVehicleFilter(v || ''); setPage(1); }}
            clearable size="xs" w={{ base: '100%', sm: 180 }} />
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

      {overdue.length > 0 && (
        <FloatingPanel title="Départs dépassés" badgeCount={overdue.length} color="green">
          <Stack gap={6}>
            {overdue.map((s) => (
              <Group key={s.id} justify="space-between" wrap="wrap" gap="sm">
                <Group gap="sm" wrap="wrap" style={{ flex: 1, minWidth: 200 }}>
                  <Text size="sm" fw={600}>{s.destination}</Text>
                  <Text size="xs" c="dimmed">{s.driver_name || 'Sans chauffeur'}</Text>
                  <VehicleIcon type={s.Vehicle?.type} size={14} color="var(--mantine-color-dimmed)" />
                  <Text size="xs" c="dimmed">{s.Vehicle ? vehicleDisplayName(s.Vehicle) : ''}</Text>
                  <Text size="xs" c="dimmed">prévu {dayjs(s.departure_time).format('DD/MM/YYYY HH:mm')}</Text>
                  <Text size="xs" c="dimmed">({s.Requests?.length || 0} passager{s.Requests?.length > 1 ? 's' : ''})</Text>
                </Group>
                <Group gap="xs">
                  <Button size="xs" variant="subtle" color="dark" leftSection={<IconEye size={14} />} onClick={() => openDetail(s)}>Détails</Button>
                  <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteTarget(s)}>Supprimer</Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </FloatingPanel>
      )}

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
                  <SortieCard key={s.id} sortie={s} chauffeurs={chauffeurs} vehicles={vehicles}
                    onAssignDriver={handleAssignDriver} onChangeVehicle={handleChangeVehicle}
                    onDetail={openDetail} onEdit={openEdit}
                    onDepart={openDepartModal} onSuggestions={openSuggestionsModal}
                    onDelete={() => setDeleteTarget(s)} onValidateReturn={() => setValidateReturnTarget(s)}
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
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="sm">
          <Select label="Véhicule" placeholder="Choisir un véhicule" w="100%"
            data={vehicles.map((v) => ({ value: String(v.id), label: `${vehicleDisplayName(v)} (${v.capacity} pers.)` }))}
            value={editVehicleId} onChange={setEditVehicleId} radius="md"
          />
          <Select label="Chauffeur (compte)" placeholder="Choisir un chauffeur" w="100%"
            data={chauffeurOptions(chauffeurs)}
            value={editDriverEmployeeId || null}
            onChange={(v) => {
              setEditDriverEmployeeId(v || '');
              const acc = chauffeurs.find((c) => String(c.id) === String(v));
              setEditDriverName(acc ? `${acc.prenom} ${acc.nom}`.trim() : '');
            }}
            clearable searchable radius="md"
          />
          <TextInput label="Destination" placeholder="Antananarivo" required w="100%" value={editDestination}
            onChange={(e) => setEditDestination(e.currentTarget.value)} radius="md"
          />
          <TextInput label="Motif" placeholder="Motif de la sortie" required w="100%" value={editMotif}
            onChange={(e) => setEditMotif(e.currentTarget.value)} radius="md"
            leftSection={<IconNote size={16} />}
          />
          <DateTimePicker label="Date et heure de départ" placeholder="Choisir une date" required w="100%"
            value={editDepartureTime} onChange={setEditDepartureTime} radius="md"
          />
          {editSortie && editDepartureTime &&
            new Date(editDepartureTime).getTime() !== new Date(editSortie.departure_time).getTime() && (
            <TextInput label="Motif de replanification" placeholder="Pourquoi déplacer cette sortie ?"
              description={`Date initiale prévue : ${dayjs(editSortie.departure_time).format('DD/MM/YYYY HH:mm')}`}
              required w="100%" value={editRescheduleReason}
              onChange={(e) => setEditRescheduleReason(e.currentTarget.value)} radius="md"
              leftSection={<IconNote size={16} />}
            />
          )}
        </SimpleGrid>
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeEditModal} radius="md">Annuler</Button>
            <Button color="brand" onClick={handleEditSave} loading={saving} radius="md">Enregistrer</Button>
          </Group>
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

      <Modal opened={suggestOpened} onClose={closeSuggest} title="Demandes compatibles" size="lg" radius="lg" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'pop', duration: 200 }}
        scrollAreaComponent={ScrollArea.Autosize}
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

      <SortieDetailModal opened={detailOpened} onClose={closeDetailModal} sortie={detailSortie} />

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
        @media (prefers-reduced-motion: reduce) {
          .sortie-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default Sorties;
