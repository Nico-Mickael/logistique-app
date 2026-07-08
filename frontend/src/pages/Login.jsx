import { useState } from 'react';
import { Paper, TextInput, PasswordInput, Button, Title, Text, Stack, Divider } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notifySuccess, notifyError } from '../utils/toast';
import Logo from '../components/Logo';

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
    <div className="login-page">
      {/* Panneau gauche */}
      <div className="login-brand-panel">
        <Logo height={72} style={{ marginBottom: 28 }} />
        <Title order={1} className="login-title">
          Gestion logistique
        </Title>
        <Text c="dimmed" ta="center" mt="sm" maw={340} className="login-subtitle">
          Suivez chaque sortie et chaque demande de transport, du dépôt jusqu'à la livraison.
        </Text>

        <div className="login-stats">
          <div className="stat">
            <span className="stat-value">100%</span>
            <span className="stat-label">Traçabilité</span>
          </div>
          <Divider orientation="vertical" />
          <div className="stat">
            <span className="stat-value">Temps réel</span>
            <span className="stat-label">Suivi des sorties</span>
          </div>
        </div>
      </div>

      {/* Panneau droit */}
      <div className="login-form-panel">
        <svg
          className="route-graphic"
          viewBox="0 0 500 500"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            id="route-path"
            d="M -20 420 C 100 420, 120 300, 220 300 S 340 180, 460 160 S 520 40, 560 20"
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="3"
            strokeDasharray="2 14"
            strokeLinecap="round"
          />
          <circle cx="-20" cy="420" r="6" fill="rgba(255,255,255,0.35)" />
          <circle cx="220" cy="300" r="5" fill="rgba(255,255,255,0.3)" />
          <circle cx="460" cy="160" r="6" fill="rgba(255,255,255,0.35)" />
          <circle className="route-marker" r="7" fill="var(--mantine-color-brandYellow-5, #F5B301)">
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
              <mpath href="#route-path" />
            </animateMotion>
          </circle>
        </svg>

        <div className="login-orb login-orb--top" />
        <div className="login-orb login-orb--bottom" />

        <Paper p="xl" w="100%" maw={400} shadow="lg" radius="lg" withBorder className="login-card">
          <Title order={3} mb={4} c="#1f1f1f">
            Connexion
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            Connectez-vous avec votre adresse email
          </Text>
          <form onSubmit={handleSubmit}>
            <Stack>
              <TextInput
                label="Email"
                placeholder="votre@email.mg"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <PasswordInput
                label="Mot de passe"
                placeholder="Votre mot de passe"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <Button
                type="submit"
                color="brandYellow"
                loading={loading}
                fullWidth
                mt="sm"
                size="md"
                c="#1f1f1f"
                className="login-submit"
              >
                Se connecter
              </Button>
            </Stack>
          </form>
        </Paper>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
        }

        .login-brand-panel {
          flex: 1;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          text-align: center;
        }

        .login-title {
          font-size: 38px;
          line-height: 1.15;
          color: var(--mantine-color-brandYellow-6, #C98A00);
          letter-spacing: -0.02em;
        }

        .login-subtitle {
          line-height: 1.5;
        }

        .login-stats {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-top: 36px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-value {
          font-weight: 700;
          font-size: 18px;
          color: #1f1f1f;
        }

        .stat-label {
          font-size: 12px;
          color: #868e96;
        }

        .login-form-panel {
          flex: 1;
          background: linear-gradient(135deg, #2E7D32 0%, #1B5E20 50%, #0D3310 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
          overflow: hidden;
        }

        .route-graphic {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .login-orb {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.03);
          pointer-events: none;
        }

        .login-orb--top {
          top: -100px;
          right: -100px;
          width: 400px;
          height: 400px;
        }

        .login-orb--bottom {
          bottom: -80px;
          left: -80px;
          width: 300px;
          height: 300px;
        }

        .login-card {
          background: rgba(255,255,255,0.97);
          position: relative;
          animation: card-in 0.5s ease-out;
        }

        .login-submit {
          transition: transform 0.15s ease;
        }

        .login-submit:hover {
          transform: translateY(-1px);
        }

        @keyframes card-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-card { animation: none; }
          .route-marker animateMotion { display: none; }
        }

        @media (max-width: 768px) {
          .login-page {
            flex-direction: column;
          }
          .login-brand-panel {
            padding: 32px 20px;
            flex: none;
          }
          .login-stats {
            margin-top: 24px;
          }
          .login-form-panel {
            padding: 24px 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default Login;