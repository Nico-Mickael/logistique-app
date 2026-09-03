import { Paper, Center, Flex, Text } from '@mantine/core';

export default function EmptyState({ icon: Icon, message, height = 160 }) {
  return (
    <Paper p="xl" radius="lg" withBorder>
      <Center h={height}>
        <Flex direction="column" align="center" gap={6}>
          <Icon size={28} color="var(--mantine-color-gray-5)" />
          <Text c="dimmed" size="sm">{message}</Text>
        </Flex>
      </Center>
    </Paper>
  );
}
