const express = require('express');
const passService = require('../services/passService');
const emailService = require('../services/emailService');
const dt = require('../config/datetime');
const realtime = require('../services/realtimeService');

const router = express.Router();

function formatCRC(value) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

router.use((req, res, next) => {
  res.locals.formatCRC = formatCRC;
  res.locals.fmtTime = passService.fmtTime;
  next();
});

router.get('/', (req, res) => {
  const allMode = req.query.perPage === 'todos';
  const requestedPerPage = parseInt(req.query.perPage, 10);
  const perPage = allMode ? 10000 : Math.min(200, Math.max(1, requestedPerPage || 10));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const filters = {
    fecha: req.query.fecha || passService.todayISO(),
    fechaDesde: req.query.fechaDesde || '',
    fechaHasta: req.query.fechaHasta || '',
    estado_pago: req.query.estado_pago || '',
    montoMin: req.query.montoMin || '',
    montoMax: req.query.montoMax || '',
    q: req.query.q || '',
    order: req.query.order || 'desc',
    limit: perPage,
    page,
  };

  const result = passService.listPasses(filters);
  const passes = result.rows;

  const buildPageLink = (p) => {
    const qs = new URLSearchParams({
      ...(filters.q && { q: filters.q }),
      ...(filters.fecha && { fecha: filters.fecha }),
      ...(filters.fechaDesde && { fechaDesde: filters.fechaDesde }),
      ...(filters.fechaHasta && { fechaHasta: filters.fechaHasta }),
      ...(filters.estado_pago && { estado_pago: filters.estado_pago }),
      ...(filters.montoMin && { montoMin: filters.montoMin }),
      ...(filters.montoMax && { montoMax: filters.montoMax }),
      order: filters.order,
      perPage: allMode ? 'todos' : String(perPage),
      page: String(p),
    });
    return `/pases?${qs.toString()}`;
  };

  res.render('passes/index', {
    title: 'Pases de día',
    active: 'passes',
    passes,
    filters,
    count: result.total,
    page,
    perPage: allMode ? 'todos' : perPage,
    totalPages: result.totalPages,
    buildPageLink,
    currentUrl: req.originalUrl,
  });
});

router.get('/nuevo', (req, res) => {
  const hoy = passService.todayISO();
  const ahora = dt.nowTimeISO();
  res.render('passes/form', {
    title: 'Nuevo pase de día',
    active: 'new-pass',
    pass: {
      cedula: '', nombre: '', telefono: '', correo: '',
      cantidad_personas: 1, placa_vehiculo: '',
      fecha: req.query.fecha || hoy,
      hora_entrada: ahora, hora_salida: '',
      monto: '', estado_pago: 'pagado', observaciones: '',
      tipo_pase: '', forma_pago: 'efectivo', adultos: 1, ninos: 0, parqueos: 0,
    },
    errors: null,
    isEdit: false,
    precios: passService.PRECIOS,
  });
});

router.post('/', async (req, res) => {
  const result = passService.createPass(req.body, req.session.userId);

  if (!result.ok) {
    return res.render('passes/form', {
      title: 'Nuevo pase de día',
      active: 'new-pass',
      pass: { ...req.body },
      errors: result.errors,
      isEdit: false,
      precios: passService.PRECIOS,
    });
  }

  const pass = passService.getPassById(result.id);
  realtime.notifyPassChange('create', pass);

  try {
    const emailResult = await emailService.sendPassConfirmation(pass);
    if (emailResult.status === 'sent') {
      req.flash('success', 'Pase registrado y correo de confirmación enviado.');
    } else if (emailResult.status === 'skipped') {
      req.flash('info', `Pase registrado. Correo no enviado: ${emailResult.reason}`);
    } else {
      req.flash('info', `Pase registrado. No se pudo enviar el correo: ${emailResult.error}`);
    }
  } catch (e) {
    req.flash('info', 'Pase registrado. Hubo un problema al enviar el correo.');
  }

  res.redirect('/pases');
});

router.get('/buscar-visitantes', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const results = passService.searchVisitors(q);
  res.json(results);
});

router.get('/:id/detalle', (req, res) => {
  const pass = passService.getPassById(Number(req.params.id));
  if (!pass) {
    req.flash('error', 'Pase no encontrado.');
    return res.redirect('/pases');
  }
  res.render('passes/detail', {
    title: 'Detalle del pase',
    active: 'passes',
    pass,
  });
});

router.get('/:id/editar', (req, res) => {
  const pass = passService.getPassById(Number(req.params.id));
  if (!pass) {
    req.flash('error', 'Pase no encontrado.');
    return res.redirect('/pases');
  }
  res.render('passes/form', {
    title: 'Editar pase',
    active: 'passes',
    pass,
    errors: null,
    isEdit: true,
    precios: passService.PRECIOS,
  });
});

router.post('/:id', (req, res) => {
  const id = Number(req.params.id);
  const result = passService.updatePass(id, req.body);

  if (!result.ok) {
    const pass = { ...passService.getPassById(id), ...req.body, id };
    return res.render('passes/form', {
      title: 'Editar pase',
      active: 'passes',
      pass,
      errors: result.errors,
      isEdit: true,
      precios: passService.PRECIOS,
    });
  }

  req.flash('success', 'Pase actualizado correctamente.');
  realtime.notifyPassChange('update', passService.getPassById(id));
  res.redirect('/pases');
});

router.post('/:id/eliminar', (req, res) => {
  const id = Number(req.params.id);
  const ok = passService.deletePass(id);
  if (ok) {
    req.flash('success', 'Pase eliminado.');
    realtime.notifyPassChange('delete', { id });
  } else req.flash('error', 'No se encontró el pase.');

  const redirectTo = req.body.redirect || '/pases';
  // Solo permitir redirecciones relativas internas para evitar open redirects
  const safeRedirect = typeof redirectTo === 'string' && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
    ? redirectTo
    : '/pases';
  res.redirect(safeRedirect);
});

router.post('/:id/reenviar-correo', async (req, res) => {
  const id = Number(req.params.id);
  const pass = passService.getPassById(id);
  if (!pass) {
    req.flash('error', 'Pase no encontrado.');
    return res.redirect('/pases');
  }
  const result = await emailService.sendPassConfirmation(pass);
  if (result.status === 'sent') req.flash('success', 'Correo reenviado correctamente.');
  else if (result.status === 'skipped') req.flash('info', `Correo no enviado: ${result.reason}`);
  else req.flash('error', `No se pudo enviar el correo: ${result.error}`);
  res.redirect('/pases');
});

module.exports = router;
