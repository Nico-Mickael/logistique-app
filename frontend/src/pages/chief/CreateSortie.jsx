import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Paper, Title, Text, Group, Stack, Badge, Button, TextInput,
  Loader, Center, Avatar, SimpleGrid, NumberInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconUsers, IconPlus,
  IconSteeringWheel, IconMapPin, IconClock, IconUser,
  IconBuildingWarehouse, IconGauge,
} from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import VehicleModal from '../../components/VehicleModal';
import dayjs from '../../utils/date';
import { vehicleService } from '../../api/vehicleService';
import { sortieService } from '../../api/sortieService';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';
import { getSeatLayout, getSeatColor } from '../../utils/seatLayout';
import { vehicleStatusLabel as statusLabel, vehicleStatusColor as statusColor } from '../../utils/labels';

function CarVisual({ vehicle, seatStates, onSeatClick, selectedSeat }) {
  const layout = getSeatLayout(vehicle.type, vehicle.capacity);
  const svgW = layout.w;
  const svgH = layout.h;
  const bodyW = layout.bodyW;
  const bodyH = layout.bodyH;
  const bx = (svgW - bodyW) / 2;
  const by = (svgH - bodyH) / 2;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0f0f0" />
          <stop offset="100%" stopColor="#e0e0e0" />
        </linearGradient>
        <filter id="carShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
        </filter>
        <filter id="seatShadow">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.2" />
        </filter>
      </defs>

      <rect x={bx - 6} y={by - 4} width={bodyW + 12} height={bodyH + 12}
        rx={14} fill="#d0d0d0" filter="url(#carShadow)" opacity="0.5"
      />

      <rect x={bx} y={by} width={bodyW} height={bodyH}
        rx={12} fill="url(#carBody)" stroke="#bbb" strokeWidth="1.5"
      />

      <path d={`M ${bx + 10} ${by + 6} L ${bx + bodyW / 3} ${by + 6} Q ${bx + bodyW / 3 + 10} ${by + 2} ${bx + bodyW / 3 + 20} ${by + 6} L ${bx + bodyW - 10} ${by + 6}`}
        fill="none" stroke="#a0a0a0" strokeWidth="1.5" opacity="0.6"
      />
      <rect x={bx + bodyW / 3 + 4} y={by + 3} width={bodyW / 3 - 8} height={4}
        rx={2} fill="#a8d4f0" opacity="0.5"
      />

      {layout.seats.map((seat) => {
        const state = seatStates[seat.id] || 'available';
        const colors = getSeatColor(state);
        const isSelected = selectedSeat === seat.id;
        return (
          <g key={seat.id}
            onClick={() => onSeatClick?.(seat.id)}
            style={{ cursor: state === 'unavailable' ? 'not-allowed' : 'pointer' }}
          >
            <rect x={bx + seat.x} y={by + seat.y}
              width={seat.w} height={seat.h} rx={5}
              fill={colors.fill} stroke={colors.stroke}
              strokeWidth={isSelected ? 2.5 : 1}
              filter={isSelected ? 'url(#seatShadow)' : undefined}
              opacity={state === 'unavailable' ? 0.5 : 1}
              style={{ transition: 'all 0.3s ease', transformOrigin: 'center' }}
            />
            {state === 'occupied' && (
              <text x={bx + seat.x + seat.w / 2} y={by + seat.y + seat.h / 2 + 1}
                textAnchor="middle" fontSize="9" fill="white" fontWeight="600"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {seat.label === 'Conducteur' ? '👤' : '👤'}
              </text>
            )}
            {state === 'available' && (
              <text x={bx + seat.x + seat.w / 2} y={by + seat.y + seat.h / 2 + 1}
                textAnchor="middle" fontSize="8" fill="white" fontWeight="600"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {seat.id + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function VehicleCard({ vehicle, seatStates, isSelected, onClick, requestsBySeat = [] }) {
  const occupiedCount = seatStates ? Object.values(seatStates).filter((s) => s === 'occupied').length : 0;
  const availableCount = vehicle.capacity - occupiedCount;

  return (
    <div className={`vehicle-flip ${isSelected ? 'vehicle-flip--selected' : ''}`}>
      <div className="vehicle-flip-inner" onClick={onClick}>
        <div className="vehicle-flip-face vehicle-flip-front">
          <Paper
            p="lg"
            radius="lg"
            withBorder
            className="vehicle-card"
            style={{
              cursor: 'pointer',
              border: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-body)',
              transition: 'all 0.3s ease',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100%',
            }}
          >
            <Group justify="space-between" mb="sm" wrap="nowrap">
              <Group gap="sm">
                <div className="vehicle-icon-container">
                  <VehicleIcon type={vehicle.type} size={22} color="light-dark(var(--mantine-color-brand-6), #7BC88A)" />
                </div>
                <div>
                  <Text fw={600} size="sm" tt="capitalize">{vehicle.type}</Text>
                  <Group gap={4}>
                    <IconUsers size={12} color="var(--mantine-color-dimmed)" />
                    <Text size="xs" c="dimmed">{vehicle.capacity} places</Text>
                  </Group>
                </div>
              </Group>
              <Badge color={statusColor[vehicle.status]} variant="light" size="sm">
                {statusLabel[vehicle.status]}
              </Badge>
            </Group>

            {vehicle.status === 'available' && (
              <div className="car-preview">
                <CarVisual
                  vehicle={vehicle}
                  seatStates={seatStates || {}}
                  onSeatClick={() => {}}
                  selectedSeat={null}
                />
              </div>
            )}

            {vehicle.status === 'available' && (
              <Group gap={6} mt="sm" justify="center">
                <span className="seat-dot" style={{ background: '#4CAF50' }} />
                <Text size="xs" c="dimmed">{availableCount} libre{availableCount !== 1 ? 's' : ''}</Text>
                {occupiedCount > 0 && (
                  <>
                    <span className="seat-dot" style={{ background: '#D32F2F' }} />
                    <Text size="xs" c="dimmed">{occupiedCount} occupée{occupiedCount !== 1 ? 's' : ''}</Text>
                  </>
                )}
              </Group>
            )}
          </Paper>
        </div>

        <div className="vehicle-flip-face vehicle-flip-back">
          <Group justify="space-between" align="center" mb="sm">
            <Group gap={6}>
              <IconUsers size={15} color="var(--mantine-color-brand-6)" />
              <Text size="sm" fw={600}>Personnes à bord</Text>
            </Group>
            <Badge size="sm" variant="light" color="brand">
              {requestsBySeat.length}
            </Badge>
          </Group>
          {requestsBySeat.length === 0 ? (
            <Text c="dimmed" size="sm">Aucune personne à bord</Text>
          ) : (
            <Stack gap={6}>
              {requestsBySeat.map((r) => (
                <Paper
                  key={r.id}
                  p="xs"
                  radius="md"
                  withBorder
                  style={{ background: 'light-dark(#f6f7f9, rgba(255,255,255,0.05))' }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color="brand" radius="xl" size="sm">
                      {`${r.Employee?.prenom?.[0] || ''}${r.Employee?.nom?.[0] || ''}`}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <Text size="sm" fw={600} truncate>
                        {r.Employee?.prenom} {r.Employee?.nom}
                      </Text>
                      {r.Employee?.department && (
                        <Text size="xs" c="dimmed" truncate>{r.Employee.department}</Text>
                      )}
                    </div>
                    <Badge size="sm" variant="light" color="red" leftSection={<IconUser size={11} />}>
                      {r.nb_personnes}
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestCard({ request, onAdd, adding, disabled }) {
  return (
    <Paper
      p="md"
      radius="lg"
      withBorder
      className="request-glass-card"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.3)',
        transition: 'all 0.3s ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Group rowGap={4} wrap="nowrap" align="flex-start">
        <Avatar color="brand" radius="xl" size="md">
          {`${request.Employee?.prenom?.[0] || ''}${request.Employee?.nom?.[0] || ''}`}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" mb={2}>
            <Text fw={600} size="sm" truncate>
              {request.Employee?.prenom} {request.Employee?.nom}
            </Text>
            <Badge size="sm" color={request.status === 'approved' ? 'brand' : 'gray'} variant="light">
              {request.nb_personnes} {request.nb_personnes > 1 ? 'personnes' : 'personne'}
            </Badge>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Group gap={4}>
              <IconBuildingWarehouse size={12} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">{request.Employee?.department}</Text>
            </Group>
            <Text size="xs" c="dimmed">·</Text>
            <Group gap={4}>
              <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">{request.destination}</Text>
            </Group>
            <Text size="xs" c="dimmed">·</Text>
            <Group gap={4}>
              <IconClock size={12} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">{dayjs(request.date_souhaitee).format('DD/MM HH:mm')}</Text>
            </Group>
          </Group>
        </div>
        <Button
          size="sm"
          color="brand"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => onAdd(request)}
          loading={adding}
          disabled={disabled}
          style={{ flexShrink: 0 }}
        >
          Ajouter
        </Button>
      </Group>
    </Paper>
  );
}

function CreateSortie() {
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [driverName, setDriverName] = useState('');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState(null);
  const [departureKm, setDepartureKm] = useState('');
  const [lastSortieLoading, setLastSortieLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [createdSortie, setCreatedSortie] = useState(null);
  const [seatStates, setSeatStates] = useState({});
  const [seatAssignments, setSeatAssignments] = useState([]);
  const [adding, setAdding] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehRes, reqRes] = await Promise.all([
        vehicleService.getOccupancy(),
        requestService.all({ limit: 9999 }),
      ]);
      setVehicles(vehRes.data || []);
      const all = reqRes.data.data || reqRes.data || [];
      const pending = all.filter(
        (r) => r.status === 'pending' || r.status === 'approved'
      );
      setRequests(pending);
    } catch {
      notifyError('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const initSeats = useCallback((vehicle) => {
    const states = {};
    const occupied = vehicle.occupiedSeats || 0;
    for (let i = 0; i < vehicle.capacity; i++) {
      states[i] = i < occupied ? 'occupied' : 'available';
    }
    return states;
  }, []);

  const handleSelectVehicle = async (vehicle) => {
    if (vehicle.status !== 'available') {
      notifyError('Ce véhicule n\'est pas disponible');
      return;
    }
    setSelectedVehicle(vehicle);
    setCreatedSortie(null);
    setSeatStates(initSeats(vehicle));
    setSeatAssignments([]);
    setDestination('');
    setDriverName('');
    setDepartureTime(null);
    setDepartureKm('');
    setConfigModalOpen(true);
    if (vehicle.id) {
      setLastSortieLoading(true);
      try {
        const { data } = await sortieService.lastForVehicle(vehicle.id);
        if (data && data.return_km != null) {
          setDepartureKm(String(data.return_km));
        }
      } catch {
        // pas de dernière sortie, champ vide
      } finally {
        setLastSortieLoading(false);
      }
    }
  };

  const handleCreateSortie = async () => {
    if (!selectedVehicle || !driverName || !destination || !departureTime) {
      notifyError('Merci de remplir tous les champs');
      return;
    }
    setCreating(true);
    try {
      const { data } = await sortieService.create({
        vehicle_id: selectedVehicle.id,
        driver_name: driverName,
        destination,
        departure_time: departureTime,
        departure_km: departureKm || null,
      });
      setCreatedSortie(data);
      notifySuccess('Sortie créée avec succès');
      setConfigModalOpen(false);

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === selectedVehicle.id ? { ...v, status: 'busy' } : v
        )
      );
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleAddRequest = async (request) => {
    if (!createdSortie) return;
    if (!request.Employee) return;

    const nb = request.nb_personnes || 1;
    const freeSeatIds = Object.entries(seatStates)
      .filter(([, state]) => state === 'available')
      .map(([k]) => parseInt(k, 10));

    if (freeSeatIds.length < nb) {
      notifyError('Plus de places disponibles dans ce véhicule');
      return;
    }
    const seatIds = freeSeatIds.slice(0, nb);

    setAdding(true);
    try {
      await sortieService.addRequest(createdSortie.id, request.id);
      setSeatStates((prev) => {
        const next = { ...prev };
        seatIds.forEach((sid) => { next[sid] = 'occupied'; });
        return next;
      });
      setSeatAssignments((prev) => [
        ...prev,
        ...seatIds.map((seatId) => ({
          seatId,
          employee: request.Employee,
          destination: request.destination,
          date_souhaitee: request.date_souhaitee,
        })),
      ]);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      notifySuccess(`${request.Employee.prenom} ${request.Employee.nom} ajouté au véhicule`);
    } catch {
      notifyError('Erreur lors de l\'ajout de la demande');
    } finally {
      setAdding(false);
    }
  };

  const compatibleRequests = useMemo(() => {
    if (!createdSortie) return [];
    return requests.filter((r) => {
      if (r.status !== 'pending') return false;
      if (r.vehicle_id) return false;
      if (r.destination !== createdSortie.destination) return false;
      return true;
    });
  }, [requests, createdSortie]);

  const occupancyByVehicle = useMemo(() => {
    const map = {};
    requests.forEach((r) => {
      if (!r.vehicle_id) return;
      if (!map[r.vehicle_id]) map[r.vehicle_id] = { count: 0, occupants: [] };
      map[r.vehicle_id].count += r.nb_personnes || 0;
      map[r.vehicle_id].occupants.push(r);
    });
    return map;
  }, [requests]);

  const makeSeatStates = (vehicle) => {
    const occ = occupancyByVehicle[vehicle.id];
    const occupied = occ ? occ.count : 0;
    const states = {};
    for (let i = 0; i < vehicle.capacity; i++) {
      states[i] = i < occupied ? 'occupied' : 'available';
    }
    return states;
  };

  const occupiedCount = Object.values(seatStates).filter((s) => s === 'occupied').length;
  const availableCount = selectedVehicle ? selectedVehicle.capacity - occupiedCount : 0;

  if (loading) {
    return <Center h={300}><Loader color="brand" size="lg" /></Center>;
  }

  return (
    <div className="page-content">
      <style>{`
        .vehicle-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .vehicle-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        }
        .vehicle-card--selected {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.12);
        }
        .vehicle-flip {
          perspective: 1200px;
          height: 100%;
        }
        .vehicle-flip--selected .vehicle-flip-front .vehicle-card {
          border: 2px solid var(--mantine-color-brand-6);
          background: rgba(46,125,50,0.04);
        }
        .vehicle-flip-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s;
          transform-style: preserve-3d;
          cursor: pointer;
        }
        .vehicle-flip:hover .vehicle-flip-inner {
          transform: rotateY(180deg);
        }
        .vehicle-flip-face {
          width: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .vehicle-flip-front {
          position: relative;
          z-index: 2;
          height: 100%;
        }
        .vehicle-flip-back {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100%;
          transform: rotateY(180deg);
          background: light-dark(#ffffff, #2E2E33);
          border: 1px solid var(--mantine-color-default-border);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          text-align: left;
          overflow-y: auto;
        }
        .vehicle-icon-container {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(46,125,50,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .car-preview {
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 0;
        }
        .request-glass-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        .seat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .seat-info-card {
          animation: card-pop 0.25s ease-out;
        }
        .glass-panel {
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.3);
        }
        .step-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .step-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        .step-circle--done {
          background: var(--mantine-color-brand-6);
          color: #fff;
        }
        .step-circle--active {
          background: var(--mantine-color-brandYellow-5);
          color: #1f1f1f;
          box-shadow: 0 0 0 4px rgba(245,179,1,0.2);
        }
        .step-circle--pending {
          background: light-dark(#e9ecef, #373A40);
          color: light-dark(#868e96, #909296);
        }
        .step-line {
          flex: 1;
          height: 2px;
          background: light-dark(#e9ecef, #373A40);
          max-width: 80px;
          min-width: 20px;
        }
        .step-line--done {
          background: var(--mantine-color-brand-6);
        }
        .seat-animate-enter {
          animation: seat-fill 0.4s ease-out;
        }
        @keyframes card-pop {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes seat-fill {
          0% { transform: scale(1); }
          30% { transform: scale(1.2); }
          60% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .vehicle-detail-car {
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .info-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid var(--mantine-color-default-border);
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(46,125,50,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .capacity-bar {
          height: 6px;
          border-radius: 3px;
          background: light-dark(#e9ecef, #373A40);
          overflow: hidden;
          margin-top: 4px;
        }
        .capacity-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }
      `}</style>

      <Group justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
        <div>
          <Title order={3}>Créer une sortie</Title>
          <Text size="sm" c="dimmed" mt={2}>
            Sélectionnez un véhicule et ajoutez les demandes compatibles
          </Text>
        </div>
      </Group>

      <div className="step-indicator">
        <div className={`step-circle ${selectedVehicle ? 'step-circle--done' : 'step-circle--active'}`}>1</div>
        <Text size="sm" fw={selectedVehicle ? 400 : 600} c={selectedVehicle ? 'dimmed' : '#1f1f1f'}>
          Véhicule
        </Text>
        <div className={`step-line ${selectedVehicle ? 'step-line--done' : ''}`} />
        <div className={`step-circle ${createdSortie ? 'step-circle--done' : selectedVehicle ? 'step-circle--active' : 'step-circle--pending'}`}>2</div>
        <Text size="sm" fw={createdSortie ? 400 : selectedVehicle ? 600 : 400} c={createdSortie ? 'dimmed' : selectedVehicle ? 'var(--mantine-color-text)' : 'dimmed'}>
          Configuration
        </Text>
        <div className={`step-line ${createdSortie ? 'step-line--done' : ''}`} />
        <div className={`step-circle ${createdSortie ? 'step-circle--active' : 'step-circle--pending'}`}>3</div>
        <Text size="sm" fw={createdSortie ? 600 : 400} c={createdSortie ? 'var(--mantine-color-text)' : 'dimmed'}>
          Affectation
        </Text>
      </div>

      <Group justify="flex-end" gap="xs" mb="sm" wrap="wrap">
        <Text size="xs" fw={600} c="dimmed">Légende :</Text>
        <span className="seat-dot" style={{ background: '#4CAF50', display: 'inline-block' }} />
        <Text size="xs" c="dimmed">Libre</Text>
        <span className="seat-dot" style={{ background: '#D32F2F', display: 'inline-block' }} />
        <Text size="xs" c="dimmed">Occupé</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md" mb="xl">
        {vehicles
          .filter((v) => v.status === 'available' || (createdSortie && v.id === selectedVehicle?.id))
          .map((vehicle) => {
            const isSelected = selectedVehicle?.id === vehicle.id;
            const vehSeatStates = isSelected ? seatStates : makeSeatStates(vehicle);
            const vehAssignments = isSelected ? seatAssignments : (occupancyByVehicle[vehicle.id]?.occupants || []);
            return (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                seatStates={vehSeatStates}
                isSelected={isSelected}
                onClick={() => handleSelectVehicle(vehicle)}
                requestsBySeat={vehAssignments}
              />
            );
          })}
      </SimpleGrid>

      {createdSortie && selectedVehicle && (
        <>

          {createdSortie && (
            <>
              <Group justify="space-between" mb="md">
                <Group gap="sm">
                  <IconUsers size={20} color="light-dark(var(--mantine-color-brand-6), #7BC88A)" />
                  <Text fw={600}>Demandes compatibles</Text>
                  <Badge color="brandYellow" variant="light" size="sm">
                    {compatibleRequests.length} disponible{compatibleRequests.length !== 1 ? 's' : ''}
                  </Badge>
                </Group>
              </Group>

              {compatibleRequests.length === 0 ? (
                <Paper p="xl" radius="lg" withBorder className="glass-panel">
                  <Center h={120}>
                    <Stack align="center" gap={6}>
                      <IconUsers size={32} color="var(--mantine-color-gray-4)" />
                      <Text c="dimmed" size="sm">Aucune demande compatible pour {createdSortie.destination}</Text>
                    </Stack>
                  </Center>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="xl">
                  {compatibleRequests.map((req) => (
                    <RequestCard
                      key={req.id}
                      request={req}
                      onAdd={handleAddRequest}
                      adding={adding}
                      disabled={availableCount < (req.nb_personnes || 1)}
                    />
                  ))}
                </SimpleGrid>
              )}
            </>
          )}
        </>
      )}

      <VehicleModal
        opened={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        vehicle={selectedVehicle}
        onConfirm={handleCreateSortie}
        confirmLabel="Créer la sortie"
        loading={creating}
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Conducteur"
            placeholder="Nom du conducteur"
            value={driverName}
            onChange={(e) => setDriverName(e.currentTarget.value)}
            required
            radius="md"
            leftSection={<IconSteeringWheel size={16} />}
          />
          <TextInput
            label="Destination"
            placeholder="Antananarivo"
            value={destination}
            onChange={(e) => setDestination(e.currentTarget.value)}
            required
            radius="md"
            leftSection={<IconMapPin size={16} />}
          />
          <NumberInput
            label="Kilométrage départ"
            placeholder={lastSortieLoading ? 'Chargement...' : 'km compteur au départ'}
            value={departureKm}
            onChange={setDepartureKm}
            min={0}
            step={1}
            radius="md"
            leftSection={<IconGauge size={16} />}
            disabled={lastSortieLoading}
          />
          <DateTimePicker
            label="Date et heure de départ"
            placeholder="Choisir une date"
            value={departureTime}
            onChange={setDepartureTime}
            minDate={new Date()}
            required
            radius="md"
          />
        </SimpleGrid>
      </VehicleModal>
    </div>
  );
}

export default CreateSortie;
