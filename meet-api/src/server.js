const { Pool } = require('pg');
const { createApp } = require('./app');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'swimmeet',
  user: process.env.DB_USER || 'swimmeet_user',
  password: process.env.DB_PASSWORD || 'change_this_local_password'
});
const app = createApp(pool);
const port = Number(process.env.PORT || 3001);
pool.query('ALTER TABLE meets ADD COLUMN IF NOT EXISTS start_date DATE')
  .then(() => pool.query('ALTER TABLE meets ADD COLUMN IF NOT EXISTS end_date DATE'))
  .then(() => pool.query('UPDATE meets SET start_date = COALESCE(start_date, meet_date), end_date = COALESCE(end_date, meet_date)'))
  .then(() => app.listen(port, () => console.log(`Meet API listening on ${port}`)))
  .catch(err => { console.error('Could not initialize meet date columns', err); process.exit(1); });
