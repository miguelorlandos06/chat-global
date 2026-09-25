// server.js
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';

import { CONFIG } from './config.js';
import { initDatabase, pool } from './database.js';
import { initWebSocket } from './ws.js';
import authRoutes from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = CONFIG.server.port;

app.set('trust proxy', 1);

// ============ MIDDLEWARES ============
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', rateLimit({
  windowMs: CONFIG.rateLimit.global.windowMs,
  max: CONFIG.rateLimit.global.max,
  message: { message: 'Demasiadas peticiones' }
}));

const authLimiter = rateLimit({
  windowMs: CONFIG.rateLimit.auth.windowMs,
  max: CONFIG.rateLimit.auth.max,
  message: { message: 'Demasiados intentos' }
});

// ============ ESTÁTICOS ============
app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ============ RUTAS API ============
app.use('/api/auth', authLimiter, authRoutes);

// ============ HEALTH ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// ============ 404 ============
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Error del servidor' });
});

// ============ ARRANQUE ============
(async () => {
  try {
    await initDatabase();

    const server = http.createServer(app);
    initWebSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('=======================================');
      console.log('     CHATGLOBAL SERVER');
      console.log('=======================================');
      console.log(`Servidor:   http://0.0.0.0:${PORT}`);
      console.log(`WebSocket:  ws://0.0.0.0:${PORT}/ws`);
      console.log(`PostgreSQL: ${CONFIG.postgres.database}`);
      console.log('');
    });
  } catch (err) {
    console.error('Error iniciando servidor:', err);
    process.exit(1);
  }
})();

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGINT', () => {
  console.log('\nCerrando...');
  pool.end().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  pool.end().then(() => process.exit(0));
});
