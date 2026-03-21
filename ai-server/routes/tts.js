'use strict';

const express = require('express');
const router = express.Router();

// POST /api/tts
router.post('/', (req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'TTS not implemented yet' } });
});

module.exports = router;
