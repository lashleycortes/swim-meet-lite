const express = require('express');

function createApp(pool) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'meet-api' }));

  app.get('/', async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT m.id, m.name, m.venue, COALESCE(m.start_date, m.meet_date) AS start_date,
         COALESCE(m.end_date, m.meet_date) AS end_date, COUNT(r.id)::int AS registration_count
         FROM meets m LEFT JOIN registrations r ON r.meet_id=m.id GROUP BY m.id ORDER BY COALESCE(m.start_date,m.meet_date) ASC`
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Could not retrieve meets' }); }
  });

  app.post('/', async (req, res) => {
    const { name, venue, start_date, end_date, meet_date } = req.body || {};
    const start = start_date || meet_date;
    const end = end_date || start;
    if (![name, venue, start, end].every(v => typeof v === 'string' && v.trim()))
      return res.status(400).json({ error: 'name, venue, start_date, and end_date are required' });
    const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    if (!validDate(start) || !validDate(end)) return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format' });
    if (end < start) return res.status(400).json({ error: 'End date cannot be before start date' });
    try {
      const result = await pool.query(
        'INSERT INTO meets (name, venue, meet_date, start_date, end_date) VALUES ($1,$2,$3,$3,$4) RETURNING id,name,venue,start_date,end_date',
        [name.trim(), venue.trim(), start, end]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Could not create meet' }); }
  });

  app.get('/:meetId/registrations', async (req, res) => {
    const meetId = Number(req.params.meetId);
    if (!Number.isInteger(meetId) || meetId < 1) return res.status(400).json({ error: 'Valid meetId is required' });
    try {
      const result = await pool.query(
        'SELECT r.id AS registration_id, r.created_at AS registered_at, s.id AS swimmer_id, s.full_name, s.age, s.team FROM registrations r JOIN swimmers s ON s.id = r.swimmer_id WHERE r.meet_id = $1 ORDER BY s.team,s.full_name', [meetId]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Could not retrieve meet registrations' }); }
  });

  app.post('/:meetId/registrations', async (req, res) => {
    const meetId = Number(req.params.meetId), swimmerId = Number(req.body && req.body.swimmer_id);
    if (!Number.isInteger(meetId) || meetId < 1 || !Number.isInteger(swimmerId) || swimmerId < 1)
      return res.status(400).json({ error: 'Valid meetId and swimmer_id are required' });
    try {
      const result = await pool.query('INSERT INTO registrations (swimmer_id, meet_id) VALUES ($1,$2) RETURNING id,swimmer_id,meet_id,created_at', [swimmerId, meetId]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: 'Swimmer or meet not found' });
      if (err.code === '23505') return res.status(409).json({ error: 'Swimmer is already registered for this meet' });
      res.status(500).json({ error: 'Could not register swimmer' });
    }
  });

  app.post('/:meetId/registrations/team', async (req, res) => {
    const meetId = Number(req.params.meetId), team = req.body && req.body.team;
    if (!Number.isInteger(meetId) || meetId < 1 || typeof team !== 'string' || !team.trim())
      return res.status(400).json({ error: 'A valid meetId and team are required' });
    try {
      const result = await pool.query(
        `INSERT INTO registrations (swimmer_id, meet_id)
         SELECT s.id, $1 FROM swimmers s WHERE LOWER(TRIM(s.team)) = LOWER(TRIM($2))
         ON CONFLICT (swimmer_id, meet_id) DO NOTHING RETURNING swimmer_id`, [meetId, team.trim()]
      );
      if (!result.rowCount) {
        const check = await pool.query('SELECT COUNT(*)::int AS count FROM swimmers WHERE LOWER(TRIM(team))=LOWER(TRIM($1))', [team.trim()]);
        if (!Number(check.rows[0]?.count)) return res.status(404).json({ error: 'No swimmers found for this team' });
      }
      res.status(201).json({ team: team.trim(), registered_count: result.rowCount, message: `${result.rowCount} swimmer(s) added; already-registered swimmers were skipped.` });
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: 'Meet not found' });
      res.status(500).json({ error: 'Could not register team' });
    }
  });
  return app;
}
module.exports = { createApp };
