module.exports = function flashMiddleware() {
  return function (req, res, next) {
    req.flash = function (type, message) {
      if (!this.session) return;
      if (!this.session.flash) this.session.flash = {};
      this.session.flash[type] = message;
    }.bind(req);

    res.locals.success = null;
    res.locals.error = null;
    res.locals.info = null;

    const current = req.session && req.session.flash;
    if (current) {
      res.locals.success = current.success || null;
      res.locals.error = current.error || null;
      res.locals.info = current.info || null;
      delete req.session.flash;
    }

    next();
  };
};
