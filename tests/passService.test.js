const { seedAdmin } = require('../src/db/seed');
const { clearAll } = require('./setup');
const passService = require('../src/services/passService');

const validBase = {
  cedula: '1-234-567',
  nombre: 'Persona Prueba',
  cantidad_personas: 2,
  fecha: '2026-06-23',
  monto: 5000,
  estado_pago: 'pagado',
};

afterEach(async () => {
  await clearAll();
});

describe('passService.validatePass', () => {
  test('valida un pase correcto', () => {
    const v = passService.validatePass(validBase);
    expect(v.valid).toBe(true);
    expect(v.data.nombre).toBe('Persona Prueba');
  });

  test('rechaza cédula vacía', () => {
    const v = passService.validatePass({ ...validBase, cedula: '' });
    expect(v.valid).toBe(false);
    expect(v.errors.cedula).toBeDefined();
  });

  test('rechaza hora_salida anterior a hora_entrada', () => {
    const v = passService.validatePass({
      ...validBase,
      hora_entrada: '15:00',
      hora_salida: '10:00',
    });
    expect(v.valid).toBe(false);
    expect(v.errors.hora_salida).toMatch(/posterior/);
  });

  test('acepta hora_salida posterior a hora_entrada', () => {
    const v = passService.validatePass({
      ...validBase,
      hora_entrada: '10:00',
      hora_salida: '15:00',
    });
    expect(v.valid).toBe(true);
  });

  test('rechaza monto negativo', () => {
    const v = passService.validatePass({ ...validBase, monto: -100 });
    expect(v.valid).toBe(false);
    expect(v.errors.monto).toBeDefined();
  });
});

describe('passService create/list with pagination + monto filters', () => {
  test('crea y lista con filtros de monto', async () => {
    const r1 = await passService.createPass({ ...validBase, monto: 1000 }, null);
    const r2 = await passService.createPass({ ...validBase, monto: 9000 }, null);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const high = await passService.listPasses({
      fecha: validBase.fecha,
      montoMin: 5000,
      limit: 0,
    });
    expect(high.rows.every((p) => p.monto >= 5000)).toBe(true);

    const low = await passService.listPasses({
      fecha: validBase.fecha,
      montoMax: 1000,
      limit: 0,
    });
    expect(low.rows.every((p) => p.monto <= 1000)).toBe(true);

    const paged = await passService.listPasses({
      fecha: validBase.fecha,
      limit: 1,
      page: 1,
    });
    expect(paged.rows.length).toBe(1);
    expect(paged.total).toBeGreaterThanOrEqual(2);
    expect(paged.totalPages).toBeGreaterThanOrEqual(2);
  });
});
