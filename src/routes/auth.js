const express = require('express');
const authService = require('../services/authService');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.render('login', { title: 'Iniciar sesión', currentUser: null, layout: false });
});

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    req.flash('error', 'Debes ingresar usuario y contraseña.');
    return res.redirect('/login');
  }

  try {
    const user = await authService.authenticate(username.trim(), password);

    if (!user) {
      req.flash('error', 'Usuario o contraseña incorrectos.');
      return res.redirect('/login');
    }

    const redirectTo = req.session.returnTo || '/dashboard';

    req.session.regenerate((err) => {
      if (err) {
        req.flash('error', 'No se pudo iniciar sesión. Inténtalo de nuevo.');
        return res.redirect('/login');
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.name = user.name;
      delete req.session.returnTo;

      res.redirect(redirectTo);
    });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
