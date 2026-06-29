const express = require('express');
const passService = require('../services/passService');

const router = express.Router();

router.get('/', (req, res) => {
  const fecha = req.query.fecha || passService.todayISO();
  const stats = passService.getDashboardStats(fecha);
  res.render('dashboard', {
    title: 'Panel principal',
    active: 'dashboard',
    fecha,
    stats,
    fmtTime: passService.fmtTime,
  });
});

module.exports = router;
