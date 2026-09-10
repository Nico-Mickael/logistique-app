import { Paper, Group, Text, ThemeIcon } from '@mantine/core';

export default function StatCard({ label, value, icon: Icon, color = 'brand' }) {
  return (
    <Paper p="md" radius="lg" withBorder h="100%">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
        <div style={{ minWidth: 0 }}>
          <Text size="xs" fw={500} tt="uppercase" c="dimmed" mb={4} truncate>
            {label}
          </Text>
          <Text fz={{ base: 20, sm: 22 }} fw={700} lh={1.2}>{value}</Text>
        </div>
        <ThemeIcon variant="light" color={color} size={32} radius={10}>
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}