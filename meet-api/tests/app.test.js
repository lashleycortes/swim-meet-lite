
const request = require('supertest');
const { createApp } = require('../src/app');

function fakePool(overrides = {}) {
  const pool = {
    query: jest.fn(async (sql, params = []) => {
      if (sql.includes('INSERT INTO meets')) {
        return {
          rows: [{
            id: 1,
            name: params[0],
            venue: params[1],
            start_date: params[2],
            end_date: params[3],
          }],
          rowCount: 1,
        };
      }

      if (
        sql.includes('INSERT INTO registrations') &&
        sql.includes('SELECT s.id')
      ) {
        return {
          rows: [{ swimmer_id: 11 }, { swimmer_id: 12 }],
          rowCount: 2,
        };
      }

      if (sql.includes('INSERT INTO registrations')) {
        return {
          rows: [{
            id: 1,
            swimmer_id: params[0],
            meet_id: params[1],
            created_at: '2030-01-01T00:00:00.000Z',
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('SELECT m.id')) {
        return {
          rows: [{
            id: 1,
            name: 'Test Meet',
            venue: 'Pool',
            start_date: '2030-01-01',
            end_date: '2030-01-02',
            registration_count: 1,
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('SELECT r.id AS registration_id')) {
        return {
          rows: [{
            registration_id: 1,
            registered_at: '2030-01-01T00:00:00.000Z',
            swimmer_id: 11,
            full_name: 'Alex Santos',
            age: 15,
            team: 'Patriots',
          }],
          rowCount: 1,
        };
      }

      if (sql.includes('SELECT COUNT(*)::int AS count FROM swimmers')) {
        return { rows: [{ count: 0 }], rowCount: 1 };
      }

      throw new Error(`Unexpected query in test: ${sql}`);
    }),
  };

  return { ...pool, ...overrides };
}

describe('Meet API', () => {
  let app;
  let pool;

  beforeEach(() => {
    pool = fakePool();
    app = createApp(pool);
  });

  test('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.service).toBe('meet-api');
    expect(res.body.status).toBe('ok');
  });

  test('POST / creates a meet with start and end dates', async () => {
    const res = await request(app).post('/').send({
      name: 'North Luzon Invite',
      venue: 'Aquatic Center',
      start_date: '2030-01-01',
      end_date: '2030-01-03',
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('North Luzon Invite');
    expect(res.body.start_date).toBe('2030-01-01');
    expect(res.body.end_date).toBe('2030-01-03');
  });

  test('POST / supports the legacy meet_date field', async () => {
    const res = await request(app).post('/').send({
      name: 'Legacy Meet',
      venue: 'Main Pool',
      meet_date: '2030-02-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.start_date).toBe('2030-02-01');
    expect(res.body.end_date).toBe('2030-02-01');
  });

  test('POST / rejects missing required fields', async () => {
    const res = await request(app).post('/').send({
      name: 'Incomplete',
    });

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('POST / rejects an end date earlier than the start date', async () => {
    const res = await request(app).post('/').send({
      name: 'Invalid Date Meet',
      venue: 'Pool',
      start_date: '2030-01-10',
      end_date: '2030-01-09',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/End date cannot be before start date/i);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('POST / rejects invalid date formats', async () => {
    const res = await request(app).post('/').send({
      name: 'Bad Format Meet',
      venue: 'Pool',
      start_date: '01/10/2030',
      end_date: '01/11/2030',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/YYYY-MM-DD/i);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('GET / lists meets with registration counts', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Test Meet');
    expect(res.body[0].registration_count).toBe(1);
  });

  test('GET /:meetId/registrations returns the selected meet roster', async () => {
    const res = await request(app).get('/1/registrations');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      swimmer_id: 11,
      full_name: 'Alex Santos',
      team: 'Patriots',
    });
  });

  test('GET /:meetId/registrations rejects an invalid meet ID', async () => {
    const res = await request(app).get('/abc/registrations');

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('POST /:meetId/registrations registers one swimmer', async () => {
    const res = await request(app)
      .post('/1/registrations')
      .send({ swimmer_id: 11 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      swimmer_id: 11,
      meet_id: 1,
    });
  });

  test('POST /:meetId/registrations rejects invalid IDs', async () => {
    const res = await request(app)
      .post('/0/registrations')
      .send({ swimmer_id: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('POST /:meetId/registrations returns 409 for duplicate registration', async () => {
    const duplicatePool = {
      query: jest.fn(async () => {
        const error = new Error('duplicate registration');
        error.code = '23505';
        throw error;
      }),
    };

    const duplicateApp = createApp(duplicatePool);

    const res = await request(duplicateApp)
      .post('/1/registrations')
      .send({ swimmer_id: 11 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  test('POST /:meetId/registrations returns 404 for missing records', async () => {
    const missingPool = {
      query: jest.fn(async () => {
        const error = new Error('foreign key violation');
        error.code = '23503';
        throw error;
      }),
    };

    const missingApp = createApp(missingPool);

    const res = await request(missingApp)
      .post('/1/registrations')
      .send({ swimmer_id: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('POST /:meetId/registrations/team registers team swimmers', async () => {
    const res = await request(app)
      .post('/1/registrations/team')
      .send({ team: 'Patriots' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      team: 'Patriots',
      registered_count: 2,
    });
  });

  test('POST /:meetId/registrations/team rejects a missing team name', async () => {
    const res = await request(app)
      .post('/1/registrations/team')
      .send({ team: '   ' });

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('POST /:meetId/registrations/team returns 404 when no swimmers belong to the team', async () => {
    const emptyTeamPool = {
      query: jest.fn(async (sql) => {
        if (
          sql.includes('INSERT INTO registrations') &&
          sql.includes('SELECT s.id')
        ) {
          return { rows: [], rowCount: 0 };
        }

        if (sql.includes('SELECT COUNT(*)::int AS count FROM swimmers')) {
          return { rows: [{ count: 0 }], rowCount: 1 };
        }

        throw new Error(`Unexpected query in test: ${sql}`);
      }),
    };

    const emptyTeamApp = createApp(emptyTeamPool);

    const res = await request(emptyTeamApp)
      .post('/1/registrations/team')
      .send({ team: 'No Such Team' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No swimmers found/i);
  });
});
