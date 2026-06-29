const { z } = require('zod');
const { Pass } = require('../config/database');
const dt = require('../config/datetime');

// Precios por categoría
const PRECIOS = {
  rio:      { adulto: 2500, nino: 1500, parqueo: 3000 },
  camping:  { adulto: 6000, nino: 3000, parqueo: 3000 },
  rancho:   { adulto: 2500, nino: 1500, parqueo: 3000, base: 10000 },
  piscina:  { adulto: 40000, nino: 28000, parqueo: 3000 },
  parqueo:  { adulto: 0, nino: 0, parqueo: 3000 },
};

function calcularMonto(tipoPase, adultos, ninos, parqueos) {
  if (!tipoPase) return 0;
  const precios = PRECIOS[tipoPase] || PRECIOS.rio;
  let total = 0;
  if (tipoPase === 'parqueo') {
    total = precios.parqueo * Math.max(1, parqueos);
  } else if (tipoPase === 'rancho') {
    total = (precios.base || 0) + (precios.adulto * adultos) + (precios.nino * ninos) + (precios.parqueo * Math.max(0, parqueos));
  } else {
    total = (precios.adulto * adultos) + (precios.nino * ninos) + (precios.parqueo * Math.max(0, parqueos));
  }
  return total;
}

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
  tipo_pase: z.enum(['rio', 'camping', 'rancho', 'piscina', 'parqueo'], { message: 'Tipo de pase no válido' }),
  forma_pago: z.enum(['efectivo', 'sinpe', 'tarjeta'], { message: 'Forma de pago no válida' }),
  adultos: z.coerce.number().int().min(0, 'Mínimo 0 adultos').max(500),
  ninos: z.coerce.number().int().min(0, 'Mínimo 0 niños').max(500),
  parqueos: z.coerce.number().int().min(0, 'Mínimo 0 parqueos').max(50),
});

function validatePass(data) {
  const source = data || {};
  const normalized = {};
  const stringFields = ['cedula', 'nombre', 'telefono', 'correo', 'placa_vehiculo', 'fecha', 'hora_entrada', 'hora_salida', 'estado_pago', 'observaciones', 'tipo_pase', 'forma_pago'];
  for (const k of stringFields) normalized[k] = source[k] == null ? '' : source[k];
  normalized.cantidad_personas = source.cantidad_personas == null || source.cantidad_personas === '' ? '' : source.cantidad_personas;
  normalized.monto = source.monto == null || source.monto === '' ? '' : source.monto;
  normalized.adultos = source.adultos == null || source.adultos === '' ? '' : source.adultos;
  normalized.ninos = source.ninos == null || source.ninos === '' ? '' : source.ninos;
  normalized.parqueos = source.parqueos == null || source.parqueos === '' ? '' : source.parqueos;

  // Defaults
  if (!normalized.tipo_pase) normalized.tipo_pase = 'rio';
  if (!normalized.forma_pago) normalized.forma_pago = 'efectivo';

  const result = passSchema.safeParse(normalized);
  if (result.success) {
    const d = result.data;
    if (d.hora_entrada && d.hora_salida && d.hora_salida < d.hora_entrada) {
      return {
        valid: false,
        errors: { hora_salida: 'La hora de salida debe ser posterior a la de entrada.' },
      };
    }
    // Calcular monto automáticamente si se proporciona tipo_pase
    const montoCalculado = calcularMonto(d.tipo_pase, d.adultos, d.ninos, d.parqueos);
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
        monto: montoCalculado,
        estado_pago: d.estado_pago,
        observaciones: d.observaciones || null,
        tipo_pase: d.tipo_pase,
        forma_pago: d.forma_pago,
        adultos: d.adultos,
        ninos: d.ninos,
        parqueos: d.parqueos,
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

// Convierte un documento Mongoose a un objeto plano con campos snake_case
// y añade id numérico-secuencial simulado (para compatibilidad con vistas EJS)
function toPlain(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ getters: false, virtuals: false }) : doc;
  o.id = String(o._id);
  return o;
}

async function createPass(data, userId) {
  const v = validatePass(data);
  if (!v.valid) return { ok: false, errors: v.errors };

  const d = v.data;
  const pass = await Pass.create({
    ...d,
    creado_por: userId || null,
  });

  return { ok: true, id: String(pass._id) };
}

async function updatePass(id, data) {
  let existing;
  try {
    existing = await Pass.findById(id).lean();
  } catch (e) {
    existing = null;
  }
  if (!existing) return { ok: false, errors: { general: 'Pase no encontrado.' } };

  const v = validatePass(data);
  if (!v.valid) return { ok: false, errors: v.errors };

  const d = v.data;
  await Pass.updateOne(
    { _id: id },
    {
      $set: {
        cedula: d.cedula,
        nombre: d.nombre,
        telefono: d.telefono,
        correo: d.correo,
        cantidad_personas: d.cantidad_personas,
        placa_vehiculo: d.placa_vehiculo,
        fecha: d.fecha,
        hora_entrada: d.hora_entrada,
        hora_salida: d.hora_salida,
        monto: d.monto,
        estado_pago: d.estado_pago,
        observaciones: d.observaciones,
        tipo_pase: d.tipo_pase,
        forma_pago: d.forma_pago,
        adultos: d.adultos,
        ninos: d.ninos,
        parqueos: d.parqueos,
        updated_at: new Date(),
      },
    }
  );

  return { ok: true, id };
}

