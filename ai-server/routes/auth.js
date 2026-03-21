'use strict';

const express = require('express');
const router = express.Router();

// POST /api/auth/sync-user
router.post('/sync-user', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

module.exports = router;
