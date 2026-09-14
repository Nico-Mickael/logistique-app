import { useEffect, useState } from 'react';
import {
  Paper, Text, Group, Badge, Select, ThemeIcon, Button, Pagination, Center,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useMediaQuery } from '@mantine/hooks';
import { IconGauge, IconDownload } from '@tabler/icons-react';
import dayjs from '../../utils/date';
import { yearOptions } from '../../utils/date';
import { statsService } from '../../api/statsService';
import { vehicleService } from '../../api/vehicleService';
import { notifyError } from '../../utils/toast';
import { downloadCSV } from '../../utils/csv';
import { vehicleDisplayName } from '../../utils/labels';
import PageHeader from '../../components/PageHeader';
import PageLoader from '../../components/PageLoader';
import ReportBreadcrumb from '../../components/ReportBreadcrumb';

export default function HistoryReport() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [kmRows, setKmRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
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
    statsService.kilometrage({ year, ...(vehicleFilter ? { vehicle_id: vehicleFilter } : {}) })
      .then(({ data }) => { if (!cancelled) setKmRows(data || []); })
      .catch(() => { if (!cancelled) notifyError('Impossible de charger l\'historique'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, vehicleFilter]);

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

  if (loading && kmRows.length === 0) return <PageLoader />;

  const size = Number(pageSize) || 10;
  const totalPages = Math.ceil(kmRows.length / size) || 1;
  const safePage = Math.min(page, totalPages);
  const rows = kmRows.slice((safePage - 1) * size, safePage * size);
  const from = kmRows.length === 0 ? 0 : (safePage - 1) * size + 1;
  const to = Math.min(safePage * size, kmRows.length);

  return (
    <div className="page-content">
      <PageHeader title={<ReportBreadcrumb active="history" />} subtitle={`Historique kilométrique (${year})`}>
        <Group gap="sm">
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
        <DataTable
          withTableBorder
          borderRadius="md"
          highlightOnHover
          verticalSpacing="sm"
          idAccessor="id"
          records={rows}
          columns={[
            { accessor: 'departure_time', title: 'Date', render: (s) => dayjs(s.departure_time).format('DD/MM/YYYY') },
            { accessor: 'vehicle', title: 'Véhicule', render: (s) => <Text>{s.Vehicle ? vehicleDisplayName(s.Vehicle) : '—'}</Text> },
            { accessor: 'driver_name', title: 'Conducteur' },
            { accessor: 'destination', title: 'Destination' },
            { accessor: 'departure_km', title: 'Km départ', textAlign: 'right' },
            { accessor: 'arrival_km', title: 'Km arrivée', textAlign: 'right' },
            { accessor: 'distance_km', title: 'Distance', textAlign: 'right', render: (s) => <Badge variant="light" color="brand">{s.distance_km} km</Badge> },
          ].filter((c) => !(isMobile && ['departure_km', 'arrival_km', 'driver_name'].includes(c.accessor)))}
        />
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
                <Pagination total={totalPages} value={safePage} onChange={setPage} size="sm" radius="md" />
              </Center>
            </Group>
          </Group>
        )}
      </Paper>
    </div>
  );
}