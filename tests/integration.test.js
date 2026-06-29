const request = require('supertest');
const { initDatabase } = require('../src/db/init');
const { app } = require('../src/server');

beforeAll(() => {
  initDatabase();
});

function parseCookies(res) {
  const cookies = {};
  const headers = res.headers['set-cookie'] || [];
  for (const h of headers) {
    const m = h.match(/^([^=]+)=([^;]+)/);
    if (m) cookies[m[1]] = decodeURIComponent(m[2]);
  }
  return cookies;
}

describe('Auth + CSRF integration', () => {
  test('redirige a /login si no autenticado', async () => {
    const res = await request(app).get('/pases');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/login/);
  });

  test('login fallido con credenciales inválidas', async () => {
    const res = await request(app).post('/login').send('username=admin&password=nope');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/login/);
  });

  test('flujo completo: login, CSRF requerido, crear pase', async () => {
    const agent = request.agent(app);

    const loginPage = await agent.get('/login');
    const cookies = parseCookies(loginPage);
    const csrf = cookies['csrf_token'];
    expect(csrf).toBeTruthy();

    const login = await agent.post('/login').send('username=admin&password=testpass123');
    expect(login.status).toBe(302);
    expect(login.headers.location).toBe('/dashboard');

    const dash = await agent.get('/dashboard');
    expect(dash.status).toBe(200);

    const newPage = await agent.get('/pases/nuevo');
    expect(newPage.status).toBe(200);

    const payload = {
      cedula: '2-345-678',
      nombre: 'Visitante Test',
      cantidad_personas: 3,
      fecha: '2026-06-23',
      monto: 7500,
      estado_pago: 'pagado',
    };

    const blocked = await agent.post('/pases').type('form').send(payload);
    expect(blocked.status).toBe(403);

    const created = await agent
      .post('/pases')
      .type('form')
      .send({ ...payload, _csrf: csrf });
    expect(created.status).toBe(302);
    expect(created.headers.location).toBe('/pases');
  });
});
