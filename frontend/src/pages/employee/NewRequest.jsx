import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Paper, Title, Text, Group, Stack, Badge, Button, TextInput, Textarea,
  NumberInput, Loader, Center, Avatar, SimpleGrid,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconCar, IconUsers, IconMapPin, IconClock, IconSend,
  IconBuildingWarehouse, IconUser, IconHourglass,
} from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import dayjs from '../../utils/date';
import { vehicleService } from '../../api/vehicleService';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';

function getSeatLayout(type, capacity) {
  if (type === 'moto') {
    return {
      w: 180, h: 90, bodyW: 140, bodyH: 70,
      seats: [
        { id: 0, label: 'Conducteur', x: 20, y: 10, w: 40, h: 28 },
        { id: 1, label: 'Passager', x: 80, y: 10, w: 40, h: 28 },
      ],
    };
  }
  if (type === 'minibus' || capacity > 8) {
    const rows = Math.ceil((capacity - 1) / 4);
    const seats = [
      { id: 0, label: 'Conducteur', x: 22, y: 4, w: 32, h: 22 },
      { id: 1, label: 'Passager', x: 74, y: 4, w: 32, h: 22 },
    ];
    let sid = 2;
    for (let r = 0; r < rows; r++) {
      const cols = Math.min(4, capacity - sid);
      const rowX = 10;
      const rowY = 36 + r * 34;
      const spacing = (120 - cols * 28) / (cols + 1);
      for (let c = 0; c < cols; c++) {
        seats.push({
          id: sid++, label: `R${r + 1}-C${c + 1}`,
          x: Math.round(rowX + spacing + c * (28 + spacing)),
          y: rowY, w: 28, h: 22,
        });
      }
    }
    return { w: 220, h: 40 + rows * 34 + 10, bodyW: 160, bodyH: 30 + rows * 34 + 10, seats };
  }
  const seats = [
    { id: 0, label: 'Conducteur', x: 20, y: 6, w: 38, h: 26 },
    { id: 1, label: 'Passager', x: 82, y: 6, w: 38, h: 26 },
    { id: 2, label: 'Arrière G', x: 10, y: 52, w: 34, h: 26 },
    { id: 3, label: 'Arrière C', x: 53, y: 52, w: 34, h: 26 },
    { id: 4, label: 'Arrière D', x: 96, y: 52, w: 34, h: 26 },
  ];
  return { w: 220, h: 100, bodyW: 160, bodyH: 90, seats };
}

function seatColor(state) {
  switch (state) {
    case 'occupied': return { fill: '#D32F2F', stroke: '#B71C1C' };
    case 'reserved': return { fill: '#F5B301', stroke: '#C79000' };
    case 'this_request': return { fill: '#2196F3', stroke: '#1565C0' };
    default: return { fill: '#4CAF50', stroke: '#388E3C' };
  }
}

