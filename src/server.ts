import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDb } from './db/client.js';
import collectorRoutes from './collector/routes.js';
import configRoutes from './config/routes.js';
import probeRoutes from './probe/routes.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(null, false);
  },
  methods: ['GET', 'POST'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(collectorRoutes);
app.use(configRoutes);
app.use(probeRoutes);

async function start() {
  await initDb();
  app.listen(PORT, () => console.log(`br-collector listening on :${PORT}`));
}

start().catch((err) => { console.error('Failed to start:', err); process.exit(1); });

export default app;
