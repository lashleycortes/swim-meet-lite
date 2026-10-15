const request = require('supertest');
const { createApp } = require('../src/app');

function fakePool() {
  return {
    query: jest.fn(async (sql, params=[]) => {
      if (sql.includes('INSERT INTO meets')) {
        return { rows: [{ id: 1, name: params[0], venue: params[1], meet_date: params[2] }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO registrations')) {
        return { rows: [{ id: 1, swimmer_id: params[0], meet_id: params[1] }], rowCount: 1 };
      }
      if (sql.includes('SELECT m.id')) return { rows: [{ id: 1, name: 'Test Meet', venue: 'Pool', meet_date: '2030-01-01', registration_count: 0 }], rowCount: 1 };
      throw new Error('Unexpected query in test');
    })
  };
}

describe('Meet API', () => {
  let app;
  beforeEach(() => { app = createApp(fakePool()); });

  test('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('meet-api');
  });

  test('POST / creates a meet', async () => {
    const res = await request(app).post('/').send({ name: 'North Luzon Invite', venue: 'Aquatic Center', meet_date: '2030-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('North Luzon Invite');
  });

  test('POST / rejects missing fields', async () => {
    const res = await request(app).post('/').send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  test('GET / lists meets', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Test Meet');
  });
});
