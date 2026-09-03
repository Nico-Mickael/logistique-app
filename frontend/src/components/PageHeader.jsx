import { Flex, Title, Text } from '@mantine/core';

export default function PageHeader({ title, subtitle, children }) {
  return (
    <Flex justify="space-between" align="flex-end" mb="lg" wrap="wrap" rowGap={4}>
      <div>
        <Title order={3}>{title}</Title>
        {subtitle && <Text size="sm" c="dimmed" mt={2}>{subtitle}</Text>}
      </div>
      {children}
    </Flex>
  );
}
