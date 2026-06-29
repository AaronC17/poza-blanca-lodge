function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      name: req.session.name,
    };
    return next();
  }

  if (req.method === 'GET' && req.accepts('html')) {
    return res.redirect('/login');
  }

  return res.status(401).json({ error: 'No autenticado.' });
}

function apiRequireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'No autenticado.' });
}

module.exports = { requireAuth, apiRequireAuth };
