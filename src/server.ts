import express from 'express';
import path from 'path';
import { AcDevice, WRITABLE } from './device';

const HOST = process.env.GREE_HOST;
const PORT = Number(process.env.PORT ?? 3000);
const BIND = process.env.BIND ?? '127.0.0.1';
const POLL = Number(process.env.POLL_INTERVAL ?? 3000);

if (!HOST) {
  console.error('Defina GREE_HOST com o IP do ar-condicionado (ex.: GREE_HOST=192.168.1.50).');
  console.error('Não sabe o IP? Rode: npm run discover');
  process.exit(1);
}

const ac = new AcDevice(HOST, POLL);
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/status', (_req, res) => {
  res.json(ac.snapshot);
});

app.get('/api/options', (_req, res) => {
  res.json(WRITABLE);
});

app.post('/api/set', async (req, res) => {
  try {
    await ac.set(req.body ?? {});
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: (err as Error).message });
  }
});

// Server-Sent Events: o painel recebe mudanças em tempo real, sem polling no navegador
app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  const send = (s: unknown) => res.write(`data: ${JSON.stringify(s)}\n\n`);
  send(ac.snapshot);
  const unsubscribe = ac.subscribe(send);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

const server = app.listen(PORT, BIND, () => {
  console.log(`Painel: http://${BIND === '0.0.0.0' ? 'localhost' : BIND}:${PORT}  (ar-condicionado em ${HOST})`);
});

const shutdown = async () => {
  server.close();
  await ac.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
