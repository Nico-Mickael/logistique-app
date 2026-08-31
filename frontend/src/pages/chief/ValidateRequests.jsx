import { useEffect, useState, useCallback } from 'react';
import {
  Paper, Title, Badge, Loader, Center, Text, Group, Button, Modal,
  TextInput, Stack, Flex, Select, Card, SimpleGrid, Pagination, SegmentedControl,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconX, IconCalendar, IconInbox, IconSearch, IconDownload, IconX as IconClear, IconEye, IconTrash } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';
import { requestStatusLabel as statusLabel, requestStatusColor as statusColor } from '../../utils/labels';
import { downloadCSV } from '../../utils/csv';

const statusOptions = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Validée' },
  { value: 'rejected', label: 'Refusée' },
  { value: 'rescheduled', label: 'Replanifiée' },
];

function ValidateRequestCard({ r, onApprove, onReject, onReschedule, onDetail, onDelete, approving }) {
  return (
    <Card withBorder radius="lg" p="lg" className="validate-request-card">
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: statusColor[r.status] === 'brand' ? 'var(--mantine-color-brand-6)' :
                    statusColor[r.status] === 'red' ? 'var(--mantine-color-red-6)' :
                    statusColor[r.status] === 'brandYellow' ? 'var(--mantine-color-brandYellow-6)' :
                    'var(--mantine-color-gray-5)',
      }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text fw={600} size="md">{r.Employee?.prenom} {r.Employee?.nom}</Text>
        <Badge color={statusColor[r.status]} variant="light">{statusLabel[r.status]}</Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm"><Text span c="dimmed">Destination: </Text>{r.destination}</Text>
        <Text size="sm"><Text span c="dimmed">Date: </Text>{dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Text>
        <Text size="sm"><Text span c="dimmed">Personnes: </Text>{r.nb_personnes}</Text>
      </Stack>
      <Group gap="xs" wrap="wrap">
        {r.status === 'pending' ? (
          <>
            <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => onApprove(r.id)} loading={approving === r.id}>Valider</Button>
            <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />} onClick={() => onReschedule(r)}>Replanifier</Button>
            <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />} onClick={() => onReject(r)}>Refuser</Button>
          </>
        ) : (
          <Button size="xs" variant="subtle" color="brand" leftSection={<IconEye size={14} />} onClick={() => onDetail(r)}>Détail</Button>
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

  const [statusFilter, setStatusFilter] = useState('');
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

  const fetchRequests = useCallback(async (p = page) => {
    try {
      const params = { page: p, limit };
      if (statusFilter) params.status = statusFilter;
      if (destinationFilter) params.destination = destinationFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
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

  const applyFilters = () => { setPage(1); };
  const clearFilters = () => {
    setStatusFilter(''); setDestinationFilter(''); setDateFrom(null); setDateTo(null);
    setPage(1);
  };
  const hasFilters = statusFilter || destinationFilter || dateFrom || dateTo;

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      await requestService.updateStatus(id, 'approved');
      notifySuccess('Demande validée');
      fetchRequests(page);
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
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally { setDeleting(false); }
  };

  const openRescheduleModal = (request) => {
    setSelectedRequest(request);
    setNewDate(null);
    open();
  };

  const handleReschedule = async () => {
    if (!newDate) { notifyError('Choisissez une nouvelle date'); return; }
    setRescheduling(true);
    try {
      await requestService.updateStatus(selectedRequest.id, 'rescheduled', newDate);
      notifySuccess('Proposition de replanification envoyée');
      close();
      fetchRequests(page);
    } catch { notifyError('Erreur lors de la replanification'); }
    finally { setRescheduling(false); }
  };

  const exportCSV = async () => {
    try {
      const params = { limit: 9999 };
      if (statusFilter) params.status = statusFilter;
      if (destinationFilter) params.destination = destinationFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
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
        <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          {r.status === 'pending' ? (
            <>
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
  ];

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Demandes à valider</Title>
          <Text size="sm" c="dimmed" mt={2}>{total} demande{total !== 1 ? 's' : ''} au total</Text>
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
        </Group>
      </Flex>

      <Paper p="md" radius="lg" withBorder mb="md" className="filters-panel">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select placeholder="Statut" data={statusOptions} value={statusFilter}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }} clearable size="xs" w={140} />
          <TextInput placeholder="Destination..." leftSection={<IconSearch size={14} />}
            value={destinationFilter} onChange={(e) => { setDestinationFilter(e.currentTarget.value); setPage(1); }} size="xs" w={{ base: '100%', sm: 180 }} />
          <DateTimePicker placeholder="Du" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} size="xs" w={{ base: '100%', sm: 140 }} clearable />
          <DateTimePicker placeholder="Au" value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} size="xs" w={{ base: '100%', sm: 140 }} clearable />
          <Button color="brand" size="xs" onClick={applyFilters}>Filtrer</Button>
          {hasFilters && (
            <Button variant="subtle" color="gray" size="xs" leftSection={<IconClear size={14} />} onClick={clearFilters}>
              Effacer
            </Button>
          )}
        </Group>
      </Paper>

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

      <Modal opened={detailOpened} onClose={() => setDetailOpened(false)} title="Détail de la demande"
        size="lg" fullScreen={{ base: true, sm: false }}
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        {detailRequest && (
          <Stack gap="sm">
            <Group grow>
              <div><Text size="xs" c="dimmed">Employé</Text><Text fw={500}>{detailRequest.Employee?.prenom} {detailRequest.Employee?.nom}</Text></div>
              <div><Text size="xs" c="dimmed">Département</Text><Text fw={500}>{detailRequest.Employee?.department || '\u2014'}</Text></div>
            </Group>
            <div><Text size="xs" c="dimmed">Destination</Text><Text fw={500}>{detailRequest.destination}</Text></div>
            <div><Text size="xs" c="dimmed">Motif</Text><Text>{detailRequest.motif}</Text></div>
            <Group grow>
              <div><Text size="xs" c="dimmed">Date souhaitée</Text><Text fw={500}>{dayjs(detailRequest.date_souhaitee).format('DD/MM/YYYY HH:mm')}</Text></div>
              <div><Text size="xs" c="dimmed">Personnes</Text><Text fw={500}>{detailRequest.nb_personnes}</Text></div>
            </Group>
            <Group grow>
              <div><Text size="xs" c="dimmed">Statut</Text><Badge color={statusColor[detailRequest.status] || 'gray'} variant="light">{statusLabel[detailRequest.status] || detailRequest.status}</Badge></div>
              {detailRequest.Vehicle && (
                <div><Text size="xs" c="dimmed">Véhicule</Text><Text fw={500} tt="capitalize">{detailRequest.Vehicle.type} ({detailRequest.Vehicle.capacity} pers.)</Text></div>
              )}
            </Group>
            <Group grow>
              <div><Text size="xs" c="dimmed">Créée le</Text><Text>{dayjs(detailRequest.createdAt).format('DD/MM/YYYY HH:mm')}</Text></div>
              <div><Text size="xs" c="dimmed">Dernière modification</Text><Text>{dayjs(detailRequest.updatedAt).format('DD/MM/YYYY HH:mm')}</Text></div>
            </Group>
            {detailRequest.Sorties?.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--mantine-color-default-border)', margin: '4px 0' }} />
                <Text size="xs" c="dimmed" fw={600}>Trajet associé</Text>
                <Group grow>
                  {detailRequest.Sorties[0].departure_km && (
                    <div><Text size="xs" c="dimmed">Km départ</Text><Text>{detailRequest.Sorties[0].departure_km}</Text></div>
                  )}
                  {(detailRequest.Sorties[0].return_km || detailRequest.Sorties[0].arrival_km) && (
                    <div><Text size="xs" c="dimmed">{detailRequest.Sorties[0].return_km ? 'Km retour' : 'Km arrivée'}</Text><Text>{detailRequest.Sorties[0].return_km || detailRequest.Sorties[0].arrival_km}</Text></div>
                  )}
                </Group>
                {detailRequest.Sorties[0].returned_at && (
                  <div><Text size="xs" c="dimmed">Retourné le</Text><Text>{dayjs(detailRequest.Sorties[0].returned_at).format('DD/MM/YYYY HH:mm')}</Text></div>
                )}
                {detailRequest.Sorties[0].distance_km && (
                  <div><Text size="xs" c="dimmed">Distance totale</Text><Text>{detailRequest.Sorties[0].distance_km} km</Text></div>
                )}
              </>
            )}
          </Stack>
        )}
      </Modal>

      <Modal opened={opened} onClose={close} title="Proposer une nouvelle date" size="sm"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        <TextInput label="Employé"
          value={`${selectedRequest?.Employee?.prenom || ''} ${selectedRequest?.Employee?.nom || ''}`}
          disabled mb="sm"
        />
        <TextInput label="Destination" value={selectedRequest?.destination || ''} disabled mb="sm" />
        <DateTimePicker label="Nouvelle date proposée" value={newDate} onChange={setNewDate}
          minDate={new Date()} mb="md"
        />
        <Button color="brand" fullWidth onClick={handleReschedule} loading={rescheduling}>
          Envoyer la proposition
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
        .page-content {  }
        .validate-request-card {
          position: relative;
          overflow: hidden;
          animation: panel-in 0.35s ease-out;
        }
        .request-card {
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
          .request-card, .dashboard-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default ValidateRequests;
