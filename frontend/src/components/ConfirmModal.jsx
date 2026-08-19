import { Modal, Text, Group, Button, Stack } from '@mantine/core';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

const iconMap = {
  warning: <IconAlertTriangle size={28} color="#F5B301" />,
  danger: <IconAlertTriangle size={28} color="#D32F2F" />,
  question: <IconAlertCircle size={28} color="#3FA34A" />,
  info: <IconInfoCircle size={28} color="#3FA34A" />,
};

const colorMap = {
  warning: '#D32F2F',
  danger: '#D32F2F',
  question: '#2E7D32',
  info: '#3FA34A',
};

export default function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'warning',
  loading = false,
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm" radius="md" centered
      overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      transitionProps={{ transition: 'fade', duration: 200 }}
    >
      <Stack gap="md" align="center" py="sm">
        {iconMap[variant]}
        <Text size="sm" ta="center" c="dimmed">{message}</Text>
        <Group justify="end" w="100%" mt="sm">
          <Button variant="default" onClick={onClose} radius="md">{cancelLabel}</Button>
          <Button color={colorMap[variant]} onClick={onConfirm} loading={loading} radius="md">
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