function CarVisual({ vehicle, seatStates, compact, onClick }) {
  const layout = getSeatLayout(vehicle.type, vehicle.capacity);
  const svgW = layout.w;
  const svgH = layout.h;
  const bodyW = layout.bodyW;
  const bodyH = layout.bodyH;
  const bx = (svgW - bodyW) / 2;
  const by = (svgH - bodyH) / 2;
  const size = compact ? 0.6 : 1;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW * size} height={svgH * size} style={{ display: 'block' }}>
      <rect x={bx - 6} y={by - 4} width={bodyW + 12} height={bodyH + 12}
        rx={14} fill="#d0d0d0" opacity="0.3"
      />
      <defs>
        <linearGradient id="cb_nr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0f0f0" />
          <stop offset="100%" stopColor="#e0e0e0" />
        </linearGradient>
      </defs>
      <rect x={bx} y={by} width={bodyW} height={bodyH}
        rx={12} fill="url(#cb_nr)" stroke="#bbb" strokeWidth="1.5"
      />
      <path d={`M ${bx + 10} ${by + 6} L ${bx + bodyW / 3} ${by + 6} Q ${bx + bodyW / 3 + 10} ${by + 2} ${bx + bodyW / 3 + 20} ${by + 6} L ${bx + bodyW - 10} ${by + 6}`}
        fill="none" stroke="#a0a0a0" strokeWidth="1.5" opacity="0.6"
      />
      <rect x={bx + bodyW / 3 + 4} y={by + 3} width={bodyW / 3 - 8} height={4}
        rx={2} fill="#a8d4f0" opacity="0.5"
      />
      {layout.seats.map((seat) => {
        const state = seatStates[seat.id] || 'available';
        const colors = seatColor(state);
        const isThis = state === 'this_request';
        return (
          <g key={seat.id} style={{ cursor: onClick ? 'pointer' : 'default' }}
            onClick={() => onClick?.(seat.id)}
          >
            <rect x={bx + seat.x} y={by + seat.y}
              width={seat.w} height={seat.h} rx={5}
              fill={colors.fill} stroke={colors.stroke}
              strokeWidth={isThis ? 2.5 : 1}
              opacity={state === 'unavailable' ? 0.4 : 1}
              style={{ transition: 'all 0.3s ease' }}
            />
            {state === 'occupied' && (
              <text x={bx + seat.x + seat.w / 2} y={by + seat.y + seat.h / 2 + 1}
                textAnchor="middle" fontSize="8" fill="white" fontWeight="600"
              >👤</text>
            )}
            {state === 'reserved' && (
              <text x={bx + seat.x + seat.w / 2} y={by + seat.y + seat.h / 2 + 1}
                textAnchor="middle" fontSize="8" fill="white" fontWeight="600"
              >⏳</text>
            )}
            {state === 'this_request' && (
              <text x={bx + seat.x + seat.w / 2} y={by + seat.y + seat.h / 2 + 1}
                textAnchor="middle" fontSize="8" fill="white" fontWeight="600"
              >✓</text>
            )}
            {state === 'available' && (
              <text x={bx + seat.x + seat.w / 2} y={by + seat.y + seat.h / 2 + 1}
                textAnchor="middle" fontSize="7" fill="white" fontWeight="600"
              >{seat.id + 1}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function getNextDeparture(occupants) {
  if (!occupants?.length) return null;
  const now = Date.now();
  let nearest = null;
  for (const occ of occupants) {
    const t = new Date(occ.date_souhaitee).getTime();
    if (t > now && (!nearest || t < nearest)) {
      nearest = t;
    }
  }
  return nearest ? new Date(nearest) : null;
}

function CountdownDisplay({ targetDate, compact }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!targetDate || !(targetDate instanceof Date)) return null;
  const diff = targetDate.getTime() - now;
  if (diff <= 0) return <Text size="xs" c="red">Départ imminent</Text>;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  if (compact) {
    if (d > 0) return <Text size="xs" fw={600}>{d}j {h}h</Text>;
    return (
      <Text size="xs" fw={600}>
        <Text span c={h < 1 ? 'red' : 'brandYellow'}>{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</Text>
      </Text>
    );
  }

  return (
    <Paper p="md" radius="lg" withBorder style={{
      background: 'linear-gradient(135deg, rgba(245,179,1,0.08), rgba(245,179,1,0.02))',
      borderColor: 'rgba(245,179,1,0.2)',
    }}>
      <Group gap="sm" justify="center">
        <IconHourglass size={20} color="var(--mantine-color-brandYellow-6)" />
        <div style={{ textAlign: 'center' }}>
          {d > 0 && <Text size="xs" c="dimmed" mb={2}>Départ dans {d} jour{d > 1 ? 's' : ''}</Text>}
          <Text size="xl" fw={700} c={h < 1 ? '#D32F2F' : '#1f1f1f'}
            style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}
          >
            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
          </Text>
          <Text size="xs" c="dimmed">{dayjs(targetDate).format('DD/MM/YYYY HH:mm')}</Text>
        </div>
      </Group>
    </Paper>
  );
}

function VehicleSelectCard({ vehicle, isSelected, onSelect, seatStates, nextDeparture }) {
  const occupied = Object.values(seatStates).filter((s) => s === 'occupied').length;
  const reserved = Object.values(seatStates).filter((s) => s === 'reserved').length;
  const available = Object.values(seatStates).filter((s) => s === 'available').length;

  return (
    <Paper
      p="md"
      radius="lg"
      withBorder
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--mantine-color-brand-6)' : '1px solid #e0e0e0',
        background: isSelected ? 'rgba(46,125,50,0.03)' : '#fff',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="sm">
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(46,125,50,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <VehicleIcon type={vehicle.type} size={20} color="var(--mantine-color-brand-6)" />
          </div>
          <div>
            <Text fw={600} size="sm" tt="capitalize">{vehicle.type}</Text>
            <Group gap={4}>
              <IconUsers size={12} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">{vehicle.capacity} places</Text>
            </Group>
          </div>
        </Group>
        <Badge color={vehicle.status === 'available' ? 'brand' : 'gray'} variant="light" size="sm">
          {vehicle.status === 'available' ? 'Disponible' : vehicle.status === 'maintenance' ? 'Maintenance' : 'Occupé'}
        </Badge>
      </Group>

      {vehicle.status === 'available' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <CarVisual vehicle={vehicle} seatStates={seatStates} compact />
        </div>
      )}

      {vehicle.status === 'available' && (
        <Group gap="xs" mt="xs" justify="center" wrap="wrap">
          {available > 0 && (
            <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">{available} libre{available > 1 ? 's' : ''}</Text></>
          )}
          {reserved > 0 && (
            <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5B301', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">{reserved} réservée{reserved > 1 ? 's' : ''}</Text></>
          )}
          {occupied > 0 && (
            <><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D32F2F', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">{occupied} occupée{occupied > 1 ? 's' : ''}</Text></>
          )}
        </Group>
      )}

      {nextDeparture && (
        <Group gap={4} mt="xs" justify="center">
          <IconClock size={12} color="var(--mantine-color-dimmed)" />
          <CountdownDisplay targetDate={nextDeparture} compact />
        </Group>
      )}
    </Paper>
  );
}

function NewRequest() {
  const [vehiclesData, setVehiclesData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [destination, setDestination] = useState('');
  const [motif, setMotif] = useState('');
  const [dateSouhaitee, setDateSouhaitee] = useState(null);
  const [nbPersonnes, setNbPersonnes] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [selectedOccupant, setSelectedOccupant] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data } = await vehicleService.getOccupancy();
        setVehiclesData(data.filter((v) => v.status === 'available'));
      } catch {
        notifyError('Impossible de charger les véhicules');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const buildSeatStates = (vehicle, vehicleData) => {
    const states = {};
    const layout = getSeatLayout(vehicle.type, vehicle.capacity);
    let seatIdx = 0;

    for (const occupant of vehicleData.occupants || []) {
      for (let i = 0; i < occupant.nb_personnes; i++) {
        if (seatIdx < layout.seats.length) {
          states[seatIdx] = occupant.status === 'approved' ? 'occupied' : 'reserved';
          occupant._seatIds = occupant._seatIds || [];
          occupant._seatIds.push(seatIdx);
          seatIdx++;
        }
      }
    }

    if (selectedVehicle?.id === vehicle.id) {
      for (let i = 0; i < nbPersonnes && seatIdx < layout.seats.length; i++) {
        if (!states[seatIdx] || states[seatIdx] === 'available') {
          states[seatIdx] = 'this_request';
          seatIdx++;
        }
      }
    }

    for (let i = 0; i < layout.seats.length; i++) {
      if (!states[i]) states[i] = 'available';
    }

    return states;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destination || !motif || !dateSouhaitee) {
      notifyError('Merci de remplir tous les champs');
      return;
    }
    if (!selectedVehicle) {
      notifyError('Veuillez sélectionner un véhicule');
      return;
    }
    setSubmitting(true);
    try {
      await requestService.create({
        destination,
        motif,
        date_souhaitee: dateSouhaitee,
        nb_personnes: nbPersonnes,
        vehicle_id: selectedVehicle.id,
      });
      notifySuccess('Demande envoyée avec succès');
      setDestination(''); setMotif(''); setDateSouhaitee(null);
      setNbPersonnes(1); setSelectedVehicle(null);
      const { data } = await vehicleService.getOccupancy();
      setVehiclesData(data.filter((v) => v.status === 'available'));
    } catch (err) {
      notifyError(err.response?.data?.message || "Erreur lors de l'envoi de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectVehicle = (vehicle) => {
    const vd = vehiclesData.find((v) => v.id === vehicle.id);
    if (vd) setSelectedVehicle({ ...vehicle, _data: vd });
    else setSelectedVehicle(vehicle);
    setSelectedOccupant(null);
  };

  const activeVehicleData = selectedVehicle
    ? vehiclesData.find((v) => v.id === selectedVehicle.id)
    : null;

  const { user } = useAuth();
  const myExistingRequest = useMemo(
    () => activeVehicleData?.occupants?.find((o) => o.employee_id === user?.id) || null,
    [activeVehicleData, user?.id]
  );

  const countdownTarget = useMemo(() => {
    if (dateSouhaitee) return dateSouhaitee;
    if (myExistingRequest?.date_souhaitee) return new Date(myExistingRequest.date_souhaitee);
    return null;
  }, [dateSouhaitee, myExistingRequest?.date_souhaitee]);

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">
      <style>{`
        .vehicle-select-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .vehicle-select-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
        .vehicle-select-card--selected { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.12); }
        .glass-panel { background: rgba(255,255,255,0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.3); }
        .capacity-bar { height: 6px; border-radius: 3px; background: #e9ecef; overflow: hidden; margin-top: 4px; }
        .capacity-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .detail-car { height: 200px; display: flex; align-items: center; justify-content: center; padding: 8px; }
      `}</style>

      <Title order={4} mb="lg">Nouvelle demande de sortie</Title>

      {vehiclesData.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder>
          <Center h={120}>
            <Stack align="center" gap={6}>
              <IconCar size={32} color="var(--mantine-color-gray-4)" />
              <Text c="dimmed" size="sm">Aucun véhicule disponible pour le moment</Text>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <>
          <Text size="sm" fw={600} mb="sm">
            <IconCar size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Choisissez un véhicule
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" mb="xl">
            {vehiclesData.map((vd) => {
              const isSelected = selectedVehicle?.id === vd.id;
              const nextDep = getNextDeparture(vd.occupants);
              return (
                <div key={vd.id} className={`vehicle-select-card ${isSelected ? 'vehicle-select-card--selected' : ''}`}
                  style={{ position: 'relative' }}
                >
                  <VehicleSelectCard
                    vehicle={vd}
                    isSelected={isSelected}
                    onSelect={() => handleSelectVehicle(vd)}
                    seatStates={buildSeatStates(vd, vd)}
                    nextDeparture={nextDep}
                  />
                  {isSelected && vd.occupants?.length > 0 && (
                    <Paper p="xs" radius="md" withBorder mt={4} style={{ background: '#fafafa' }}>
                      <Text size="xs" c="dimmed" fw={600} mb={4}>Occupants actuels</Text>
                      {vd.occupants.map((occ) => (
                        <Group key={occ.id} gap={4} mb={2}>
                          <Badge
                            size="sm" variant="light"
                            color={occ.status === 'approved' ? 'red' : 'brandYellow'}
                            leftSection={<IconUser size={10} />}
                          >
                            {occ.employee?.prenom} {occ.employee?.nom}
                          </Badge>
                        </Group>
                      ))}
                    </Paper>
                  )}
                </div>
              );
            })}
          </SimpleGrid>

          {selectedVehicle && activeVehicleData && (
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mb="xl">
              <Paper p="lg" radius="lg" className="glass-panel">
                <Group justify="space-between" mb="md">
                  <Group gap="sm">
                    <Text fw={600} size="md" tt="capitalize">{selectedVehicle.type}</Text>
                    <Badge color="brand" variant="light" size="sm">
                      {activeVehicleData.availableSeats} libre{activeVehicleData.availableSeats > 1 ? 's' : ''}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <span className="dot" style={{ background: '#4CAF50' }} />
                    <Text size="xs" c="dimmed">Libre</Text>
                    <span className="dot" style={{ background: '#F5B301' }} />
                    <Text size="xs" c="dimmed">Réservé</Text>
                    <span className="dot" style={{ background: '#D32F2F' }} />
                    <Text size="xs" c="dimmed">Occupé</Text>
                    <span className="dot" style={{ background: '#2196F3' }} />
                    <Text size="xs" c="dimmed">Votre place</Text>
                  </Group>
                </Group>

                <div className="detail-car" style={{ position: 'relative' }}>
                  <CarVisual
                    vehicle={selectedVehicle}
                    seatStates={buildSeatStates(selectedVehicle, activeVehicleData)}
                  />
                </div>

                {countdownTarget && <CountdownDisplay targetDate={countdownTarget} />}

                {activeVehicleData.occupants?.length > 0 && (
                  <Paper p="sm" radius="md" withBorder mt="sm" style={{ background: '#fafafa' }}>
                    <Text size="xs" fw={600} c="dimmed" mb="xs">Détails occupants</Text>
                    <Stack gap={4}>
                      {activeVehicleData.occupants.map((occ) => (
                        <Group key={occ.id} gap="sm" wrap="nowrap">
                          <Avatar color="brand" radius="xl" size="sm">
                            {`${occ.employee?.prenom?.[0] || ''}${occ.employee?.nom?.[0] || ''}`}
                          </Avatar>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={500} truncate>
                              {occ.employee?.prenom} {occ.employee?.nom}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {occ.destination} · {occ.employee?.department}
                            </Text>
                          </div>
                          <Badge size="xs" color={occ.status === 'approved' ? 'brand' : 'brandYellow'} variant="light">
                            {occ.status === 'approved' ? 'Validé' : 'En attente'}
                          </Badge>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                )}
              </Paper>

              <Paper p="lg" radius="lg" className="glass-panel">
                <Text fw={600} size="sm" mb="md">
                  <IconSend size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Détails de votre demande
                </Text>
                <form onSubmit={handleSubmit}>
                  <Stack gap="sm">
                    <TextInput
                      label="Destination"
                      placeholder="Antananarivo"
                      required
                      value={destination}
                      onChange={(e) => setDestination(e.currentTarget.value)}
                      leftSection={<IconMapPin size={16} />}
                    />
                    <Textarea
                      label="Motif"
                      placeholder="Réunion client, livraison..."
                      required
                      minRows={3}
                      value={motif}
                      onChange={(e) => setMotif(e.currentTarget.value)}
                    />
                    <DateTimePicker
                      label="Date et heure de départ souhaitées"
                      placeholder="Choisir une date"
                      required
                      value={dateSouhaitee}
                      onChange={setDateSouhaitee}
                      minDate={new Date()}
                    />
                    <div>
                      <NumberInput
                        label="Nombre de personnes"
                        min={1}
                        max={Math.max(1, activeVehicleData.availableSeats)}
                        required
                        value={nbPersonnes}
                        onChange={(v) => {
                          setNbPersonnes(Math.min(v, Math.max(1, activeVehicleData.availableSeats)));
                          setSelectedOccupant(null);
                        }}
                        description={`Places disponibles: ${activeVehicleData.availableSeats}`}
                      />
                      <div className="capacity-bar" style={{ marginTop: 6 }}>
                        <div className="capacity-fill"
                          style={{
                            width: `${Math.min(100, ((activeVehicleData.occupiedSeats + nbPersonnes) / selectedVehicle.capacity) * 100)}%`,
                            background: (activeVehicleData.occupiedSeats + nbPersonnes) > selectedVehicle.capacity
                              ? '#D32F2F' : 'var(--mantine-color-brand-6)',
                          }}
                        />
                      </div>
                      <Group justify="space-between" mt={2}>
                        <Text size="xs" c="dimmed">
                          {activeVehicleData.occupiedSeats + nbPersonnes}/{selectedVehicle.capacity} places
                        </Text>
                        <Text size="xs" c="dimmed">
                          {activeVehicleData.availableSeats - nbPersonnes} restante{(activeVehicleData.availableSeats - nbPersonnes) > 1 ? 's' : ''}
                        </Text>
                      </Group>
                    </div>
                    <Button
                      type="submit" color="brand"
                      loading={submitting}
                      mt="sm" size="md"
                      leftSection={<IconSend size={16} />}
                      fullWidth
                    >
                      Envoyer la demande
                    </Button>
                  </Stack>
                </form>
              </Paper>
            </SimpleGrid>
          )}
        </>
      )}
    </div>
  );
}

export default NewRequest;
