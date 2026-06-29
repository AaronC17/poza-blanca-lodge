const { z } = require('zod');
const { getDb } = require('../config/database');
const dt = require('../config/datetime');

const passSchema = z.object({
  cedula: z.string().trim().min(1, 'La cédula es obligatoria').max(50),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  telefono: z.string().trim().max(50).optional().or(z.literal('')),
  correo: z.string().trim().toLowerCase().email('Correo no válido').optional().or(z.literal('')),
  cantidad_personas: z.coerce.number().int('La cantidad debe ser un número entero').min(1, 'Mínimo 1 persona').max(500),
  placa_vehiculo: z.string().trim().max(50).optional().or(z.literal('')),
  fecha: z.string().trim().min(1, 'La fecha es obligatoria'),
  hora_entrada: z.string().trim().optional().or(z.literal('')),
  hora_salida: z.string().trim().optional().or(z.literal('')),
  monto: z.coerce.number().min(0, 'El monto no puede ser negativo'),
  estado_pago: z.enum(['pagado', 'pendiente'], { message: 'Estado de pago no válido' }),
  observaciones: z.string().trim().max(1000).optional().or(z.literal('')),
});

function validatePass(data) {
  const source = data || {};
  const normalized = {};
  const stringFields = ['cedula', 'nombre', 'telefono', 'correo', 'placa_vehiculo', 'fecha', 'hora_entrada', 'hora_salida', 'estado_pago', 'observaciones'];
  for (const k of stringFields) normalized[k] = source[k] == null ? '' : source[k];
  normalized.cantidad_personas = source.cantidad_personas == null || source.cantidad_personas === '' ? '' : source.cantidad_personas;
  normalized.monto = source.monto == null || source.monto === '' ? '' : source.monto;

  const result = passSchema.safeParse(normalized);
  if (result.success) {
    const d = result.data;
    if (d.hora_entrada && d.hora_salida && d.hora_salida < d.hora_entrada) {
      return {
        valid: false,
        errors: { hora_salida: 'La hora de salida debe ser posterior a la de entrada.' },
      };
    }
    return {
      valid: true,
      data: {
        cedula: d.cedula,
        nombre: d.nombre,
        telefono: d.telefono || null,
        correo: d.correo || null,
        cantidad_personas: d.cantidad_personas,
        placa_vehiculo: d.placa_vehiculo || null,
        fecha: d.fecha,
        hora_entrada: d.hora_entrada || null,
        hora_salida: d.hora_salida || null,
        monto: d.monto,
        estado_pago: d.estado_pago,
        observaciones: d.observaciones || null,
      },
    };
  }
  const fieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { valid: false, errors: fieldErrors };
}

function todayISO() {
  return dt.todayISO();
}

function createPass(data, userId) {
  const db = getDb();
  const v = validatePass(data);
  if (!v.valid) return { ok: false, errors: v.errors };

  const d = v.data;
  const info = db.prepare(`
    INSERT INTO passes
      (cedula, nombre, telefono, correo, cantidad_personas, placa_vehiculo,
       fecha, hora_entrada, hora_salida, monto, estado_pago, observaciones, creado_por)
    VALUES
      (@cedula, @nombre, @telefono, @correo, @cantidad_personas, @placa_vehiculo,
       @fecha, @hora_entrada, @hora_salida, @monto, @estado_pago, @observaciones, @creado_por)
  `).run({ ...d, creado_por: userId || null });

  return { ok: true, id: info.lastInsertRowid };
}

