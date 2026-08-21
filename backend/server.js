require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const db = require('./models');
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const sortieRoutes = require('./routes/sortieRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const importRoutes = require('./routes/importRoutes');
const statsRoutes = require('./routes/statsRoutes');
const { setupSocket } = require('./services/socketService');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET non défini dans les variables d\'environnement');
  process.exit(1);
}

const app = express();
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
app.use('/api/employees', employeeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/stats', statsRoutes);

app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
setupSocket(server);

const start = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Connexion PostgreSQL réussie');
    server.listen(PORT, () => console.log(`Backend démarré sur le port ${PORT}`));
  } catch (err) {
    console.error('❌ Erreur de connexion PostgreSQL :', err.message);
    process.exit(1);
  }
};

start();