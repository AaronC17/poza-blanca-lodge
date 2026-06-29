const config = require('../config/env');

function notFound(req, res) {
  if (req.accepts('html')) {
    return res.status(404).render('error', {
      title: 'Página no encontrada',
      statusCode: 404,
      message: 'La página que buscas no existe.',
      currentUser: null,
    });
  }
  return res.status(404).json({ error: 'Recurso no encontrado.' });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = config.isProd && status >= 500 ? 'Error interno del servidor.' : err.message;

  if (!config.isProd) {
    console.error('[error]', err);
  }

  if (req.accepts('html')) {
    return res.status(status).render('error', {
      title: 'Error',
      statusCode: status,
      message,
      currentUser: res.locals.currentUser || null,
    });
  }

  return res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