async function deletePass(id) {
  const result = await Pass.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function getPassById(id) {
  let doc;
  try {
    doc = await Pass.findById(id).lean();
  } catch (e) {
    doc = null;
  }
  if (!doc) return null;
  doc.id = String(doc._id);
  return doc;
}

function buildFilter(filters = {}) {
  const f = {};
  if (filters.fecha) f.fecha = filters.fecha;
  if (filters.fechaDesde) f.fecha = { ...f.fecha, $gte: filters.fechaDesde };
  if (filters.fechaHasta) f.fecha = { ...f.fecha, $lte: filters.fechaHasta };
  if (filters.estado_pago) f.estado_pago = filters.estado_pago;
  if (filters.montoMin != null && filters.montoMin !== '') f.monto = { ...f.monto, $gte: Number(filters.montoMin) };
  if (filters.montoMax != null && filters.montoMax !== '') f.monto = { ...f.monto, $lte: Number(filters.montoMax) };
  if (filters.q) {
    const term = filters.q;
    f.$or = [
      { nombre: { $regex: term, $options: 'i' } },
      { cedula: { $regex: term, $options: 'i' } },
      { correo: { $regex: term, $options: 'i' } },
      { placa_vehiculo: { $regex: term, $options: 'i' } },
    ];
  }
  return f;
}

async function listPasses(filters = {}) {
  const f = buildFilter(filters);
  const order = filters.order === 'asc' ? 1 : -1;
  const sort = { fecha: order, created_at: order };

  const paginate = filters.limit != null && filters.limit > 0;
  let rows, total;
  if (paginate) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 20));
    const skip = (page - 1) * perPage;
    [rows, total] = await Promise.all([
      Pass.find(f).sort(sort).skip(skip).limit(perPage).lean(),
      Pass.countDocuments(f),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    rows.forEach((r) => { r.id = String(r._id); });
    return { rows, total, totalPages };
  }

  rows = await Pass.find(f).sort(sort).lean();
  rows.forEach((r) => { r.id = String(r._id); });
  return { rows, total: rows.length, totalPages: 1 };
}

async function getDashboardStats(date = todayISO()) {
  // Resumen del día
  const todayAgg = await Pass.aggregate([
    { $match: { fecha: date } },
    {
      $group: {
        _id: null,
        total_pases: { $sum: 1 },
        total_personas: { $sum: '$cantidad_personas' },
        ingresos_pagados: { $sum: { $cond: [{ $eq: ['$estado_pago', 'pagado'] }, '$monto', 0] } },
        ingresos_pendientes: { $sum: { $cond: [{ $eq: ['$estado_pago', 'pendiente'] }, '$monto', 0] } },
        ingresos_totales: { $sum: '$monto' },
      },
    },
  ]);
  const today = todayAgg[0] || {
    total_pases: 0, total_personas: 0, ingresos_pagados: 0,
    ingresos_pendientes: 0, ingresos_totales: 0,
  };

  // Últimos 7 días
  const start7 = dt.addDaysISO(dt.todayISO(), -6);
  const last7 = await Pass.aggregate([
    { $match: { fecha: { $gte: start7 } } },
    {
      $group: {
        _id: '$fecha',
        fecha: { $first: '$fecha' },
        pases: { $sum: 1 },
        personas: { $sum: '$cantidad_personas' },
        monto: { $sum: '$monto' },
      },
    },
    { $sort: { fecha: 1 } },
    { $project: { _id: 0, fecha: 1, pases: 1, personas: 1, monto: 1 } },
  ]);

  // Totales del mes (mismo YYYY-MM)
  const yearMonth = date.slice(0, 7);
  const monthAgg = await Pass.aggregate([
    { $match: { fecha: { $regex: `^${yearMonth}` } } },
    {
      $group: {
        _id: null,
        total_pases: { $sum: 1 },
        total_personas: { $sum: '$cantidad_personas' },
        ingresos_totales: { $sum: '$monto' },
      },
    },
  ]);
  const month = monthAgg[0] || { total_pases: 0, total_personas: 0, ingresos_totales: 0 };

  // Pases recientes
  const recientes = await Pass.find().sort({ created_at: -1 }).limit(5).lean();
  recientes.forEach((r) => { r.id = String(r._id); });

  // Visitantes de hoy
  const visitantesHoy = await Pass.find({ fecha: date })
    .sort({ hora_entrada: 1, created_at: 1 }).lean();
  visitantesHoy.forEach((r) => { r.id = String(r._id); });

  // Pendientes de hoy
  const pendientesHoy = await Pass.find({ fecha: date, estado_pago: 'pendiente' })
    .sort({ monto: -1 }).lean();
  pendientesHoy.forEach((r) => { r.id = String(r._id); });

  // Top visitantes (agrupado por cédula)
  const topVisitantes = await Pass.aggregate([
    {
      $group: {
        _id: '$cedula',
        cedula: { $first: '$cedula' },
        nombre: { $first: '$nombre' },
        visitas: { $sum: 1 },
        personas: { $sum: '$cantidad_personas' },
        total: { $sum: '$monto' },
      },
    },
    { $sort: { visitas: -1, total: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, cedula: 1, nombre: 1, visitas: 1, personas: 1, total: 1 } },
  ]);

  // Promedios del mes
  const promAgg = await Pass.aggregate([
    { $match: { fecha: { $regex: `^${yearMonth}` } } },
    {
      $group: {
        _id: null,
        promedio: { $avg: '$monto' },
        prom_personas: { $avg: '$cantidad_personas' },
      },
    },
  ]);
  const promedio = promAgg[0] || { promedio: 0, prom_personas: 0 };

  // Desglose por tipo de pase (hoy)
  const porTipoPase = await Pass.aggregate([
    { $match: { fecha: date } },
    {
      $group: {
        _id: '$tipo_pase',
        tipo_pase: { $first: '$tipo_pase' },
        total: { $sum: 1 },
        monto: { $sum: '$monto' },
      },
    },
    { $sort: { monto: -1 } },
    { $project: { _id: 0, tipo_pase: 1, total: 1, monto: 1 } },
  ]);

  // Desglose por forma de pago (hoy)
  const porFormaPago = await Pass.aggregate([
    { $match: { fecha: date } },
    {
      $group: {
        _id: '$forma_pago',
        forma_pago: { $first: '$forma_pago' },
        total: { $sum: 1 },
        monto: { $sum: '$monto' },
      },
    },
    { $sort: { monto: -1 } },
    { $project: { _id: 0, forma_pago: 1, total: 1, monto: 1 } },
  ]);

  return { today, last7, month, recientes, visitantesHoy, pendientesHoy, topVisitantes, promedio, porTipoPase, porFormaPago };
}

