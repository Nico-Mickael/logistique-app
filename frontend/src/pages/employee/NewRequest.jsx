import { useState } from 'react';
import { Paper, TextInput, Textarea, NumberInput, Button, Title, Text, Stack, Center, Flex } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconSend, IconClipboard } from '@tabler/icons-react';
import { requestService } from '../../api/requestService';
import { notifySuccess, notifyError } from '../../utils/toast';

function NewRequest() {
  const [destination, setDestination] = useState('');
  const [motif, setMotif] = useState('');
  const [dateSouhaitee, setDateSouhaitee] = useState(null);
  const [nbPersonnes, setNbPersonnes] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destination || !motif || !dateSouhaitee) {
      notifyError('Merci de remplir tous les champs');
      return;
    }
    setLoading(true);
    try {
      await requestService.create({ destination, motif, date_souhaitee: dateSouhaitee, nb_personnes: nbPersonnes });
      notifySuccess('Demande envoyée avec succès');
      setDestination(''); setMotif(''); setDateSouhaitee(null); setNbPersonnes(1);
    } catch (err) {
      notifyError(err.response?.data?.message || "Erreur lors de l'envoi de la demande");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 560, margin: '0 auto' }}>
      <Title order={3} mb="lg">Nouvelle demande de sortie</Title>

      <Paper p="lg" radius="lg" withBorder className="dashboard-panel">
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Destination"
              placeholder="Antananarivo"
              required
              value={destination}
              onChange={(e) => setDestination(e.currentTarget.value)}
            />
            <Textarea
              label="Motif"
              placeholder="Réunion client, livraison..."
              required
              minRows={3}
              value={motif}
              onChange={(e) => setMotif(e.currentTarget.value)}
            />
            <DateTimePicker
              label="Date et heure souhaitées"
              placeholder="Choisir une date"
              required
              value={dateSouhaitee}
              onChange={setDateSouhaitee}
              minDate={new Date()}
            />
            <NumberInput
              label="Nombre de personnes"
              min={1}
              max={30}
              required
              value={nbPersonnes}
              onChange={setNbPersonnes}
            />
            <Button type="submit" color="brand" loading={loading} mt="sm" size="md"
              leftSection={<IconSend size={16} />} className="btn-action"
            >
              Envoyer la demande
            </Button>
          </Stack>
        </form>
      </Paper>

      <style>{`
        .dashboard-panel {
          animation: panel-in 0.4s ease-out;
        }
        @keyframes panel-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .btn-action {
          transition: transform 0.15s ease;
        }
        .btn-action:hover {
          transform: translateY(-1px);
        }
        @media (prefers-reduced-motion: reduce) {
          .dashboard-panel { animation: none; }
          .btn-action { transition: none; }
        }
      `}</style>
    </div>
  );
}

export default NewRequest;
