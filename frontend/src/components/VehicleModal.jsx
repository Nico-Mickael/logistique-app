import { Modal, Group, Button, Stack, ScrollArea } from '@mantine/core';
import { vehicleDisplayName } from '../utils/labels';

export default function VehicleModal({
  opened,
  onClose,
  vehicle,
  onConfirm,
  confirmLabel = 'Créer',
  confirmColor = 'brand',
  loading = false,
  children,
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={vehicle ? `${vehicleDisplayName(vehicle)} (${vehicle.capacity} places)` : 'Véhicule'}
      size="lg"
      radius="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      transitionProps={{ transition: 'pop', duration: 200 }}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md" mt="sm">
        {children}

        <Group justify="end" mt="md">
          <Button variant="default" onClick={onClose} radius="md">Annuler</Button>
          {onConfirm && (
            <Button onClick={onConfirm} loading={loading} color={confirmColor} radius="md">
              {confirmLabel}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
