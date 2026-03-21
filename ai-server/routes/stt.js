'use strict';

const express = require('express');
const router = express.Router();

// POST /api/stt
router.post('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'STT not implemented yet' } });
});

module.exports = router;
