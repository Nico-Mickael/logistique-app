import { Modal, Text, Group, Button, Stack, Box } from '@mantine/core';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

const variants = {
  warning: { icon: IconAlertTriangle, iconColor: '#F5B301', bg: '#FFF9E5', btn: '#D32F2F' },
  danger: { icon: IconAlertTriangle, iconColor: '#D32F2F', bg: '#FFEBEE', btn: '#D32F2F' },
  question: { icon: IconAlertCircle, iconColor: '#3FA34A', bg: '#E8F5E9', btn: '#2E7D32' },
  info: { icon: IconInfoCircle, iconColor: '#3FA34A', bg: '#E8F5E9', btn: '#3FA34A' },
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
  const v = variants[variant] || variants.warning;
  const Icon = v.icon;

  return (
    <Modal opened={opened} onClose={onClose} size="sm" radius="lg" centered withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      transitionProps={{ transition: 'fade', duration: 200 }}
      styles={{ title: { fontWeight: 600, fontSize: '1.05rem' } }}
    >
      <Stack gap="lg" align="center" pt="xs" pb="xs">
        <Box
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: v.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={28} color={v.iconColor} />
        </Box>

        <Stack gap={4} align="center">
          <Text fw={600} size="md" ta="center">{title}</Text>
          <Text size="sm" c="dimmed" ta="center" maw={320}>{message}</Text>
        </Stack>

        <Group gap="sm" w="100%" mt="xs">
          <Button variant="default" radius="md" onClick={onClose} style={{ flex: 1 }}>
            {cancelLabel}
          </Button>
          <Button radius="md" color={v.btn} onClick={onConfirm} loading={loading} style={{ flex: 1 }}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
