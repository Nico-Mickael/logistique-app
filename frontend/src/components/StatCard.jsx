import { Paper, Group, Text, ThemeIcon } from '@mantine/core';

export default function StatCard({ label, value, icon: Icon, color = 'brand' }) {
  return (
    <Paper p="md" radius="lg" withBorder>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text size="xs" fw={500} tt="uppercase" c="dimmed" mb={4}>{label}</Text>
          <Text fz={22} fw={700} lh={1}>{value}</Text>
        </div>
        <ThemeIcon variant="light" color={color} size={32} radius={10}>
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
