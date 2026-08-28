import { Modal, Group, Button, Stack } from '@mantine/core';

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
      title={vehicle ? `${vehicle.type} (${vehicle.capacity} places)` : 'Véhicule'}
      size="md"
      radius="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      transitionProps={{ transition: 'pop', duration: 200 }}
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
