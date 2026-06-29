const { initDatabase } = require('../src/db/init');
const passService = require('../src/services/passService');

beforeAll(() => {
  initDatabase();
});

const validBase = {
  cedula: '1-234-567',
  nombre: 'Persona Prueba',
  cantidad_personas: 2,
  fecha: '2026-06-23',
  monto: 5000,
  estado_pago: 'pagado',
};

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
  test('crea y lista con filtros de monto', () => {
    const r1 = passService.createPass({ ...validBase, monto: 1000 }, 1);
    const r2 = passService.createPass({ ...validBase, monto: 9000 }, 1);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const high = passService.listPasses({
      fecha: validBase.fecha,
      montoMin: 5000,
      limit: 0,
    });
    expect(high.rows.every((p) => p.monto >= 5000)).toBe(true);

    const low = passService.listPasses({
      fecha: validBase.fecha,
      montoMax: 1000,
      limit: 0,
    });
    expect(low.rows.every((p) => p.monto <= 1000)).toBe(true);

    const paged = passService.listPasses({
      fecha: validBase.fecha,
      limit: 1,
      page: 1,
    });
    expect(paged.rows.length).toBe(1);
    expect(paged.total).toBeGreaterThanOrEqual(2);
    expect(paged.totalPages).toBeGreaterThanOrEqual(2);
  });
});