function updatePass(id, data) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM passes WHERE id = ?').get(id);
  if (!existing) return { ok: false, errors: { general: 'Pase no encontrado.' } };

  const v = validatePass(data);
  if (!v.valid) return { ok: false, errors: v.errors };

  const d = v.data;
  db.prepare(`
    UPDATE passes SET
      cedula = @cedula,
      nombre = @nombre,
      telefono = @telefono,
      correo = @correo,
      cantidad_personas = @cantidad_personas,
      placa_vehiculo = @placa_vehiculo,
      fecha = @fecha,
      hora_entrada = @hora_entrada,
      hora_salida = @hora_salida,
      monto = @monto,
      estado_pago = @estado_pago,
      observaciones = @observaciones,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...d, id });

  return { ok: true, id };
}

function deletePass(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM passes WHERE id = ?').run(id);
  return info.changes > 0;
}

function getPassById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM passes WHERE id = ?').get(id) || null;
}

function listPasses(filters = {}) {
  const db = getDb();
  const conditions = [];
  const params = {};

  if (filters.fecha) {
    conditions.push('fecha = @fecha');
    params.fecha = filters.fecha;
  }
  if (filters.fechaDesde) {
    conditions.push('fecha >= @fechaDesde');
    params.fechaDesde = filters.fechaDesde;
  }
  if (filters.fechaHasta) {
    conditions.push('fecha <= @fechaHasta');
    params.fechaHasta = filters.fechaHasta;
  }
  if (filters.estado_pago) {
    conditions.push('estado_pago = @estado_pago');
    params.estado_pago = filters.estado_pago;
  }
  if (filters.montoMin != null && filters.montoMin !== '') {
    conditions.push('monto >= @montoMin');
    params.montoMin = Number(filters.montoMin);
  }
  if (filters.montoMax != null && filters.montoMax !== '') {
    conditions.push('monto <= @montoMax');
    params.montoMax = Number(filters.montoMax);
  }
  if (filters.q) {
    conditions.push('(nombre LIKE @q OR cedula LIKE @q OR correo LIKE @q OR placa_vehiculo LIKE @q)');
    params.q = `%${filters.q}%`;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const order = filters.order === 'asc' ? 'ASC' : 'DESC';

  const paginate = filters.limit != null && filters.limit > 0;
  let limitSql = '';
  if (paginate) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * perPage;
    limitSql = 'LIMIT @perPage OFFSET @offset';
    params.perPage = perPage;
    params.offset = offset;
  }

  const sql = `SELECT * FROM passes ${where} ORDER BY fecha ${order}, created_at ${order} ${limitSql}`;
  const rows = db.prepare(sql).all(params);

  let total = rows.length;
  let totalPages = 1;
  if (paginate) {
    total = db.prepare(`SELECT COUNT(*) as c FROM passes ${where}`).get(params).c;
    const perPage = params.perPage;
    totalPages = Math.max(1, Math.ceil(total / perPage));
  }

  return { rows, total, totalPages };
}

function getDashboardStats(date = todayISO()) {
  const db = getDb();

  const today = db.prepare(`
    SELECT
      COUNT(*) as total_pases,
      COALESCE(SUM(cantidad_personas), 0) as total_personas,
      COALESCE(SUM(CASE WHEN estado_pago='pagado' THEN monto ELSE 0 END), 0) as ingresos_pagados,
      COALESCE(SUM(CASE WHEN estado_pago='pendiente' THEN monto ELSE 0 END), 0) as ingresos_pendientes,
      COALESCE(SUM(monto), 0) as ingresos_totales
    FROM passes WHERE fecha = @fecha
  `).get({ fecha: date });

  const last7 = db.prepare(`
    SELECT
      fecha,
      COUNT(*) as pases,
      COALESCE(SUM(cantidad_personas), 0) as personas,
      COALESCE(SUM(monto), 0) as monto
    FROM passes
    WHERE fecha >= @start
    GROUP BY fecha
    ORDER BY fecha ASC
  `).all({
    start: dt.addDaysISO(dt.todayISO(), -6),
  });

  const month = db.prepare(`
    SELECT
      COUNT(*) as total_pases,
      COALESCE(SUM(cantidad_personas), 0) as total_personas,
      COALESCE(SUM(monto), 0) as ingresos_totales
    FROM passes
    WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', @fecha)
  `).get({ fecha: date });

  const recientes = db.prepare(`
    SELECT * FROM passes ORDER BY created_at DESC LIMIT 5
  `).all();

  const visitantesHoy = db.prepare(`
    SELECT * FROM passes WHERE fecha = @fecha ORDER BY hora_entrada ASC, created_at ASC
  `).all({ fecha: date });

  const pendientesHoy = db.prepare(`
    SELECT * FROM passes WHERE fecha = @fecha AND estado_pago = 'pendiente' ORDER BY monto DESC
  `).all({ fecha: date });

  const topVisitantes = db.prepare(`
    SELECT cedula, nombre, COUNT(*) as visitas, SUM(cantidad_personas) as personas, SUM(monto) as total
    FROM passes
    GROUP BY cedula
    ORDER BY visitas DESC, total DESC
    LIMIT 5
  `).all();

  const promedio = db.prepare(`
    SELECT COALESCE(AVG(monto), 0) as promedio, COALESCE(AVG(cantidad_personas), 0) as prom_personas
    FROM passes WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', @fecha)
  `).get({ fecha: date });

  return { today, last7, month, recientes, visitantesHoy, pendientesHoy, topVisitantes, promedio };
}

function getReport(fechaDesde, fechaHasta) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM passes
    WHERE fecha >= @desde AND fecha <= @hasta
    ORDER BY fecha ASC, hora_entrada ASC
  `).all({ desde: fechaDesde, hasta: fechaHasta });

  const totals = rows.reduce(
    (acc, r) => {
      acc.totalPases += 1;
      acc.totalPersonas += r.cantidad_personas;
      acc.montoTotal += r.monto;
      if (r.estado_pago === 'pagado') acc.montoPagado += r.monto;
      else acc.montoPendiente += r.monto;
      return acc;
    },
    { totalPases: 0, totalPersonas: 0, montoTotal: 0, montoPagado: 0, montoPendiente: 0 }
  );

  const porDia = {};
  for (const r of rows) {
    if (!porDia[r.fecha]) {
      porDia[r.fecha] = { fecha: r.fecha, pases: 0, personas: 0, monto: 0 };
    }
    porDia[r.fecha].pases += 1;
    porDia[r.fecha].personas += r.cantidad_personas;
    porDia[r.fecha].monto += r.monto;
  }

  return {
    rows,
    totals,
    porDia: Object.values(porDia).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    fechaDesde,
    fechaHasta,
  };
}

