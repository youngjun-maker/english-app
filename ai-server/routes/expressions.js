'use strict';

const express = require('express');
const router = express.Router();

// GET /api/expressions
router.get('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

// POST /api/expressions
router.post('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

// DELETE /api/expressions/:id
router.delete('/:id', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

module.exports = router;
