import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initPool, closePool, query } from './db.js';
import { ValidationError, HttpError, wrap, periodParam } from './util.js';
import { dashboard, drill, loadNames } from './reports.js';
import { router as accounts } from './accounts.js';
import { properties, units } from './properties.js';
import { router as tenants } from './tenants.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', wrap(async (req, res) => { await query('SELECT 1 FROM dual'); res.json({ ok: true }); }));
app.get('/api/dashboard', wrap(async (req, res) => res.json(await dashboard(req.query.property || null, periodParam(req.query.period)))));
app.get('/api/drill', wrap(async (req, res) => {
  const out = await drill(String(req.query.kind || ''), req.query.property || null, periodParam(req.query.period));
  if (!out) throw new HttpError(400, 'Unknown drill-down.'); res.json(out);
}));
app.use('/api/accounts', accounts);
app.use('/api/properties', properties);
app.use('/api/units', units);
app.use('/api/tenants', tenants);
app.get('/api/names', wrap(async (req, res) => res.json((await loadNames()).propertyList)));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof ValidationError) return res.status(400).json({ message: 'Please fix the highlighted fields.', errors: err.errors });
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server. Check the server log.' });
});

const port = Number(process.env.PORT) || 3001;
try {
  await initPool();
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
} catch (e) { console.error('Could not start:', e.message); process.exit(1); }
process.on('SIGINT', async () => { await closePool(); process.exit(0); });
