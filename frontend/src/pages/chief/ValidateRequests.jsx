import { useEffect, useState } from 'react';
import {
  Paper, Title, Badge, Loader, Center, Text, Group, Button, Modal,
  TextInput, Textarea, Stack, Card, SimpleGrid, Flex, Select,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { IconCheck, IconX, IconCalendar, IconInbox, IconSearch, IconDownload, IconX as IconClear, IconEye } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import Swal from 'sweetalert2';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';

const statusColor = { pending: 'gray', approved: 'brand', rescheduled: 'brandYellow', rejected: 'red' };
const statusLabel = { pending: 'En attente', approved: 'Validée', rescheduled: 'Replanifiée', rejected: 'Refusée' };

const statusOptions = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Validée' },
  { value: 'rejected', label: 'Refusée' },
  { value: 'rescheduled', label: 'Replanifiée' },
];

function RequestCard({ request, onApprove, onReject, onReschedule }) {
  return (
    <Card withBorder radius="lg" p="lg" className="request-card">
      <div className="stat-card-accent" style={{ background: 'var(--mantine-color-brandYellow-6)' }} />
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text fw={600} size="md">{request.destination}</Text>
        <Badge color={statusColor[request.status]} variant="light">
          {statusLabel[request.status]}
        </Badge>
      </Group>
      <Stack gap={4} mb="md">
        <Text size="sm">
          <Text span c="dimmed" size="sm">Employé: </Text>
          {request.Employee?.prenom} {request.Employee?.nom}
        </Text>
        <Text size="sm">
          <Text span c="dimmed" size="sm">Motif: </Text>{request.motif}
        </Text>
        <Text size="sm">
          <Text span c="dimmed" size="sm">Date: </Text>
          {dayjs(request.date_souhaitee).format('DD/MM/YYYY HH:mm')}
        </Text>
        <Text size="sm">
          <Text span c="dimmed" size="sm">Personnes: </Text>{request.nb_personnes}
        </Text>
      </Stack>
      {request.status === 'pending' && (
        <Group gap="xs" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => onApprove(request.id)}>
            Valider
          </Button>
          <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />} onClick={() => onReschedule(request)}>
            Replanifier
          </Button>
          <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />} onClick={() => onReject(request.id)}>
            Refuser
          </Button>
        </Group>
      )}
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

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchRequests = async (p = page) => {
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
  };

  useEffect(() => { fetchRequests(1); }, []);

  const applyFilters = () => { setPage(1); fetchRequests(1); };
  const clearFilters = () => {
    setStatusFilter(''); setDestinationFilter(''); setDateFrom(null); setDateTo(null);
    setPage(1); fetchRequests(1);
  };
  const hasFilters = statusFilter || destinationFilter || dateFrom || dateTo;

  useEffect(() => { if (!loading) fetchRequests(); }, [page]);

  const handleApprove = async (id) => {
    try {
      await requestService.updateStatus(id, 'approved');
      notifySuccess('Demande validée');
      fetchRequests(page);
    } catch { notifyError('Erreur lors de la validation'); }
  };

  const handleReject = async (id) => {
    const result = await Swal.fire({
      title: 'Refuser cette demande ?',
      text: "L'employé sera notifié du refus.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, refuser',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#D32F2F',
      cancelButtonColor: '#8C8C8C',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await requestService.updateStatus(id, 'rejected');
      notifySuccess('Demande refusée');
      fetchRequests(page);
    } catch { notifyError('Erreur lors du refus'); }
  };

  const openRescheduleModal = (request) => {
    setSelectedRequest(request);
    setNewDate(null);
    open();
  };

  const handleReschedule = async () => {
    if (!newDate) { notifyError('Choisissez une nouvelle date'); return; }
    try {
      await requestService.updateStatus(selectedRequest.id, 'rescheduled', newDate);
      notifySuccess('Proposition de replanification envoyée');
      close();
      fetchRequests(page);
    } catch { notifyError('Erreur lors de la replanification'); }
  };

  const exportCSV = () => {
    const headers = ['Employé;Département;Destination;Motif;Date souhaitée;Personnes;Statut'];
    const rows = requests.map((r) =>
      `${r.Employee?.prenom} ${r.Employee?.nom};${r.Employee?.department || ''};${r.destination};${r.motif};${dayjs(r.date_souhaitee).format('DD/MM/YYYY HH:mm')};${r.nb_personnes};${statusLabel[r.status] || r.status}`
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'demandes.csv'; a.click();
    URL.revokeObjectURL(url);
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
              <Button size="xs" color="brand" leftSection={<IconCheck size={14} />} onClick={() => handleApprove(r.id)}>Valider</Button>
              <Button size="xs" variant="outline" color="brandYellow" leftSection={<IconCalendar size={14} />} onClick={() => openRescheduleModal(r)}>Replanifier</Button>
              <Button size="xs" variant="outline" color="red" leftSection={<IconX size={14} />} onClick={() => handleReject(r.id)}>Refuser</Button>
            </>
          ) : (
            <Button size="xs" variant="subtle" leftSection={<IconEye size={14} />} onClick={() => openDetail(r)}>Détail</Button>
          )}
        </Group>
      ),
    },
  ];

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowgap={4}>
        <div>
          <Title order={3}>Demandes à valider</Title>
          <Text size="sm" c="dimmed" mt={2}>{total} demande{total !== 1 ? 's' : ''} au total</Text>
        </div>
        <Group gap="xs">
          <Button variant="subtle" color="gray" leftSection={<IconDownload size={16} />} onClick={exportCSV} size="sm">
            Export CSV
          </Button>
        </Group>
      </Flex>

      <Paper p="md" radius="lg" withBorder mb="md" className="filters-panel">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select placeholder="Statut" data={statusOptions} value={statusFilter}
            onChange={setStatusFilter} clearable size="xs" w={140} />
          <TextInput placeholder="Destination..." leftSection={<IconSearch size={14} />}
            value={destinationFilter} onChange={(e) => setDestinationFilter(e.currentTarget.value)} size="xs" w={180} />
          <DateTimePicker placeholder="Du" value={dateFrom} onChange={setDateFrom} size="xs" w={140} clearable />
          <DateTimePicker placeholder="Au" value={dateTo} onChange={setDateTo} size="xs" w={140} clearable />
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
      )}

      <Modal opened={detailOpened} onClose={() => setDetailOpened(false)} title="Détail de la demande" size="lg"
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
                    <div><Text size="xs" c="dimmed">Km retour</Text><Text>{detailRequest.Sorties[0].return_km || detailRequest.Sorties[0].arrival_km}</Text></div>
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
        <Button color="brand" fullWidth onClick={handleReschedule}>
          Envoyer la proposition
        </Button>
      </Modal>

      <style>{`
        .page-content {  }
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
