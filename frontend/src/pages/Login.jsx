import { useState } from 'react';
import { Paper, TextInput, PasswordInput, Button, Title, Stack, Center } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notifySuccess, notifyError } from '../utils/toast';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      notifySuccess(`Bienvenue ${user.prenom}`);
      navigate('/');
    } catch (err) {
      notifyError(err.response?.data?.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center h="100vh" style={{ background: '#F5F9F5' }}>
      <Paper p="xl" radius="md" withBorder w={380}>
        <Title order={3} ta="center" mb="lg" c="brand.8">Connexion</Title>
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="votre@email.mg"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Mot de passe"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Button type="submit" color="brand" loading={loading} fullWidth mt="sm">
              Se connecter
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}

export default Login;