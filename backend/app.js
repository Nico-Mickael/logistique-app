require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/sorties', require('./routes/sortieRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/sites', require('./routes/siteRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/conversations', require('./routes/conversationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route API introuvable' });
});

app.use((err, req, res, next) => {
  const e = err || {};
  const status = e.status || e.statusCode || 500;
  if (status >= 500) {
    console.error('Erreur non gérée:', err);
  }
  res.status(status).json({ message: status >= 500 ? 'Erreur interne du serveur' : (e.message || 'Erreur') });
});

module.exports = app;