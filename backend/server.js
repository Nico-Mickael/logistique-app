require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./models');
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/vehicles', vehicleRoutes);

const PORT = process.env.PORT || 5000;

db.sequelize.authenticate()
  .then(() => console.log('✅ Connexion PostgreSQL réussie'))
  .catch((err) => console.error('❌ Erreur de connexion PostgreSQL :', err.message));

app.listen(PORT, () => console.log(`Backend démarré sur le port ${PORT}`));