import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

// Éditeur d'itinéraire multi-étapes : liste ordonnée des lieux de passage
// avant la destination finale. `value` = tableau de chaînes, `onChange` renvoie
// le nouveau tableau (étapes vides ignorées à l'envoi).
export default function StopsEditor({ value = [], onChange, maxStops = 8 }) {
  const stops = Array.isArray(value) ? value : [];

  const update = (index, text) => {
    const next = stops.map((s, i) => (i === index ? text : s));
    onChange(next);
  };

  const remove = (index) => {
    onChange(stops.filter((_, i) => i !== index));
  };

  const add = () => {
    if (stops.length >= maxStops) return;
    onChange([...stops, '']);
  };

  return (
    <div>
      {stops.length > 0 && (
        <Stack gap={6} mb={6}>
          {stops.map((stop, i) => (
            <Group key={i} gap={6} wrap="nowrap" align="flex-start">
              <Text size="sm" fw={600} c="dimmed" style={{ paddingTop: 8, minWidth: 22 }}>
                {i + 1}
              </Text>
              <TextInput
                placeholder={`Étape ${i + 1} (ex: faire une pause à ...)`}
                value={stop}
                onChange={(e) => update(i, e.currentTarget.value)}
                radius="md"
                style={{ flex: 1 }}
              />
              <Button size="xs" variant="subtle" color="red"
                onClick={() => remove(i)}
                leftSection={<IconTrash size={14} />}
                style={{ marginTop: 2 }}
              >
                Retirer
              </Button>
            </Group>
          ))}
        </Stack>
      )}
      {stops.length < maxStops && (
        <Button size="xs" variant="subtle" color="brand"
          onClick={add}
          leftSection={<IconPlus size={14} />}
          disabled={stops.some((s) => !s.trim())}
        >
          Ajouter une étape
        </Button>
      )}
      <Text size="xs" c="dimmed" mt={6}>
        Lieux de passage avant la destination finale ({stops.filter((s) => s.trim()).length}/{maxStops}).
      </Text>
    </div>
  );
}