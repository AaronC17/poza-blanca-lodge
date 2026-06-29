const crypto = require('crypto');
const config = require('../config/env');

const COOKIE_NAME = 'csrf_token';
const FIELD_NAME = '_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function isSameOrigin(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  if (tokenA.length !== tokenB.length) return false;
  return crypto.timingSafeEqual(Buffer.from(tokenA), Buffer.from(tokenB));
}

function csrfMiddleware(opts = {}) {
  const cookieName = opts.cookieName || COOKIE_NAME;
  const fieldName = opts.fieldName || FIELD_NAME;

  return function csrf(req, res, next) {
    res.locals.csrfToken = '';
    res.locals.csrfField = fieldName;

    let token = req.cookies && req.cookies[cookieName];

    if (!token || typeof token !== 'string' || token.length < 32) {
      token = crypto.randomBytes(32).toString('hex');
      const cookieOpts = {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
        path: '/',
        maxAge: 12 * 60 * 60 * 1000,
      };
      res.cookie(cookieName, token, cookieOpts);
    }

    req.csrfToken = () => token;
    res.locals.csrfToken = token;

    if (SAFE_METHODS.has(req.method)) return next();

    if (req.path === '/login' || req.path === '/logout') {
      return next();
    }

    const submitted =
      (req.body && req.body[fieldName]) ||
      (req.headers['x-csrf-token']) ||
      (req.headers['x-xsrf-token']);

    if (!isSameOrigin(submitted, token)) {
      return res.status(403).render('error', {
        title: 'Acción no permitida',
        statusCode: 403,
        message:
          'No se pudo verificar la autenticidad de esta solicitud (token CSRF inválido). Vuelve atrás, recarga la página e inténtalo de nuevo.',
        currentUser: res.locals.currentUser || null,
      });
    }

    if (req.body) delete req.body[fieldName];
    next();
  };
}

module.exports = csrfMiddleware;
module.exports.COOKIE_NAME = COOKIE_NAME;
module.exports.FIELD_NAME = FIELD_NAME;