function searchVisitors(q) {
  const db = getDb();
  const term = `%${q}%`;
  return db.prepare(`
    SELECT cedula, nombre, telefono, correo,
      COUNT(*) as visitas,
      MAX(fecha) as ultima_visita
    FROM passes
    WHERE cedula LIKE @q OR nombre LIKE @q OR correo LIKE @q
    GROUP BY cedula
    ORDER BY visitas DESC
    LIMIT 8
  `).all({ q: term });
}

function buildCSV(rows) {
  // UTF-8 BOM to ensure Excel reads accents correctly
  const BOM = '\uFEFF'; 
  const headers = ['Fecha', 'Cédula', 'Nombre Completo', 'Teléfono', 'Correo Electrónico', 'Cantidad Personas', 'Placa Vehículo', 'Hora Entrada', 'Hora Salida', 'Monto Total', 'Estado de Pago', 'Observaciones Extras'];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[";,\n\r]/.test(s) ? `"${s}"` : s;
  };
  // Using semicolon instead of comma for better Excel compatibility in Spanish locales
  const lines = [headers.join(';')];
  for (const r of rows) {
    const formattedDate = new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-CR');
    lines.push([
      formattedDate, r.cedula, r.nombre, r.telefono, r.correo,
      r.cantidad_personas, r.placa_vehiculo, fmtTime(r.hora_entrada), fmtTime(r.hora_salida),
      r.monto, r.estado_pago.toUpperCase(), r.observaciones
    ].map(escape).join(';'));
  }
  return BOM + lines.join('\r\n');
}

function fmtTime(h) {
  if (!h) return '';
  const parts = h.split(':');
  if (parts.length < 2) return h;
  let hour = parseInt(parts[0], 10);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

module.exports = {
  validatePass,
  createPass,
  updatePass,
  deletePass,
  getPassById,
  listPasses,
  getDashboardStats,
  getReport,
  searchVisitors,
  buildCSV,
  fmtTime,
  todayISO,
};
