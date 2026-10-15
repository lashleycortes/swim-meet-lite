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
const port = Number(process.env.PORT || 3000);
pool.query(`CREATE TABLE IF NOT EXISTS teams (id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  .then(() => pool.query("INSERT INTO teams(name) SELECT DISTINCT TRIM(team) FROM swimmers WHERE TRIM(team) <> '' ON CONFLICT (name) DO NOTHING"))
  .then(() => app.listen(port, () => console.log(`Swimmer API listening on ${port}`)))
  .catch(err => { console.error('Could not initialize teams table', err); process.exit(1); });
