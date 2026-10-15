const express = require('express');

function createApp(pool) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'swimmer-api' }));

  app.get('/teams', async (_req, res) => {
    try { const result = await pool.query("SELECT name FROM teams UNION SELECT DISTINCT TRIM(team) AS name FROM swimmers WHERE TRIM(team) <> '' ORDER BY name"); res.json(result.rows.map(r => r.name)); }
    catch (err) { res.status(500).json({ error: 'Could not retrieve teams' }); }
  });

  app.post('/teams', async (req, res) => {
    const name = req.body && req.body.name;
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Team name is required' });
    try {
      const result = await pool.query('INSERT INTO teams (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING name', [name.trim()]);
      res.status(201).json({ name: result.rows[0]?.name || name.trim(), already_exists: !result.rowCount });
    } catch (err) { res.status(500).json({ error: 'Could not create team' }); }
  });

  app.get('/', async (_req, res) => {
    try {
      const result = await pool.query('SELECT id, full_name, age, team, created_at FROM swimmers ORDER BY id DESC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Could not retrieve swimmers' });
    }
  });

  app.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid swimmer id' });
    try {
      const result = await pool.query('SELECT id, full_name, age, team, created_at FROM swimmers WHERE id = $1', [id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Swimmer not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Could not retrieve swimmer' });
    }
  });

  app.post('/', async (req, res) => {
    const { full_name, age, team = 'Independent' } = req.body || {};
    const parsedAge = Number(age);
    if (typeof full_name !== 'string' || !full_name.trim() || !Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      return res.status(400).json({ error: 'full_name and a valid age (1–120) are required' });
    }
    if (typeof team !== 'string' || !team.trim()) return res.status(400).json({ error: 'team must be a non-empty string' });
    try {
      const result = await pool.query(
        'INSERT INTO swimmers (full_name, age, team) VALUES ($1, $2, $3) RETURNING id, full_name, age, team, created_at',
        [full_name.trim(), parsedAge, team.trim()]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Could not create swimmer' });
    }
  });

  return app;
}
module.exports = { createApp };
