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

router.get('/debug-auth', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { User } = require('../config/database');
  const config = require('../config/env');
  try {
    await require('../config/database').connectDb();
    const mongoose = require('mongoose');
    const user = await User.findOne({ username: config.admin.username }).lean();
    const allUsers = await User.find({}, { username: 1 }).lean();
    const passwordWorks = user ? bcrypt.compareSync(config.admin.password, user.password_hash) : false;
    res.json({
      userFound: !!user,
      passwordWorks,
      usernameQueried: config.admin.username,
      passwordLength: config.admin.password ? config.admin.password.length : 0,
      dbName: mongoose.connection.db.databaseName,
      allUsers: allUsers.map(u => u.username),
      mongodbUri: config.mongodbUri ? config.mongodbUri.substring(0, 50) + '...' : 'NOT SET',
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

module.exports = router;
