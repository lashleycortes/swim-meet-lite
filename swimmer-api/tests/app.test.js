const request = require('supertest');
const { createApp } = require('../src/app');

function fakePool() {
  const rows = [];
  let nextId = 1;
  return {
    rows,
    query: jest.fn(async (sql, params=[]) => {
      if (sql.startsWith('SELECT id, full_name, age, team, created_at FROM swimmers ORDER BY')) {
        return { rows: [...rows].reverse(), rowCount: rows.length };
      }
      if (sql.startsWith('INSERT INTO swimmers')) {
        const row = { id: nextId++, full_name: params[0], age: params[1], team: params[2], created_at: new Date().toISOString() };
        rows.push(row); return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('WHERE id = $1')) {
        const row = rows.find(x => x.id === params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      throw new Error('Unexpected query in test');
    })
  };
}

describe('Swimmer API', () => {
  let pool, app;
  beforeEach(() => { pool = fakePool(); app = createApp(pool); });

  test('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST / creates a swimmer', async () => {
    const res = await request(app).post('/').send({ full_name: 'Alex Santos', age: 15, team: 'Patriots' });
    expect(res.status).toBe(201);
    expect(res.body.full_name).toBe('Alex Santos');
    expect(res.body.age).toBe(15);
  });

  test('POST / rejects an invalid age', async () => {
    const res = await request(app).post('/').send({ full_name: 'Alex Santos', age: 0 });
    expect(res.status).toBe(400);
  });

  test('GET / lists swimmers', async () => {
    await request(app).post('/').send({ full_name: 'Alex Santos', age: 15 });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
