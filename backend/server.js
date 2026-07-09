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
const { setupSocket } = require('./services/socketService');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/sorties', sortieRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/import', importRoutes);

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
setupSocket(server);

db.sequelize.authenticate()
  .then(() => console.log('✅ Connexion PostgreSQL réussie'))
  .catch((err) => console.error('❌ Erreur de connexion PostgreSQL :', err.message));

server.listen(PORT, () => console.log(`Backend démarré sur le port ${PORT}`));