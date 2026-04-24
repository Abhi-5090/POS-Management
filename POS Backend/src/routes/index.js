'use strict';

const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/tables', require('./tableRoutes'));
router.use('/sessions', require('./sessionRoutes'));
router.use('/menu', require('./menuRoutes'));
router.use('/orders', require('./orderRoutes'));
router.use('/kots', require('./kotRoutes'));
router.use('/bills', require('./billRoutes'));
router.use('/parcel', require('./parcelRoutes'));
router.use('/reports', require('./reportRoutes'));

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'POS Backend',
      version: '1.0.0',
      endpoints: [
        '/auth',
        '/tables',
        '/sessions',
        '/menu',
        '/orders',
        '/kots',
        '/bills',
        '/parcel',
        '/reports',
      ],
    },
  });
});

module.exports = router;
