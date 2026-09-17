import { useEffect, useState } from 'react';
import {
  Paper, Text, Group, Badge, Select, ThemeIcon, Button, Pagination, Center,
  Checkbox, SegmentedControl, Card, SimpleGrid,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useMediaQuery } from '@mantine/hooks';
import { IconGauge, IconDownload, IconTrash } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { yearOptions } from '../../utils/date';
import { statsService } from '../../api/statsService';
import { vehicleService } from '../../api/vehicleService';
import { sortieService } from '../../api/sortieService';
import { notifyError, notifySuccess } from '../../utils/toast';
import { downloadCSV } from '../../utils/csv';
import { vehicleDisplayName } from '../../utils/labels';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import ReportBreadcrumb from '../../components/ReportBreadcrumb';
import ConfirmModal from '../../components/ConfirmModal';

export default function HistoryReport() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [kmRows, setKmRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [viewMode, setViewMode] = useState('table');
  const [selectedIds, setSelectedIds] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    vehicleService.getAll()
      .then(({ data }) => setVehicles(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    setSelectedIds([]);
    statsService.kilometrage({ year, ...(vehicleFilter ? { vehicle_id: vehicleFilter } : {}) })
      .then(({ data }) => { if (!cancelled) setKmRows(data || []); })
      .catch(() => { if (!cancelled) notifyError('Impossible de charger l\'historique'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, vehicleFilter, reloadKey]);

  const exportKmCSV = () => {
    downloadCSV(`${year}-kilometrage.csv`,
      ['Date', 'Véhicule', 'Conducteur', 'Destination', 'Km départ', 'Km arrivée', 'Distance'],
      kmRows.map((s) => [
        dayjs(s.departure_time).format('DD/MM/YYYY'),
        s.Vehicle ? vehicleDisplayName(s.Vehicle) : '',
        s.driver_name,
        s.destination,
        s.departure_km ?? '',
        s.arrival_km ?? '',
        s.distance_km ?? '',
      ].join(';'))
    );
  };

  const toggleOne = (id) => setSelectedIds((prev) => (
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  ));

  const allSelected = kmRows.length > 0 && selectedIds.length === kmRows.length;
  const partialSelected = selectedIds.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(kmRows.map((r) => r.id));
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data } = await sortieService.removeBulk(selectedIds);
      notifySuccess(data?.message || 'Sorties supprimées');
      setSelectedIds([]);
      setConfirmOpen(false);
      setReloadKey((k) => k + 1);
    } catch {
      notifyError('Échec de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && kmRows.length === 0) return <PageLoader />;

  const size = Number(pageSize) || 10;
  const totalPages = Math.ceil(kmRows.length / size) || 1;
  const safePage = Math.min(page, totalPages);
  const rows = kmRows.slice((safePage - 1) * size, safePage * size);
  const from = kmRows.length === 0 ? 0 : (safePage - 1) * size + 1;
  const to = Math.min(safePage * size, kmRows.length);

  const selectionColumn = {
    accessor: 'select',
    title: '',
    width: 44,
    render: (s) => (
      <Checkbox
        aria-label="Sélectionner"
        checked={selectedIds.includes(s.id)}
        onChange={() => toggleOne(s.id)}
      />
    ),
  };

  return (
    <div className="page-content">
      <PageHeader title={<ReportBreadcrumb active="history" />} subtitle={`Historique kilométrique (${year})`}>
        <Group gap="sm">
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
          <Select data={yearOptions} value={year} onChange={setYear} size="xs" w={110} />
          <Button
            color="brand"
            size="sm"
            leftSection={<IconDownload size={16} />}
            disabled={kmRows.length === 0}
            onClick={exportKmCSV}
          >
            Exporter
          </Button>
        </Group>
      </PageHeader>

      <Paper p="lg" radius="lg" withBorder>
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group gap="sm">
            <ThemeIcon variant="light" color="brand" size={28} radius={8}>
              <IconGauge size={16} />
            </ThemeIcon>
            <Text fw={600} size="sm">Historique kilométrique ({kmRows.length})</Text>
          </Group>
          <Select
            placeholder="Tous les véhicules"
            data={vehicles.map((v) => ({ value: String(v.id), label: vehicleDisplayName(v) }))}
            value={vehicleFilter}
            onChange={(v) => setVehicleFilter(v || '')}
            clearable
            size="xs"
            w={{ base: '100%', sm: 180 }}
          />
        </Group>

        {kmRows.length > 0 && (
          <Group justify="space-between" mb="md" gap="sm" wrap="wrap">
            <Checkbox
              label="Tout sélectionner"
              checked={allSelected}
              indeterminate={partialSelected}
              onChange={toggleAll}
            />
            <Button
              color="red"
              variant="light"
              size="xs"
              leftSection={<IconTrash size={15} />}
              disabled={selectedIds.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Supprimer ({selectedIds.length})
            </Button>
          </Group>
        )}

        {viewMode === 'table' ? (
          <DataTable
            withTableBorder
            borderRadius="md"
            highlightOnHover
            verticalSpacing="sm"
            idAccessor="id"
            records={rows}
            columns={[
              selectionColumn,
              { accessor: 'departure_time', title: 'Date', render: (s) => dayjs(s.departure_time).format('DD/MM/YYYY') },
              { accessor: 'vehicle', title: 'Véhicule', render: (s) => <Text>{s.Vehicle ? vehicleDisplayName(s.Vehicle) : '—'}</Text> },
              { accessor: 'driver_name', title: 'Conducteur' },
              { accessor: 'destination', title: 'Destination' },
              { accessor: 'departure_km', title: 'Km départ', textAlign: 'right' },
              { accessor: 'arrival_km', title: 'Km arrivée', textAlign: 'right' },
              { accessor: 'distance_km', title: 'Distance', textAlign: 'right', render: (s) => <Badge variant="light" color="brand">{s.distance_km} km</Badge> },
            ].filter((c) => !(isMobile && ['departure_km', 'arrival_km', 'driver_name'].includes(c.accessor)))}
          />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
            {rows.map((s) => (
              <Card key={s.id} shadow="xs" padding="md" radius="lg" withBorder>
                <Group justify="space-between" mb="xs">
                  <Checkbox
                    aria-label="Sélectionner"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => toggleOne(s.id)}
                  />
                  <Badge variant="light" color="brand">{s.distance_km} km</Badge>
                </Group>
                <Text fw={600}>{dayjs(s.departure_time).format('DD/MM/YYYY')}</Text>
                <Text size="sm" c="dimmed">{s.Vehicle ? vehicleDisplayName(s.Vehicle) : '—'}</Text>
                <Text size="sm" mt={4}>{s.destination}</Text>
                <Text size="xs" c="dimmed" mt={4}>Conducteur : {s.driver_name || '—'}</Text>
                <Group gap="xs" mt="md">
                  <Badge variant="default" size="sm">Départ : {s.departure_km ?? '—'} km</Badge>
                  <Badge variant="default" size="sm">Arrivée : {s.arrival_km ?? '—'} km</Badge>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {kmRows.length > 0 && (
          <Group justify="space-between" mt="md" align="center" wrap="wrap">
            <Text size="xs" c="dimmed">Affichage {from}–{to} sur {kmRows.length} sortie{kmRows.length > 1 ? 's' : ''}</Text>
            <Group gap="sm" align="center" wrap="wrap">
              <Select
                aria-label="Nombre par page"
                data={['10', '20', '50', '100']}
                value={pageSize}
                onChange={(v) => { setPageSize(v || '10'); setPage(1); }}
                size="xs"
                w={90}
              />
              <Center>
                <Pagination total={totalPages} value={safePage} onChange={setPage} color="brand" size="sm" radius="md" />
              </Center>
            </Group>
          </Group>
        )}
      </Paper>

      <ConfirmModal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer de l'historique ?"
        message={`${selectedIds.length} sortie${selectedIds.length > 1 ? 's' : ''} terminée${selectedIds.length > 1 ? 's' : ''} seront retirée${selectedIds.length > 1 ? 's' : ''} de l'historique kilométrique.`}
        confirmLabel="Oui, supprimer"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}