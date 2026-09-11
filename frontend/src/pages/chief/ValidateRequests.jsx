import { useEffect, useState, useCallback } from 'react';
import {
  Paper, Badge, Center, Text, Group, Button, Modal,
  TextInput, Stack, Flex, Card, SimpleGrid, Pagination, SegmentedControl, Select,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconCheck, IconX, IconCalendar, IconInbox, IconSearch, IconDownload, IconEye, IconTrash, IconCar } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { requestService } from '../../api/requestService';
import { vehicleService } from '../../api/vehicleService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import { requestStatusLabel as statusLabel, requestStatusColor as statusColor, accentColor, vehicleDisplayName } from '../../utils/labels';
import { downloadCSV } from '../../utils/csv';
import MotifCell from '../../components/MotifCell';
import RequestDetailModal from '../../components/RequestDetailModal';
import FloatingPanel from '../../components/FloatingPanel';

// Filtres disponibles, construits depuis la source unique des libellés.
const STATUS_FILTER_ORDER = ['pending', 'approved', 'rescheduled', 'rejected'];
const statusFilterOptions = [
  { value: 'all', label: 'Tous' },
  ...STATUS_FILTER_ORDER.map((value) => ({ value, label: statusLabel[value] })),
];

// Export CSV : borne haute pour récupérer toutes les lignes correspondant aux filtres.
const CSV_EXPORT_LIMIT = 9999;

function ValidateRequestCard({ r, onApprove, onReject, onReschedule, onDetail, onDelete, approving }) {
  return (
    <Card withBorder radius="lg" p="lg" className="validate-request-card">
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accentColor(statusColor[r.status]),
      }} />
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Text fw={600} size="md" style={{ minWidth: 0, wordBreak: 'break-word' }}>{r.Employee?.prenom} {r.Employee?.nom}</Text>
        <Badge color={statusColor[r.status]} variant="light">{statusLabel[r.status]}</Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm"><Text span c="dimmed">Destination: </Text>{r.destination}</Text>
        <Text size="sm"><Text span c="dimmed">Date: </Text>{dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Text>
        <Text size="sm"><Text span c="dimmed">Personnes: </Text>{r.nb_personnes}</Text>
      </Stack>
      <Group gap="xs" wrap="wrap">
        <Button size="xs" variant="subtle" color="brand" leftSection={<IconEye size={14} />} onClick={() => onDetail(r)}>Détail</Button>
        {r.status === 'pending' && (
          <>
            <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => onApprove(r.id)} loading={approving === r.id}>Valider</Button>
            <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />} onClick={() => onReschedule(r)}>Replanifier</Button>
            <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />} onClick={() => onReject(r)}>Refuser</Button>
          </>
        )}
        <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => onDelete(r)}>Supprimer</Button>
      </Group>
    </Card>
  );
}

function ValidateRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newDate, setNewDate] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState('table');
  const limit = 20;
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Demandes VALIDÉES sans sortie : véhicule demandé occupé, à réaffecter.
  const [toProcess, setToProcess] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchToProcess = useCallback(async () => {
    try {
      const { data } = await requestService.toProcess();
      setToProcess(data || []);
    } catch {
      // Non bloquant pour la page principale.
    }
  }, []);

  useEffect(() => {
    vehicleService.getOccupancy().then(({ data }) => setVehicles(data || [])).catch(() => {});
    fetchToProcess();
  }, [fetchToProcess]);

  const assignableVehicles = vehicles.filter((v) => v.requestable !== false);
  const assignVehicleOptions = assignableVehicles.map((v) => ({
    value: String(v.id),
    label: `${vehicleDisplayName(v)} (${v.availableSeats} pl. disp.)`,
  }));

  // Filtres communs à la pagination et à l'export CSV.
  const buildFilterParams = (extra = {}) => {
    const params = { ...extra };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (destinationFilter) params.destination = destinationFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return params;
  };

  const fetchRequests = useCallback(async (p = page) => {
    try {
      const params = { page: p, limit, ...buildFilterParams() };
      const { data } = await requestService.all(params);
      setRequests(data.data || []);
      setTotal(data.total || 0);
    } catch {
      notifyError('Impossible de charger les demandes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, destinationFilter, dateFrom, dateTo, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const t = setTimeout(() => { fetchRequests(); }, 250);
    return () => clearTimeout(t);
  }, [fetchRequests]);

  const clearFilters = () => {
    setStatusFilter('all'); setDestinationFilter(''); setDateFrom(null); setDateTo(null);
    setPage(1);
  };
  const hasFilters = statusFilter !== 'all' || destinationFilter || dateFrom || dateTo;

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      await requestService.updateStatus(id, 'approved');
      notifySuccess('Demande validée');
      fetchRequests(page);
      fetchToProcess();
    } catch { notifyError('Erreur lors de la validation'); }
    finally { setApprovingId(null); }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await requestService.updateStatus(rejectTarget.id, 'rejected');
      notifySuccess('Demande refusée');
      setRejectTarget(null);
      fetchRequests(page);
      fetchToProcess();
    } catch { notifyError('Erreur lors du refus'); }
    finally { setRejecting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await requestService.remove(deleteTarget.id);
      notifySuccess('Demande supprimée');
      setDeleteTarget(null);
      fetchRequests(page);
      fetchToProcess();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally { setDeleting(false); }
  };

  const openRescheduleModal = (request) => {
    setSelectedRequest(request);
    setNewDate(null);
    setRescheduleReason('');
    open();
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignVehicleId) { notifyError('Choisissez un véhicule'); return; }
    setAssigning(true);
    try {
      const { data } = await requestService.assignVehicle(assignTarget.id, Number(assignVehicleId));
      notifySuccess(data?.sortie ? 'Sortie créée : la demande est affectée' : 'Véhicule affecté à la demande');
      setAssignTarget(null);
      setAssignVehicleId('');
      fetchRequests(page);
      fetchToProcess();
    } catch (err) {
      notifyError(err.response?.data?.message || "Impossible d'affecter ce véhicule");
    } finally { setAssigning(false); }
  };

  const handleReschedule = async () => {
    if (!newDate) { notifyError('Choisissez une nouvelle date'); return; }
    if (!rescheduleReason.trim()) { notifyError('Un motif de replanification est requis'); return; }
    setRescheduling(true);
    try {
      await requestService.updateStatus(selectedRequest.id, 'rescheduled', newDate, rescheduleReason.trim());
      notifySuccess('Proposition de replanification envoyée');
      close();
      fetchRequests(page);
      fetchToProcess();
    } catch { notifyError('Erreur lors de la replanification'); }
    finally { setRescheduling(false); }
  };

  const exportCSV = async () => {
    try {
      const params = buildFilterParams({ limit: CSV_EXPORT_LIMIT });
      const { data } = await requestService.all(params);
      const allRequests = data.data || [];

      downloadCSV('demandes.csv',
        ['Employé', 'Département', 'Destination', 'Motif', 'Date souhaitée', 'Personnes', 'Statut'],
        allRequests.map((r) =>
          [`${r.Employee?.prenom} ${r.Employee?.nom}`, r.Employee?.department || '', r.destination, r.motif, dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm'), r.nb_personnes, statusLabel[r.status] || r.status].join(';')
        )
      );
    } catch {
      notifyError("Erreur lors de l'export CSV");
    }
  };

  const [detailRequest, setDetailRequest] = useState(null);
  const [detailOpened, setDetailOpened] = useState(false);
  const openDetail = (r) => { setDetailRequest(r); setDetailOpened(true); };

  const columns = [
    {
      accessor: 'employee', title: 'Employé',
      render: (r) => `${r.Employee?.prenom || ''} ${r.Employee?.nom || ''}`,
    },
    { accessor: 'destination', title: 'Destination', sortable: true },
    { accessor: 'motif', title: 'Motif', render: (r) => <MotifCell motif={r.motif} maxWidth={140} /> },
    {
      accessor: 'date_souhaitee', title: 'Date souhaitée', sortable: true,
      render: (r) => dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm'),
    },
    { accessor: 'nb_personnes', title: 'Personnes', textAlign: 'center' },
    {
      accessor: 'status', title: 'Statut', sortable: true,
      render: (r) => <Badge color={statusColor[r.status]} variant="light">{statusLabel[r.status]}</Badge>,
    },
    {
      accessor: 'actions', title: '',
      render: (r) => (
        <Group gap="xs" wrap="wrap" onClick={(e) => e.stopPropagation()}>
          {r.status === 'pending' ? (
            <>
              <Button size="xs" variant="subtle" color="brand" leftSection={<IconEye size={14} />} onClick={() => openDetail(r)}>Détail</Button>
              <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => handleApprove(r.id)} loading={approvingId === r.id}>Valider</Button>
              <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />} onClick={() => openRescheduleModal(r)}>Replanifier</Button>
              <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />} onClick={() => setRejectTarget(r)}>Refuser</Button>
            </>
          ) : (
            <Button size="xs" variant="subtle" color="brand" leftSection={<IconEye size={14} />} onClick={() => openDetail(r)}>Détail</Button>
          )}
          <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteTarget(r)}>Supprimer</Button>
        </Group>
      ),
    },
  ].filter((c) => !(isMobile && ['motif', 'nb_personnes'].includes(c.accessor)));

  if (loading) return <PageLoader />;

  return (
    <div className="page-content">
      <PageHeader title="Demandes à valider" subtitle={`${total} demande${total !== 1 ? 's' : ''} au total`}>
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
        </Group>
      </PageHeader>

      <Paper p={{ base: 'xs', sm: 'md' }} radius="lg" withBorder mb="md" className="filters-panel">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <SegmentedControl value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            data={statusFilterOptions} size="xs" color="brand" w={{ base: '100%', sm: 'auto' }} fullWidth={isMobile} />
          <TextInput placeholder="Destination..." leftSection={<IconSearch size={14} />}
            value={destinationFilter} onChange={(e) => { setDestinationFilter(e.currentTarget.value); setPage(1); }} size="xs" w={{ base: '100%', sm: 180 }} />
          <DateTimePicker placeholder="Du" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} size="xs" w={{ base: '100%', sm: 140 }} clearable />
          <DateTimePicker placeholder="Au" value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} size="xs" w={{ base: '100%', sm: 140 }} clearable />
          {hasFilters && (
            <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />} onClick={clearFilters}>
              Effacer
            </Button>
          )}
        </Group>
      </Paper>

      {toProcess.length > 0 && (
        <FloatingPanel title="Demandes validées sans sortie" badgeCount={toProcess.length} color="green">
          <Stack gap={8}>
            {toProcess.map((r) => (
              <Group key={r.id} justify="space-between" wrap="wrap" gap="sm" p="xs"
                style={{ borderRadius: 8, background: 'var(--mantine-color-default-hover)' }}>
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500}>
                    {`${r.Employee?.prenom || ''} ${r.Employee?.nom || ''}`}
                    <Text span c="dimmed" size="sm"> — {r.destination}</Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    {dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')} · {r.nb_personnes} pers. · {r.Vehicle ? vehicleDisplayName(r.Vehicle) : 'sans véhicule'}
                    {r.conflict?.departure_time
                      ? ` · occupé à ${dayjs(r.conflict.departure_time).format('HH:mm')} (${r.conflict.destination})`
                      : ''}
                  </Text>
                </Stack>
                <Group gap="xs" wrap="wrap">
                  <Button size="xs" color="brand" leftSection={<IconCar size={14} />}
                    onClick={() => { setAssignTarget(r); setAssignVehicleId(''); }}>
                    Affecter
                  </Button>
                  <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />}
                    onClick={() => openRescheduleModal(r)}>
                    Replanifier
                  </Button>
                  <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteTarget(r)}>Supprimer</Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </FloatingPanel>
      )}

      {requests.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={160}>
            <Flex direction="column" align="center" gap={6}>
              <IconInbox size={28} color="var(--mantine-color-gray-5)" />
              <Text c="dimmed" size="sm">Aucune demande trouvée</Text>
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
                records={requests}
                idAccessor="id"
                onRowClick={({ record }) => openDetail(record)}
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
                {requests.map((r) => (
                  <ValidateRequestCard key={r.id} r={r}
                    onApprove={handleApprove} onReject={(r) => setRejectTarget(r)}
                    onReschedule={openRescheduleModal} onDetail={openDetail}
                    onDelete={(req) => setDeleteTarget(req)}
                    approving={approvingId}
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

      <RequestDetailModal
        opened={detailOpened}
        onClose={() => setDetailOpened(false)}
        request={detailRequest}
      />

      <Modal opened={opened} onClose={close} title="Proposer une nouvelle date" size="md" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="sm">
          <TextInput label="Employé"
            value={`${selectedRequest?.Employee?.prenom || ''} ${selectedRequest?.Employee?.nom || ''}`}
            disabled
          />
          <TextInput label="Destination" value={selectedRequest?.destination || ''} disabled />
        </SimpleGrid>
        <DateTimePicker label="Nouvelle date proposée" value={newDate} onChange={setNewDate}
          minDate={new Date()} mb="md"
        />
        <TextInput label="Motif de replanification" placeholder="Pourquoi déplacer cette demande ?"
          required value={rescheduleReason}
          onChange={(e) => setRescheduleReason(e.currentTarget.value)} mb="md"
        />
        <Button color="brand" fullWidth onClick={handleReschedule} loading={rescheduling}>
          Envoyer la proposition
        </Button>
      </Modal>

      <Modal opened={!!assignTarget} onClose={() => setAssignTarget(null)} title="Affecter un véhicule (demande validée sans sortie)" size="md" centered
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="sm">
          <TextInput label="Employé"
            value={`${assignTarget?.Employee?.prenom || ''} ${assignTarget?.Employee?.nom || ''}`}
            disabled
          />
          <TextInput label="Destination" value={assignTarget?.destination || ''} disabled />
        </SimpleGrid>
        <TextInput label="Date souhaitée"
          value={assignTarget ? dayjs(assignTarget.date_souhaitee).format('DD/MM/YYYY HH:mm') : ''}
          disabled mb="sm"
        />
        <Select
          label="Véhicule disponible"
          placeholder="Choisir un véhicule"
          value={assignVehicleId}
          onChange={(v) => setAssignVehicleId(v || '')}
          data={assignVehicleOptions}
          searchable
          mb="md"
        />
        {assignableVehicles.length === 0 && (
          <Text size="sm" c="orange" mb="md">Aucun véhicule disponible pour l'instant. Réessayez plus tard ou supprimez la demande.</Text>
        )}
        <Button color="brand" fullWidth onClick={handleAssign} loading={assigning} disabled={!assignVehicleId}>
          Créer ou rejoindre la sortie
        </Button>
      </Modal>

      <ConfirmModal
        opened={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Refuser cette demande ?"
        message="L'employé sera notifié du refus."
        confirmLabel="Refuser"
        variant="danger"
        loading={rejecting}
      />

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer cette demande ?"
        message={deleteTarget?.status === 'approved'
          ? `La demande validée de ${deleteTarget?.Employee?.prenom || ''} ${deleteTarget?.Employee?.nom || ''} vers ${deleteTarget?.destination || ''} sera supprimée. Sa sortie associée sera mise à jour si elle n'emporte plus personne.`
          : `La demande de ${deleteTarget?.Employee?.prenom || ''} ${deleteTarget?.Employee?.nom || ''} vers ${deleteTarget?.destination || ''} sera définitivement supprimée. L'employé sera notifié.`}
        confirmLabel="Oui, supprimer"
        variant="danger"
        loading={deleting}
      />

      <style>{`
        .validate-request-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .validate-request-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default ValidateRequests;
