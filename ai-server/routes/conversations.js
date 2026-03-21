'use strict';

const express = require('express');
const router = express.Router();

// GET /api/conversations
router.get('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

// POST /api/conversations
router.post('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented yet' } });
});

module.exports = router;
