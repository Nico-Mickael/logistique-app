import { useState } from 'react';
import { Paper, TextInput, Textarea, NumberInput, Button, Title, Stack } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
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
      await requestService.create({
        destination,
        motif,
        date_souhaitee: dateSouhaitee,
        nb_personnes: nbPersonnes,
      });
      notifySuccess('Demande envoyée avec succès');
      setDestination('');
      setMotif('');
      setDateSouhaitee(null);
      setNbPersonnes(1);
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erreur lors de l’envoi de la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper p="lg" radius="md" withBorder maw={520}>
      <Title order={4} mb="md">Nouvelle demande de sortie</Title>
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
          <Button type="submit" color="brand" loading={loading} mt="sm">
            Envoyer la demande
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

export default NewRequest;