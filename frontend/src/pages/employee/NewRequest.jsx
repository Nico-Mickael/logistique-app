import { useEffect, useId, useRef, useState } from 'react';
import {
  Paper, Title, Text, Group, Stack, Badge, TextInput, Textarea,
  NumberInput, Loader, Center, Avatar, SimpleGrid, Grid,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconCar, IconUsers, IconMapPin, IconClock,
  IconUser, IconHourglass,
} from '@tabler/icons-react';
import VehicleIcon from '../../components/VehicleIcon';
import VehicleModal from '../../components/VehicleModal';
import dayjs from '../../utils/date';
import { vehicleService } from '../../api/vehicleService';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';
import { getSeatLayout, getSeatColor } from '../../utils/seatLayout';
import { vehicleStatusLabel, vehicleStatusColor, vehicleDisplayName } from '../../utils/labels';

function CarVisual({ vehicle, seatStates, compact, onClick }) {
  const gradientId = useId();
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
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0f0f0" />
          <stop offset="100%" stopColor="#e0e0e0" />
        </linearGradient>
      </defs>
      <rect x={bx} y={by} width={bodyW} height={bodyH}
        rx={12} fill={`url(#${gradientId})`} stroke="#bbb" strokeWidth="1.5"
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
  const [now, setNow] = useState(() => Date.now());

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
          <Text size="xl" fw={700} c={h < 1 ? '#D32F2F' : 'var(--mantine-color-text)'}
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

function VehicleSelectCard({ vehicle, isSelected, onSelect, seatStates, nextDeparture, occupants = [] }) {
  const occupied = Object.values(seatStates).filter((s) => s === 'occupied').length;
  const reserved = Object.values(seatStates).filter((s) => s === 'reserved').length;
  const available = Object.values(seatStates).filter((s) => s === 'available').length;

  return (
    <div className={`vehicle-flip ${isSelected ? 'vehicle-flip--selected' : ''}`}>
      <div className="vehicle-flip-inner" onClick={onSelect}>
        <div className="vehicle-flip-face vehicle-flip-front">
          <Paper
            p="md"
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
            <Group justify="space-between" mb="xs" wrap="wrap">
              <Group gap="sm" wrap="wrap" style={{ minWidth: 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(46,125,50,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <VehicleIcon type={vehicle.type} size={20} color="var(--mantine-color-brand-6)" />
                </div>
                <div>
                  <Text fw={600} size="sm">{vehicleDisplayName(vehicle)}</Text>
                  <Group gap={4}>
                    <IconUsers size={12} color="var(--mantine-color-dimmed)" />
                    <Text size="xs" c="dimmed">{vehicle.capacity} places</Text>
                  </Group>
                </div>
              </Group>
              <Badge color={vehicleStatusColor[vehicle.status] || 'gray'} variant="light" size="sm">
                {vehicleStatusLabel[vehicle.status] || vehicle.status || '—'}
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
                  <Text size="xs" c="dimmed">{available} libre{available > 1 ? 's' : ''}</Text>
                )}
                {reserved > 0 && (
                  <Text size="xs" c="dimmed">{reserved} réservée{reserved > 1 ? 's' : ''}</Text>
                )}
                {occupied > 0 && (
                  <Text size="xs" c="dimmed">{occupied} occupée{occupied > 1 ? 's' : ''}</Text>
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
        </div>

        <div className="vehicle-flip-face vehicle-flip-back">
          <Group justify="space-between" align="center" mb="sm">
            <Group gap={6}>
              <IconUsers size={15} color="var(--mantine-color-brand-6)" />
              <Text size="sm" fw={600}>Personnes à bord</Text>
            </Group>
            <Badge size="sm" variant="light" color="brand">
              {occupants.length}
            </Badge>
          </Group>
          {occupants.length === 0 ? (
            <Text c="dimmed" size="sm">Aucune personne à bord</Text>
          ) : (
            <Stack gap={6}>
              {occupants.map((occ) => (
                <Paper
                  key={occ.id}
                  p="xs"
                  radius="md"
                  withBorder
                  style={{ background: 'light-dark(#f6f7f9, rgba(255,255,255,0.05))' }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color="brand" radius="xl" size="sm">
                      {`${occ.employee?.prenom?.[0] || ''}${occ.employee?.nom?.[0] || ''}`}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <Text size="sm" fw={600} truncate>
                        {occ.employee?.prenom} {occ.employee?.nom}
                      </Text>
                      {occ.employee?.department && (
                        <Text size="xs" c="dimmed" truncate>{occ.employee.department}</Text>
                      )}
                    </div>
                    <Badge size="sm" variant="light" color={occ.status === 'approved' ? 'red' : 'yellow'} leftSection={<IconUser size={11} />}>
                      {occ.nb_personnes}
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

function NewRequest() {
  const [vehiclesData, setVehiclesData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [motif, setMotif] = useState('');
  const [dateSouhaitee, setDateSouhaitee] = useState(null);
  const [nbPersonnes, setNbPersonnes] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data } = await vehicleService.getOccupancy();
        setVehiclesData(data.filter((v) => v.requestable !== false));
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
    const maxSeats = Math.min(layout.seats.length, vehicle.capacity);
    let seatIdx = 0;

    for (const occupant of vehicleData.occupants || []) {
      for (let i = 0; i < occupant.nb_personnes; i++) {
        if (seatIdx < maxSeats) {
          states[seatIdx] = occupant.status === 'approved' ? 'occupied' : 'reserved';
          seatIdx++;
        }
      }
    }

    if (selectedVehicle?.id === vehicle.id) {
      for (let i = 0; i < nbPersonnes && seatIdx < maxSeats; i++) {
        if (!states[seatIdx] || states[seatIdx] === 'available') {
          states[seatIdx] = 'this_request';
          seatIdx++;
        }
      }
    }

    for (let i = 0; i < layout.seats.length; i++) {
      if (i >= vehicle.capacity) {
        if (!states[i] || states[i] === 'available') states[i] = 'unavailable';
      } else if (!states[i]) states[i] = 'available';
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
      setConfigModalOpen(false);
      setDestination(''); setMotif(''); setDateSouhaitee(null);
      setNbPersonnes(1); setSelectedVehicle(null);
      const { data } = await vehicleService.getOccupancy();
      setVehiclesData(data.filter((v) => v.requestable !== false));
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
    setConfigModalOpen(true);
  };

  const activeVehicleData = selectedVehicle
    ? vehiclesData.find((v) => v.id === selectedVehicle.id)
    : null;

  if (loading) return <Center h={300}><Loader color="brand" size="lg" /></Center>;

  return (
    <div className="page-content">

      <Title order={4} mb="lg">Nouvelle demande de sortie</Title>

      <div className="step-indicator">
        <div className={`step-circle ${selectedVehicle ? 'step-circle--done' : 'step-circle--active'}`}>1</div>
        <Text size="sm" fw={selectedVehicle ? 400 : 600} c={selectedVehicle ? 'dimmed' : 'var(--mantine-color-text)'}>
          Véhicule
        </Text>
        <div className={`step-line ${selectedVehicle ? 'step-line--done' : ''}`} />
        <div className={`step-circle ${selectedVehicle ? 'step-circle--active' : 'step-circle--pending'}`}>2</div>
        <Text size="sm" fw={selectedVehicle ? 600 : 400} c={selectedVehicle ? 'var(--mantine-color-text)' : 'dimmed'}>
          Détails de la demande
        </Text>
      </div>

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
          <Group justify="space-between" mb="sm" wrap="wrap" rowGap={4}>
            <Text size="sm" fw={600}>
              <IconCar size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Choisissez un véhicule
            </Text>
            <Group gap="xs" wrap="wrap">
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
                    occupants={vd.occupants || []}
                  />
                </div>
              );
            })}
          </SimpleGrid>

        </>
      )}

      <VehicleModal
        opened={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        vehicle={selectedVehicle}
        onConfirm={() => formRef.current?.requestSubmit()}
        confirmLabel="Envoyer la demande"
        loading={submitting}
      >
        {selectedVehicle && activeVehicleData && (
          <form ref={formRef} onSubmit={handleSubmit}>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Destination"
                  placeholder="Antananarivo"
                  required
                  w="100%"
                  value={destination}
                  onChange={(e) => setDestination(e.currentTarget.value)}
                  radius="md"
                  leftSection={<IconMapPin size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <DateTimePicker
                  label="Date et heure de départ souhaitées"
                  placeholder="Choisir une date"
                  required
                  w="100%"
                  value={dateSouhaitee}
                  onChange={setDateSouhaitee}
                  minDate={new Date()}
                  radius="md"
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Motif"
                  placeholder="Réunion client, livraison..."
                  required
                  w="100%"
                  minRows={2}
                  value={motif}
                  onChange={(e) => setMotif(e.currentTarget.value)}
                  radius="md"
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <div>
                  <NumberInput
                    label="Nombre de personnes"
                    min={1}
                    max={Math.max(1, activeVehicleData.availableSeats)}
                    required
                    w="100%"
                    value={nbPersonnes}
                    onChange={(v) => {
                      const val = Number(v) || 1;
                      setNbPersonnes(Math.min(val, Math.max(1, activeVehicleData.availableSeats)));
                    }}
                    radius="md"
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
              </Grid.Col>
            </Grid>
          </form>
        )}
      </VehicleModal>
    </div>
  );
}

export default NewRequest;