async function getReport(fechaDesde, fechaHasta) {
  const rows = await Pass.find({ fecha: { $gte: fechaDesde, $lte: fechaHasta } })
    .sort({ fecha: 1, hora_entrada: 1 }).lean();
  rows.forEach((r) => { r.id = String(r._id); });

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

async function searchVisitors(q) {
  const term = q;
  return Pass.aggregate([
    {
      $match: {
        $or: [
          { cedula: { $regex: term, $options: 'i' } },
          { nombre: { $regex: term, $options: 'i' } },
          { correo: { $regex: term, $options: 'i' } },
        ],
      },
    },
    {
      $group: {
        _id: '$cedula',
        cedula: { $first: '$cedula' },
        nombre: { $first: '$nombre' },
        telefono: { $first: '$telefono' },
        correo: { $first: '$correo' },
        visitas: { $sum: 1 },
        ultima_visita: { $max: '$fecha' },
      },
    },
    { $sort: { visitas: -1 } },
    { $limit: 8 },
    { $project: { _id: 0, cedula: 1, nombre: 1, telefono: 1, correo: 1, visitas: 1, ultima_visita: 1 } },
  ]);
}

function buildCSV(rows) {
  // UTF-8 BOM to ensure Excel reads accents correctly
  const BOM = '\uFEFF';
  const headers = ['Fecha', 'Cédula', 'Nombre Completo', 'Teléfono', 'Correo Electrónico', 'Tipo de Pase', 'Forma de Pago', 'Adultos', 'Niños', 'Parqueos', 'Cantidad Personas', 'Placa Vehículo', 'Hora Entrada', 'Hora Salida', 'Monto Total', 'Estado de Pago', 'Observaciones Extras'];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[";,\n\r]/.test(s) ? `"${s}"` : s;
  };
  // Using semicolon instead of comma for better Excel compatibility in Spanish locales
  const lines = [headers.join(';')];
  for (const r of rows) {
    const formattedDate = new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-CR');
    const tipoPaseLabels = { rio: 'Pase Río', camping: 'Camping', rancho: 'Pase Río + Rancho', piscina: 'Day Pass Piscina', parqueo: 'Parqueo' };
    const formaPagoLabels = { efectivo: 'Efectivo', sinpe: 'Sinpe', tarjeta: 'Tarjeta' };
    lines.push([
      formattedDate, r.cedula, r.nombre, r.telefono, r.correo,
      tipoPaseLabels[r.tipo_pase] || r.tipo_pase || '—',
      formaPagoLabels[r.forma_pago] || r.forma_pago || '—',
      r.adultos || 0, r.ninos || 0, r.parqueos || 0,
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
  PRECIOS,
  calcularMonto,
};
