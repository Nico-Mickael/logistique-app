import { Stack, Group, Text } from '@mantine/core';
import { IconRoute } from '@tabler/icons-react';

export default function SortieItinerary({ stops, destination, size = 'sm', label = 'Itinéraire' }) {
  const list = Array.isArray(stops) ? stops : [];
  if (list.length === 0) return null;
  return (
    <Stack gap={3}>
      <Group gap={4}>
        <IconRoute size={14} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed" fw={600} style={{ textTransform: 'none' }}>{label}</Text>
      </Group>
      {list.map((stop, i) => (
        <Group key={i} gap={4} wrap="nowrap">
          <Text size={size} c="dimmed" w={20} style={{ flexShrink: 0 }}>{i + 1}.</Text>
          <Text size={size} style={{ wordBreak: 'break-word' }}>{stop}</Text>
        </Group>
      ))}
      <Group gap={4} wrap="nowrap">
        <Text size={size} c="dimmed" w={20} style={{ flexShrink: 0 }}>{list.length + 1}.</Text>
        <Text size={size} fw={600}>{destination}</Text>
      </Group>
    </Stack>
  );
}