
const request = require('supertest');
const { createApp } = require('../src/app');

function fakePool(overrides = {}) {
  const swimmers = [];
  const teams = [];
  let nextSwimmerId = 1;

  const pool = {
    query: jest.fn(async (sql, params = []) => {
      // Health checks do not query the database.

      // List teams, including teams assigned to swimmers.
      if (sql.includes('SELECT name FROM teams UNION')) {
        const names = new Set([
          ...teams.map((team) => team.name),
          ...swimmers
            .map((swimmer) => swimmer.team.trim())
            .filter(Boolean),
        ]);

        return {
          rows: [...names].sort().map((name) => ({ name })),
          rowCount: names.size,
        };
      }

      // Create a team.
      if (sql.includes('INSERT INTO teams')) {
        const name = params[0];
        const exists = teams.some((team) => team.name === name);

        if (exists) {
          return { rows: [], rowCount: 0 };
        }

        teams.push({ name });
        return { rows: [{ name }], rowCount: 1 };
      }

      // List swimmers.
      if (
        sql.startsWith(
          'SELECT id, full_name, age, team, created_at FROM swimmers ORDER BY'
        )
      ) {
        return {
          rows: [...swimmers].reverse(),
          rowCount: swimmers.length,
        };
      }

      // Retrieve a swimmer by ID.
      if (sql.includes('WHERE id = $1')) {
        const swimmer = swimmers.find(
          (item) => item.id === params[0]
        );

        return {
          rows: swimmer ? [swimmer] : [],
          rowCount: swimmer ? 1 : 0,
        };
      }

      // Register a swimmer.
      if (sql.includes('INSERT INTO swimmers')) {
        const swimmer = {
          id: nextSwimmerId++,
          full_name: params[0],
          age: params[1],
          team: params[2],
          created_at: new Date().toISOString(),
        };

        swimmers.push(swimmer);

        return {
          rows: [swimmer],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query in test: ${sql}`);
    }),
  };

  return { ...pool, ...overrides };
}

describe('Swimmer API', () => {
  let pool;
  let app;

  beforeEach(() => {
    pool = fakePool();
    app = createApp(pool);
  });

  test('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'swimmer-api',
    });
    expect(1 + 1).toBe(3);
  });

  test('POST / creates a swimmer', async () => {
    const res = await request(app).post('/').send({
      full_name: 'Alex Santos',
      age: 15,
      team: 'Patriots',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 1,
      full_name: 'Alex Santos',
      age: 15,
      team: 'Patriots',
    });
    expect(res.body.created_at).toBeDefined();
  });

  test('POST / trims swimmer name and team', async () => {
    const res = await request(app).post('/').send({
      full_name: '  Alex Santos  ',
      age: 15,
      team: '  Patriots  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.full_name).toBe('Alex Santos');
    expect(res.body.team).toBe('Patriots');
  });

  test('POST / defaults the team to Independent', async () => {
    const res = await request(app).post('/').send({
      full_name: 'Jamie Cruz',
      age: 14,
    });

    expect(res.status).toBe(201);
    expect(res.body.team).toBe('Independent');
  });

  test.each([
    ['missing name', { age: 15 }],
    ['empty name', { full_name: '   ', age: 15 }],
    ['missing age', { full_name: 'Alex Santos' }],
    ['age of zero', { full_name: 'Alex Santos', age: 0 }],
    ['negative age', { full_name: 'Alex Santos', age: -1 }],
    ['age above 120', { full_name: 'Alex Santos', age: 121 }],
    ['decimal age', { full_name: 'Alex Santos', age: 15.5 }],
    ['non-numeric age', { full_name: 'Alex Santos', age: 'abc' }],
    ['empty team', {
      full_name: 'Alex Santos',
      age: 15,
      team: '   ',
    }],
    ['non-string team', {
      full_name: 'Alex Santos',
      age: 15,
      team: 123,
    }],
  ])('POST / rejects invalid swimmer data: %s', async (_case, body) => {
    const res = await request(app).post('/').send(body);

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('GET / returns an empty list when no swimmers exist', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('GET / lists swimmers in descending ID order', async () => {
    await request(app).post('/').send({
      full_name: 'Alex Santos',
      age: 15,
      team: 'Patriots',
    });

    await request(app).post('/').send({
      full_name: 'Jamie Cruz',
      age: 14,
      team: 'Sharks',
    });

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].full_name).toBe('Jamie Cruz');
    expect(res.body[1].full_name).toBe('Alex Santos');
  });

  test('GET /:id returns a swimmer that exists', async () => {
    await request(app).post('/').send({
      full_name: 'Alex Santos',
      age: 15,
      team: 'Patriots',
    });

    const res = await request(app).get('/1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      full_name: 'Alex Santos',
      age: 15,
      team: 'Patriots',
    });
  });

  test('GET /:id rejects a non-numeric ID', async () => {
    const res = await request(app).get('/abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid swimmer id');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('GET /:id rejects an ID of zero', async () => {
    const res = await request(app).get('/0');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid swimmer id');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('GET /:id returns 404 when the swimmer does not exist', async () => {
    const res = await request(app).get('/999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Swimmer not found');
  });

  test('POST /teams creates a team', async () => {
    const res = await request(app).post('/teams').send({
      name: 'Patriots',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      name: 'Patriots',
      already_exists: false,
    });
  });

  test('POST /teams trims the team name', async () => {
    const res = await request(app).post('/teams').send({
      name: '  Patriots  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Patriots');
  });

  test('POST /teams rejects a missing or blank name', async () => {
    for (const body of [{}, { name: '' }, { name: '   ' }]) {
      const res = await request(app).post('/teams').send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Team name is required');
    }

    expect(pool.query).not.toHaveBeenCalled();
  });

  test('POST /teams reports when a team already exists', async () => {
    await request(app).post('/teams').send({ name: 'Patriots' });

    const res = await request(app).post('/teams').send({
      name: 'Patriots',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      name: 'Patriots',
      already_exists: true,
    });
  });

  test('GET /teams returns teams from the team list and swimmer records', async () => {
    await request(app).post('/teams').send({ name: 'Patriots' });

    await request(app).post('/').send({
      full_name: 'Jamie Cruz',
      age: 14,
      team: 'Sharks',
    });

    const res = await request(app).get('/teams');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Patriots', 'Sharks']);
  });

  test('GET /teams returns an empty list when no teams exist', async () => {
    const res = await request(app).get('/teams');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
