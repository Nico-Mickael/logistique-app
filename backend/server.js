require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const db = require('./models');
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const sortieRoutes = require('./routes/sortieRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const pushRoutes = require('./routes/pushRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const statsRoutes = require('./routes/statsRoutes');
const exportRoutes = require('./routes/exportRoutes');
const { setupSocket } = require('./services/socketService');
const { start: startSortieScheduler } = require('./services/sortieScheduler');
const { configure: configureWebPush } = require('./services/webPushService');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET non défini dans les variables d\'environnement');
  process.exit(1);
}

const app = express();

// Derrière le reverse proxy nginx (frontend/nginx.conf pose X-Forwarded-For),
// req.ip reflète l'IP réelle du client. Sinon toutes les requêtes partagent
// l'IP du proxy → les limiteurs traiteraient tous les utilisateurs comme un seul.
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/sorties', sortieRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/export', exportRoutes);

// --- Hébergement du frontend (build statique) en mode "serveur unique" ---
// Un seul processus sert à la fois l'API et l'application React (SPA).
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.SERVE_FRONTEND !== 'false' && fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  // Fallback SPA : renvoie index.html pour toute requête GET hors /api
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    return next();
  });
  console.log(`🖥️  Frontend servi depuis ${frontendDist}`);
} else if (process.env.SERVE_FRONTEND === 'false') {
  console.log('Servir le frontend est désactivé (SERVE_FRONTEND=false)');
} else {
  console.log('⚠️  Build frontend introuvable, exécutez "npm run build" dans /frontend. API seule.');
}

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('Erreur non gérée:', err);
  }
  res.status(status).json({ message: status >= 500 ? 'Erreur interne du serveur' : (err.message || 'Erreur') });
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
setupSocket(server);

const start = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Connexion PostgreSQL réussie');
    if (configureWebPush()) {
      console.log('📲 Notifications push activées (Web Push / VAPID)');
    } else {
      console.log('📲 Notifications push désactivées — renseignez VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY (.env)');
    }
    // Notifications d'imminence : boucle périodique (anti-doublon via entité).
    startSortieScheduler();
    server.listen(PORT, () => {
      console.log(`Backend démarré sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Erreur de connexion PostgreSQL :', err.message);
    process.exit(1);
  }
};

start();