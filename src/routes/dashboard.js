const express = require('express');
const passService = require('../services/passService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const fecha = req.query.fecha || passService.todayISO();
    const stats = await passService.getDashboardStats(fecha);
    res.render('dashboard', {
      title: 'Panel principal',
      active: 'dashboard',
      fecha,
      stats,
      fmtTime: passService.fmtTime,
    });
  } catch (err) { next(err); }
});

module.exports = router;
